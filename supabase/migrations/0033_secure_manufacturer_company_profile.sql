begin;

create or replace function public.manage_manufacturer_application_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_status text;
begin
  if tg_op = 'INSERT' then
    if new.review_notes is not null or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Manufacturer review fields cannot be set during application creation.';
    end if;
    if new.application_status not in ('draft', 'submitted') then
      raise exception 'Manufacturers can only create draft or submitted applications.';
    end if;
    new.submitted_at := case when new.application_status = 'submitted' then now() else null end;
    return new;
  end if;

  if public.is_admin() then
    if new.application_status is distinct from old.application_status
      or new.review_notes is distinct from old.review_notes then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if auth.uid() is distinct from old.owner_id then
    raise exception 'Only the manufacturer owner or an admin can update this application.';
  end if;

  -- Approved owners receive one deliberately narrow profile-maintenance path.
  -- This trigger independently enforces the allowlist even if a future policy
  -- accidentally exposes direct UPDATE access.
  if old.application_status = 'approved' then
    select role, status into actor_role, actor_status
    from public.profiles where id = auth.uid();

    if actor_role is distinct from 'manufacturer' or actor_status is distinct from 'active' then
      raise exception 'Active Manufacturer account required.';
    end if;
    if new.owner_id is distinct from old.owner_id
      or new.application_status is distinct from old.application_status
      or new.company_legal_name is distinct from old.company_legal_name
      or new.country is distinct from old.country
      or new.year_established is distinct from old.year_established
      or new.export_experience is distinct from old.export_experience
      or new.product_categories is distinct from old.product_categories
      or new.certifications is distinct from old.certifications
      or new.review_notes is distinct from old.review_notes
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.submitted_at is distinct from old.submitted_at
      or new.verification_status is distinct from old.verification_status then
      raise exception 'Approved Manufacturer profile update contains protected fields.';
    end if;
    if (to_jsonb(new) - array[
      'company_name', 'company_display_name', 'company_description', 'website',
      'city', 'province', 'contact_person', 'contact_title', 'email', 'phone',
      'street_address', 'postal_code'
    ]) is distinct from (to_jsonb(old) - array[
      'company_name', 'company_display_name', 'company_description', 'website',
      'city', 'province', 'contact_person', 'contact_title', 'email', 'phone',
      'street_address', 'postal_code'
    ]) then
      raise exception 'Approved Manufacturer profile update contains unexpected fields.';
    end if;
    return new;
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
    and not (old.application_status in ('draft', 'rejected') and new.application_status = 'submitted') then
    raise exception 'Submitted timestamp can only change during a valid submission.';
  end if;
  if old.application_status not in ('draft', 'rejected') then
    raise exception 'Manufacturers can edit applications only while they are draft or rejected.';
  end if;
  if new.application_status is distinct from old.application_status then
    if old.application_status in ('draft', 'rejected') and new.application_status = 'submitted' then
      new.submitted_at := now();
      return new;
    end if;
    raise exception 'Manufacturers can only submit draft or rejected applications.';
  end if;
  return new;
end;
$$;

create or replace function public.update_my_manufacturer_company_profile(
  company_display_name_text text,
  company_description_text text,
  website_text text,
  city_text text,
  region_text text,
  contact_person_text text,
  contact_title_text text,
  contact_email_text text,
  contact_phone_text text,
  street_address_text text,
  postal_code_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles%rowtype;
  owned public.manufacturers%rowtype;
  display_name text := nullif(btrim(company_display_name_text), '');
  description text := nullif(btrim(company_description_text), '');
  normalized_website text := nullif(btrim(website_text), '');
  normalized_email text := nullif(lower(btrim(contact_email_text)), '');
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or actor.role <> 'manufacturer' or actor.status <> 'active' then
    raise exception 'Active Manufacturer account required.';
  end if;

  select * into owned from public.manufacturers where owner_id = auth.uid() for update;
  if not found or owned.application_status <> 'approved' then
    raise exception 'Approved Manufacturer account required.';
  end if;

  if display_name is null or length(display_name) > 120 then raise exception 'Company display name must be between 1 and 120 characters.'; end if;
  if description is null or length(description) > 2000 then raise exception 'Company description must be between 1 and 2000 characters.'; end if;
  if normalized_website is not null and (length(normalized_website) > 500 or normalized_website !~* '^https?://[^[:space:]]+$') then raise exception 'Website must be a valid HTTP or HTTPS URL.'; end if;
  if nullif(btrim(city_text), '') is null or length(btrim(city_text)) > 120 then raise exception 'City must be between 1 and 120 characters.'; end if;
  if length(coalesce(btrim(region_text), '')) > 120 then raise exception 'Province or state is too long.'; end if;
  if nullif(btrim(contact_person_text), '') is null or length(btrim(contact_person_text)) > 120 then raise exception 'Contact person must be between 1 and 120 characters.'; end if;
  if length(coalesce(btrim(contact_title_text), '')) > 120 then raise exception 'Contact title is too long.'; end if;
  if normalized_email is null or length(normalized_email) > 254 or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Contact email is invalid.'; end if;
  if length(coalesce(btrim(contact_phone_text), '')) > 40 then raise exception 'Phone is too long.'; end if;
  if length(coalesce(btrim(street_address_text), '')) > 300 then raise exception 'Street address is too long.'; end if;
  if length(coalesce(btrim(postal_code_text), '')) > 32 then raise exception 'Postal code is too long.'; end if;

  update public.manufacturers set
    company_name = display_name,
    company_display_name = display_name,
    company_description = description,
    website = normalized_website,
    city = nullif(btrim(city_text), ''),
    province = nullif(btrim(region_text), ''),
    contact_person = nullif(btrim(contact_person_text), ''),
    contact_title = nullif(btrim(contact_title_text), ''),
    email = normalized_email,
    phone = nullif(btrim(contact_phone_text), ''),
    street_address = nullif(btrim(street_address_text), ''),
    postal_code = nullif(btrim(postal_code_text), '')
  where id = owned.id;
  return owned.id;
end;
$$;

revoke all on function public.update_my_manufacturer_company_profile(text,text,text,text,text,text,text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.update_my_manufacturer_company_profile(text,text,text,text,text,text,text,text,text,text,text) to authenticated;

commit;
