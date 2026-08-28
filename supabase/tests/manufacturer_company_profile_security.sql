-- Run after migrations 0001-0033 in an isolated disposable database. Everything rolls back.
begin;

create temp table company_profile_subjects (name text primary key, id uuid not null, manufacturer_id uuid) on commit drop;
grant select on company_profile_subjects to authenticated;

do $$
declare owner_one uuid := gen_random_uuid(); owner_two uuid := gen_random_uuid(); inactive_owner uuid := gen_random_uuid(); unapproved_owner uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid();
begin
  insert into auth.users (id,email,raw_user_meta_data) values
    (owner_one, 'profile-one@example.test', '{"full_name":"One","role":"manufacturer"}'),
    (owner_two, 'profile-two@example.test', '{"full_name":"Two","role":"manufacturer"}'),
    (inactive_owner, 'profile-inactive@example.test', '{"full_name":"Inactive","role":"manufacturer"}'),
    (unapproved_owner, 'profile-unapproved@example.test', '{"full_name":"Unapproved","role":"manufacturer"}'),
    (admin_id, 'profile-admin@example.test', '{"full_name":"Admin","role":"buyer"}');
  update public.profiles set role='admin' where id=admin_id;
  perform set_config('request.jwt.claim.sub', owner_one::text, true);
  insert into public.manufacturers(owner_id,company_name,company_legal_name,company_display_name,contact_person,email,country,city,year_established,export_experience,product_categories,certifications,company_description,application_status)
    values(owner_one,'Original Display','Locked Legal One','Original Display','Original Contact','one@example.test','CA','Toronto',2005,'Reviewed export','{ADU}','{CSA}','Original description','draft');
  perform set_config('request.jwt.claim.sub', owner_two::text, true);
  insert into public.manufacturers(owner_id,company_name,company_legal_name,company_display_name,contact_person,email,country,city,application_status)
    values(owner_two,'Other Display','Locked Legal Two','Other Display','Other Contact','two@example.test','US','Austin','draft');
  perform set_config('request.jwt.claim.sub', inactive_owner::text, true);
  insert into public.manufacturers(owner_id,company_name,company_display_name,contact_person,email,country,city,company_description,application_status)
    values(inactive_owner,'Inactive Display','Inactive Display','Inactive Contact','inactive@example.test','US','Denver','Inactive description','draft');
  perform set_config('request.jwt.claim.sub', unapproved_owner::text, true);
  insert into public.manufacturers(owner_id,company_name,company_display_name,contact_person,email,country,city,company_description,application_status)
    values(unapproved_owner,'Unapproved Display','Unapproved Display','Unapproved Contact','unapproved@example.test','US','Miami','Unapproved description','draft');
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.manufacturers set application_status='approved' where owner_id in(owner_one,owner_two,inactive_owner);
  update public.profiles set status='suspended' where id=inactive_owner;
  insert into company_profile_subjects select 'owner',owner_one,id from public.manufacturers where owner_id=owner_one;
  insert into company_profile_subjects select 'other',owner_two,id from public.manufacturers where owner_id=owner_two;
  insert into company_profile_subjects select 'inactive',inactive_owner,id from public.manufacturers where owner_id=inactive_owner;
  insert into company_profile_subjects select 'unapproved',unapproved_owner,id from public.manufacturers where owner_id=unapproved_owner;
  insert into company_profile_subjects values('admin',admin_id,null);
end $$;

-- Simulate a future accidental owner UPDATE policy. Protected columns must
-- still be rejected by the trigger's independent allowlist.
create policy "company_profile_test_future_owner_update" on public.manufacturers
for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

set local role authenticated;

do $$
declare owner_actor_id uuid; other_actor_id uuid; admin_actor_id uuid; before_other jsonb; after_other jsonb; own_id uuid; directory_row record; affected integer;
begin
  select id,manufacturer_id into owner_actor_id,own_id from company_profile_subjects where name='owner';
  select id into other_actor_id from company_profile_subjects where name='other';
  select id into admin_actor_id from company_profile_subjects where name='admin';
  select to_jsonb(m) into before_other from public.manufacturers m where m.owner_id=other_actor_id;
  perform set_config('request.jwt.claim.sub',owner_actor_id::text,true);
  perform public.update_my_manufacturer_company_profile(
    'Updated Display','Updated public description','https://updated.example','Vancouver','British Columbia',
    'Updated Contact','Director','private.updated@example.test','+1 555 0100','101 Private Way','V1V 1V1'
  );
  if not exists(select 1 from public.manufacturers where id=own_id and company_name='Updated Display' and company_display_name='Updated Display'
    and company_description='Updated public description' and website='https://updated.example' and city='Vancouver' and province='British Columbia'
    and contact_person='Updated Contact' and contact_title='Director' and email='private.updated@example.test' and phone='+1 555 0100'
    and street_address='101 Private Way' and postal_code='V1V 1V1') then raise exception 'allowed fields were not updated'; end if;
  if not exists(select 1 from public.manufacturers where id=own_id and company_legal_name='Locked Legal One' and country='CA' and year_established=2005
    and export_experience='Reviewed export' and product_categories='{ADU}' and certifications='{CSA}' and application_status='approved') then raise exception 'protected fields changed'; end if;
  select * into directory_row from public.buyer_manufacturer_directory where id=own_id;
  if directory_row.display_name <> 'Updated Display' or directory_row.description <> 'Updated public description' or directory_row.city <> 'Vancouver' or directory_row.region <> 'British Columbia' then raise exception 'public changes missing from directory'; end if;
  if to_jsonb(directory_row)::text ~* 'private.updated|555 0100|Private Way|V1V' then raise exception 'private data leaked into directory'; end if;
  update public.manufacturers set company_display_name='Cross-owner forgery' where owner_id=other_actor_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-Manufacturer direct update was not denied'; end if;
  perform set_config('request.jwt.claim.sub',admin_actor_id::text,true);
  select to_jsonb(m) into after_other from public.manufacturers m where m.owner_id=other_actor_id;
  if after_other is distinct from before_other then raise exception 'cross-Manufacturer row changed'; end if;
end $$;

do $$ declare actor uuid; blocked boolean := false;
begin
  select id into actor from company_profile_subjects where name='unapproved'; perform set_config('request.jwt.claim.sub',actor::text,true);
  begin perform public.update_my_manufacturer_company_profile('No','No','https://no.example','No','No','No','No','no@example.test','','',''); exception when others then blocked:=true; end;
  if not blocked then raise exception 'unapproved Manufacturer updated profile'; end if;
end $$;

do $$ declare actor uuid; blocked boolean := false;
begin
  select id into actor from company_profile_subjects where name='inactive'; perform set_config('request.jwt.claim.sub',actor::text,true);
  begin perform public.update_my_manufacturer_company_profile('No','No','https://no.example','No','No','No','No','no@example.test','','',''); exception when others then blocked:=true; end;
  if not blocked then raise exception 'inactive Manufacturer updated profile'; end if;
end $$;

-- With the simulated future owner policy in place, the trigger must still deny
-- every protected/authority-field mutation independently of the RPC.
do $$
declare actor uuid; target uuid; field_name text; blocked boolean; sql text;
begin
  select id,manufacturer_id into actor,target from company_profile_subjects where name='owner'; perform set_config('request.jwt.claim.sub',actor::text,true);
  foreach field_name in array array['company_legal_name','country','year_established','export_experience','product_categories','certifications','owner_id','application_status','review_notes','reviewed_by','reviewed_at','submitted_at','verification_status'] loop
    blocked:=false;
    sql := case field_name
      when 'year_established' then format('update public.manufacturers set year_established=1999 where id=%L',target)
      when 'product_categories' then format('update public.manufacturers set product_categories=''{Forged}'' where id=%L',target)
      when 'certifications' then format('update public.manufacturers set certifications=''{Forged}'' where id=%L',target)
      when 'owner_id' then format('update public.manufacturers set owner_id=%L where id=%L',gen_random_uuid(),target)
      when 'application_status' then format('update public.manufacturers set application_status=''draft'' where id=%L',target)
      when 'reviewed_by' then format('update public.manufacturers set reviewed_by=%L where id=%L',actor,target)
      when 'reviewed_at' then format('update public.manufacturers set reviewed_at=clock_timestamp() + interval ''1 hour'' where id=%L',target)
      when 'submitted_at' then format('update public.manufacturers set submitted_at=now() where id=%L',target)
      when 'verification_status' then format('update public.manufacturers set verification_status=''verified'' where id=%L',target)
      else format('update public.manufacturers set %I=''Forged'' where id=%L',field_name,target) end;
    begin execute sql; exception when others then blocked:=true; end;
    if not blocked then raise exception 'direct update unexpectedly changed %',field_name; end if;
  end loop;
end $$;

do $$ declare admin_id uuid; target uuid;
begin
  select id into admin_id from company_profile_subjects where name='admin'; select manufacturer_id into target from company_profile_subjects where name='owner';
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  update public.manufacturers set application_status='suspended',review_notes='Admin authority preserved' where id=target;
  if not exists(select 1 from public.manufacturers where id=target and application_status='suspended' and reviewed_by=admin_id and review_notes='Admin authority preserved') then raise exception 'Admin suspension authority failed'; end if;
end $$;

rollback;
