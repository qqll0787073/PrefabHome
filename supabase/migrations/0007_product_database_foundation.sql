-- PH-003 Product database foundation.
-- Additive migration using the existing public.products table.

alter table public.products
  add column if not exists sku text,
  add column if not exists model_name text,
  add column if not exists slug text,
  add column if not exists short_description text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists intended_uses text[] not null default '{}'::text[],
  add column if not exists floor_area_sq_ft numeric,
  add column if not exists bedrooms smallint,
  add column if not exists bathrooms numeric,
  add column if not exists stories smallint,
  add column if not exists length_ft numeric,
  add column if not exists width_ft numeric,
  add column if not exists height_ft numeric,
  add column if not exists structure_material text,
  add column if not exists exterior_finish text,
  add column if not exists roof_type text,
  add column if not exists insulation text,
  add column if not exists electrical_standard text,
  add column if not exists plumbing_standard text,
  add column if not exists wind_rating text,
  add column if not exists snow_load_psf numeric,
  add column if not exists currency text not null default 'USD',
  add column if not exists fob_price numeric,
  add column if not exists price_unit text,
  add column if not exists minimum_order_quantity integer,
  add column if not exists production_lead_time_weeks integer,
  add column if not exists port_of_loading text,
  add column if not exists hs_code text,
  add column if not exists certifications text[] not null default '{}'::text[],
  add column if not exists target_markets text[] not null default '{}'::text[],
  add column if not exists notes text,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz;

update public.products
set
  model_name = coalesce(model_name, name),
  short_description = coalesce(short_description, description),
  floor_area_sq_ft = coalesce(floor_area_sq_ft, size_sqft::numeric),
  fob_price = coalesce(fob_price, base_price),
  production_lead_time_weeks = coalesce(production_lead_time_weeks, lead_time_weeks),
  status = case status
    when 'active' then 'published'
    when 'pending_review' then 'submitted'
    else status
  end,
  published_at = case
    when status = 'active' and published_at is null then now()
    else published_at
  end
where
  model_name is null
  or short_description is null
  or floor_area_sq_ft is null
  or fob_price is null
  or production_lead_time_weeks is null
  or status in ('active', 'pending_review');

alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'submitted', 'published', 'rejected', 'archived'))
  not valid;

alter table public.products
  validate constraint products_status_check;

alter table public.products
  add constraint products_currency_length_check
  check (char_length(currency) = 3)
  not valid;

alter table public.products
  validate constraint products_currency_length_check;

alter table public.products
  add constraint products_non_negative_numbers_check
  check (
    (fob_price is null or fob_price >= 0)
    and (base_price is null or base_price >= 0)
    and (floor_area_sq_ft is null or floor_area_sq_ft >= 0)
    and (size_sqft is null or size_sqft >= 0)
    and (bedrooms is null or bedrooms >= 0)
    and (bathrooms is null or bathrooms >= 0)
    and (stories is null or stories >= 0)
    and (length_ft is null or length_ft >= 0)
    and (width_ft is null or width_ft >= 0)
    and (height_ft is null or height_ft >= 0)
    and (snow_load_psf is null or snow_load_psf >= 0)
  )
  not valid;

alter table public.products
  validate constraint products_non_negative_numbers_check;

alter table public.products
  add constraint products_ordering_check
  check (
    (minimum_order_quantity is null or minimum_order_quantity >= 1)
    and (production_lead_time_weeks is null or production_lead_time_weeks >= 0)
    and (lead_time_weeks is null or lead_time_weeks >= 0)
  )
  not valid;

alter table public.products
  validate constraint products_ordering_check;

create unique index if not exists products_manufacturer_sku_key
  on public.products (manufacturer_id, lower(sku))
  where sku is not null;

create unique index if not exists products_slug_key
  on public.products (lower(slug))
  where slug is not null;

create index if not exists products_published_idx
  on public.products (published_at)
  where status = 'published';

create index if not exists products_submitted_idx
  on public.products (submitted_at)
  where status = 'submitted';

grant select on table public.products to anon;

create or replace function public.set_product_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_product_updated_at();

create or replace function public.is_manufacturer_owner_of_product(product_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products p
    join public.manufacturers m on m.id = p.manufacturer_id
    where p.id = product_uuid
      and m.owner_id = auth.uid()
  )
$$;

create or replace function public.manage_product_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.is_admin() then
      if new.status = 'published' then
        new.published_at := coalesce(new.published_at, now());
        new.archived_at := null;
      elsif new.status = 'archived' then
        new.archived_at := coalesce(new.archived_at, now());
      end if;

      return new;
    end if;

    if not public.owns_manufacturer(new.manufacturer_id) then
      raise exception 'Manufacturers can create products only for their own manufacturer profile.';
    end if;

    if not public.is_approved_manufacturer(new.manufacturer_id) then
      raise exception 'Manufacturer must be approved before creating products.';
    end if;

    if new.status not in ('draft', 'submitted') then
      raise exception 'Manufacturers can create only draft or submitted products.';
    end if;

    if new.review_notes is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null then
      raise exception 'Product review fields can only be set by an admin.';
    end if;

    if new.status = 'submitted' then
      new.submitted_at := now();
    else
      new.submitted_at := null;
    end if;

    new.published_at := null;
    new.archived_at := null;
    return new;
  end if;

  new.updated_at := clock_timestamp();

  if public.is_admin() then
    if new.status is distinct from old.status
      or new.review_notes is distinct from old.review_notes then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;

    if new.status = 'published' and old.status is distinct from 'published' then
      new.published_at := now();
      new.archived_at := null;
    elsif new.status = 'archived' and old.status is distinct from 'archived' then
      new.archived_at := now();
    elsif new.status = 'submitted' and old.status is distinct from 'submitted' then
      new.submitted_at := now();
    end if;

    return new;
  end if;

  if new.manufacturer_id is distinct from old.manufacturer_id then
    raise exception 'Product manufacturer cannot be changed.';
  end if;

  if not public.owns_manufacturer(old.manufacturer_id) then
    raise exception 'Manufacturers can update only their own products.';
  end if;

  if old.status not in ('draft', 'rejected') then
    raise exception 'Manufacturers can edit products only while draft or rejected.';
  end if;

  if new.review_notes is distinct from old.review_notes
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.published_at is distinct from old.published_at
    or new.archived_at is distinct from old.archived_at then
    raise exception 'Product review and publication fields can only be changed by an admin.';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('draft', 'rejected') and new.status = 'submitted' then
      new.submitted_at := now();
      return new;
    end if;

    raise exception 'Manufacturers can only submit draft or rejected products.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unapproved_product_changes on public.products;
drop trigger if exists manage_product_lifecycle on public.products;

create trigger manage_product_lifecycle
before insert or update on public.products
for each row execute function public.manage_product_lifecycle();

drop policy if exists "products_select_active_or_owner_or_admin" on public.products;
drop policy if exists "products_insert_owner_or_admin" on public.products;
drop policy if exists "products_update_owner_or_admin" on public.products;
drop policy if exists "products_insert_approved_owner_or_admin" on public.products;
drop policy if exists "products_update_approved_owner_or_admin" on public.products;
drop policy if exists "products_public_select_published" on public.products;
drop policy if exists "products_authenticated_select_visible" on public.products;
drop policy if exists "products_manufacturer_insert_own_approved" on public.products;
drop policy if exists "products_manufacturer_update_own_editable" on public.products;
drop policy if exists "products_admin_manage_all" on public.products;

create policy "products_public_select_published"
on public.products
for select
to anon
using (status = 'published');

create policy "products_authenticated_select_visible"
on public.products
for select
to authenticated
using (
  status = 'published'
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

create policy "products_manufacturer_insert_own_approved"
on public.products
for insert
to authenticated
with check (
  public.owns_manufacturer(manufacturer_id)
  and public.is_approved_manufacturer(manufacturer_id)
  and status in ('draft', 'submitted')
);

create policy "products_manufacturer_update_own_editable"
on public.products
for update
to authenticated
using (public.owns_manufacturer(manufacturer_id))
with check (public.owns_manufacturer(manufacturer_id));

create policy "products_admin_manage_all"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
