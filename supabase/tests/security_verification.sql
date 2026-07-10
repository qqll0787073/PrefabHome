begin;

create temp table security_verification_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table security_verification_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on security_verification_results to authenticated;
grant select on security_verification_subjects to authenticated;

do $$
declare
  buyer_id uuid := gen_random_uuid();
  manufacturer_id uuid := gen_random_uuid();
  admin_metadata_id uuid := gen_random_uuid();
  legitimate_admin_id uuid := gen_random_uuid();
  actual_role text;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      buyer_id,
      'authenticated',
      'authenticated',
      'audit-buyer-' || buyer_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Audit Buyer","role":"buyer"}'::jsonb,
      now(),
      now(),
      false,
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      manufacturer_id,
      'authenticated',
      'authenticated',
      'audit-manufacturer-' || manufacturer_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Audit Manufacturer","role":"manufacturer"}'::jsonb,
      now(),
      now(),
      false,
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      admin_metadata_id,
      'authenticated',
      'authenticated',
      'audit-admin-metadata-' || admin_metadata_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Audit Admin Metadata","role":"admin"}'::jsonb,
      now(),
      now(),
      false,
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      legitimate_admin_id,
      'authenticated',
      'authenticated',
      'audit-legitimate-admin-' || legitimate_admin_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Audit Legitimate Admin","role":"buyer"}'::jsonb,
      now(),
      now(),
      false,
      false
    );

  update public.profiles
  set role = 'admin'
  where id = legitimate_admin_id;

  insert into security_verification_subjects(subject_name, subject_id)
  values
    ('buyer', buyer_id),
    ('manufacturer', manufacturer_id),
    ('admin_metadata', admin_metadata_id),
    ('legitimate_admin', legitimate_admin_id);

  select role into actual_role from public.profiles where id = buyer_id;
  insert into security_verification_results
  values ('signup as buyer creates role=buyer', actual_role = 'buyer', 'actual role: ' || coalesce(actual_role, 'null'));

  select role into actual_role from public.profiles where id = manufacturer_id;
  insert into security_verification_results
  values ('signup as manufacturer creates role=manufacturer', actual_role = 'manufacturer', 'actual role: ' || coalesce(actual_role, 'null'));

  select role into actual_role from public.profiles where id = admin_metadata_id;
  insert into security_verification_results
  values ('signup metadata role=admin does not create an admin', actual_role <> 'admin', 'actual role: ' || coalesce(actual_role, 'null'));
end;
$$;

set local role authenticated;

do $$
declare
  buyer_id uuid;
  blocked boolean := false;
begin
  select subject_id into buyer_id
  from security_verification_subjects
  where subject_name = 'buyer';

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    update public.profiles
    set role = 'admin'
    where id = buyer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into security_verification_results
  values ('buyer cannot update own role', blocked, case when blocked then 'blocked by trigger/RLS' else 'update unexpectedly succeeded' end);
end;
$$;

do $$
declare
  manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into manufacturer_id
  from security_verification_subjects
  where subject_name = 'manufacturer';

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    update public.profiles
    set status = 'suspended'
    where id = manufacturer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into security_verification_results
  values ('manufacturer cannot update own status', blocked, case when blocked then 'blocked by trigger/RLS' else 'update unexpectedly succeeded' end);
end;
$$;

do $$
declare
  buyer_id uuid;
  updated_name text;
begin
  select subject_id into buyer_id
  from security_verification_subjects
  where subject_name = 'buyer';

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.profiles
  set full_name = 'Audit Buyer Updated'
  where id = buyer_id;

  select full_name into updated_name
  from public.profiles
  where id = buyer_id;

  insert into security_verification_results
  values ('normal profile fields can still be updated', updated_name = 'Audit Buyer Updated', 'full_name after update: ' || coalesce(updated_name, 'null'));
end;
$$;

do $$
declare
  buyer_id uuid;
  admin_id uuid;
  actual_role text;
  actual_status text;
begin
  select subject_id into buyer_id
  from security_verification_subjects
  where subject_name = 'buyer';

  select subject_id into admin_id
  from security_verification_subjects
  where subject_name = 'legitimate_admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.profiles
  set role = 'manufacturer',
      status = 'suspended'
  where id = buyer_id;

  select role, status
  into actual_role, actual_status
  from public.profiles
  where id = buyer_id;

  insert into security_verification_results
  values ('legitimate admin update remains possible', actual_role = 'manufacturer' and actual_status = 'suspended', 'role/status after admin update: ' || coalesce(actual_role, 'null') || '/' || coalesce(actual_status, 'null'));
end;
$$;

select check_name, passed, detail
from security_verification_results
order by check_name;

rollback;
