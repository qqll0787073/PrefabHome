begin;

-- Manufacturer transaction authority is valid only while both the Auth profile
-- and owned business entity remain active and approved. Onboarding policies use
-- direct owner_id checks and therefore remain available before approval.
create or replace function public.owns_manufacturer(manufacturer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manufacturers m
    join public.profiles p on p.id = m.owner_id
    where m.id = manufacturer_uuid
      and m.owner_id = auth.uid()
      and p.role = 'manufacturer'
      and p.status = 'active'
      and m.application_status = 'approved'
  )
$$;

create or replace function public.get_my_manufacturer_account()
returns table (
  profile_id uuid,
  profile_email text,
  profile_full_name text,
  profile_role text,
  profile_status text,
  profile_created_at timestamptz,
  id uuid,
  company_name text,
  company_legal_name text,
  company_display_name text,
  contact_person text,
  contact_title text,
  email text,
  phone text,
  website text,
  country text,
  province text,
  city text,
  street_address text,
  postal_code text,
  year_established integer,
  export_experience text,
  product_categories text[],
  certifications text[],
  company_description text,
  application_status text,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.email, p.full_name, p.role, p.status, p.created_at,
    m.id, m.company_name, m.company_legal_name, m.company_display_name,
    m.contact_person, m.contact_title, m.email, m.phone, m.website,
    m.country, m.province, m.city, m.street_address, m.postal_code,
    m.year_established, m.export_experience, m.product_categories,
    m.certifications, m.company_description, m.application_status,
    m.submitted_at, m.created_at, m.updated_at
  from public.profiles p
  left join public.manufacturers m on m.owner_id = p.id
  where p.id = auth.uid()
    and p.role = 'manufacturer'
$$;

create or replace function public.save_my_manufacturer_application(
  company_legal_name_text text,
  company_display_name_text text,
  contact_person_text text,
  contact_title_text text,
  contact_email_text text,
  contact_phone_text text,
  website_text text,
  country_text text,
  region_text text,
  city_text text,
  street_address_text text,
  postal_code_text text,
  year_established_value integer,
  export_experience_text text,
  product_categories_value text[],
  certifications_value text[],
  company_description_text text,
  submit_application boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles%rowtype;
  existing public.manufacturers%rowtype;
  next_status text;
  display_name text := nullif(btrim(company_display_name_text), '');
  legal_name text := nullif(btrim(company_legal_name_text), '');
begin
  select * into actor from public.profiles where id = auth.uid();
  if not found or actor.role <> 'manufacturer' or actor.status <> 'active' then
    raise exception 'Active Manufacturer account required.';
  end if;

  select * into existing
  from public.manufacturers
  where owner_id = auth.uid()
  for update;

  if found and existing.application_status not in ('draft', 'rejected') then
    raise exception 'Manufacturer application is not editable in its current status.';
  end if;

  next_status := case when submit_application then 'submitted' else coalesce(existing.application_status, 'draft') end;

  if submit_application and (
    legal_name is null or display_name is null
    or nullif(btrim(contact_person_text), '') is null
    or nullif(btrim(contact_email_text), '') is null
    or nullif(btrim(country_text), '') is null
    or nullif(btrim(city_text), '') is null
    or nullif(btrim(company_description_text), '') is null
    or coalesce(array_length(product_categories_value, 1), 0) = 0
  ) then
    raise exception 'Complete Manufacturer application required before submission.';
  end if;

  if year_established_value is not null
    and (year_established_value < 1800 or year_established_value > extract(year from now())::integer) then
    raise exception 'Invalid year established.';
  end if;

  if existing.id is null then
    insert into public.manufacturers (
      owner_id, company_name, company_legal_name, company_display_name,
      contact_person, contact_title, email, phone, website, country, province,
      city, street_address, postal_code, year_established, export_experience,
      product_categories, certifications, company_description, application_status
    ) values (
      auth.uid(), coalesce(display_name, legal_name, 'Untitled manufacturer application'),
      legal_name, display_name, nullif(btrim(contact_person_text), ''),
      nullif(btrim(contact_title_text), ''), nullif(btrim(contact_email_text), ''),
      nullif(btrim(contact_phone_text), ''), nullif(btrim(website_text), ''),
      coalesce(nullif(btrim(country_text), ''), 'Unspecified'), nullif(btrim(region_text), ''),
      nullif(btrim(city_text), ''), nullif(btrim(street_address_text), ''),
      nullif(btrim(postal_code_text), ''), year_established_value,
      nullif(btrim(export_experience_text), ''), coalesce(product_categories_value, '{}'),
      coalesce(certifications_value, '{}'), nullif(btrim(company_description_text), ''), next_status
    ) returning id into existing.id;
  else
    update public.manufacturers set
      company_name = coalesce(display_name, legal_name, 'Untitled manufacturer application'),
      company_legal_name = legal_name,
      company_display_name = display_name,
      contact_person = nullif(btrim(contact_person_text), ''),
      contact_title = nullif(btrim(contact_title_text), ''),
      email = nullif(btrim(contact_email_text), ''),
      phone = nullif(btrim(contact_phone_text), ''),
      website = nullif(btrim(website_text), ''),
      country = coalesce(nullif(btrim(country_text), ''), 'Unspecified'),
      province = nullif(btrim(region_text), ''),
      city = nullif(btrim(city_text), ''),
      street_address = nullif(btrim(street_address_text), ''),
      postal_code = nullif(btrim(postal_code_text), ''),
      year_established = year_established_value,
      export_experience = nullif(btrim(export_experience_text), ''),
      product_categories = coalesce(product_categories_value, '{}'),
      certifications = coalesce(certifications_value, '{}'),
      company_description = nullif(btrim(company_description_text), ''),
      application_status = next_status
    where id = existing.id
    returning id into existing.id;
  end if;
  return existing.id;
end;
$$;

drop policy if exists "manufacturers_insert_one_own_application" on public.manufacturers;
drop policy if exists "manufacturers_update_own_application" on public.manufacturers;
revoke all on function public.get_my_manufacturer_account() from public, anon;
revoke all on function public.save_my_manufacturer_application(text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text[],text[],text,boolean) from public, anon;
grant execute on function public.get_my_manufacturer_account() to authenticated;
grant execute on function public.save_my_manufacturer_application(text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text[],text[],text,boolean) to authenticated;

commit;
