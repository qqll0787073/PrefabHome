-- Allow authenticated API users to reach tables protected by RLS.
-- Row-level policies remain the authorization boundary.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.buyers to authenticated;
grant select, insert, update, delete on table public.manufacturers to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.quote_requests to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.saved_products to authenticated;
grant select, insert, update, delete on table public.manufacturer_outreach to authenticated;
grant select, insert, update, delete on table public.import_documents to authenticated;
