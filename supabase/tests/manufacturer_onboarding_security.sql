begin;

create temp table manufacturer_onboarding_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table manufacturer_onboarding_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on manufacturer_onboarding_results to authenticated;
grant select, insert on manufacturer_onboarding_results to anon;
grant select on manufacturer_onboarding_subjects to authenticated;

do $$
declare
  manufacturer_id uuid := gen_random_uuid();
  other_manufacturer_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
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
      manufacturer_id,
      'authenticated',
      'authenticated',
      'onboarding-manufacturer-' || manufacturer_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Onboarding Manufacturer","role":"manufacturer"}'::jsonb,
      now(),
      now(),
      false,
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      other_manufacturer_id,
      'authenticated',
      'authenticated',
      'onboarding-other-' || other_manufacturer_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Other Manufacturer","role":"manufacturer"}'::jsonb,
      now(),
      now(),
      false,
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'onboarding-admin-' || admin_id || '@example.test',
      'audit-password-placeholder',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Onboarding Admin","role":"buyer"}'::jsonb,
      now(),
      now(),
      false,
      false
    );

  update public.profiles
  set role = 'admin'
  where id = admin_id;

  insert into manufacturer_onboarding_subjects(subject_name, subject_id)
  values
    ('manufacturer', manufacturer_id),
    ('other_manufacturer', other_manufacturer_id),
    ('admin', admin_id);
end;
$$;

set local role authenticated;

do $$
declare
  manufacturer_id uuid;
  application_id uuid;
  visible_count integer;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers (
    owner_id,
    company_name,
    company_legal_name,
    company_display_name,
    contact_person,
    email,
    country,
    city,
    product_categories,
    company_description,
    application_status
  )
  values (
    manufacturer_id,
    'Audit Modular',
    'Audit Modular Legal Ltd.',
    'Audit Modular',
    'Lin Chen',
    'manufacturer@example.test',
    'China',
    'Shenzhen',
    array['ADU'],
    'Rollback-only onboarding test manufacturer.',
    'submitted'
  )
  returning id into application_id;

  select count(*) into visible_count
  from public.manufacturers;

  insert into manufacturer_onboarding_results
  values (
    'manufacturer can access only own application',
    visible_count = 1,
    'visible applications: ' || visible_count
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    update public.manufacturers
    set application_status = 'approved'
    where owner_id = manufacturer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'manufacturer cannot change approval status',
    blocked,
    case when blocked then 'blocked by trigger/RLS' else 'status update unexpectedly succeeded' end
  );
end;
$$;

do $$
declare
  other_manufacturer_id uuid;
  visible_count integer;
begin
  select subject_id into other_manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'other_manufacturer';

  perform set_config('request.jwt.claim.sub', other_manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into visible_count
  from public.manufacturers;

  insert into manufacturer_onboarding_results
  values (
    'other manufacturer cannot read private application',
    visible_count = 0,
    'visible applications: ' || visible_count
  );
end;
$$;

reset role;
set local role anon;

do $$
declare
  visible_count integer := 0;
  blocked boolean := false;
begin
  begin
    select count(*) into visible_count
    from public.manufacturers;
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'anonymous user cannot access private applications',
    blocked or visible_count = 0,
    case when blocked then 'blocked by permissions/RLS' else 'visible applications: ' || visible_count end
  );
end;
$$;

set local role authenticated;

do $$
declare
  admin_id uuid;
  visible_count integer;
begin
  select subject_id into admin_id
  from manufacturer_onboarding_subjects
  where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into visible_count
  from public.manufacturers;

  update public.manufacturers
  set application_status = 'approved',
      review_notes = 'Approved by rollback-only security verification.'
  where company_name = 'Audit Modular';

  insert into manufacturer_onboarding_results
  values (
    'admin can review all applications',
    visible_count = 1,
    'visible applications before review: ' || visible_count
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  application_id uuid;
  inserted_product_id uuid;
  blocked_before_approval boolean := false;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';

  select id into application_id
  from public.manufacturers
  where owner_id = manufacturer_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    insert into public.products (manufacturer_id, name, category, status)
    values (application_id, 'Unapproved Product', 'ADU', 'draft');
  exception
    when others then
      blocked_before_approval := true;
  end;

  perform set_config(
    'request.jwt.claim.sub',
    (select subject_id::text from manufacturer_onboarding_subjects where subject_name = 'admin'),
    true
  );

  update public.manufacturers
  set application_status = 'approved'
  where id = application_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);

  insert into public.products (manufacturer_id, name, category, status)
  values (application_id, 'Approved Product', 'ADU', 'draft')
  returning id into inserted_product_id;

  insert into manufacturer_onboarding_results
  values (
    'approved manufacturer status is enforced before product creation',
    blocked_before_approval and inserted_product_id is not null,
    'blocked before approval: ' || blocked_before_approval || ', product after approval: ' || coalesce(inserted_product_id::text, 'null')
  );
end;
$$;

select check_name, passed, detail
from manufacturer_onboarding_results
order by check_name;

rollback;
