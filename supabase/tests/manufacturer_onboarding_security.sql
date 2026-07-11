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
  actual_status text;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers (
    owner_id,
    company_name,
    country,
    application_status
  )
  values (
    manufacturer_id,
    'Incomplete Draft',
    'Unspecified',
    'draft'
  )
  returning id, application_status into application_id, actual_status;

  insert into manufacturer_onboarding_results
  values (
    'incomplete draft can be saved',
    application_id is not null and actual_status = 'draft',
    'status: ' || coalesce(actual_status, 'null')
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  submitted_at_value timestamptz;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set company_legal_name = 'Audit Modular Legal Ltd.',
      company_display_name = 'Audit Modular',
      company_name = 'Audit Modular',
      contact_person = 'Lin Chen',
      email = 'manufacturer@example.test',
      country = 'China',
      city = 'Shenzhen',
      product_categories = array['ADU'],
      company_description = 'Rollback-only onboarding test manufacturer.',
      application_status = 'submitted'
  where owner_id = manufacturer_id
  returning submitted_at into submitted_at_value;

  insert into manufacturer_onboarding_results
  values (
    'existing draft can be submitted',
    submitted_at_value is not null,
    'submitted_at: ' || coalesce(submitted_at_value::text, 'null')
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
    'manufacturer cannot self-approve',
    blocked,
    case when blocked then 'blocked by trigger/RLS' else 'approval unexpectedly succeeded' end
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
    set city = 'Guangzhou'
    where owner_id = manufacturer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'manufacturer cannot edit submitted application',
    blocked,
    case when blocked then 'blocked while submitted' else 'submitted edit unexpectedly succeeded' end
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  admin_id uuid;
  blocked boolean := false;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';
  select subject_id into admin_id
  from manufacturer_onboarding_subjects
  where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set application_status = 'under_review',
      review_notes = 'Review started.'
  where owner_id = manufacturer_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);

  begin
    update public.manufacturers
    set city = 'Foshan'
    where owner_id = manufacturer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'manufacturer cannot edit under_review application',
    blocked,
    case when blocked then 'blocked while under_review' else 'under_review edit unexpectedly succeeded' end
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  admin_id uuid;
  blocked boolean := false;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';
  select subject_id into admin_id
  from manufacturer_onboarding_subjects
  where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set application_status = 'approved',
      review_notes = 'Approved for edit enforcement check.'
  where owner_id = manufacturer_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);

  begin
    update public.manufacturers
    set city = 'Approved Edit Attempt'
    where owner_id = manufacturer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'approved manufacturer cannot edit its application',
    blocked,
    case when blocked then 'blocked while approved' else 'approved edit unexpectedly succeeded' end
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  admin_id uuid;
  blocked boolean := false;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';
  select subject_id into admin_id
  from manufacturer_onboarding_subjects
  where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set application_status = 'suspended',
      review_notes = 'Suspended for edit enforcement check.'
  where owner_id = manufacturer_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);

  begin
    update public.manufacturers
    set city = 'Suspended Edit Attempt'
    where owner_id = manufacturer_id;
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'suspended manufacturer cannot edit its application',
    blocked,
    case when blocked then 'blocked while suspended' else 'suspended edit unexpectedly succeeded' end
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  admin_id uuid;
  first_submitted_at timestamptz;
  second_submitted_at timestamptz;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';
  select subject_id into admin_id
  from manufacturer_onboarding_subjects
  where subject_name = 'admin';

  select submitted_at into first_submitted_at
  from public.manufacturers
  where owner_id = manufacturer_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set application_status = 'rejected',
      review_notes = 'Please revise export documentation.'
  where owner_id = manufacturer_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);

  update public.manufacturers
  set export_experience = 'Ten years exporting modular housing.',
      application_status = 'submitted'
  where owner_id = manufacturer_id
  returning submitted_at into second_submitted_at;

  insert into manufacturer_onboarding_results
  values (
    'rejected application can be resubmitted',
    second_submitted_at is not null and second_submitted_at >= first_submitted_at,
    'first submitted_at: ' || coalesce(first_submitted_at::text, 'null') || ', resubmitted_at: ' || coalesce(second_submitted_at::text, 'null')
  );
end;
$$;

do $$
declare
  manufacturer_id uuid;
  admin_id uuid;
  approved_city text;
  suspended_city text;
begin
  select subject_id into manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'manufacturer';
  select subject_id into admin_id
  from manufacturer_onboarding_subjects
  where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set application_status = 'approved',
      city = 'Admin Approved Edit',
      review_notes = 'Admin edited approved application.'
  where owner_id = manufacturer_id
  returning city into approved_city;

  update public.manufacturers
  set application_status = 'suspended',
      city = 'Admin Suspended Edit',
      review_notes = 'Admin edited suspended application.'
  where owner_id = manufacturer_id
  returning city into suspended_city;

  insert into manufacturer_onboarding_results
  values (
    'admin can edit approved and suspended applications',
    approved_city = 'Admin Approved Edit' and suspended_city = 'Admin Suspended Edit',
    'approved city: ' || coalesce(approved_city, 'null') || ', suspended city: ' || coalesce(suspended_city, 'null')
  );
end;
$$;

do $$
declare
  other_manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into other_manufacturer_id
  from manufacturer_onboarding_subjects
  where subject_name = 'other_manufacturer';

  perform set_config('request.jwt.claim.sub', other_manufacturer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    insert into public.manufacturers (
      owner_id,
      company_name,
      country,
      application_status,
      review_notes
    )
    values (
      other_manufacturer_id,
      'Review Notes Insert',
      'Unspecified',
      'draft',
      'Manufacturer should not set this.'
    );
  exception
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'manufacturer cannot set review_notes on insert',
    blocked,
    case when blocked then 'blocked by trigger/RLS' else 'review_notes insert unexpectedly succeeded' end
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
    insert into public.manufacturers (owner_id, company_name, country, application_status)
    values (manufacturer_id, 'Duplicate Application', 'Unspecified', 'draft');
  exception
    when unique_violation then
      blocked := true;
    when others then
      blocked := true;
  end;

  insert into manufacturer_onboarding_results
  values (
    'duplicate manufacturer application is blocked by unique constraint',
    blocked,
    case when blocked then 'duplicate blocked' else 'duplicate unexpectedly succeeded' end
  );
end;
$$;

do $$
declare
  has_recursive_condition boolean;
begin
  select exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'manufacturers'
      and policyname = 'manufacturers_insert_one_own_application'
      and qual is null
      and with_check ilike '%not exists%'
  )
  into has_recursive_condition;

  insert into manufacturer_onboarding_results
  values (
    'insert policy does not recurse',
    not has_recursive_condition,
    case when has_recursive_condition then 'recursive condition found' else 'no recursive NOT EXISTS found' end
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
    'manufacturer can access only own application',
    visible_count = 0,
    'other manufacturer visible applications: ' || visible_count
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

  perform set_config('request.jwt.claim.sub', (select subject_id::text from manufacturer_onboarding_subjects where subject_name = 'admin'), true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.manufacturers
  set application_status = 'rejected'
  where id = application_id;

  perform set_config('request.jwt.claim.sub', manufacturer_id::text, true);

  begin
    insert into public.products (manufacturer_id, name, category, status)
    values (application_id, 'Unapproved Product', 'ADU', 'draft');
  exception
    when others then
      blocked_before_approval := true;
  end;

  perform set_config('request.jwt.claim.sub', (select subject_id::text from manufacturer_onboarding_subjects where subject_name = 'admin'), true);

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
