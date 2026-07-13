begin;

create temp table public_marketplace_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table public_marketplace_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on public_marketplace_results to anon, authenticated;
grant select, insert on public_marketplace_subjects to anon, authenticated;

do $$
declare
  approved_owner_id uuid := gen_random_uuid();
  unapproved_owner_id uuid := gen_random_uuid();
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
    ('00000000-0000-0000-0000-000000000000', approved_owner_id, 'authenticated', 'authenticated', 'market-approved-' || approved_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marketplace Approved","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', unapproved_owner_id, 'authenticated', 'authenticated', 'market-unapproved-' || unapproved_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marketplace Unapproved","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'market-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marketplace Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'market-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marketplace Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into public_marketplace_subjects(subject_name, subject_id)
  values
    ('approved_owner', approved_owner_id),
    ('unapproved_owner', unapproved_owner_id),
    ('buyer', buyer_id),
    ('admin', admin_id);
end;
$$;

set local role authenticated;

do $$
declare
  approved_owner_id uuid;
  unapproved_owner_id uuid;
  admin_id uuid;
  approved_manufacturer_id uuid;
  unapproved_manufacturer_id uuid;
  published_product_id uuid;
  no_image_product_id uuid;
  unapproved_published_product_id uuid;
  draft_product_id uuid;
  submitted_product_id uuid;
  rejected_product_id uuid;
  archived_product_id uuid;
  public_image_id uuid;
  private_image_id uuid;
  document_id uuid;
begin
  select subject_id into approved_owner_id from public_marketplace_subjects where subject_name = 'approved_owner';
  select subject_id into unapproved_owner_id from public_marketplace_subjects where subject_name = 'unapproved_owner';
  select subject_id into admin_id from public_marketplace_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', approved_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.manufacturers(
    owner_id,
    company_name,
    company_display_name,
    email,
    phone,
    country,
    province,
    city,
    street_address,
    postal_code,
    website,
    application_status
  )
  values (
    approved_owner_id,
    'Private Legal Marketplace Factory',
    'Public Marketplace Factory',
    'private@example.test',
    '+1-555-PRIVATE',
    'China',
    'Guangdong',
    'Shenzhen',
    'Private Street',
    'PRIVATE',
    'https://factory.example.test',
    'submitted'
  )
  returning id into approved_manufacturer_id;

  perform set_config('request.jwt.claim.sub', unapproved_owner_id::text, true);
  insert into public.manufacturers(
    owner_id,
    company_name,
    company_display_name,
    country,
    city,
    application_status
  )
  values (
    unapproved_owner_id,
    'Unapproved Marketplace Factory',
    'Unapproved Public Factory',
    'China',
    'Qingdao',
    'draft'
  )
  returning id into unapproved_manufacturer_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.manufacturers
  set application_status = 'approved',
      review_notes = 'Approved for public marketplace verification.'
  where id = approved_manufacturer_id;

  insert into public.products(
    manufacturer_id,
    name,
    model_name,
    slug,
    category,
    short_description,
    description,
    tags,
    intended_uses,
    floor_area_sq_ft,
    bedrooms,
    bathrooms,
    currency,
    fob_price,
    target_markets,
    certifications,
    notes,
    review_notes,
    status
  )
  values
    (approved_manufacturer_id, 'Published Marketplace Home', 'PMH-1', 'pmh-1', 'ADU', 'Public description', 'Published public product.', array['adu', 'public'], array['backyard'], 420, 1, 1, 'USD', 40000, array['United States'], array['CE'], 'private note', 'review note', 'published'),
    (approved_manufacturer_id, 'No Image Marketplace Home', 'PMH-2', 'pmh-2', 'Tiny House', 'No image description', 'Published product without an image.', array['tiny'], array['residential'], 500, 2, 1, 'USD', 52000, array['Canada'], array['CSA'], 'private note', 'review note', 'published'),
    (unapproved_manufacturer_id, 'Unapproved Published Home', 'UPH-1', 'uph-1', 'ADU', 'Should not appear', 'Unapproved manufacturer product.', array['hidden'], array['hidden'], 300, 1, 1, 'USD', 30000, array['United States'], array['CE'], 'private note', 'review note', 'published'),
    (approved_manufacturer_id, 'Draft Marketplace Home', 'DMH-1', 'dmh-1', 'ADU', 'Draft hidden', 'Draft product.', array['draft'], array['hidden'], 300, 1, 1, 'USD', 30000, array['United States'], array['CE'], 'private note', 'review note', 'draft'),
    (approved_manufacturer_id, 'Submitted Marketplace Home', 'SMH-1', 'smh-1', 'ADU', 'Submitted hidden', 'Submitted product.', array['submitted'], array['hidden'], 300, 1, 1, 'USD', 30000, array['United States'], array['CE'], 'private note', 'review note', 'submitted'),
    (approved_manufacturer_id, 'Rejected Marketplace Home', 'RMH-1', 'rmh-1', 'ADU', 'Rejected hidden', 'Rejected product.', array['rejected'], array['hidden'], 300, 1, 1, 'USD', 30000, array['United States'], array['CE'], 'private note', 'review note', 'rejected'),
    (approved_manufacturer_id, 'Archived Marketplace Home', 'AMH-1', 'amh-1', 'ADU', 'Archived hidden', 'Archived product.', array['archived'], array['hidden'], 300, 1, 1, 'USD', 30000, array['United States'], array['CE'], 'private note', 'review note', 'archived');

  select id into published_product_id from public.products where slug = 'pmh-1';
  select id into no_image_product_id from public.products where slug = 'pmh-2';
  select id into unapproved_published_product_id from public.products where slug = 'uph-1';
  select id into draft_product_id from public.products where slug = 'dmh-1';
  select id into submitted_product_id from public.products where slug = 'smh-1';
  select id into rejected_product_id from public.products where slug = 'rmh-1';
  select id into archived_product_id from public.products where slug = 'amh-1';

  insert into public.product_media(
    product_id,
    media_type,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    visibility
  )
  values
    (published_product_id, 'exterior_image', 'product-images', approved_manufacturer_id || '/' || published_product_id || '/public-primary.png', 'public-primary.png', 'image/png', 'public'),
    (published_product_id, 'interior_image', 'product-images', approved_manufacturer_id || '/' || published_product_id || '/private-image.png', 'private-image.png', 'image/png', 'private'),
    (published_product_id, 'specification_sheet', 'product-documents', approved_manufacturer_id || '/' || published_product_id || '/private-document.pdf', 'private-document.pdf', 'application/pdf', 'private'),
    (draft_product_id, 'exterior_image', 'product-images', approved_manufacturer_id || '/' || draft_product_id || '/draft-public.png', 'draft-public.png', 'image/png', 'public');

  select id into public_image_id from public.product_media where storage_path like '%/public-primary.png';
  select id into private_image_id from public.product_media where storage_path like '%/private-image.png';
  select id into document_id from public.product_media where storage_path like '%/private-document.pdf';

  perform public.set_primary_product_media(published_product_id, public_image_id);

  insert into public_marketplace_subjects(subject_name, subject_id)
  values
    ('approved_manufacturer', approved_manufacturer_id),
    ('unapproved_manufacturer', unapproved_manufacturer_id),
    ('published_product', published_product_id),
    ('no_image_product', no_image_product_id),
    ('unapproved_published_product', unapproved_published_product_id),
    ('draft_product', draft_product_id),
    ('submitted_product', submitted_product_id),
    ('rejected_product', rejected_product_id),
    ('archived_product', archived_product_id),
    ('public_image', public_image_id),
    ('private_image', private_image_id),
    ('document', document_id);
end;
$$;

set local role anon;

do $$
declare
  published_product_id uuid;
  no_image_product_id uuid;
  draft_product_id uuid;
  submitted_product_id uuid;
  rejected_product_id uuid;
  archived_product_id uuid;
  visible_count integer;
  leaked_count integer;
  column_count integer;
begin
  select subject_id into published_product_id from public_marketplace_subjects where subject_name = 'published_product';
  select subject_id into no_image_product_id from public_marketplace_subjects where subject_name = 'no_image_product';
  select subject_id into draft_product_id from public_marketplace_subjects where subject_name = 'draft_product';
  select subject_id into submitted_product_id from public_marketplace_subjects where subject_name = 'submitted_product';
  select subject_id into rejected_product_id from public_marketplace_subjects where subject_name = 'rejected_product';
  select subject_id into archived_product_id from public_marketplace_subjects where subject_name = 'archived_product';

  select count(*) into visible_count from public.marketplace_products where id = published_product_id;
  insert into public_marketplace_results values ('anonymous can read published marketplace product', visible_count = 1, 'visible: ' || visible_count);

  select count(*) into leaked_count from public.marketplace_products where id = draft_product_id;
  insert into public_marketplace_results values ('anonymous cannot read draft product', leaked_count = 0, 'visible: ' || leaked_count);

  select count(*) into leaked_count from public.marketplace_products where id = submitted_product_id;
  insert into public_marketplace_results values ('anonymous cannot read submitted product', leaked_count = 0, 'visible: ' || leaked_count);

  select count(*) into leaked_count from public.marketplace_products where id = rejected_product_id;
  insert into public_marketplace_results values ('anonymous cannot read rejected product', leaked_count = 0, 'visible: ' || leaked_count);

  select count(*) into leaked_count from public.marketplace_products where id = archived_product_id;
  insert into public_marketplace_results values ('anonymous cannot read archived product', leaked_count = 0, 'visible: ' || leaked_count);

  select count(*) into column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'marketplace_products'
    and column_name in ('notes', 'review_notes', 'reviewed_by', 'reviewed_at', 'submitted_at', 'archived_at');
  insert into public_marketplace_results values ('marketplace projection excludes product notes', column_count = 0, 'private columns: ' || column_count);
  insert into public_marketplace_results values ('marketplace projection excludes review fields', column_count = 0, 'review columns: ' || column_count);

  select count(*) into column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'marketplace_products'
    and column_name = 'owner_id';
  insert into public_marketplace_results values ('marketplace projection excludes manufacturer owner_id', column_count = 0, 'owner columns: ' || column_count);

  select count(*) into column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'marketplace_products'
    and column_name in ('email', 'phone', 'street_address', 'postal_code');
  insert into public_marketplace_results values ('marketplace projection excludes private manufacturer contact data', column_count = 0, 'private contact columns: ' || column_count);

  select count(*) into visible_count from public.marketplace_products where id = no_image_product_id and primary_media_id is null;
  insert into public_marketplace_results values ('product with no image remains readable', visible_count = 1, 'visible no-image products: ' || visible_count);
end;
$$;

set local role authenticated;

do $$
declare
  buyer_id uuid;
  published_product_id uuid;
  unapproved_published_product_id uuid;
  public_image_id uuid;
  private_image_id uuid;
  document_id uuid;
  visible_count integer;
  leaked_count integer;
  direct_anon_products boolean;
  direct_anon_media boolean;
begin
  select subject_id into buyer_id from public_marketplace_subjects where subject_name = 'buyer';
  select subject_id into published_product_id from public_marketplace_subjects where subject_name = 'published_product';
  select subject_id into unapproved_published_product_id from public_marketplace_subjects where subject_name = 'unapproved_published_product';
  select subject_id into public_image_id from public_marketplace_subjects where subject_name = 'public_image';
  select subject_id into private_image_id from public_marketplace_subjects where subject_name = 'private_image';
  select subject_id into document_id from public_marketplace_subjects where subject_name = 'document';
  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into visible_count from public.marketplace_products where id = published_product_id;
  insert into public_marketplace_results values ('buyer can read published marketplace product', visible_count = 1, 'visible: ' || visible_count);

  select count(*) into leaked_count from public.marketplace_products where id = unapproved_published_product_id;
  insert into public_marketplace_results values ('only approved manufacturer public data appears', leaked_count = 0, 'unapproved visible: ' || leaked_count);

  select count(*) into leaked_count from public.published_product_media where product_id <> published_product_id;
  insert into public_marketplace_results values ('unpublished product images are excluded', leaked_count = 0, 'non-published media visible: ' || leaked_count);

  select count(*) into leaked_count from public.marketplace_products where primary_media_id = private_image_id;
  insert into public_marketplace_results values ('private images are excluded', leaked_count = 0, 'private image primary rows: ' || leaked_count);

  select count(*) into leaked_count from public.marketplace_products where primary_media_id = document_id;
  insert into public_marketplace_results values ('product documents are excluded', leaked_count = 0, 'document primary rows: ' || leaked_count);

  select count(*) into visible_count from public.marketplace_products where id = published_product_id and primary_media_id = public_image_id;
  insert into public_marketplace_results values ('primary public published image can appear', visible_count = 1, 'primary image rows: ' || visible_count);

  select count(*) into leaked_count
  from public.marketplace_products
  where primary_storage_bucket <> 'product-images'
     or primary_media_type in ('specification_sheet', 'catalog', 'installation_manual', 'certification', 'other_document');
  insert into public_marketplace_results values ('duplicate or malformed media does not expose private content', leaked_count = 0, 'malformed public rows: ' || leaked_count);

  select count(*) into leaked_count
  from public.marketplace_products
  where category = 'ADU'
    and id <> published_product_id;
  insert into public_marketplace_results values ('search/filter query still returns only published rows', leaked_count = 0, 'unexpected ADU rows: ' || leaked_count);

  select count(*) into visible_count from public.marketplace_products;
  insert into public_marketplace_results values ('count/pagination does not leak unpublished row counts', visible_count = 2, 'marketplace count: ' || visible_count);

  direct_anon_products := has_table_privilege('anon', 'public.products', 'select');
  direct_anon_media := has_table_privilege('anon', 'public.product_media', 'select');
  insert into public_marketplace_results values (
    'direct private-table permissions remain unchanged',
    direct_anon_products = false and direct_anon_media = false,
    'anon products select: ' || direct_anon_products || ', anon product_media select: ' || direct_anon_media
  );
end;
$$;

select check_name, passed, detail
from public_marketplace_results
order by check_name;

rollback;
