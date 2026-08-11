-- Buyer-safe Manufacturer directory. This is intentionally a narrow projection:
-- private contacts, addresses, ownership, review metadata, and internal status are excluded.
create index if not exists products_published_manufacturer_idx
  on public.products (manufacturer_id)
  where status = 'published';

drop view if exists public.buyer_manufacturer_directory;

create view public.buyer_manufacturer_directory
with (security_barrier = true)
as
select
  m.id,
  coalesce(nullif(btrim(m.company_display_name), ''), nullif(btrim(m.company_name), ''), 'Approved manufacturer') as display_name,
  nullif(btrim(m.company_description), '') as description,
  nullif(btrim(m.website), '') as website,
  nullif(btrim(m.city), '') as city,
  nullif(btrim(m.province), '') as region,
  nullif(btrim(m.country), '') as country,
  coalesce(m.certifications, '{}'::text[]) as certifications,
  count(p.id)::integer as published_product_count
from public.manufacturers m
left join public.products p
  on p.manufacturer_id = m.id
 and p.status = 'published'
where m.application_status = 'approved'
group by m.id, m.company_display_name, m.company_name, m.company_description,
  m.website, m.city, m.province, m.country, m.certifications;

revoke all on public.buyer_manufacturer_directory from public;
grant select on public.buyer_manufacturer_directory to authenticated;
