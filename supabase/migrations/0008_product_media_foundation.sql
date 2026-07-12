-- PH-004 Product media foundation.
-- Additive migration for secure product media metadata and storage policies.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'product-images',
    'product-images',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'product-documents',
    'product-documents',
    false,
    26214400,
    array['application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  title text,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  visibility text not null default 'public',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_media
  add constraint product_media_type_check
  check (media_type in (
    'exterior_image',
    'interior_image',
    'floor_plan',
    'rendering',
    'factory_photo',
    'specification_sheet',
    'catalog',
    'installation_manual',
    'certification',
    'other_document'
  ))
  not valid;

alter table public.product_media
  validate constraint product_media_type_check;

alter table public.product_media
  add constraint product_media_visibility_check
  check (visibility in ('public', 'private'))
  not valid;

alter table public.product_media
  validate constraint product_media_visibility_check;

alter table public.product_media
  add constraint product_media_non_negative_check
  check (
    (file_size_bytes is null or file_size_bytes >= 0)
    and sort_order >= 0
  )
  not valid;

alter table public.product_media
  validate constraint product_media_non_negative_check;

alter table public.product_media
  add constraint product_media_bucket_check
  check (storage_bucket in ('product-images', 'product-documents'))
  not valid;

alter table public.product_media
  validate constraint product_media_bucket_check;

alter table public.product_media
  drop constraint if exists product_media_primary_image_check;

alter table public.product_media
  add constraint product_media_primary_image_check
  check (
    is_primary = false
    or (
      storage_bucket = 'product-images'
      and media_type in (
        'exterior_image',
        'interior_image',
        'floor_plan',
        'rendering',
        'factory_photo'
      )
    )
  )
  not valid;

alter table public.product_media
  drop constraint if exists product_media_documents_private_check;

alter table public.product_media
  add constraint product_media_documents_private_check
  check (
    not (
      storage_bucket = 'product-documents'
      or media_type in (
        'specification_sheet',
        'catalog',
        'installation_manual',
        'certification',
        'other_document'
      )
    )
    or visibility = 'private'
  )
  not valid;

create unique index if not exists product_media_storage_path_key
  on public.product_media (storage_bucket, storage_path);

create unique index if not exists product_media_one_primary_per_product_key
  on public.product_media (product_id)
  where is_primary = true;

create index if not exists product_media_product_sort_idx
  on public.product_media (product_id, sort_order, created_at);

create index if not exists product_media_public_idx
  on public.product_media (product_id, sort_order)
  where visibility = 'public';

revoke select on public.product_media from anon;
grant select, insert, update, delete on public.product_media to authenticated;

create or replace function public.product_media_owner_id(product_uuid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.manufacturer_id
  from public.products p
  where p.id = product_uuid
$$;

create or replace function public.product_media_path_prefix(product_uuid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.manufacturer_id::text || '/' || p.id::text || '/'
  from public.products p
  where p.id = product_uuid
$$;

create or replace function public.can_manage_product_media(product_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_uuid
        and p.status in ('draft', 'rejected')
        and public.owns_manufacturer(p.manufacturer_id)
        and public.is_approved_manufacturer(p.manufacturer_id)
    ),
    false
  )
$$;

create or replace function public.can_view_private_product_media(product_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.products p
      where p.id = product_uuid
        and public.owns_manufacturer(p.manufacturer_id)
    ),
    false
  )
$$;

create or replace function public.can_read_public_product_media(product_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products p
    where p.id = product_uuid
      and p.status = 'published'
  )
$$;

create or replace function public.can_read_public_product_media_item(media_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.product_media pm
    join public.products p on p.id = pm.product_id
    where pm.id = media_uuid
      and pm.visibility = 'public'
      and p.status = 'published'
  )
$$;

create or replace function public.can_read_public_product_media_object(
  object_bucket text,
  object_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.product_media pm
    join public.products p on p.id = pm.product_id
    where pm.storage_bucket = object_bucket
      and pm.storage_path = object_path
      and pm.storage_bucket = 'product-images'
      and pm.visibility = 'public'
      and p.status = 'published'
  )
$$;

create or replace function public.storage_object_product_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  product_token text;
begin
  product_token := split_part(object_name, '/', 2);
  if product_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return product_token::uuid;
end;
$$;

create or replace function public.storage_object_manufacturer_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  manufacturer_token text;
begin
  manufacturer_token := split_part(object_name, '/', 1);
  if manufacturer_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return manufacturer_token::uuid;
end;
$$;

create or replace function public.is_valid_product_media_storage_path(
  product_uuid uuid,
  storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(storage_path like public.product_media_path_prefix(product_uuid) || '%', false)
$$;

create or replace function public.is_product_media_storage_object_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.storage_object_product_id(object_name) is not null
    and public.storage_object_manufacturer_id(object_name) = public.product_media_owner_id(public.storage_object_product_id(object_name))
    and object_name like public.product_media_path_prefix(public.storage_object_product_id(object_name)) || '%',
    false
  )
$$;

create or replace function public.enforce_product_media_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bucket_id not in ('product-images', 'product-documents') then
    return new;
  end if;

  if public.storage_object_product_id(new.name) is null
    or public.storage_object_manufacturer_id(new.name) is distinct from public.product_media_owner_id(public.storage_object_product_id(new.name)) then
    raise exception 'Product media storage path is not authorized.';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1
      from public.products p
      join public.manufacturers m on m.id = p.manufacturer_id
      where p.id = public.storage_object_product_id(new.name)
        and m.id = public.storage_object_manufacturer_id(new.name)
        and m.owner_id = auth.uid()
        and m.application_status = 'approved'
        and p.status in ('draft', 'rejected')
    )
  ) then
    raise exception 'Product media storage object cannot be changed for this product.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_media_storage_object on storage.objects;

create trigger enforce_product_media_storage_object
before insert or update on storage.objects
for each row execute function public.enforce_product_media_storage_object();

create or replace function public.manage_product_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primary_rpc_context boolean := current_setting('app.set_primary_product_media', true) = 'on';
begin
  if tg_op = 'INSERT' then
    if not public.can_manage_product_media(new.product_id) then
      raise exception 'Only approved manufacturers can manage media for draft or rejected products.';
    end if;

    if new.is_primary = true then
      raise exception 'Primary images must be selected with set_primary_product_media.';
    end if;

    new.created_by := auth.uid();
  else
    if new.product_id is distinct from old.product_id then
      raise exception 'Product media cannot be moved between products.';
    end if;

    if new.storage_bucket is distinct from old.storage_bucket
      or new.storage_path is distinct from old.storage_path then
      raise exception 'Product media storage location cannot be changed.';
    end if;

    if new.created_by is distinct from old.created_by and not public.is_admin() then
      raise exception 'Product media creator cannot be changed.';
    end if;

    if not public.can_manage_product_media(old.product_id) then
      raise exception 'This product is locked. Media can be changed only while draft or rejected.';
    end if;

    if old.is_primary = false and new.is_primary = true and not primary_rpc_context then
      raise exception 'Primary images must be selected with set_primary_product_media.';
    end if;
  end if;

  if new.media_type in (
    'exterior_image',
    'interior_image',
    'floor_plan',
    'rendering',
    'factory_photo'
  ) and new.storage_bucket <> 'product-images' then
    raise exception 'Image media must be stored in product-images.';
  end if;

  if new.media_type in (
    'specification_sheet',
    'catalog',
    'installation_manual',
    'certification',
    'other_document'
  ) and new.storage_bucket <> 'product-documents' then
    raise exception 'Document media must be stored in product-documents.';
  end if;

  if new.is_primary = true
    and (
      new.storage_bucket <> 'product-images'
      or new.media_type not in (
        'exterior_image',
        'interior_image',
        'floor_plan',
        'rendering',
        'factory_photo'
      )
    ) then
    raise exception 'Primary media must be a product image.';
  end if;

  if (
    new.storage_bucket = 'product-documents'
    or new.media_type in (
      'specification_sheet',
      'catalog',
      'installation_manual',
      'certification',
      'other_document'
    )
  ) and new.visibility <> 'private' then
    raise exception 'Document media must be private.';
  end if;

  if not public.is_valid_product_media_storage_path(new.product_id, new.storage_path) then
    raise exception 'Product media storage path is not authorized for this product.';
  end if;

  if new.storage_bucket = 'product-images'
    and new.mime_type is not null
    and new.mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Image MIME type is not allowed.';
  end if;

  if new.storage_bucket = 'product-documents'
    and new.mime_type is not null
    and new.mime_type <> 'application/pdf' then
    raise exception 'Document MIME type is not allowed.';
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.set_primary_product_media(
  product_uuid uuid,
  media_uuid uuid
)
returns public.product_media
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_media public.product_media;
  previous_primary_context text;
begin
  if not public.can_manage_product_media(product_uuid) then
    raise exception 'Only approved manufacturers can manage media for draft or rejected products.';
  end if;

  select *
  into selected_media
  from public.product_media
  where id = media_uuid
    and product_id = product_uuid
  for update;

  if not found then
    raise exception 'Primary media must belong to the selected product.';
  end if;

  if selected_media.storage_bucket <> 'product-images'
    or selected_media.media_type not in (
      'exterior_image',
      'interior_image',
      'floor_plan',
      'rendering',
      'factory_photo'
    ) then
    raise exception 'Primary product media must be an image.';
  end if;

  previous_primary_context := current_setting('app.set_primary_product_media', true);
  perform set_config('app.set_primary_product_media', 'on', true);

  begin
    update public.product_media
    set is_primary = false
    where product_id = product_uuid
      and is_primary = true
      and id <> media_uuid;

    update public.product_media
    set is_primary = true
    where id = media_uuid
    returning * into selected_media;
  exception when others then
    perform set_config('app.set_primary_product_media', coalesce(previous_primary_context, 'off'), true);
    raise;
  end;

  perform set_config('app.set_primary_product_media', coalesce(previous_primary_context, 'off'), true);

  return selected_media;
end;
$$;

drop trigger if exists manage_product_media on public.product_media;

create trigger manage_product_media
before insert or update on public.product_media
for each row execute function public.manage_product_media();

alter table public.product_media enable row level security;

drop policy if exists "product_media_public_select_published" on public.product_media;
drop policy if exists "product_media_authenticated_select_visible" on public.product_media;
drop policy if exists "product_media_insert_manageable" on public.product_media;
drop policy if exists "product_media_update_manageable" on public.product_media;
drop policy if exists "product_media_delete_manageable" on public.product_media;

create policy "product_media_authenticated_select_visible"
on public.product_media
for select
to authenticated
using (public.can_view_private_product_media(product_id));

create policy "product_media_insert_manageable"
on public.product_media
for insert
to authenticated
with check (public.can_manage_product_media(product_id));

create policy "product_media_update_manageable"
on public.product_media
for update
to authenticated
using (public.can_manage_product_media(product_id))
with check (public.can_manage_product_media(product_id));

create policy "product_media_delete_manageable"
on public.product_media
for delete
to authenticated
using (public.can_manage_product_media(product_id));

drop view if exists public.published_product_media;

create view public.published_product_media
with (security_barrier = true)
as
select
  pm.id,
  pm.product_id,
  pm.media_type,
  pm.storage_bucket,
  pm.storage_path,
  pm.original_filename,
  pm.mime_type,
  pm.file_size_bytes,
  pm.title,
  pm.alt_text,
  pm.sort_order,
  pm.is_primary,
  pm.visibility,
  pm.created_at
from public.product_media pm
join public.products p on p.id = pm.product_id
where p.status = 'published'
  and pm.visibility = 'public'
  and pm.storage_bucket = 'product-images'
  and pm.media_type in (
    'exterior_image',
    'interior_image',
    'floor_plan',
    'rendering',
    'factory_photo'
  );

grant select on public.published_product_media to anon, authenticated;

revoke execute on function public.product_media_owner_id(uuid) from public;
revoke execute on function public.product_media_path_prefix(uuid) from public;
revoke execute on function public.can_manage_product_media(uuid) from public;
revoke execute on function public.can_view_private_product_media(uuid) from public;
revoke execute on function public.can_read_public_product_media(uuid) from public;
revoke execute on function public.can_read_public_product_media_item(uuid) from public;
revoke execute on function public.can_read_public_product_media_object(text, text) from public;
revoke execute on function public.is_valid_product_media_storage_path(uuid, text) from public;
revoke execute on function public.is_product_media_storage_object_path(text) from public;
revoke execute on function public.enforce_product_media_storage_object() from public;
revoke execute on function public.manage_product_media() from public;
revoke execute on function public.set_primary_product_media(uuid, uuid) from public;

grant execute on function public.product_media_owner_id(uuid) to authenticated;
grant execute on function public.product_media_path_prefix(uuid) to authenticated;
grant execute on function public.can_manage_product_media(uuid) to authenticated;
grant execute on function public.can_view_private_product_media(uuid) to authenticated;
grant execute on function public.can_read_public_product_media(uuid) to anon, authenticated;
grant execute on function public.can_read_public_product_media_item(uuid) to anon, authenticated;
grant execute on function public.can_read_public_product_media_object(text, text) to anon, authenticated;
grant execute on function public.is_valid_product_media_storage_path(uuid, text) to authenticated;
grant execute on function public.set_primary_product_media(uuid, uuid) to authenticated;

grant select on storage.objects to anon;
grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists "product_images_public_read_published" on storage.objects;
drop policy if exists "product_media_owner_admin_read" on storage.objects;
drop policy if exists "product_media_owner_admin_insert" on storage.objects;
drop policy if exists "product_media_owner_admin_update" on storage.objects;
drop policy if exists "product_media_owner_admin_delete" on storage.objects;

create policy "product_images_public_read_published"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
  and public.can_read_public_product_media_object(storage.objects.bucket_id, storage.objects.name)
);

create policy "product_media_owner_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('product-images', 'product-documents')
  and (
    exists (
      select 1
      from public.product_media pm
      where pm.storage_bucket = storage.objects.bucket_id
        and pm.storage_path = storage.objects.name
        and public.can_view_private_product_media(pm.product_id)
    )
    or (
      public.storage_object_product_id(name) is not null
      and public.storage_object_manufacturer_id(name) = public.product_media_owner_id(public.storage_object_product_id(name))
      and public.can_manage_product_media(public.storage_object_product_id(name))
    )
  )
);

create policy "product_media_owner_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('product-images', 'product-documents')
);

create policy "product_media_owner_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('product-images', 'product-documents')
  and public.storage_object_product_id(name) is not null
  and public.storage_object_manufacturer_id(name) = public.product_media_owner_id(public.storage_object_product_id(name))
  and (
    public.is_admin()
    or exists (
      select 1
      from public.products p
      join public.manufacturers m on m.id = p.manufacturer_id
      where p.id = public.storage_object_product_id(storage.objects.name)
        and m.id = public.storage_object_manufacturer_id(storage.objects.name)
        and m.owner_id = auth.uid()
        and m.application_status = 'approved'
        and p.status in ('draft', 'rejected')
    )
  )
)
with check (
  bucket_id in ('product-images', 'product-documents')
);

create policy "product_media_owner_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('product-images', 'product-documents')
  and public.storage_object_product_id(name) is not null
  and public.storage_object_manufacturer_id(name) = public.product_media_owner_id(public.storage_object_product_id(name))
  and (
    public.is_admin()
    or exists (
      select 1
      from public.products p
      join public.manufacturers m on m.id = p.manufacturer_id
      where p.id = public.storage_object_product_id(storage.objects.name)
        and m.id = public.storage_object_manufacturer_id(storage.objects.name)
        and m.owner_id = auth.uid()
        and m.application_status = 'approved'
        and p.status in ('draft', 'rejected')
    )
  )
);
