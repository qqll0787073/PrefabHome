-- Reconcile the function deployed by 0032 without rewriting migration history.
-- Apply in normal order after 0033-0035, only when that full sequence is approved.
-- CREATE OR REPLACE preserves the existing owner and execution grants.
begin;

create or replace function public.save_my_manufacturer_product(
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

commit;
