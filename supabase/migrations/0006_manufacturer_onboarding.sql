-- PH-002 Manufacturer onboarding and admin approval.
-- Additive migration: keeps legacy verification_status for compatibility and
-- introduces application_status as the onboarding workflow source of truth.

alter table public.manufacturers
  add column if not exists company_legal_name text,
  add column if not exists company_display_name text,
  add column if not exists contact_person text,
  add column if not exists contact_title text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists street_address text,
  add column if not exists postal_code text,
  add column if not exists year_established integer,
  add column if not exists export_experience text,
  add column if not exists product_categories text[] not null default '{}'::text[],
  add column if not exists certifications text[] not null default '{}'::text[],
  add column if not exists company_description text,
  add column if not exists application_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz;

alter table public.manufacturers
  add constraint manufacturers_application_status_check
  check (application_status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'suspended'))
  not valid;

alter table public.manufacturers
  validate constraint manufacturers_application_status_check;

alter table public.manufacturers
  add constraint manufacturers_year_established_check
  check (year_established is null or (year_established >= 1800 and year_established <= extract(year from now())::integer))
  not valid;

alter table public.manufacturers
  validate constraint manufacturers_year_established_check;

create unique index if not exists manufacturers_owner_id_key
  on public.manufacturers (owner_id);

create index if not exists manufacturers_application_status_idx
  on public.manufacturers (application_status);

create index if not exists manufacturers_reviewed_by_idx
  on public.manufacturers (reviewed_by);

create or replace function public.is_approved_manufacturer(manufacturer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manufacturers
    where id = manufacturer_uuid
      and application_status = 'approved'
  )
$$;

create or replace function public.manage_manufacturer_application_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.review_notes is not null
      or new.reviewed_by is not null
      or new.reviewed_at is not null then
      raise exception 'Manufacturer review fields cannot be set during application creation.';
    end if;

    if new.application_status not in ('draft', 'submitted') then
      raise exception 'Manufacturers can only create draft or submitted applications.';
    end if;

    if new.application_status = 'submitted' then
      new.submitted_at := now();
    else
      new.submitted_at := null;
    end if;

    return new;
  end if;

  if public.is_admin() then
    if (
      new.application_status is distinct from old.application_status
      or new.review_notes is distinct from old.review_notes
    ) then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;

    return new;
  end if;

  if auth.uid() is distinct from old.owner_id then
    raise exception 'Only the manufacturer owner or an admin can update this application.';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Manufacturer ownership cannot be changed by the manufacturer.';
  end if;

  if new.review_notes is distinct from old.review_notes
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Manufacturer review fields can only be changed by an admin.';
  end if;

  if new.submitted_at is distinct from old.submitted_at
    and not (
      old.application_status in ('draft', 'rejected')
      and new.application_status = 'submitted'
    ) then
    raise exception 'Submitted timestamp can only change during a valid submission.';
  end if;

  if old.application_status in ('submitted', 'under_review') then
    raise exception 'Applications under review cannot be edited by the manufacturer.';
  end if;

  if new.application_status is distinct from old.application_status then
    if old.application_status in ('draft', 'rejected')
      and new.application_status = 'submitted' then
      new.submitted_at := now();
      return new;
    end if;

    raise exception 'Manufacturers can only submit draft or rejected applications.';
  end if;

  return new;
end;
$$;

drop trigger if exists manage_manufacturer_application_review on public.manufacturers;

create trigger manage_manufacturer_application_review
before insert or update on public.manufacturers
for each row execute function public.manage_manufacturer_application_review();

create or replace function public.prevent_unapproved_product_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_manufacturer(new.manufacturer_id) then
    raise exception 'Manufacturer must be approved before creating or publishing products.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unapproved_product_changes on public.products;

create trigger prevent_unapproved_product_changes
before insert or update of manufacturer_id, status on public.products
for each row execute function public.prevent_unapproved_product_changes();

drop policy if exists "manufacturers_select_approved_or_owner_or_admin" on public.manufacturers;
drop policy if exists "manufacturers_insert_owner" on public.manufacturers;
drop policy if exists "manufacturers_update_owner_or_admin" on public.manufacturers;

create policy "manufacturers_select_owner_or_admin"
on public.manufacturers
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin());

create policy "manufacturers_insert_one_own_application"
on public.manufacturers
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.current_profile_role() = 'manufacturer'
  and application_status in ('draft', 'submitted')
  and review_notes is null
  and reviewed_by is null
  and reviewed_at is null
);

create policy "manufacturers_update_own_application"
on public.manufacturers
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "manufacturers_admin_review_all"
on public.manufacturers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_insert_owner_or_admin" on public.products;
drop policy if exists "products_update_owner_or_admin" on public.products;

create policy "products_insert_approved_owner_or_admin"
on public.products
for insert
to authenticated
with check (
  public.is_approved_manufacturer(manufacturer_id)
  and (public.owns_manufacturer(manufacturer_id) or public.is_admin())
);

create policy "products_update_approved_owner_or_admin"
on public.products
for update
to authenticated
using (public.owns_manufacturer(manufacturer_id) or public.is_admin())
with check (
  public.is_approved_manufacturer(manufacturer_id)
  and (public.owns_manufacturer(manufacturer_id) or public.is_admin())
);
