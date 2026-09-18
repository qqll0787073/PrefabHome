-- Candidate-only rollback probe. Never replaces the public function.
-- Run only on explicitly guarded Staging after trigger side-effect inspection.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
create temp table reconciliation_marker (id integer);
create or replace function pg_temp.save_my_manufacturer_product(
  product_uuid uuid,
  sku_text text,
  model_name_text text,
  slug_text text,
  category_text text,
  short_description_text text,
  description_text text,
  tags_value text[],
  intended_uses_value text[],
  floor_area_value numeric,
  bedrooms_value integer,
  bathrooms_value numeric,
  stories_value integer,
  length_value numeric,
  width_value numeric,
  height_value numeric,
  structure_material_text text,
  exterior_finish_text text,
  roof_type_text text,
  insulation_text text,
  electrical_standard_text text,
  plumbing_standard_text text,
  wind_rating_text text,
  snow_load_value numeric,
  currency_text text,
  fob_price_value numeric,
  price_unit_text text,
  minimum_order_quantity_value integer,
  production_lead_time_value integer,
  port_of_loading_text text,
  hs_code_text text,
  certifications_value text[],
  target_markets_value text[],
  notes_text text,
  submit_product boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owned_manufacturer uuid;
  existing public.products%rowtype;
  saved_id uuid;
  normalized_model text := nullif(btrim(model_name_text), '');
  normalized_category text := nullif(btrim(category_text), '');
  normalized_currency text := upper(coalesce(nullif(btrim(currency_text), ''), 'USD'));
  next_status text;
begin
  select m.id into owned_manufacturer
  from public.manufacturers m
  where public.owns_manufacturer(m.id)
  for update;

  if owned_manufacturer is null then
    raise exception 'Active approved Manufacturer account required.';
  end if;

  if submit_product and (normalized_model is null or normalized_category is null
    or nullif(btrim(description_text), '') is null) then
    raise exception 'Complete Product required before submission.';
  end if;

  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid Product currency.'; end if;
  if slug_text is not null and btrim(slug_text) <> ''
    and btrim(slug_text) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid Product slug.';
  end if;
  if (fob_price_value is not null and fob_price_value < 0)
    or (floor_area_value is not null and floor_area_value < 0)
    or (bathrooms_value is not null and bathrooms_value < 0)
    or (length_value is not null and length_value < 0)
    or (width_value is not null and width_value < 0)
    or (height_value is not null and height_value < 0)
    or (snow_load_value is not null and snow_load_value < 0)
    or (bedrooms_value is not null and bedrooms_value < 0)
    or (stories_value is not null and stories_value < 0)
    or (production_lead_time_value is not null and production_lead_time_value < 0)
    or (minimum_order_quantity_value is not null and minimum_order_quantity_value < 1) then
    raise exception 'Invalid Product numeric value.';
  end if;
  if length(coalesce(normalized_model, '')) > 200 or length(coalesce(normalized_category, '')) > 120
    or length(coalesce(description_text, '')) > 5000 or length(coalesce(short_description_text, '')) > 500
    or length(coalesce(notes_text, '')) > 5000
    or coalesce(array_length(tags_value, 1), 0) > 50
    or coalesce(array_length(intended_uses_value, 1), 0) > 50
    or coalesce(array_length(certifications_value, 1), 0) > 50
    or coalesce(array_length(target_markets_value, 1), 0) > 50 then
    raise exception 'Product field limit exceeded.';
  end if;

  if product_uuid is not null then
    select * into existing from public.products p where p.id = product_uuid for update;
    if not found or existing.manufacturer_id <> owned_manufacturer then
      raise exception 'Product unavailable.';
    end if;
    if existing.status not in ('draft', 'rejected') then
      raise exception 'Product is not editable in its current status.';
    end if;
  end if;

  next_status := case when submit_product then 'submitted' else coalesce(existing.status, 'draft') end;

  if product_uuid is null then
    insert into public.products (
      manufacturer_id, name, model_name, sku, slug, category, short_description,
      description, tags, intended_uses, floor_area_sq_ft, bedrooms, bathrooms, stories,
      length_ft, width_ft, height_ft, structure_material, exterior_finish, roof_type,
      insulation, electrical_standard, plumbing_standard, wind_rating, snow_load_psf,
      currency, fob_price, price_unit, minimum_order_quantity, production_lead_time_weeks,
      port_of_loading, hs_code, certifications, target_markets, notes, status,
      base_price, size_sqft, lead_time_weeks
    ) values (
      owned_manufacturer, coalesce(normalized_model, 'Untitled product draft'), normalized_model,
      nullif(btrim(sku_text), ''), nullif(btrim(slug_text), ''), coalesce(normalized_category, 'Uncategorized'),
      nullif(btrim(short_description_text), ''), nullif(btrim(description_text), ''),
      coalesce(tags_value, '{}'), coalesce(intended_uses_value, '{}'), floor_area_value,
      bedrooms_value, bathrooms_value, stories_value, length_value, width_value, height_value,
      nullif(btrim(structure_material_text), ''), nullif(btrim(exterior_finish_text), ''),
      nullif(btrim(roof_type_text), ''), nullif(btrim(insulation_text), ''),
      nullif(btrim(electrical_standard_text), ''), nullif(btrim(plumbing_standard_text), ''),
      nullif(btrim(wind_rating_text), ''), snow_load_value, normalized_currency, fob_price_value,
      nullif(btrim(price_unit_text), ''), minimum_order_quantity_value, production_lead_time_value,
      nullif(btrim(port_of_loading_text), ''), nullif(btrim(hs_code_text), ''),
      coalesce(certifications_value, '{}'), coalesce(target_markets_value, '{}'),
      nullif(btrim(notes_text), ''), next_status, fob_price_value,
      case when floor_area_value is null then null else floor(floor_area_value)::integer end,
      production_lead_time_value
    ) returning id into saved_id;
  else
    update public.products set
      name = coalesce(normalized_model, 'Untitled product draft'), model_name = normalized_model,
      sku = nullif(btrim(sku_text), ''), slug = nullif(btrim(slug_text), ''),
      category = coalesce(normalized_category, 'Uncategorized'),
      short_description = nullif(btrim(short_description_text), ''),
      description = nullif(btrim(description_text), ''), tags = coalesce(tags_value, '{}'),
      intended_uses = coalesce(intended_uses_value, '{}'), floor_area_sq_ft = floor_area_value,
      bedrooms = bedrooms_value, bathrooms = bathrooms_value, stories = stories_value,
      length_ft = length_value, width_ft = width_value, height_ft = height_value,
      structure_material = nullif(btrim(structure_material_text), ''),
      exterior_finish = nullif(btrim(exterior_finish_text), ''), roof_type = nullif(btrim(roof_type_text), ''),
      insulation = nullif(btrim(insulation_text), ''), electrical_standard = nullif(btrim(electrical_standard_text), ''),
      plumbing_standard = nullif(btrim(plumbing_standard_text), ''), wind_rating = nullif(btrim(wind_rating_text), ''),
      snow_load_psf = snow_load_value, currency = normalized_currency, fob_price = fob_price_value,
      price_unit = nullif(btrim(price_unit_text), ''), minimum_order_quantity = minimum_order_quantity_value,
      production_lead_time_weeks = production_lead_time_value, port_of_loading = nullif(btrim(port_of_loading_text), ''),
      hs_code = nullif(btrim(hs_code_text), ''), certifications = coalesce(certifications_value, '{}'),
      target_markets = coalesce(target_markets_value, '{}'), notes = nullif(btrim(notes_text), ''),
      status = next_status, base_price = fob_price_value,
      size_sqft = case when floor_area_value is null then null else floor(floor_area_value)::integer end,
      lead_time_weeks = production_lead_time_value
    where id = product_uuid returning id into saved_id;
  end if;
  return saved_id;
end;
$$;
revoke all on function pg_temp.save_my_manufacturer_product(uuid,text,text,text,text,text,text,text[],text[],numeric,integer,numeric,integer,numeric,numeric,numeric,text,text,text,text,text,text,text,numeric,text,numeric,text,integer,integer,text,text,text[],text[],text,boolean) from public, anon;
grant execute on function pg_temp.save_my_manufacturer_product(uuid,text,text,text,text,text,text,text[],text[],numeric,integer,numeric,integer,numeric,numeric,numeric,text,text,text,text,text,text,text,numeric,text,numeric,text,integer,integer,text,text,text[],text[],text,boolean) to authenticated;
do $$ begin
  execute format('grant usage on schema %I to authenticated', pg_my_temp_schema()::regnamespace::text);
end $$;
-- Run after migrations 0001-0036 in an isolated disposable database.
-- The fixture and every attempted Product mutation roll back.

do $$
declare
  manufacturer_user uuid := gen_random_uuid();
  other_manufacturer_user uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (manufacturer_user, 'product-validation-manufacturer-' || manufacturer_user || '@example.test',
      '{"full_name":"Product Validation Manufacturer","role":"manufacturer"}'),
    (other_manufacturer_user, 'product-validation-other-' || other_manufacturer_user || '@example.test',
      '{"full_name":"Other Product Validation Manufacturer","role":"manufacturer"}'),
    (admin_user, 'product-validation-admin-' || admin_user || '@example.test',
      '{"full_name":"Product Validation Admin","role":"buyer"}');

  update public.profiles set role = 'admin' where id = admin_user;
  perform set_config('test.admin_user', admin_user::text, true);

  perform set_config('request.jwt.claim.sub', manufacturer_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.manufacturers (owner_id, company_name, country, application_status)
  values (manufacturer_user, 'Product Validation Manufacturer', 'US', 'draft');

  perform set_config('request.jwt.claim.sub', other_manufacturer_user::text, true);
  insert into public.manufacturers (owner_id, company_name, country, application_status)
  values (other_manufacturer_user, 'Other Product Validation Manufacturer', 'US', 'draft');
  perform set_config('test.other_manufacturer', other_manufacturer_user::text, true);

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  update public.manufacturers
  set application_status = 'approved'
  where owner_id in (manufacturer_user, other_manufacturer_user);

  perform set_config('request.jwt.claim.sub', manufacturer_user::text, true);
end;
$$;

set local role authenticated;

create function pg_temp.save_validation_product(
  floor_area numeric default null,
  bedrooms integer default null,
  bathrooms numeric default null,
  stories integer default null,
  length_ft numeric default null,
  width_ft numeric default null,
  height_ft numeric default null,
  snow_load numeric default null,
  fob_price numeric default null,
  minimum_order integer default null,
  production_lead_time integer default null,
  product_id uuid default null,
  submit_for_review boolean default false
) returns uuid
language sql
as $$
  select pg_temp.save_my_manufacturer_product(
    product_id, null, 'Validation product', null, 'ADU', null, 'Validation description', '{}', '{}',
    floor_area, bedrooms, bathrooms, stories, length_ft, width_ft, height_ft,
    null, null, null, null, null, null, null, snow_load, 'USD', fob_price,
    null, minimum_order, production_lead_time, null, null, '{}', '{}', null, submit_for_review
  )
$$;

do $$
declare
  field_name text;
  rejected boolean;
begin
  foreach field_name in array array[
    'fob_price', 'floor_area', 'bathrooms', 'length_ft', 'width_ft', 'height_ft',
    'snow_load', 'bedrooms', 'stories', 'production_lead_time'
  ] loop
    rejected := false;
    begin
      perform pg_temp.save_validation_product(
        floor_area => case when field_name = 'floor_area' then -1 else 1000 end,
        bedrooms => case when field_name = 'bedrooms' then -1 else 2 end,
        bathrooms => case when field_name = 'bathrooms' then -1 else 1.5 end,
        stories => case when field_name = 'stories' then -1 else 1 end,
        length_ft => case when field_name = 'length_ft' then -1 else 40 end,
        width_ft => case when field_name = 'width_ft' then -1 else 20 end,
        height_ft => case when field_name = 'height_ft' then -1 else 12 end,
        snow_load => case when field_name = 'snow_load' then -1 else 30 end,
        fob_price => case when field_name = 'fob_price' then -5000 else 50000 end,
        minimum_order => 1,
        production_lead_time => case when field_name = 'production_lead_time' then -1 else 8 end
      );
    exception when others then
      if sqlerrm = 'Invalid Product numeric value.' then
        rejected := true;
      else
        raise;
      end if;
    end;
    if not rejected then
      raise exception 'save_my_manufacturer_product accepted negative %', field_name;
    end if;
  end loop;

  rejected := false;
  begin
    perform pg_temp.save_validation_product(minimum_order => 0);
  exception when others then
    if sqlerrm = 'Invalid Product numeric value.' then
      rejected := true;
    else
      raise;
    end if;
  end;
  if not rejected then
    raise exception 'save_my_manufacturer_product accepted MOQ below 1';
  end if;
end;
$$;

do $$
declare
  owner_user uuid := auth.uid();
  saved_id uuid;
  denied boolean := false;
  actual_status text;
begin
  -- Optional nulls, permitted zeroes, and positive values retain their contract.
  saved_id := pg_temp.save_validation_product();
  if saved_id is null then raise exception 'Null optional draft failed'; end if;
  saved_id := pg_temp.save_validation_product(floor_area => 0, bedrooms => 0,
    bathrooms => 0, stories => 0, length_ft => 0, width_ft => 0, height_ft => 0,
    snow_load => 0, fob_price => 0, minimum_order => 1, production_lead_time => 0);
  if saved_id is null then raise exception 'Allowed zero draft failed'; end if;
  saved_id := pg_temp.save_validation_product(floor_area => 1000, fob_price => 50000,
    minimum_order => 1, production_lead_time => 8);

  perform set_config('request.jwt.claim.sub', current_setting('test.other_manufacturer'), true);
  begin
    perform pg_temp.save_validation_product(product_id => saved_id);
  exception when others then
    if sqlerrm = 'Product unavailable.' then denied := true; else raise; end if;
  end;
  if not denied then raise exception 'Cross-Manufacturer Product update accepted'; end if;
  perform set_config('request.jwt.claim.sub', owner_user::text, true);

  -- Caller cannot publish directly; either a permission error or zero rows is safe.
  begin
    update public.products set status = 'published' where id = saved_id;
    if found then raise exception 'Manufacturer publication forgery accepted'; end if;
  exception when insufficient_privilege then null;
  end;
  select status into actual_status from public.get_my_manufacturer_products() where id = saved_id;
  if actual_status is distinct from 'draft' then raise exception 'Denied publication changed status'; end if;

  perform pg_temp.save_validation_product(product_id => saved_id, submit_for_review => true);
  denied := false;
  begin
    perform pg_temp.save_validation_product(product_id => saved_id);
  exception when others then
    if sqlerrm = 'Product is not editable in its current status.' then denied := true; else raise; end if;
  end;
  if not denied then raise exception 'Submitted Product edit accepted'; end if;
  perform set_config('request.jwt.claim.sub', current_setting('test.admin_user'), true);
  update public.products set status = 'published' where id = saved_id;
  select status into actual_status from public.products where id = saved_id;
  if actual_status is distinct from 'published' then raise exception 'Admin publication failed'; end if;
end;
$$;


reset role;
rollback;
select 'PASSED: candidate numeric, cross-Manufacturer, publication, lifecycle; transaction rolled back' as regression;
