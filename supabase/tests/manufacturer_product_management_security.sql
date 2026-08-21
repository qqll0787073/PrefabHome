-- Run after migrations 0001-0032 in an isolated disposable database.
-- The fixture and every attempted Product mutation roll back.

begin;

do $$
declare
  manufacturer_user uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (manufacturer_user, 'product-validation-manufacturer-' || manufacturer_user || '@example.test',
      '{"full_name":"Product Validation Manufacturer","role":"manufacturer"}'),
    (admin_user, 'product-validation-admin-' || admin_user || '@example.test',
      '{"full_name":"Product Validation Admin","role":"buyer"}');

  update public.profiles set role = 'admin' where id = admin_user;

  perform set_config('request.jwt.claim.sub', manufacturer_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.manufacturers (owner_id, company_name, country, application_status)
  values (manufacturer_user, 'Product Validation Manufacturer', 'US', 'draft');

  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  update public.manufacturers
  set application_status = 'approved'
  where owner_id = manufacturer_user;

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
  production_lead_time integer default null
) returns uuid
language sql
as $$
  select public.save_my_manufacturer_product(
    null, null, 'Validation product', null, 'ADU', null, null, '{}', '{}',
    floor_area, bedrooms, bathrooms, stories, length_ft, width_ft, height_ft,
    null, null, null, null, null, null, null, snow_load, 'USD', fob_price,
    null, minimum_order, production_lead_time, null, null, '{}', '{}', null, false
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

rollback;
