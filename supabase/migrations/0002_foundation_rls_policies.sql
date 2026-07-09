-- PrefabHome Marketplace initial RLS policy draft.
-- These policies are intentionally conservative and should be tested before production.

alter table public.profiles enable row level security;
alter table public.buyers enable row level security;
alter table public.manufacturers enable row level security;
alter table public.products enable row level security;
alter table public.quote_requests enable row level security;
alter table public.messages enable row level security;
alter table public.saved_products enable row level security;
alter table public.manufacturer_outreach enable row level security;
alter table public.import_documents enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

create or replace function public.owns_manufacturer(manufacturer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.manufacturers
    where id = manufacturer_uuid
      and owner_id = auth.uid()
  )
$$;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "buyers_manage_own_or_admin"
on public.buyers
for all
to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

create policy "manufacturers_select_approved_or_owner_or_admin"
on public.manufacturers
for select
to authenticated
using (
  verification_status = 'approved'
  or owner_id = auth.uid()
  or public.is_admin()
);

create policy "manufacturers_insert_owner"
on public.manufacturers
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

create policy "manufacturers_update_owner_or_admin"
on public.manufacturers
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "products_select_active_or_owner_or_admin"
on public.products
for select
to authenticated
using (
  status = 'active'
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

create policy "products_insert_owner_or_admin"
on public.products
for insert
to authenticated
with check (public.owns_manufacturer(manufacturer_id) or public.is_admin());

create policy "products_update_owner_or_admin"
on public.products
for update
to authenticated
using (public.owns_manufacturer(manufacturer_id) or public.is_admin())
with check (public.owns_manufacturer(manufacturer_id) or public.is_admin());

create policy "quote_requests_select_participant_or_admin"
on public.quote_requests
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

create policy "quote_requests_insert_buyer"
on public.quote_requests
for insert
to authenticated
with check (buyer_id = auth.uid());

create policy "quote_requests_update_participant_or_admin"
on public.quote_requests
for update
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
)
with check (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

create policy "messages_select_participant_or_admin"
on public.messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.is_admin()
);

create policy "messages_insert_sender"
on public.messages
for insert
to authenticated
with check (sender_id = auth.uid());

create policy "messages_update_recipient_read_state"
on public.messages
for update
to authenticated
using (recipient_id = auth.uid() or public.is_admin())
with check (recipient_id = auth.uid() or public.is_admin());

create policy "saved_products_manage_own"
on public.saved_products
for all
to authenticated
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

create policy "manufacturer_outreach_manage_owner_or_admin"
on public.manufacturer_outreach
for all
to authenticated
using (public.owns_manufacturer(manufacturer_id) or public.is_admin())
with check (public.owns_manufacturer(manufacturer_id) or public.is_admin());

create policy "import_documents_select_owner_quote_participant_or_admin"
on public.import_documents
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.quote_requests qr
    where qr.id = quote_request_id
      and (
        qr.buyer_id = auth.uid()
        or public.owns_manufacturer(qr.manufacturer_id)
      )
  )
);

create policy "import_documents_insert_owner"
on public.import_documents
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

create policy "import_documents_update_owner_or_admin"
on public.import_documents
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());
