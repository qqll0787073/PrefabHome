-- Run only after migrations 0001-0034 in a disposable database. Everything rolls back.
begin;

create temp table admin_5d1_subjects(name text primary key, id uuid not null, manufacturer_id uuid, product_id uuid) on commit drop;
grant select on admin_5d1_subjects to authenticated;

do $$
declare
  admin_one uuid := gen_random_uuid(); admin_two uuid := gen_random_uuid(); suspended_admin uuid := gen_random_uuid();
  buyer_id uuid := gen_random_uuid(); manufacturer_id uuid := gen_random_uuid(); company_id uuid; product_id uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (admin_one,'admin-one@example.test','{"full_name":"Admin One","role":"buyer"}'),
    (admin_two,'admin-two@example.test','{"full_name":"Admin Two","role":"buyer"}'),
    (suspended_admin,'admin-suspended@example.test','{"full_name":"Suspended Admin","role":"buyer"}'),
    (buyer_id,'buyer@example.test','{"full_name":"Buyer Person","role":"buyer"}'),
    (manufacturer_id,'manufacturer@example.test','{"full_name":"Manufacturer Owner","role":"manufacturer"}');
  update public.profiles set role='admin' where id in (admin_one,admin_two,suspended_admin);
  update public.profiles set status='suspended' where id=suspended_admin;

  perform set_config('request.jwt.claim.sub',manufacturer_id::text,true);
  insert into public.manufacturers(owner_id,company_name,company_display_name,email,phone,street_address,postal_code,country,application_status)
  values(manufacturer_id,'Safe Company','Safe Company','private@company.test','+1 private','1 Private Street','PRIVATE','US','draft') returning id into company_id;
  perform set_config('request.jwt.claim.sub',admin_one::text,true);
  update public.manufacturers set application_status='approved' where id=company_id;
  perform set_config('request.jwt.claim.sub',manufacturer_id::text,true);
  insert into public.products(manufacturer_id,name,category,status) values(company_id,'Review Product','ADU','submitted') returning id into product_id;
  insert into admin_5d1_subjects values
    ('admin-one',admin_one,null,null),('admin-two',admin_two,null,null),('suspended-admin',suspended_admin,null,null),
    ('buyer',buyer_id,null,null),('manufacturer',manufacturer_id,company_id,product_id);
end $$;

set local role authenticated;

do $$
declare a uuid; listed record; summary record;
begin
  select id into a from admin_5d1_subjects where name='admin-one'; perform set_config('request.jwt.claim.sub',a::text,true);
  select * into listed from public.admin_list_users('safe company','manufacturer','active',10,0);
  if listed.profile_role <> 'manufacturer' or listed.manufacturer_name <> 'Safe Company' or listed.total_count <> 1 then raise exception 'curated search/filter listing failed'; end if;
  if to_jsonb(listed)::text ~* 'private@company|private street|\\+1 private|postal|review_notes|password|token' then raise exception 'private data leaked from Admin listing'; end if;
  if (select count(*) from public.admin_list_users(null,null,null,2,0)) <> 2 or (select count(*) from public.admin_list_users(null,null,null,2,2)) <> 2 then raise exception 'deterministic pagination failed'; end if;
  select * into summary from public.admin_dashboard_summary();
  if summary.total_users <> 5 or summary.active_admins <> 2 or summary.suspended_users <> 1 then raise exception 'dashboard aggregation failed'; end if;
end $$;

-- Preserve the complete migration 0031 Manufacturer authority contract.
reset role;
create temp table manufacturer_authority_subjects(name text primary key, id uuid not null, manufacturer_id uuid, rfq_id uuid) on commit drop;
grant select on manufacturer_authority_subjects to authenticated;
do $$
declare admin_id uuid; buyer_id uuid; owner_id uuid; approved_company uuid; other_owner uuid := gen_random_uuid(); other_company uuid; rfq_product uuid; rfq_row public.rfqs;
begin
  select id into admin_id from admin_5d1_subjects where name='admin-one';
  select id into buyer_id from admin_5d1_subjects where name='buyer';
  select id,manufacturer_id into owner_id,approved_company from admin_5d1_subjects where name='manufacturer';
  insert into auth.users(id,email,raw_user_meta_data) values(other_owner,'authority-other@example.test','{"full_name":"Other Manufacturer","role":"manufacturer"}');
  perform set_config('request.jwt.claim.sub',other_owner::text,true);
  insert into public.manufacturers(owner_id,company_name,country,application_status) values(other_owner,'Other Draft Company','US','draft') returning id into other_company;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  insert into public.products(manufacturer_id,name,category,status) values(approved_company,'Authority RFQ Product','ADU','published') returning id into rfq_product;
  perform set_config('request.jwt.claim.sub',buyer_id::text,true);
  rfq_row := public.create_rfq_draft(rfq_product,1,'USD','US',null,null,null,'Authority regression');
  rfq_row := public.submit_rfq(rfq_row.id,1,'USD','US',null,null,null,'Authority regression');
  insert into manufacturer_authority_subjects values('owner',owner_id,approved_company,rfq_row.id),('other',other_owner,other_company,null);
end $$;
set local role authenticated;

do $$
declare admin_id uuid; owner_id uuid; company_id uuid; other_company uuid; target_rfq uuid; application_state text; blocked boolean;
begin
  select id into admin_id from admin_5d1_subjects where name='admin-one';
  select id,manufacturer_id,rfq_id into owner_id,company_id,target_rfq from manufacturer_authority_subjects where name='owner';
  select manufacturer_id into other_company from manufacturer_authority_subjects where name='other';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if not public.owns_manufacturer(company_id) then raise exception 'active approved Manufacturer was not authorized'; end if;
  if public.owns_manufacturer(other_company) then raise exception 'cross-Manufacturer ownership was authorized'; end if;

  foreach application_state in array array['draft','submitted','under_review','rejected','suspended'] loop
    perform set_config('request.jwt.claim.sub',admin_id::text,true);
    update public.manufacturers set application_status=application_state where id=company_id;
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    if public.owns_manufacturer(company_id) then raise exception 'unapproved application status % retained Manufacturer authority',application_state; end if;
    if application_state='draft' then
      blocked:=false;
      begin perform public.record_rfq_opened(target_rfq); exception when others then blocked:=true; end;
      perform set_config('request.jwt.claim.sub',admin_id::text,true);
      if not blocked or (select status from public.rfqs where id=target_rfq) is distinct from 'submitted' then raise exception 'unapproved Manufacturer opened protected RFQ'; end if;
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  update public.manufacturers set application_status='approved' where id=company_id;
  perform public.admin_set_profile_status(owner_id,'suspended');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if public.owns_manufacturer(company_id) then raise exception 'suspended profile retained approved Manufacturer authority'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.admin_set_profile_status(owner_id,'active');
end $$;

do $$
declare actor uuid; target uuid; before_row jsonb; after_row jsonb;
begin
  select id into actor from admin_5d1_subjects where name='admin-one'; select id into target from admin_5d1_subjects where name='admin-two';
  perform set_config('request.jwt.claim.sub',actor::text,true); select to_jsonb(p) into before_row from public.profiles p where id=target;
  perform public.admin_set_profile_status(target,'suspended');
  select to_jsonb(p) into after_row from public.profiles p where id=target;
  if after_row->>'status' <> 'suspended' or after_row->>'role' <> before_row->>'role' or after_row->>'id' <> before_row->>'id' or after_row->>'email' <> before_row->>'email' then raise exception 'status RPC changed protected identity fields'; end if;
  perform public.admin_set_profile_status(target,'active');
  begin perform public.admin_set_profile_status(actor,'suspended'); raise exception 'self-suspension succeeded'; exception when insufficient_privilege then null; end;
  if not exists(select 1 from public.profiles where id=actor and status='active') then raise exception 'self-suspension changed active Admin'; end if;
end $$;

do $$
declare actor uuid; blocked boolean;
begin
  foreach actor in array array[(select id from admin_5d1_subjects where name='buyer'),(select id from admin_5d1_subjects where name='manufacturer'),(select id from admin_5d1_subjects where name='suspended-admin')] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    blocked:=false; begin perform public.admin_dashboard_summary(); exception when insufficient_privilege then blocked:=true; end; if not blocked then raise exception 'non-active Admin used dashboard'; end if;
    blocked:=false; begin perform public.admin_list_users(); exception when insufficient_privilege then blocked:=true; end; if not blocked then raise exception 'non-active Admin listed users'; end if;
    blocked:=false; begin perform public.admin_set_profile_status(actor,'active'); exception when insufficient_privilege then blocked:=true; end; if not blocked then raise exception 'non-active Admin changed status'; end if;
  end loop;
end $$;

do $$
declare suspended_id uuid; company uuid; product uuid; affected integer; blocked boolean;
begin
  select id into suspended_id from admin_5d1_subjects where name='suspended-admin'; select manufacturer_id,product_id into company,product from admin_5d1_subjects where name='manufacturer';
  perform set_config('request.jwt.claim.sub',suspended_id::text,true);
  update public.manufacturers set application_status='suspended' where id=company; get diagnostics affected=row_count; if affected <> 0 then raise exception 'suspended Admin retained Manufacturer review authority'; end if;
  update public.products set status='published' where id=product; get diagnostics affected=row_count; if affected <> 0 then raise exception 'suspended Admin retained Product review authority'; end if;
  blocked:=false; begin perform public.admin_list_logistics_provider_candidates(null); exception when others then blocked:=true; end; if not blocked then raise exception 'suspended Admin retained Logistics authority'; end if;
end $$;

do $$
declare admin_id uuid; buyer uuid; manufacturer uuid; blocked boolean;
begin
  select id into admin_id from admin_5d1_subjects where name='admin-one'; select id into buyer from admin_5d1_subjects where name='buyer'; select id into manufacturer from admin_5d1_subjects where name='manufacturer';
  perform set_config('request.jwt.claim.sub',admin_id::text,true); perform public.admin_set_profile_status(buyer,'suspended'); perform public.admin_set_profile_status(manufacturer,'suspended');
  perform set_config('request.jwt.claim.sub',buyer::text,true); blocked:=false;
  begin perform public.update_my_buyer_profile('Blocked Buyer'); exception when others then blocked:=true; end; if not blocked then raise exception 'suspended Buyer retained protected profile authority'; end if;
  perform set_config('request.jwt.claim.sub',manufacturer::text,true); blocked:=false;
  begin perform public.update_my_manufacturer_company_profile('Blocked',null,null,null,null,null,null,null,null,null,null); exception when others then blocked:=true; end; if not blocked then raise exception 'suspended Manufacturer retained company authority'; end if;
end $$;

set local role anon;
do $$ declare blocked boolean := false; begin
  begin perform public.admin_dashboard_summary(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'anonymous caller used Admin summary'; end if;
end $$;
set local role authenticated;

-- Active Admin review authority remains intact.
do $$
declare admin_id uuid; company uuid; product uuid;
begin
  select id into admin_id from admin_5d1_subjects where name='admin-one'; select manufacturer_id,product_id into company,product from admin_5d1_subjects where name='manufacturer';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  update public.manufacturers set application_status='under_review' where id=company;
  update public.products set status='published' where id=product;
  if not exists(select 1 from public.manufacturers where id=company and reviewed_by=admin_id) or not exists(select 1 from public.products where id=product and status='published' and reviewed_by=admin_id) then raise exception 'active Admin review authority regressed'; end if;
end $$;

do $$
declare buyer uuid; blocked boolean := false;
begin
  select id into buyer from admin_5d1_subjects where name='buyer'; perform set_config('request.jwt.claim.sub',buyer::text,true);
  begin execute format('update public.profiles set status=''active'' where id=%L',buyer); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'direct authenticated profile UPDATE was restored'; end if;
end $$;

reset role;
do $$
declare requested uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data) values(requested,'requested-admin@example.test','{"role":"admin"}');
  if (select role from public.profiles where id=requested)='admin' then raise exception 'signup metadata created Admin authority'; end if;
end $$;

rollback;
