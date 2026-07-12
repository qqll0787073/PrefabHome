begin;

create temp table product_media_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table product_media_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on product_media_results to authenticated;
grant select, insert on product_media_results to anon;
grant select, insert on product_media_subjects to authenticated;
grant select on product_media_subjects to anon;

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
    ('00000000-0000-0000-0000-000000000000', unapproved_owner_id, 'authenticated', 'authenticated', 'media-unapproved-' || unapproved_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Media Unapproved","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', approved_owner_id, 'authenticated', 'authenticated', 'media-approved-' || approved_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Media Approved","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_owner_id, 'authenticated', 'authenticated', 'media-other-' || other_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Media Other","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'media-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Media Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'media-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Media Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into product_media_subjects(subject_name, subject_id)
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
  select subject_id into unapproved_owner_id from product_media_subjects where subject_name = 'unapproved_owner';
  select subject_id into approved_owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into other_owner_id from product_media_subjects where subject_name = 'other_owner';
  select subject_id into admin_id from product_media_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform set_config('request.jwt.claim.sub', unapproved_owner_id::text, true);
  insert into public.manufacturers(owner_id, company_name, country, application_status)
  values (unapproved_owner_id, 'Unapproved Media Factory', 'China', 'draft')
  returning id into unapproved_manufacturer_id;

  perform set_config('request.jwt.claim.sub', approved_owner_id::text, true);
  insert into public.manufacturers(owner_id, company_name, country, application_status)
  values (approved_owner_id, 'Approved Media Factory', 'China', 'submitted')
  returning id into approved_manufacturer_id;

  perform set_config('request.jwt.claim.sub', other_owner_id::text, true);
  insert into public.manufacturers(owner_id, company_name, country, application_status)
  values (other_owner_id, 'Other Media Factory', 'China', 'submitted')
  returning id into other_manufacturer_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.manufacturers
  set application_status = 'approved',
      review_notes = 'Approved for product media verification.'
  where id in (approved_manufacturer_id, other_manufacturer_id);

  insert into product_media_subjects(subject_name, subject_id)
  values
    ('unapproved_manufacturer', unapproved_manufacturer_id),
    ('approved_manufacturer', approved_manufacturer_id),
    ('other_manufacturer', other_manufacturer_id);
end;
$$;

do $$
declare
  admin_id uuid;
  owner_id uuid;
  other_owner_id uuid;
  unapproved_manufacturer_id uuid;
  approved_manufacturer_id uuid;
  other_manufacturer_id uuid;
  unapproved_product_id uuid;
  draft_product_id uuid;
  other_product_id uuid;
  submitted_product_id uuid;
  published_product_id uuid;
  rejected_product_id uuid;
  primary_product_id uuid;
  cascade_product_id uuid;
begin
  select subject_id into admin_id from product_media_subjects where subject_name = 'admin';
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into other_owner_id from product_media_subjects where subject_name = 'other_owner';
  select subject_id into unapproved_manufacturer_id from product_media_subjects where subject_name = 'unapproved_manufacturer';
  select subject_id into approved_manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into other_manufacturer_id from product_media_subjects where subject_name = 'other_manufacturer';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (unapproved_manufacturer_id, 'Unapproved Media Product', 'Unapproved Media Product', 'ADU', 'draft')
  returning id into unapproved_product_id;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (approved_manufacturer_id, 'Draft Media Product', 'Draft Media Product', 'ADU', 'draft')
  returning id into draft_product_id;

  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (approved_manufacturer_id, 'Submitted Media Product', 'Submitted Media Product', 'ADU', 'draft')
  returning id into submitted_product_id;

  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (approved_manufacturer_id, 'Published Media Product', 'Published Media Product', 'ADU', 'draft')
  returning id into published_product_id;

  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (approved_manufacturer_id, 'Rejected Media Product', 'Rejected Media Product', 'ADU', 'submitted')
  returning id into rejected_product_id;

  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (approved_manufacturer_id, 'Primary Media Product', 'Primary Media Product', 'ADU', 'draft')
  returning id into primary_product_id;

  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (approved_manufacturer_id, 'Cascade Media Product', 'Cascade Media Product', 'ADU', 'draft')
  returning id into cascade_product_id;

  perform set_config('request.jwt.claim.sub', other_owner_id::text, true);
  insert into public.products(manufacturer_id, name, model_name, category, status)
  values (other_manufacturer_id, 'Other Media Product', 'Other Media Product', 'ADU', 'draft')
  returning id into other_product_id;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  update public.products set status = 'submitted' where id = published_product_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.products set status = 'published' where id = published_product_id;
  update public.products set status = 'rejected' where id = rejected_product_id;

  insert into product_media_subjects(subject_name, subject_id)
  values
    ('unapproved_product', unapproved_product_id),
    ('draft_product', draft_product_id),
    ('other_product', other_product_id),
    ('submitted_product', submitted_product_id),
    ('published_product', published_product_id),
    ('rejected_product', rejected_product_id),
    ('primary_product', primary_product_id),
    ('cascade_product', cascade_product_id);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  media_id uuid;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'draft_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, original_filename, mime_type, file_size_bytes, title)
  values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/draft-image.jpg', 'draft-image.jpg', 'image/jpeg', 100, 'Draft image')
  returning id into media_id;

  insert into product_media_subjects values ('draft_media', media_id);
  insert into product_media_results values ('approved manufacturer can create media for own draft product', media_id is not null, 'media: ' || coalesce(media_id::text, 'null'));
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'unapproved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'unapproved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'unapproved_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
    values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/blocked.jpg', 'image/jpeg');
  exception when others then
    blocked := true;
  end;

  insert into product_media_results values ('unapproved manufacturer cannot upload media metadata', blocked, case when blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

do $$
declare
  owner_id uuid;
  other_product_id uuid;
  other_manufacturer_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into other_product_id from product_media_subjects where subject_name = 'other_product';
  select subject_id into other_manufacturer_id from product_media_subjects where subject_name = 'other_manufacturer';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
    values (other_product_id, 'exterior_image', 'product-images', other_manufacturer_id || '/' || other_product_id || '/wrong-owner.jpg', 'image/jpeg');
  exception when others then
    blocked := true;
  end;

  insert into product_media_results values ('manufacturer cannot create media for another manufacturer product', blocked, case when blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  media_id uuid;
  blocked boolean := false;
  updated_count integer;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'submitted_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
  values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/submitted.jpg', 'image/jpeg')
  returning id into media_id;

  update public.products set status = 'submitted' where id = product_id;

  update public.product_media set title = 'Blocked submitted edit' where id = media_id;
  get diagnostics updated_count = row_count;
  blocked := updated_count = 0;

  insert into product_media_results values ('manufacturer cannot edit media for submitted product', blocked, case when blocked then 'blocked' else 'unexpectedly edited rows: ' || updated_count end);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  media_id uuid;
  blocked boolean := false;
  deleted_count integer;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'published_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  perform set_config('request.jwt.claim.sub', (select subject_id::text from product_media_subjects where subject_name = 'admin'), true);
  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, visibility)
  values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/published.jpg', 'image/jpeg', 'public')
  returning id into media_id;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  delete from public.product_media where id = media_id;
  get diagnostics deleted_count = row_count;
  blocked := deleted_count = 0;

  insert into product_media_subjects values ('published_media', media_id);
  insert into product_media_results values ('manufacturer cannot delete media for published product', blocked, case when blocked then 'blocked' else 'unexpectedly deleted rows: ' || deleted_count end);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  media_id uuid;
  updated_title text;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'rejected_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
  values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/rejected.jpg', 'image/jpeg')
  returning id into media_id;

  update public.product_media set title = 'Rejected edit allowed' where id = media_id returning title into updated_title;

  insert into product_media_results values ('manufacturer can edit media for own rejected product', updated_title = 'Rejected edit allowed', 'title: ' || coalesce(updated_title, 'null'));
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  product_id uuid;
  blocked boolean := false;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into other_manufacturer_id from product_media_subjects where subject_name = 'other_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'draft_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
    values (product_id, 'exterior_image', 'product-images', other_manufacturer_id || '/' || product_id || '/forged.jpg', 'image/jpeg');
  exception when others then
    blocked := true;
  end;

  insert into product_media_results values ('manufacturer cannot forge manufacturer storage path', blocked, case when blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

reset role;
set local role anon;

do $$
declare
  draft_product_id uuid;
  published_product_id uuid;
  unpublished_count integer;
  published_count integer;
  created_by_blocked boolean := false;
begin
  select subject_id into draft_product_id from product_media_subjects where subject_name = 'draft_product';
  select subject_id into published_product_id from product_media_subjects where subject_name = 'published_product';

  select count(*) into unpublished_count from public.published_product_media where product_id = draft_product_id;
  select count(*) into published_count from public.published_product_media where product_id = published_product_id;

  begin
    execute 'select created_by from public.published_product_media limit 1';
  exception when undefined_column then
    created_by_blocked := true;
  end;

  insert into product_media_results values ('anonymous cannot read unpublished product media', unpublished_count = 0, 'unpublished visible: ' || unpublished_count);
  insert into product_media_results values ('anonymous can read public media for published product', published_count = 1, 'published visible: ' || published_count);
  insert into product_media_results values ('public projection excludes created_by', created_by_blocked, case when created_by_blocked then 'blocked' else 'unexpectedly selected' end);
end;
$$;

set local role authenticated;

do $$
declare
  admin_id uuid;
  buyer_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  private_media_id uuid;
  buyer_private_count integer;
  public_private_count integer;
begin
  select subject_id into admin_id from product_media_subjects where subject_name = 'admin';
  select subject_id into buyer_id from product_media_subjects where subject_name = 'buyer';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'published_product';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, visibility)
  values (product_id, 'specification_sheet', 'product-documents', manufacturer_id || '/' || product_id || '/private.pdf', 'application/pdf', 'private')
  returning id into private_media_id;

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select count(*) into buyer_private_count from public.product_media where id = private_media_id;
  select count(*) into public_private_count from public.published_product_media where id = private_media_id;

  insert into product_media_results values ('buyer cannot read private document media', buyer_private_count = 0, 'buyer visible private docs: ' || buyer_private_count);
  insert into product_media_results values ('public projection excludes private document', public_private_count = 0, 'public visible private docs: ' || public_private_count);
end;
$$;

do $$
declare
  admin_id uuid;
  target_product_id uuid;
  visible_count integer;
  updated_title text;
begin
  select subject_id into admin_id from product_media_subjects where subject_name = 'admin';
  select subject_id into target_product_id from product_media_subjects where subject_name = 'published_product';
  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  select count(*) into visible_count from public.product_media;
  update public.product_media
  set title = 'Admin managed published media'
  where public.product_media.product_id = target_product_id
    and storage_bucket = 'product-images'
  returning title into updated_title;

  insert into product_media_results values ('admin can view all media', visible_count >= 4, 'visible media: ' || visible_count);
  insert into product_media_results values ('admin can manage media for published product', updated_title = 'Admin managed published media', 'title: ' || coalesce(updated_title, 'null'));
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  duplicate_primary_blocked boolean := false;
  duplicate_path_blocked boolean := false;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'primary_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, is_primary)
  values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/primary-1.jpg', 'image/jpeg', true);

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, is_primary)
    values (product_id, 'interior_image', 'product-images', manufacturer_id || '/' || product_id || '/primary-2.jpg', 'image/jpeg', true);
  exception when others then
    duplicate_primary_blocked := true;
  end;

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
    values (product_id, 'interior_image', 'product-images', manufacturer_id || '/' || product_id || '/primary-1.jpg', 'image/jpeg');
  exception when others then
    duplicate_path_blocked := true;
  end;

  insert into product_media_results values ('only one primary media item is allowed per product', duplicate_primary_blocked, case when duplicate_primary_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_media_results values ('duplicate storage path is blocked', duplicate_path_blocked, case when duplicate_path_blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

do $$
declare
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  invalid_visibility_blocked boolean := false;
  invalid_media_type_blocked boolean := false;
  negative_file_size_blocked boolean := false;
  negative_sort_order_blocked boolean := false;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'draft_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, visibility)
    values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/invalid-visibility.jpg', 'image/jpeg', 'internal');
  exception when others then
    invalid_visibility_blocked := true;
  end;

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
    values (product_id, 'bad_type', 'product-images', manufacturer_id || '/' || product_id || '/invalid-type.jpg', 'image/jpeg');
  exception when others then
    invalid_media_type_blocked := true;
  end;

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, file_size_bytes)
    values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/negative-size.jpg', 'image/jpeg', -1);
  exception when others then
    negative_file_size_blocked := true;
  end;

  begin
    insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type, sort_order)
    values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/negative-sort.jpg', 'image/jpeg', -1);
  exception when others then
    negative_sort_order_blocked := true;
  end;

  insert into product_media_results values ('invalid visibility is blocked', invalid_visibility_blocked, case when invalid_visibility_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_media_results values ('invalid media_type is blocked', invalid_media_type_blocked, case when invalid_media_type_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_media_results values ('negative file size is blocked', negative_file_size_blocked, case when negative_file_size_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_media_results values ('negative sort order is blocked', negative_sort_order_blocked, case when negative_sort_order_blocked then 'blocked' else 'unexpectedly inserted' end);
end;
$$;

do $$
declare
  admin_id uuid;
  owner_id uuid;
  manufacturer_id uuid;
  product_id uuid;
  media_id uuid;
  remaining_count integer;
  old_updated_at timestamptz;
  new_updated_at timestamptz;
begin
  select subject_id into admin_id from product_media_subjects where subject_name = 'admin';
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'cascade_product';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  insert into public.product_media(product_id, media_type, storage_bucket, storage_path, mime_type)
  values (product_id, 'exterior_image', 'product-images', manufacturer_id || '/' || product_id || '/cascade.jpg', 'image/jpeg')
  returning id, updated_at into media_id, old_updated_at;

  perform pg_sleep(0.01);
  update public.product_media set title = 'Timestamp update' where id = media_id returning updated_at into new_updated_at;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  delete from public.products where id = product_id;
  select count(*) into remaining_count from public.product_media where id = media_id;

  insert into product_media_results values ('cascade delete removes media records when product is deleted', remaining_count = 0, 'remaining media: ' || remaining_count);
  insert into product_media_results values ('updated_at changes on valid update', new_updated_at > old_updated_at, 'old: ' || old_updated_at || ', new: ' || new_updated_at);
end;
$$;

do $$
declare
  owner_id uuid;
  buyer_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  product_id uuid;
  valid_upload_id uuid;
  valid_upload_inserted boolean := false;
  forged_upload_blocked boolean := false;
  valid_upload_error text := '';
  document_read_count integer;
begin
  select subject_id into owner_id from product_media_subjects where subject_name = 'approved_owner';
  select subject_id into buyer_id from product_media_subjects where subject_name = 'buyer';
  select subject_id into manufacturer_id from product_media_subjects where subject_name = 'approved_manufacturer';
  select subject_id into other_manufacturer_id from product_media_subjects where subject_name = 'other_manufacturer';
  select subject_id into product_id from product_media_subjects where subject_name = 'draft_product';

  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  begin
    insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
    values ('product-images', manufacturer_id || '/' || product_id || '/valid-owner-upload.jpg', owner_id, owner_id::text, '{}'::jsonb)
    returning id into valid_upload_id;
    valid_upload_inserted := true;
  exception when others then
    valid_upload_inserted := false;
    valid_upload_error := sqlerrm;
  end;

  begin
    insert into storage.objects(bucket_id, name, owner, owner_id, metadata)
    values ('product-images', other_manufacturer_id || '/' || product_id || '/forged-upload.jpg', owner_id, owner_id::text, '{}'::jsonb);
  exception when others then
    forged_upload_blocked := true;
  end;

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select count(*) into document_read_count
  from storage.objects
  where bucket_id = 'product-documents';

  insert into product_media_results values (
    'storage policy permits valid owner upload to editable product',
    valid_upload_inserted,
    'object: ' || coalesce(valid_upload_id::text, 'null') || case when valid_upload_error = '' then '' else ', error: ' || valid_upload_error end
  );
  insert into product_media_results values ('storage policy blocks upload to another manufacturer path', forged_upload_blocked, case when forged_upload_blocked then 'blocked' else 'unexpectedly inserted' end);
  insert into product_media_results values ('storage policy blocks unauthorized document read', document_read_count = 0, 'buyer visible documents: ' || document_read_count);
end;
$$;

select check_name, passed, detail
from product_media_results
order by check_name;

rollback;
