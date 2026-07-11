begin;

create temp table product_database_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table product_database_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on product_database_results to authenticated;
grant select, insert on product_database_results to anon;
grant select, insert on product_database_subjects to authenticated;
grant select on product_database_subjects to anon;

do $$
declare
  unapproved_owner_id uuid := gen_random_uuid();
  approved_owner_id uuid := gen_random_uuid();
  other_owner_id uuid := gen_random_uuid();
  buyer_id uuid := gen_random_uuid();
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
    ('00000000-0000-0000-0000-000000000000', unapproved_owner_id, 'authenticated', 'authenticated', 'product-unapproved-' || unapproved_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Product Unapproved","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', approved_owner_id, 'authenticated', 'authenticated', 'product-approved-' || approved_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Product Approved","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_owner_id, 'authenticated', 'authenticated', 'product-other-' || other_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Product Other","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'product-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Product Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'product-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Product Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles
  set role = 'admin'
  where id = admin_id;

  insert into product_database_subjects(subject_name, subject_id)
  values
    ('unapproved_owner', unapproved_owner_id),
    ('approved_owner', approved_owner_id),
    ('other_owner', other_owner_id),
    ('buyer', buyer_id),
    ('admin', admin_id);
end;
$$;

set local role authenticated;

do $$
declare
  unapproved_owner_id uuid;
  approved_owner_id uuid;
  other_owner_id uuid;
  admin_id uuid;
  unapproved_manufacturer_id uuid;
  approved_manufacturer_id uuid;
  other_manufacturer_id uuid;
begin
  select subject_id into unapproved_owner_id from product_database_subjects where subject_name = 'unapproved_owner';
  select subject_id into approved_owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into other_owner_id from product_database_subjects where subject_name = 'other_owner';
  select subject_id into admin_id from product_database_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', unapproved_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.manufacturers(owner_id, company_name, country, application_status)
  values (unapproved_owner_id, 'Unapproved Product Factory', 'China', 'draft')
  returning id into unapproved_manufacturer_id;

  perform set_config('request.jwt.claim.sub', approved_owner_id::text, true);
  insert into public.manufacturers(owner_id, company_name, country, application_status)
  values (approved_owner_id, 'Approved Product Factory', 'China', 'submitted')
  returning id into approved_manufacturer_id;

  perform set_config('request.jwt.claim.sub', other_owner_id::text, true);
  insert into public.manufacturers(owner_id, company_name, country, application_status)
  values (other_owner_id, 'Other Product Factory', 'China', 'submitted')
  returning id into other_manufacturer_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.manufacturers
  set application_status = 'approved',
      review_notes = 'Approved for product security verification.'
  where id in (approved_manufacturer_id, other_manufacturer_id);

  insert into product_database_subjects(subject_name, subject_id)
  values
    ('unapproved_manufacturer', unapproved_manufacturer_id),
    ('approved_manufacturer', approved_manufacturer_id),
    ('other_manufacturer', other_manufacturer_id);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'unapproved_owner';
  select subject_id into manufacturer_id from product_database_subjects where subject_name = 'unapproved_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.products(manufacturer_id, name, model_name, category, status)
    values (manufacturer_id, 'Unapproved Draft', 'Unapproved Draft', 'ADU', 'draft');
  exception when others then
    blocked := true;
  end;

  insert into product_database_results values ('unapproved manufacturer cannot create product', blocked, case when blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_database_subjects where subject_name = 'approved_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.products(manufacturer_id, name, model_name, sku, slug, category, status, fob_price, floor_area_sq_ft)
  values (manufacturer_id, 'Own Draft', 'Own Draft', 'SKU-1', 'own-draft-' || manufacturer_id, 'ADU', 'draft', 100, 400)
  returning id into product_id;

  insert into product_database_subjects values ('own_product', product_id);
  insert into product_database_results values ('approved manufacturer can create own draft', product_id is not null, 'product: ' || coalesce(product_id::text, 'null'));
end;
$$;

do $$
declare
  owner_id uuid;
  other_manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into other_manufacturer_id from product_database_subjects where subject_name = 'other_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.products(manufacturer_id, name, model_name, category, status)
    values (other_manufacturer_id, 'Wrong Owner Draft', 'Wrong Owner Draft', 'ADU', 'draft');
  exception when others then
    blocked := true;
  end;

  insert into product_database_results values ('manufacturer cannot create product for another manufacturer', blocked, case when blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

do $$
declare
  owner_id uuid;
  product_id uuid;
  updated_name text;
  old_updated_at timestamptz;
  new_updated_at timestamptz;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into product_id from product_database_subjects where subject_name = 'own_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  select updated_at into old_updated_at from public.products where id = product_id;
  perform pg_sleep(0.01);
  update public.products
  set model_name = 'Own Draft Updated',
      name = 'Own Draft Updated'
  where id = product_id
  returning model_name, updated_at into updated_name, new_updated_at;

  insert into product_database_results values ('manufacturer can edit own draft', updated_name = 'Own Draft Updated', 'name: ' || coalesce(updated_name, 'null'));
  insert into product_database_results values ('updated_at changes on valid update', new_updated_at > old_updated_at, 'old: ' || old_updated_at || ', new: ' || new_updated_at);
end;
$$;

do $$
declare
  owner_id uuid;
  product_id uuid;
  submitted_at_value timestamptz;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into product_id from product_database_subjects where subject_name = 'own_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  update public.products
  set status = 'submitted'
  where id = product_id
  returning submitted_at into submitted_at_value;

  insert into product_database_results values ('manufacturer can submit own draft', submitted_at_value is not null, 'submitted_at: ' || coalesce(submitted_at_value::text, 'null'));
end;
$$;

do $$
declare
  owner_id uuid;
  product_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into product_id from product_database_subjects where subject_name = 'own_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    update public.products set model_name = 'Submitted Edit' where id = product_id;
  exception when others then
    blocked := true;
  end;

  insert into product_database_results values ('manufacturer cannot edit submitted product', blocked, case when blocked then 'blocked' else 'unexpectedly edited' end);
end;
$$;

do $$
declare
  owner_id uuid;
  product_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into product_id from product_database_subjects where subject_name = 'own_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    update public.products set status = 'published' where id = product_id;
  exception when others then
    blocked := true;
  end;

  insert into product_database_results values ('manufacturer cannot self-publish', blocked, case when blocked then 'blocked' else 'unexpectedly published' end);
end;
$$;

do $$
declare
  owner_id uuid;
  product_id uuid;
  other_manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into product_id from product_database_subjects where subject_name = 'own_product';
  select subject_id into other_manufacturer_id from product_database_subjects where subject_name = 'other_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    update public.products set manufacturer_id = other_manufacturer_id where id = product_id;
  exception when others then
    blocked := true;
  end;

  insert into product_database_results values ('manufacturer cannot change manufacturer_id', blocked, case when blocked then 'blocked' else 'unexpectedly changed' end);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  other_private_product_id uuid;
  other_published_product_id uuid;
  visible_private_count integer;
  visible_published_count integer;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'other_owner';
  select subject_id into manufacturer_id from product_database_subjects where subject_name = 'other_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.products(manufacturer_id, name, model_name, sku, slug, category, status)
  values (manufacturer_id, 'Other Private Draft', 'Other Private Draft', 'SKU-2', 'other-private-' || manufacturer_id, 'ADU', 'draft')
  returning id into other_private_product_id;

  insert into public.products(manufacturer_id, name, model_name, sku, slug, category, status)
  values (manufacturer_id, 'Other Submitted', 'Other Submitted', 'SKU-3', 'other-submitted-' || manufacturer_id, 'ADU', 'submitted')
  returning id into other_published_product_id;

  perform set_config('request.jwt.claim.sub', (select subject_id::text from product_database_subjects where subject_name = 'admin'), true);
  update public.products set status = 'published' where id = other_published_product_id;

  perform set_config('request.jwt.claim.sub', (select subject_id::text from product_database_subjects where subject_name = 'approved_owner'), true);
  select count(*) into visible_private_count from public.products where id = other_private_product_id;
  select count(*) into visible_published_count from public.products where id = other_published_product_id;

  insert into product_database_subjects values ('other_private_product', other_private_product_id);
  insert into product_database_subjects values ('other_published_product', other_published_product_id);
  insert into product_database_results values ('manufacturer cannot read another manufacturer private draft', visible_private_count = 0, 'visible private: ' || visible_private_count);
  insert into product_database_results values ('manufacturer can read another manufacturer published product', visible_published_count = 1, 'visible published: ' || visible_published_count);
end;
$$;

do $$
declare
  buyer_id uuid;
  private_id uuid;
  published_id uuid;
  buyer_visible_private integer;
  buyer_visible_published integer;
begin
  select subject_id into buyer_id from product_database_subjects where subject_name = 'buyer';
  select subject_id into private_id from product_database_subjects where subject_name = 'other_private_product';
  select subject_id into published_id from product_database_subjects where subject_name = 'other_published_product';
  perform set_config('request.jwt.claim.sub', buyer_id::text, true);

  select count(*) into buyer_visible_private from public.products where id = private_id;
  select count(*) into buyer_visible_published from public.products where id = published_id;

  insert into product_database_results values ('buyer can read published product only', buyer_visible_private = 0 and buyer_visible_published = 1, 'private: ' || buyer_visible_private || ', published: ' || buyer_visible_published);
end;
$$;

reset role;
set local role anon;

do $$
declare
  private_id uuid;
  published_id uuid;
  anon_visible_private integer;
  anon_visible_published integer;
begin
  select subject_id into private_id from product_database_subjects where subject_name = 'other_private_product';
  select subject_id into published_id from product_database_subjects where subject_name = 'other_published_product';

  select count(*) into anon_visible_private from public.products where id = private_id;
  select count(*) into anon_visible_published from public.products where id = published_id;

  insert into product_database_results values ('anonymous user can read published product only', anon_visible_private = 0 and anon_visible_published = 1, 'private: ' || anon_visible_private || ', published: ' || anon_visible_published);
end;
$$;

set local role authenticated;

do $$
declare
  admin_id uuid;
  visible_count integer;
  product_id uuid;
  published_at_value timestamptz;
  rejected_status text;
begin
  select subject_id into admin_id from product_database_subjects where subject_name = 'admin';
  select subject_id into product_id from product_database_subjects where subject_name = 'own_product';
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into visible_count from public.products;
  update public.products set status = 'published', review_notes = 'Published in verification.' where id = product_id returning published_at into published_at_value;
  update public.products set status = 'submitted' where id = product_id;
  update public.products set status = 'rejected', review_notes = 'Rejected in verification.' where id = product_id returning status into rejected_status;

  insert into product_database_results values ('admin can review all products', visible_count >= 3, 'visible products: ' || visible_count);
  insert into product_database_results values ('admin can publish submitted product', published_at_value is not null, 'published_at: ' || coalesce(published_at_value::text, 'null'));
  insert into product_database_results values ('published_at is set on publication', published_at_value is not null, 'published_at: ' || coalesce(published_at_value::text, 'null'));
  insert into product_database_results values ('admin can reject submitted product', rejected_status = 'rejected', 'status: ' || coalesce(rejected_status, 'null'));
end;
$$;

do $$
declare
  admin_id uuid;
  product_id uuid;
begin
  select subject_id into admin_id from product_database_subjects where subject_name = 'admin';
  select subject_id into product_id from product_database_subjects where subject_name = 'other_published_product';
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.products set status = 'archived' where id = product_id;
end;
$$;

reset role;
set local role anon;

do $$
declare
  product_id uuid;
  public_visible_count integer;
begin
  select subject_id into product_id from product_database_subjects where subject_name = 'other_published_product';

  select count(*) into public_visible_count from public.products where id = product_id;

  insert into product_database_results values ('archived products are hidden from public queries', public_visible_count = 0, 'public visible archived: ' || public_visible_count);
end;
$$;

set local role authenticated;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  duplicate_blocked boolean := false;
  different_manufacturer_product_id uuid;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_database_subjects where subject_name = 'approved_manufacturer';
  select subject_id into other_manufacturer_id from product_database_subjects where subject_name = 'other_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.products(manufacturer_id, name, model_name, sku, slug, category, status)
    values (manufacturer_id, 'Duplicate SKU', 'Duplicate SKU', 'SKU-1', 'duplicate-sku-' || manufacturer_id, 'ADU', 'draft');
  exception when others then
    duplicate_blocked := true;
  end;

  perform set_config('request.jwt.claim.sub', (select subject_id::text from product_database_subjects where subject_name = 'other_owner'), true);
  insert into public.products(manufacturer_id, name, model_name, sku, slug, category, status)
  values (other_manufacturer_id, 'Same SKU Other Manufacturer', 'Same SKU Other Manufacturer', 'SKU-1', 'same-sku-other-' || other_manufacturer_id, 'ADU', 'draft')
  returning id into different_manufacturer_product_id;

  insert into product_database_results values ('duplicate SKU per manufacturer is blocked', duplicate_blocked, case when duplicate_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_database_results values ('same SKU for different manufacturers is allowed', different_manufacturer_product_id is not null, 'product: ' || coalesce(different_manufacturer_product_id::text, 'null'));
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  negative_blocked boolean := false;
  invalid_transition_blocked boolean := false;
begin
  select subject_id into owner_id from product_database_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_database_subjects where subject_name = 'approved_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.products(manufacturer_id, name, model_name, category, status, fob_price, floor_area_sq_ft)
    values (manufacturer_id, 'Negative Product', 'Negative Product', 'ADU', 'draft', -1, -10);
  exception when others then
    negative_blocked := true;
  end;

  begin
    insert into public.products(manufacturer_id, name, model_name, category, status)
    values (manufacturer_id, 'Invalid Transition Product', 'Invalid Transition Product', 'ADU', 'published');
  exception when others then
    invalid_transition_blocked := true;
  end;

  insert into product_database_results values ('invalid negative price/dimensions are blocked', negative_blocked, case when negative_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_database_results values ('invalid status transition is blocked', invalid_transition_blocked, case when invalid_transition_blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

select check_name, passed, detail
from product_database_results
order by check_name;

rollback;
