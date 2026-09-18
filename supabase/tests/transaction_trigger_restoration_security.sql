-- Run only in an authorized rollback transaction after 0037 (or a rolled-back rehearsal).
begin;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
create temp table trigger_security_subjects(name text primary key, id uuid) on commit drop;
grant select, insert on trigger_security_subjects to authenticated;
create function pg_temp.expect_denied(statement_text text, message_fragment text) returns void
language plpgsql as $$
declare denied boolean := false;
begin
  begin execute statement_text;
  exception when others then
    if position(message_fragment in sqlerrm) > 0 then denied := true; else raise; end if;
  end;
  if not denied then raise exception 'Expected rejection: %', statement_text; end if;
end $$;
do $$
declare b uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); company uuid; product uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (b,'trigger-37-buyer-'||b||'@example.test','{"role":"buyer"}'),
    (o,'trigger-37-other-'||o||'@example.test','{"role":"buyer"}'),
    (m,'trigger-37-maker-'||m||'@example.test','{"role":"manufacturer"}'),
    (a,'trigger-37-admin-'||a||'@example.test','{"role":"buyer"}');
  update public.profiles set role='admin' where id=a;
  perform set_config('request.jwt.claim.sub',m::text,true);
  insert into public.manufacturers(owner_id,company_name,country,application_status)
    values(m,'Trigger 0037 fixture','US','draft') returning id into company;
  perform set_config('request.jwt.claim.sub',a::text,true);
  update public.manufacturers set application_status='approved',verification_status='approved' where id=company;
  insert into public.products(manufacturer_id,name,category,status)
    values(company,'Trigger 0037 fixture','ADU','published') returning id into product;
  insert into trigger_security_subjects values('buyer',b),('other',o),('maker',m),('admin',a),('company',company),('product',product);
end $$;
set local role authenticated;
do $$
declare b uuid; o uuid; m uuid; a uuid; product uuid; r uuid; q uuid; po public.purchase_orders; again public.purchase_orders; actor uuid; state text; col text; before_row jsonb;
begin
  select id into b from trigger_security_subjects where name='buyer';
  select id into o from trigger_security_subjects where name='other';
  select id into m from trigger_security_subjects where name='maker';
  select id into a from trigger_security_subjects where name='admin';
  select id into product from trigger_security_subjects where name='product';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  select id into r from public.create_rfq_draft(product,1,'USD','US',null,null,null,'Trigger security regression');
  perform public.submit_rfq(r,1,'USD','US',null,null,null,'Trigger security regression');
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform public.record_rfq_opened(r);
  select id into q from public.create_rfq_quote_draft(r);
  insert into public.rfq_quote_items(quote_id,line_order,item_type,description,quantity,unit_price)
    values(q,1,'product','Trigger regression item',1,100);
  perform public.submit_rfq_quote(q);
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.accept_rfq_quote(q,'Regression acceptance');
  po:=public.create_purchase_order_from_quote(q);
  again:=public.create_purchase_order_from_quote(q);
  if po.id is distinct from again.id or po.buyer_id is distinct from b or po.subtotal<>100 then raise exception 'Accepted Quote/PO identity or idempotency failed'; end if;
  perform public.update_purchase_order_draft(po.id,'ACTIVE','Active fixture',null);
  if (select buyer_reference from public.purchase_orders where id=po.id) is distinct from 'ACTIVE' then raise exception 'Active update failed'; end if;
  foreach actor in array array[o,m,a] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform pg_temp.expect_denied(format('select public.update_purchase_order_draft(%L,''CROSS'',null,null)',po.id),'Only the buyer');
    perform pg_temp.expect_denied(format('select public.create_purchase_order_from_quote(%L)',q),
      case when actor=o then 'not available to this Buyer' else 'active Buyer' end);
  end loop;
  perform set_config('request.jwt.claim.sub',b::text,true);
  foreach col in array array['buyer_id','manufacturer_id','subtotal','status'] loop
    perform pg_temp.expect_denied(
      case col when 'buyer_id' then format('update public.purchase_orders set buyer_id=%L where id=%L',o,po.id)
      when 'manufacturer_id' then format('update public.purchase_orders set manufacturer_id=%L where id=%L',gen_random_uuid(),po.id)
      when 'subtotal' then format('update public.purchase_orders set subtotal=1 where id=%L',po.id)
      else format('update public.purchase_orders set status=''confirmed'' where id=%L',po.id) end,'permission denied');
  end loop;
  foreach state in array array['suspended','pending'] loop
    perform set_config('request.jwt.claim.sub',a::text,true);
    -- Status transitions active->pending are not exposed by the Admin RPC.
    -- Suspended is set by the public RPC; pending is covered in the privileged phase below.
    if state='pending' then continue; end if;
    perform public.admin_set_profile_status(b,state);
    select to_jsonb(p) into before_row from public.purchase_orders p where id=po.id;
    perform set_config('request.jwt.claim.sub',b::text,true);
    perform pg_temp.expect_denied(format('select public.update_purchase_order_draft(%L,''BLOCKED'',''Blocked'',null)',po.id),'trusted RPCs');
    perform pg_temp.expect_denied(format('select public.submit_purchase_order(%L)',po.id),'trusted RPCs');
    perform pg_temp.expect_denied(format('select public.cancel_purchase_order_draft(%L)',po.id),'trusted RPCs');
    perform set_config('request.jwt.claim.sub',a::text,true);
    if (select to_jsonb(p) from public.purchase_orders p where id=po.id) is distinct from before_row then raise exception 'Denied mutation changed PO'; end if;
    perform public.admin_set_profile_status(b,'active');
  end loop;
  insert into trigger_security_subjects values('po',po.id),('quote',q);
end $$;
reset role;
-- A pending fixture is not an account activation/provisioning operation; all rolls back.
do $$ begin
  perform set_config('request.jwt.claim.sub',(select id::text from trigger_security_subjects where name='admin'),true);
  update public.profiles set status='pending' where id=(select id from trigger_security_subjects where name='buyer');
end $$;
set local role authenticated;
do $$ declare b uuid; po uuid; begin
  select id into b from trigger_security_subjects where name='buyer'; select id into po from trigger_security_subjects where name='po';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform pg_temp.expect_denied(format('select public.update_purchase_order_draft(%L,''PENDING'',null,null)',po),'trusted RPCs');
  perform set_config('request.jwt.claim.sub',(select id::text from trigger_security_subjects where name='admin'),true);
  perform public.admin_set_profile_status(b,'active');
end $$;
-- Preserve actual Buyer -> Manufacturer -> Contract -> Signature/Invoice -> Shipping/Logistics flows.
do $$
declare b uuid; m uuid; a uuid; po uuid; c uuid; s uuid; i uuid; shipping uuid; booking uuid;
  address jsonb:='{"address_line1":"1 Test Way","city":"Austin","state_region":"TX","postal_code":"78701","country_code":"US"}';
begin
  select id into b from trigger_security_subjects where name='buyer'; select id into m from trigger_security_subjects where name='maker';
  select id into a from trigger_security_subjects where name='admin'; select id into po from trigger_security_subjects where name='po';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.submit_purchase_order(po);
  perform set_config('request.jwt.claim.sub',a::text,true);
  if not exists(select 1 from public.purchase_orders where id=po) then raise exception 'Admin read failed'; end if;
  perform pg_temp.expect_denied(format('select public.confirm_purchase_order(%L,''Forged'')',po),'assigned manufacturer');
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform public.record_purchase_order_opened(po);
  perform public.request_purchase_order_revision(po,'Revise reference');
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.update_purchase_order_revision(po,'REVISION','Revised',null);
  perform public.resubmit_purchase_order(po);
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform public.record_purchase_order_opened(po);
  perform public.confirm_purchase_order(po,'Confirmed');
  perform set_config('request.jwt.claim.sub',b::text,true);
  select id into c from public.create_contract_from_po(po);
  perform public.update_contract_draft(c,'Trigger regression contract','Texas','Fixture terms');
  perform set_config('request.jwt.claim.sub',a::text,true); perform public.admin_set_profile_status(b,'suspended');
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform pg_temp.expect_denied(format('select public.update_contract_draft(%L,''Blocked'',''Texas'',''Blocked'')',c),'trusted RPCs');
  perform set_config('request.jwt.claim.sub',a::text,true); perform public.admin_set_profile_status(b,'active');
  perform set_config('request.jwt.claim.sub',b::text,true); perform public.mark_contract_ready(c);
  perform set_config('request.jwt.claim.sub',m::text,true); perform public.record_contract_opened(c); perform public.accept_contract(c,'Accepted');
  perform set_config('request.jwt.claim.sub',b::text,true); select id into s from public.create_signature_package(c);
  perform public.update_buyer_signature_participant(s,'Buyer Fixture','buyer@example.test','Owner');
  perform set_config('request.jwt.claim.sub',a::text,true); perform public.admin_set_profile_status(b,'suspended');
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform pg_temp.expect_denied(format('select public.update_buyer_signature_participant(%L,''Blocked'',''buyer@example.test'',''Owner'')',s),'trusted RPCs');
  perform set_config('request.jwt.claim.sub',a::text,true); perform public.admin_set_profile_status(b,'active');
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform public.update_manufacturer_signature_participant(s,'Maker Fixture','maker@example.test','Owner');
  perform set_config('request.jwt.claim.sub',b::text,true); perform public.mark_signature_package_ready(s);
  perform set_config('request.jwt.claim.sub',m::text,true);
  select id into i from public.create_invoice_from_purchase_order(po);
  perform public.update_invoice_draft(i,current_date,current_date+30,'Buyer Fixture','buyer@example.test',address,0,0,0);
  perform public.issue_invoice(i);
  select id into shipping from public.create_shipping_readiness(po);
  perform public.update_shipping_readiness_draft(shipping,'ocean','FOB',address,address,'Fixture cargo',1,100,10,current_date+10,current_date+5,'Fixture');
  perform public.mark_shipping_readiness_ready(shipping);
  select id into booking from public.create_logistics_booking_request(shipping);
  perform public.update_logistics_booking_request_draft(booking,'ocean','FOB',current_date+10,current_date+20,address,address,'not_specified',null,null,'Fixture');
  perform public.submit_logistics_booking_request(booking);
  insert into trigger_security_subjects values('contract',c),('signature',s),('invoice',i),('shipping',shipping),('booking',booking);
end $$;
reset role;
-- For every restored trigger, verify its actual trigger-level rejection rather than
-- mistaking table NOT NULL/FK failures or browser permission denial for trigger enforcement.
do $$
declare spec record; denied boolean; fixture_id uuid; parent_column text; subject text;
begin
  perform set_config('request.jwt.claim.sub',(select id::text from trigger_security_subjects where name='buyer'),true);
  for spec in select * from (values
    ('purchase_orders','Purchase orders must be changed through trusted RPCs.'),
    ('purchase_order_items','Purchase order items are immutable.'),
    ('purchase_order_events','Purchase order events must be generated by trusted flows.'),
    ('purchase_order_decisions','Purchase order decisions must be created by trusted manufacturer decision flows.'),
    ('contracts','Contracts must be changed through trusted RPCs.'),
    ('contract_events','Contract events must be generated by trusted flows.'),
    ('contract_review_decisions','Contract review decisions must be generated by trusted RPCs.'),
    ('signature_packages','Signature packages must be changed through trusted RPCs.'),
    ('signature_participants','Signature participants must be changed through trusted RPCs.'),
    ('signature_package_events','Signature package events must be generated by trusted flows.'),
    ('invoices','Invoices must be changed through trusted RPCs.'),
    ('invoice_line_items','Invoice line items must be created by trusted flows.'),
    ('invoice_events','Invoice events must be generated by trusted flows.'),
    ('shipping_readiness_records','Shipping readiness records are managed through trusted RPCs.'),
    ('shipping_readiness_events','Shipping readiness events are immutable and cannot be changed.'),
    ('logistics_booking_requests','Logistics booking requests are managed through trusted RPCs.'),
    ('logistics_booking_request_events','Logistics booking request events are immutable and cannot be changed.')
  ) as expected(table_name,message) loop
    denied:=false;
    begin execute format('insert into public.%I default values',spec.table_name);
    exception when others then
      if sqlerrm=spec.message then denied:=true; else raise; end if;
    end;
    if not denied then raise exception 'Missing trigger protection on %',spec.table_name; end if;
    subject:=case when spec.table_name like 'purchase_order%' then 'po'
      when spec.table_name like 'contract%' then 'contract'
      when spec.table_name like 'signature%' then 'signature'
      when spec.table_name like 'invoice%' then 'invoice'
      when spec.table_name like 'shipping%' then 'shipping' else 'booking' end;
    parent_column:=case when spec.table_name in ('purchase_orders','contracts','signature_packages','invoices','shipping_readiness_records','logistics_booking_requests') then 'id'
      when subject='po' then 'purchase_order_id' when subject='contract' then 'contract_id'
      when subject='signature' then 'signature_package_id' when subject='invoice' then 'invoice_id'
      when subject='shipping' then 'shipping_readiness_id' else 'booking_request_id' end;
    execute format('select id from public.%I where %I=$1 limit 1',spec.table_name,parent_column)
      into fixture_id using (select id from trigger_security_subjects where name=subject);
    if fixture_id is null then raise exception 'Missing lifecycle fixture: %',spec.table_name; end if;
    denied:=false;
    begin execute format('update public.%I set id=id where id=$1',spec.table_name) using fixture_id;
    exception when others then
      if sqlerrm ~ '(trusted|immutable|cannot be changed)' then denied:=true; else raise; end if;
    end;
    if not denied then raise exception 'Unguarded fixture update: %',spec.table_name; end if;
  end loop;
end $$;
rollback;
select 'PASS: 17 trigger invariants, Buyer authority/forgery, accepted Quote PO idempotency, Manufacturer decisions, Admin reads, Contract/Signature/Invoice/Shipping/Logistics flows; rolled back' as regression;
