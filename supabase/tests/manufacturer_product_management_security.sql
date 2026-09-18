-- Run after migrations 0001-0036 in an isolated disposable database.
-- The fixture and every attempted Product mutation roll back.

begin;

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
  select public.save_my_manufacturer_product(
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

rollback;
