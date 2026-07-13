-- PH-005 Public Product Marketplace projection.
-- Adds a public-safe product browse view without exposing private product,
-- manufacturer, media, review, or ownership fields.

create index if not exists products_marketplace_category_idx
  on public.products (category)
  where status = 'published';

create index if not exists products_marketplace_price_idx
  on public.products (fob_price)
  where status = 'published';

create index if not exists products_marketplace_area_idx
  on public.products (floor_area_sq_ft)
  where status = 'published';

create index if not exists products_marketplace_target_markets_idx
  on public.products using gin (target_markets)
  where status = 'published';

create index if not exists products_marketplace_certifications_idx
  on public.products using gin (certifications)
  where status = 'published';

drop view if exists public.marketplace_products;

create view public.marketplace_products
with (security_barrier = true)
as
select
  p.id,
  p.manufacturer_id,
  coalesce(nullif(m.company_display_name, ''), nullif(m.company_name, ''), 'Approved manufacturer') as manufacturer_display_name,
  m.country as manufacturer_country,
  p.name,
  p.model_name,
  p.slug,
  p.category,
  p.short_description,
  p.description,
  p.tags,
  p.intended_uses,
  p.floor_area_sq_ft,
  p.bedrooms,
  p.bathrooms,
  p.stories,
  p.length_ft,
  p.width_ft,
  p.height_ft,
  p.structure_material,
  p.exterior_finish,
  p.roof_type,
  p.insulation,
  p.electrical_standard,
  p.plumbing_standard,
  p.wind_rating,
  p.snow_load_psf,
  p.currency,
  p.fob_price,
  p.price_unit,
  p.minimum_order_quantity,
  p.production_lead_time_weeks,
  p.port_of_loading,
  p.hs_code,
  p.certifications,
  p.target_markets,
  p.published_at,
  concat_ws(
    ' ',
    p.name,
    p.model_name,
    p.category,
    p.short_description,
    array_to_string(p.tags, ' ')
  ) as search_text,
  primary_media.id as primary_media_id,
  primary_media.media_type as primary_media_type,
  primary_media.storage_bucket as primary_storage_bucket,
  primary_media.storage_path as primary_storage_path,
  primary_media.original_filename as primary_original_filename,
  primary_media.mime_type as primary_mime_type,
  primary_media.title as primary_title,
  primary_media.alt_text as primary_alt_text,
  primary_media.sort_order as primary_sort_order,
  primary_media.is_primary as primary_is_primary
from public.products p
join public.manufacturers m on m.id = p.manufacturer_id
left join lateral (
  select
    pm.id,
    pm.media_type,
    pm.storage_bucket,
    pm.storage_path,
    pm.original_filename,
    pm.mime_type,
    pm.title,
    pm.alt_text,
    pm.sort_order,
    pm.is_primary
  from public.product_media pm
  where pm.product_id = p.id
    and pm.visibility = 'public'
    and pm.storage_bucket = 'product-images'
    and pm.media_type in (
      'exterior_image',
      'interior_image',
      'floor_plan',
      'rendering',
      'factory_photo'
    )
  order by pm.is_primary desc, pm.sort_order asc, pm.created_at asc
  limit 1
) primary_media on true
where p.status = 'published'
  and m.application_status = 'approved';

grant select on public.marketplace_products to anon, authenticated;
