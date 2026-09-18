-- Read-only evaluation of the exact canonical numeric predicate, not an RPC write.
-- Does not prove authenticated RPC behavior; use the disposable SQL regression for that.
with cases(case_name, fob_price_value, floor_area_value, bathrooms_value, length_value, width_value, height_value, snow_load_value, bedrooms_value, stories_value, production_lead_time_value, minimum_order_quantity_value, expected_rejection) as (
  values
    ('negative_fob_price_value', -1, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, true),
    ('negative_floor_area_value', 10, -1, 10, 10, 10, 10, 10, 10, 10, 10, 10, true),
    ('negative_bathrooms_value', 10, 10, -1, 10, 10, 10, 10, 10, 10, 10, 10, true),
    ('negative_length_value', 10, 10, 10, -1, 10, 10, 10, 10, 10, 10, 10, true),
    ('negative_width_value', 10, 10, 10, 10, -1, 10, 10, 10, 10, 10, 10, true),
    ('negative_height_value', 10, 10, 10, 10, 10, -1, 10, 10, 10, 10, 10, true),
    ('negative_snow_load_value', 10, 10, 10, 10, 10, 10, -1, 10, 10, 10, 10, true),
    ('negative_bedrooms_value', 10, 10, 10, 10, 10, 10, 10, -1, 10, 10, 10, true),
    ('negative_stories_value', 10, 10, 10, 10, 10, 10, 10, 10, -1, 10, 10, true),
    ('negative_production_lead_time_value', 10, 10, 10, 10, 10, 10, 10, 10, 10, -1, 10, true),
    ('negative_minimum_order_quantity_value', 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, -1, true),
    ('zero_allowed', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, false),
    ('positive', 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, false),
    ('optional_null', null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, false),
    ('minimum_order_zero', 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0, true)
), results as (
  select case_name, expected_rejection, ((fob_price_value is not null and fob_price_value < 0)
    or (floor_area_value is not null and floor_area_value < 0)
    or (bathrooms_value is not null and bathrooms_value < 0)
    or (length_value is not null and length_value < 0)
    or (width_value is not null and width_value < 0)
    or (height_value is not null and height_value < 0)
    or (snow_load_value is not null and snow_load_value < 0)
    or (bedrooms_value is not null and bedrooms_value < 0)
    or (stories_value is not null and stories_value < 0)
    or (production_lead_time_value is not null and production_lead_time_value < 0)
    or (minimum_order_quantity_value is not null and minimum_order_quantity_value < 1)) as rejected from cases
)
select *, rejected = expected_rejection as passed from results order by case_name;
