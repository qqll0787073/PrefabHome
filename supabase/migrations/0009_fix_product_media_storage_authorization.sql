-- PH-004 Storage authorization hardening.
-- Move product media Storage write authorization fully into storage.objects RLS.

drop trigger if exists enforce_product_media_storage_object on storage.objects;
drop function if exists public.enforce_product_media_storage_object();

create or replace function public.can_write_product_media_storage_object(
  object_name text,
  object_owner_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.role() = 'authenticated'
    and public.storage_object_product_id(object_name) is not null
    and public.storage_object_manufacturer_id(object_name) is not null
    and public.storage_object_manufacturer_id(object_name) = public.product_media_owner_id(public.storage_object_product_id(object_name))
    and object_name like public.product_media_path_prefix(public.storage_object_product_id(object_name)) || '%'
    and public.can_manage_product_media(public.storage_object_product_id(object_name))
    and (object_owner_id is null or object_owner_id = auth.uid()::text),
    false
  )
$$;

revoke execute on function public.can_write_product_media_storage_object(text, text) from public;
grant execute on function public.can_write_product_media_storage_object(text, text) to authenticated;

drop policy if exists "product_media_owner_admin_insert" on storage.objects;
drop policy if exists "product_media_owner_admin_update" on storage.objects;
drop policy if exists "product_media_owner_admin_delete" on storage.objects;

create policy "product_media_owner_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('product-images', 'product-documents')
  and public.can_write_product_media_storage_object(name, owner_id)
);

create policy "product_media_owner_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('product-images', 'product-documents')
  and public.can_write_product_media_storage_object(name, owner_id)
)
with check (
  bucket_id in ('product-images', 'product-documents')
  and public.can_write_product_media_storage_object(name, owner_id)
);

create policy "product_media_owner_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('product-images', 'product-documents')
  and public.can_write_product_media_storage_object(name, owner_id)
);
