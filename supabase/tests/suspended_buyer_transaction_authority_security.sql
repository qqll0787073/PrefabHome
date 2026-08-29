-- Sprint 5D.2 active Buyer transaction-authority regression.
begin;

create temp table buyer_5d2_subjects(name text primary key, id uuid not null, manufacturer_id uuid, po_id uuid) on commit drop;
grant select on buyer_5d2_subjects to authenticated, anon;

do $$
declare
  buyer uuid := gen_random_uuid(); other_buyer uuid := gen_random_uuid(); manufacturer_owner uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid();
  manufacturer uuid; product uuid; rfq uuid; quote uuid; decision uuid; po uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (buyer,'buyer-5d2@example.test','{"full_name":"Buyer 5D2","role":"buyer"}'),
    (other_buyer,'other-buyer-5d2@example.test','{"full_name":"Other Buyer","role":"buyer"}'),
    (manufacturer_owner,'manufacturer-5d2@example.test','{"full_name":"Manufacturer","role":"manufacturer"}'),
    (admin_id,'admin-5d2@example.test','{"full_name":"Admin","role":"buyer"}');
  update public.profiles set role='admin' where id=admin_id;
  perform set_config('request.jwt.claim.sub',manufacturer_owner::text,true);
  insert into public.manufacturers(owner_id,company_name,country,application_status) values(manufacturer_owner,'5D2 Manufacturer','US','draft') returning id into manufacturer;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  update public.manufacturers set application_status='approved' where id=manufacturer;
  insert into public.products(manufacturer_id,name,category,status) values(manufacturer,'5D2 Product','ADU','published') returning id into product;

  -- Fixture construction is privileged and trigger-free; protected behavior below runs as authenticated callers.
  set local session_replication_role = replica;
  insert into public.rfqs(id,buyer_id,manufacturer_id,product_id,product_snapshot,status,requested_quantity,requested_currency,destination_country)
    values(gen_random_uuid(),buyer,manufacturer,product,'{"name":"5D2 Product"}','accepted',1,'USD','US') returning id into rfq;
  insert into public.rfq_quotes(id,rfq_id,manufacturer_id,version,status,currency,unit_price,quantity,subtotal,created_by,submitted_at)
    values(gen_random_uuid(),rfq,manufacturer,1,'accepted','USD',100,1,100,manufacturer_owner,now()) returning id into quote;
  insert into public.rfq_quote_items(quote_id,line_order,item_type,description,quantity,unit_price) values(quote,1,'product','5D2 Product',1,100);
  insert into public.rfq_quote_decisions(rfq_id,quote_id,buyer_id,decision) values(rfq,quote,buyer,'accepted') returning id into decision;
  insert into public.purchase_orders(po_number,rfq_id,quote_id,quote_decision_id,buyer_id,manufacturer_id,status,currency,subtotal,quote_snapshot,buyer_snapshot,manufacturer_snapshot,product_snapshot,created_by)
    values('PO-5D2-000001',rfq,quote,decision,buyer,manufacturer,'draft','USD',100,'{}','{}','{}','{}',buyer) returning id into po;
  set local session_replication_role = origin;
  insert into buyer_5d2_subjects values('buyer',buyer,manufacturer,po),('other',other_buyer,null,null),('manufacturer',manufacturer_owner,manufacturer,null),('admin',admin_id,null,null);
end $$;

set local role authenticated;

-- Representative end-to-end: active -> suspended -> denied unchanged -> active.
do $$
declare buyer uuid; admin_id uuid; po uuid; before_row jsonb; after_row jsonb; before_events bigint; blocked boolean;
begin
  select id,po_id into buyer,po from buyer_5d2_subjects where name='buyer';
  select id into admin_id from buyer_5d2_subjects where name='admin';
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  perform public.update_purchase_order_draft(po,'ACTIVE-ONE','Active update',null);
  if (select buyer_reference from public.purchase_orders where id=po) <> 'ACTIVE-ONE' then raise exception 'active Buyer update failed'; end if;

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.admin_set_profile_status(buyer,'suspended');
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  select to_jsonb(p), (select count(*) from public.purchase_order_events where purchase_order_id=po) into before_row,before_events from public.purchase_orders p where id=po;
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  blocked:=false; begin perform public.update_purchase_order_draft(po,'BLOCKED','Must not persist',null); exception when others then blocked:=true; end;
  if not blocked then raise exception 'suspended Buyer updated Purchase Order'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  select to_jsonb(p) into after_row from public.purchase_orders p where id=po;
  if after_row is distinct from before_row or (select count(*) from public.purchase_order_events where purchase_order_id=po) <> before_events then
    raise exception 'state changed after denied operation';
  end if;
  perform public.admin_set_profile_status(buyer,'active');
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  perform public.update_purchase_order_draft(po,'ACTIVE-TWO','Restored update',null);
  if (select buyer_reference from public.purchase_orders where id=po) <> 'ACTIVE-TWO' then raise exception 'restored active Buyer authority failed'; end if;
end $$;

-- Other active Buyer, Admin, Manufacturer, and anonymous callers gain no Buyer mutation authority.
do $$
declare po uuid; actor uuid; actor_name text; blocked boolean;
begin
  select po_id into po from buyer_5d2_subjects where name='buyer';
  foreach actor_name in array array['other','admin','manufacturer'] loop
    select id into actor from buyer_5d2_subjects where name=actor_name;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    blocked:=false; begin perform public.update_purchase_order_draft(po,'CROSS','Denied',null); exception when others then blocked:=true; end;
    if not blocked then raise exception '% gained Buyer PO mutation authority',actor_name; end if;
  end loop;
end $$;
set local role anon;
do $$ declare po uuid; blocked boolean:=false; begin
  select po_id into po from buyer_5d2_subjects where name='buyer';
  begin perform public.update_purchase_order_draft(po,'ANON','Denied',null); exception when others then blocked:=true; end;
  if not blocked then raise exception 'anonymous gained Buyer PO mutation authority'; end if;
end $$;
set local role authenticated;

-- Every audited RPC below writes through one of these trusted trigger boundaries:
-- update_purchase_order_draft, submit_purchase_order, cancel_purchase_order_draft,
-- update_purchase_order_revision, resubmit_purchase_order;
-- update_contract_draft, mark_contract_ready, update_contract_revision, resubmit_contract;
-- update_buyer_signature_participant, mark_signature_package_ready;
-- create_signature_delivery_request, queue_signature_delivery_request, cancel_signature_delivery_request.
-- These internal helpers are temporarily executable only inside this rolled-back test transaction.
reset role;
grant execute on function public.is_trusted_purchase_order_write() to authenticated;
grant execute on function public.is_trusted_contract_write() to authenticated;
grant execute on function public.is_trusted_signature_preparation_write() to authenticated;
grant execute on function public.is_trusted_signature_delivery_write() to authenticated;
set local role authenticated;
do $$
declare buyer uuid; admin_id uuid;
begin
  select id into buyer from buyer_5d2_subjects where name='buyer'; select id into admin_id from buyer_5d2_subjects where name='admin';
  perform set_config('request.jwt.claim.sub',admin_id::text,true); perform public.admin_set_profile_status(buyer,'suspended');
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  perform set_config('app.purchase_order_trusted_write','on',true);
  if public.is_trusted_purchase_order_write() then raise exception 'suspended Buyer passed PO trusted-write boundary'; end if;
  perform set_config('app.contract_trusted_write','on',true);
  if public.is_trusted_contract_write() then raise exception 'suspended Buyer passed Contract trusted-write boundary'; end if;
  perform set_config('app.signature_preparation_trusted_write','on',true);
  if public.is_trusted_signature_preparation_write() then raise exception 'suspended Buyer passed signature preparation boundary'; end if;
  perform set_config('app.signature_delivery_trusted_write','on',true);
  if public.is_trusted_signature_delivery_write() then raise exception 'suspended Buyer passed signature delivery boundary'; end if;
  if public.is_active_buyer() then raise exception 'suspended Buyer retained active Buyer authority'; end if;
end $$;

-- Suspended Buyer loses private participant reads; active Admin and assigned Manufacturer retain existing reads.
do $$
declare buyer uuid; admin_id uuid; manufacturer_owner uuid; po uuid;
begin
  select id,po_id into buyer,po from buyer_5d2_subjects where name='buyer';
  select id into admin_id from buyer_5d2_subjects where name='admin'; select id into manufacturer_owner from buyer_5d2_subjects where name='manufacturer';
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  if exists(select 1 from public.purchase_orders where id=po) or public.can_access_purchase_order(po) then raise exception 'suspended Buyer retained private PO read'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  if not exists(select 1 from public.purchase_orders where id=po) then raise exception 'active Admin read authority regressed'; end if;
  perform set_config('request.jwt.claim.sub',manufacturer_owner::text,true);
  if not exists(select 1 from public.purchase_orders where id=po) then raise exception 'approved Manufacturer read authority regressed'; end if;
end $$;

rollback;
