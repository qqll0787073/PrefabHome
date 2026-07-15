begin;

-- PH-008A Contract Foundation.
-- Additive contract tables, immutable snapshots, trusted RPCs, and RLS.

create sequence if not exists public.contract_number_seq;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text unique not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  po_number text not null,
  rfq_id uuid not null references public.rfqs(id) on delete restrict,
  quote_id uuid not null references public.rfq_quotes(id) on delete restrict,
  quote_decision_id uuid not null references public.rfq_quote_decisions(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'draft',
  currency text not null,
  subtotal numeric(14,2) not null,
  contract_title text,
  governing_law text,
  contract_terms text,
  buyer_reference text,
  buyer_note text,
  purchase_order_snapshot jsonb not null,
  buyer_snapshot jsonb not null,
  manufacturer_snapshot jsonb not null,
  quote_snapshot jsonb not null,
  product_snapshot jsonb not null,
  line_items_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_status_check check (status in ('draft', 'ready')),
  constraint contracts_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint contracts_subtotal_check check (subtotal >= 0),
  constraint contracts_title_length_check check (contract_title is null or char_length(contract_title) <= 200),
  constraint contracts_governing_law_length_check check (governing_law is null or char_length(governing_law) <= 120),
  constraint contracts_terms_length_check check (contract_terms is null or char_length(contract_terms) <= 8000),
  constraint contracts_buyer_reference_length_check check (buyer_reference is null or char_length(buyer_reference) <= 120),
  constraint contracts_buyer_note_length_check check (buyer_note is null or char_length(buyer_note) <= 2000),
  constraint contracts_line_items_snapshot_check check (jsonb_typeof(line_items_snapshot) = 'array' and jsonb_array_length(line_items_snapshot) > 0),
  constraint contracts_ready_timestamp_check check (
    (status = 'draft' and ready_at is null)
    or (status = 'ready' and ready_at is not null)
  ),
  constraint contracts_purchase_order_unique unique (purchase_order_id)
);

create table if not exists public.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint contract_events_type_check check (
    event_type in ('contract_created', 'contract_updated', 'contract_ready')
  )
);

create index if not exists contracts_buyer_status_idx
  on public.contracts (buyer_id, status, created_at desc);

create index if not exists contracts_manufacturer_status_idx
  on public.contracts (manufacturer_id, status, created_at desc);

create index if not exists contracts_purchase_order_idx
  on public.contracts (purchase_order_id);

create index if not exists contract_events_contract_created_idx
  on public.contract_events (contract_id, created_at);

alter table public.contracts enable row level security;
alter table public.contract_events enable row level security;

grant select on table public.contracts to authenticated;
grant select on table public.contract_events to authenticated;
revoke all on table public.contracts from anon;
revoke all on table public.contract_events from anon;
revoke insert, update, delete on table public.contracts from authenticated;
revoke insert, update, delete on table public.contract_events from authenticated;

create or replace function public.is_trusted_contract_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.contract_trusted_write', true), '') = 'on';
$$;

create or replace function public.can_access_contract(contract_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contracts c
    where c.id = contract_uuid
      and (
        c.buyer_id = auth.uid()
        or public.owns_manufacturer(c.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.generate_contract_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.contract_number_seq');
  return 'CON-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.build_contract_purchase_order_snapshot(
  po_record public.purchase_orders
)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'purchase_order_id', po_record.id,
    'po_number', po_record.po_number,
    'rfq_id', po_record.rfq_id,
    'quote_id', po_record.quote_id,
    'quote_decision_id', po_record.quote_decision_id,
    'status', po_record.status,
    'currency', po_record.currency,
    'subtotal', po_record.subtotal,
    'incoterm', po_record.incoterm,
    'origin_port', po_record.origin_port,
    'destination_port', po_record.destination_port,
    'production_lead_days', po_record.production_lead_days,
    'shipping_lead_days', po_record.shipping_lead_days,
    'requested_delivery_date', po_record.requested_delivery_date,
    'buyer_reference', po_record.buyer_reference,
    'buyer_note', po_record.buyer_note,
    'submitted_at', po_record.submitted_at,
    'last_submitted_at', po_record.last_submitted_at,
    'confirmed_at', po_record.confirmed_at,
    'review_round', po_record.review_round
  ))
$$;

create or replace function public.build_contract_line_items_snapshot(po_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'source_purchase_order_item_id', item.id,
        'source_quote_item_id', item.source_quote_item_id,
        'line_order', item.line_order,
        'item_type', item.item_type,
        'description', item.description,
        'quantity', item.quantity,
        'unit', item.unit,
        'unit_price', item.unit_price,
        'amount', item.amount
      ))
      order by item.line_order
    ),
    '[]'::jsonb
  )
  from public.purchase_order_items item
  where item.purchase_order_id = po_uuid
$$;

create or replace function public.insert_trusted_contract_event(
  contract_uuid uuid,
  event_name text,
  actor_uuid uuid,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if event_name not in ('contract_created', 'contract_updated', 'contract_ready') then
    raise exception 'Contract event type must be generated by a trusted flow.';
  end if;

  insert into public.contract_events (
    contract_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    contract_uuid,
    event_name,
    actor_uuid,
    coalesce(event_metadata, '{}'::jsonb)
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role'
      - 'buyer_id'
      - 'manufacturer_id'
  );
end;
$$;

create or replace function public.protect_contract_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Contracts are auditable and cannot be deleted.';
  end if;

  new.currency := upper(new.currency);
  new.contract_title := nullif(btrim(coalesce(new.contract_title, '')), '');
  new.governing_law := nullif(btrim(coalesce(new.governing_law, '')), '');
  new.contract_terms := nullif(btrim(coalesce(new.contract_terms, '')), '');
  new.buyer_reference := nullif(btrim(coalesce(new.buyer_reference, '')), '');
  new.buyer_note := nullif(btrim(coalesce(new.buyer_note, '')), '');
  new.updated_at := now();

  if public.is_trusted_contract_write() then
    return new;
  end if;

  raise exception 'Contracts must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_contract_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_contract_write() then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role'
      - 'buyer_id'
      - 'manufacturer_id';
    return new;
  end if;

  raise exception 'Contract events must be generated by trusted flows.';
end;
$$;

create or replace function public.create_contract_from_po(po_uuid uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  po_record public.purchase_orders%rowtype;
  contract_record public.contracts%rowtype;
  items_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if public.current_profile_role() <> 'buyer' then
    raise exception 'Only buyers can create contracts.';
  end if;

  select * into po_record
  from public.purchase_orders
  where id = po_uuid
  for update;

  if not found then
    raise exception 'Purchase order does not exist.';
  end if;

  if po_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the purchase order buyer can create this contract.';
  end if;

  if po_record.status <> 'confirmed' then
    raise exception 'Contracts can be created only from confirmed purchase orders.';
  end if;

  if exists (select 1 from public.contracts where purchase_order_id = po_record.id) then
    raise exception 'A contract already exists for this purchase order.';
  end if;

  items_snapshot := public.build_contract_line_items_snapshot(po_record.id);
  if jsonb_array_length(items_snapshot) = 0 then
    raise exception 'Confirmed purchase order must include line items.';
  end if;

  perform set_config('app.contract_trusted_write', 'on', true);

  insert into public.contracts (
    contract_number,
    purchase_order_id,
    po_number,
    rfq_id,
    quote_id,
    quote_decision_id,
    buyer_id,
    manufacturer_id,
    status,
    currency,
    subtotal,
    contract_title,
    governing_law,
    contract_terms,
    buyer_reference,
    buyer_note,
    purchase_order_snapshot,
    buyer_snapshot,
    manufacturer_snapshot,
    quote_snapshot,
    product_snapshot,
    line_items_snapshot,
    created_by
  )
  values (
    public.generate_contract_number(),
    po_record.id,
    po_record.po_number,
    po_record.rfq_id,
    po_record.quote_id,
    po_record.quote_decision_id,
    po_record.buyer_id,
    po_record.manufacturer_id,
    'draft',
    po_record.currency,
    po_record.subtotal,
    'Contract for ' || po_record.po_number,
    null,
    null,
    po_record.buyer_reference,
    po_record.buyer_note,
    public.build_contract_purchase_order_snapshot(po_record),
    po_record.buyer_snapshot,
    po_record.manufacturer_snapshot,
    po_record.quote_snapshot,
    po_record.product_snapshot,
    items_snapshot,
    auth.uid()
  )
  returning * into contract_record;

  perform public.insert_trusted_contract_event(
    contract_record.id,
    'contract_created',
    auth.uid(),
    jsonb_build_object('purchase_order_id', po_record.id, 'po_number', po_record.po_number)
  );

  perform set_config('app.contract_trusted_write', '', true);

  return contract_record;
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_contract_draft(
  contract_uuid uuid,
  contract_title_text text,
  governing_law_text text,
  contract_terms_text text
)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into contract_record
  from public.contracts
  where id = contract_uuid
  for update;

  if not found then
    raise exception 'Contract does not exist.';
  end if;

  if contract_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can update this contract draft.';
  end if;

  if contract_record.status <> 'draft' then
    raise exception 'Only draft contracts can be updated.';
  end if;

  if contract_title_text is not null and char_length(btrim(contract_title_text)) > 200 then
    raise exception 'Contract title must be 200 characters or fewer.';
  end if;

  if governing_law_text is not null and char_length(btrim(governing_law_text)) > 120 then
    raise exception 'Governing law must be 120 characters or fewer.';
  end if;

  if contract_terms_text is not null and char_length(btrim(contract_terms_text)) > 8000 then
    raise exception 'Contract terms must be 8000 characters or fewer.';
  end if;

  perform set_config('app.contract_trusted_write', 'on', true);

  update public.contracts
  set contract_title = nullif(btrim(coalesce(contract_title_text, '')), ''),
      governing_law = nullif(btrim(coalesce(governing_law_text, '')), ''),
      contract_terms = nullif(btrim(coalesce(contract_terms_text, '')), '')
  where id = contract_uuid
  returning * into contract_record;

  perform public.insert_trusted_contract_event(
    contract_record.id,
    'contract_updated',
    auth.uid(),
    jsonb_build_object('contract_number', contract_record.contract_number)
  );

  perform set_config('app.contract_trusted_write', '', true);

  return contract_record;
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.mark_contract_ready(contract_uuid uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into contract_record
  from public.contracts
  where id = contract_uuid
  for update;

  if not found then
    raise exception 'Contract does not exist.';
  end if;

  if contract_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can mark this contract ready.';
  end if;

  if contract_record.status <> 'draft' then
    raise exception 'Only draft contracts can be marked ready.';
  end if;

  if contract_record.contract_title is null then
    raise exception 'Contract title is required before marking ready.';
  end if;

  perform set_config('app.contract_trusted_write', 'on', true);

  update public.contracts
  set status = 'ready',
      ready_at = now()
  where id = contract_uuid
    and status = 'draft'
  returning * into contract_record;

  if not found then
    raise exception 'Contract is no longer a draft.';
  end if;

  perform public.insert_trusted_contract_event(
    contract_record.id,
    'contract_ready',
    auth.uid(),
    jsonb_build_object('contract_number', contract_record.contract_number)
  );

  perform set_config('app.contract_trusted_write', '', true);

  return contract_record;
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_contract_write on public.contracts;
create trigger protect_contract_write
before insert or update or delete on public.contracts
for each row execute function public.protect_contract_write();

drop trigger if exists protect_contract_event_write on public.contract_events;
create trigger protect_contract_event_write
before insert or update or delete on public.contract_events
for each row execute function public.protect_contract_event_write();

drop policy if exists "contracts_select_participant_or_admin" on public.contracts;
create policy "contracts_select_participant_or_admin"
on public.contracts
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "contract_events_select_participant_or_admin" on public.contract_events;
create policy "contract_events_select_participant_or_admin"
on public.contract_events
for select
to authenticated
using (
  exists (
    select 1
    from public.contracts c
    where c.id = contract_events.contract_id
      and (
        c.buyer_id = auth.uid()
        or public.owns_manufacturer(c.manufacturer_id)
        or public.is_admin()
      )
  )
);

revoke all on function public.is_trusted_contract_write() from public, anon, authenticated;
revoke all on function public.can_access_contract(uuid) from public, anon, authenticated;
revoke all on function public.generate_contract_number() from public, anon, authenticated;
revoke all on function public.build_contract_purchase_order_snapshot(public.purchase_orders) from public, anon, authenticated;
revoke all on function public.build_contract_line_items_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.insert_trusted_contract_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_contract_write() from public, anon, authenticated;
revoke all on function public.protect_contract_event_write() from public, anon, authenticated;

revoke all on function public.create_contract_from_po(uuid) from public, anon, authenticated;
revoke all on function public.update_contract_draft(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_contract_ready(uuid) from public, anon, authenticated;
grant execute on function public.create_contract_from_po(uuid) to authenticated;
grant execute on function public.update_contract_draft(uuid, text, text, text) to authenticated;
grant execute on function public.mark_contract_ready(uuid) to authenticated;

create temp table contract_security_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table contract_security_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on contract_security_results to anon, authenticated;
grant select, insert on contract_security_subjects to anon, authenticated;

do $$
<<contract_checks>>
declare
  buyer_id uuid := gen_random_uuid();
  other_buyer_id uuid := gen_random_uuid();
  manufacturer_owner_id uuid := gen_random_uuid();
  other_manufacturer_owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'contract-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_buyer_id, 'authenticated', 'authenticated', 'contract-other-buyer-' || other_buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Other Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_id, 'authenticated', 'authenticated', 'contract-manufacturer-' || manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_id, 'authenticated', 'authenticated', 'contract-other-manufacturer-' || other_manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Contract Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'contract-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into contract_security_subjects(subject_name, subject_id)
  values
    ('buyer', buyer_id),
    ('other_buyer', other_buyer_id),
    ('manufacturer_owner', manufacturer_owner_id),
    ('other_manufacturer_owner', other_manufacturer_owner_id),
    ('admin', admin_id);
end;
$$;

set local role authenticated;

create or replace function pg_temp.create_confirmed_po(
  label_text text,
  buyer_uuid uuid,
  manufacturer_owner_uuid uuid,
  manufacturer_uuid uuid,
  product_uuid uuid
)
returns uuid
language plpgsql
as $$
declare
  rfq_uuid uuid;
  quote_uuid uuid;
  po_uuid uuid;
begin
  perform set_config('request.jwt.claim.sub', buyer_uuid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    incoterm,
    destination_country,
    destination_port,
    buyer_message
  )
  values (
    buyer_uuid,
    manufacturer_uuid,
    product_uuid,
    'submitted',
    1,
    'USD',
    'FOB',
    'United States',
    'Los Angeles',
    label_text
  )
  returning id into rfq_uuid;

  perform set_config('request.jwt.claim.sub', manufacturer_owner_uuid::text, true);
  perform public.record_rfq_opened(rfq_uuid);
  select id into quote_uuid from public.create_rfq_quote_draft(rfq_uuid);

  update public.rfq_quotes
  set origin_port = 'Shanghai',
      destination_port = 'Los Angeles',
      production_lead_days = 45,
      shipping_lead_days = 21,
      manufacturer_note = label_text
  where id = quote_uuid;

  insert into public.rfq_quote_items(quote_id, line_order, item_type, description, quantity, unit, unit_price)
  values (quote_uuid, 1, 'product', label_text || ' item', 1, 'unit', 100000);

  select id into quote_uuid from public.submit_rfq_quote(quote_uuid);

  perform set_config('request.jwt.claim.sub', buyer_uuid::text, true);
  perform public.record_rfq_quote_opened(quote_uuid);
  perform public.accept_rfq_quote(quote_uuid, label_text || ' accepted');
  select id into po_uuid from public.create_purchase_order_from_quote(quote_uuid);
  select id into po_uuid from public.submit_purchase_order(po_uuid);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_uuid::text, true);
  perform public.record_purchase_order_opened(po_uuid);
  perform public.confirm_purchase_order(po_uuid, label_text || ' confirmed');

  return po_uuid;
end;
$$;

do $$
declare
  buyer_id uuid;
  other_buyer_id uuid;
  manufacturer_owner_id uuid;
  other_manufacturer_owner_id uuid;
  admin_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  product_id uuid;
  confirmed_po_id uuid;
  second_po_id uuid;
  draft_po_id uuid;
  created_contract_id uuid;
  ready_contract_id uuid;
  visible_count integer := 0;
  event_count integer := 0;
  blocked boolean := false;
  before_snapshot jsonb;
  after_snapshot jsonb;
  contract_number_text text;
begin
  select subject_id into buyer_id from contract_security_subjects where subject_name = 'buyer';
  select subject_id into other_buyer_id from contract_security_subjects where subject_name = 'other_buyer';
  select subject_id into manufacturer_owner_id from contract_security_subjects where subject_name = 'manufacturer_owner';
  select subject_id into other_manufacturer_owner_id from contract_security_subjects where subject_name = 'other_manufacturer_owner';
  select subject_id into admin_id from contract_security_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_id, 'Contract Factory Legal', 'Contract Factory', 'China', 'draft')
  returning id into manufacturer_id;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_id, 'Other Contract Factory Legal', 'Other Contract Factory', 'Vietnam', 'draft')
  returning id into other_manufacturer_id;

  update public.manufacturers
  set application_status = 'approved',
      reviewed_by = admin_id,
      reviewed_at = now()
  where id in (manufacturer_id, other_manufacturer_id);

  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_id, 'Contract Home', 'Contract Model', 'Modular', 'Contract verification product.', 'USD', 'draft')
  returning id into product_id;

  confirmed_po_id := pg_temp.create_confirmed_po('contract primary flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);
  second_po_id := pg_temp.create_confirmed_po('contract ready flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);
  draft_po_id := pg_temp.create_confirmed_po('contract non-confirmed flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);

  reset role;
  perform set_config('app.purchase_order_trusted_write', 'on', true);
  update public.purchase_orders
  set status = 'submitted', confirmed_at = null
  where id = draft_po_id;
  perform set_config('app.purchase_order_trusted_write', '', true);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  blocked := false;
  begin
    perform public.create_contract_from_po(draft_po_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('non-confirmed PO contract creation denied', blocked, 'blocked: ' || blocked);

  select created_contract.id, created_contract.contract_number, created_contract.line_items_snapshot
  into created_contract_id, contract_number_text, before_snapshot
  from public.create_contract_from_po(confirmed_po_id) as created_contract;

  insert into contract_security_results values (
    'Buyer creates draft contract from confirmed PO',
    exists (select 1 from public.contracts where id = created_contract_id and status = 'draft' and purchase_order_id = confirmed_po_id),
    'created'
  );

  insert into contract_security_results values (
    'contract number format',
    contract_number_text ~ '^CON-[0-9]{4}-[0-9]{6}$',
    contract_number_text
  );

  insert into contract_security_results values (
    'line item snapshot captured',
    jsonb_array_length(before_snapshot) = 1 and before_snapshot->0->>'description' like 'contract primary flow%',
    'snapshot checked'
  );

  insert into contract_security_results values (
    'buyer manufacturer quote PO snapshots captured',
    exists (
      select 1
      from public.contracts
      where id = created_contract_id
        and buyer_snapshot ? 'email'
        and manufacturer_snapshot ? 'manufacturer_id'
        and quote_snapshot ? 'quote_id'
        and purchase_order_snapshot->>'purchase_order_id' = confirmed_po_id::text
    ),
    'snapshots checked'
  );

  reset role;
  perform set_config('app.purchase_order_trusted_write', 'on', true);
  update public.purchase_order_items
  set description = 'changed after snapshot'
  where purchase_order_id = confirmed_po_id;
  perform set_config('app.purchase_order_trusted_write', '', true);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select line_items_snapshot into after_snapshot from public.contracts where id = created_contract_id;
  insert into contract_security_results values (
    'contract snapshot immutable after source change',
    after_snapshot = before_snapshot,
    'snapshot preserved'
  );

  perform public.update_contract_draft(created_contract_id, 'Updated Contract Title', 'Delaware', 'Foundation terms only.');
  insert into contract_security_results values (
    'Buyer updates draft contract',
    exists (select 1 from public.contracts where id = created_contract_id and contract_title = 'Updated Contract Title' and governing_law = 'Delaware'),
    'updated'
  );

  select count(*) into event_count
  from public.contract_events event_row
  where event_row.contract_id = created_contract_id
    and event_row.event_type = 'contract_updated';
  insert into contract_security_results values ('trusted update event created', event_count = 1, 'events: ' || event_count);

  select created_contract.id
  into ready_contract_id
  from public.create_contract_from_po(second_po_id) as created_contract;
  perform public.update_contract_draft(ready_contract_id, 'Ready Contract', 'New York', 'Ready terms.');
  perform public.mark_contract_ready(ready_contract_id);
  insert into contract_security_results values (
    'Buyer marks contract ready',
    exists (select 1 from public.contracts where id = ready_contract_id and status = 'ready' and ready_at is not null),
    'ready'
  );

  blocked := false;
  begin
    perform public.update_contract_draft(ready_contract_id, 'Change ready', null, null);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('ready contract update denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    perform public.mark_contract_ready(ready_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('duplicate ready transition denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    perform public.create_contract_from_po(confirmed_po_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('duplicate contract per PO denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.update_contract_draft(created_contract_id, 'Manufacturer edit', null, null);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('Manufacturer cannot update draft contract', blocked, 'blocked: ' || blocked);

  select count(*) into visible_count from public.contracts where id = created_contract_id;
  insert into contract_security_results values ('assigned Manufacturer can read contract', visible_count = 1, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.contracts where id = created_contract_id;
  insert into contract_security_results values ('other Manufacturer cannot read contract', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);
  select count(*) into visible_count from public.contracts where id = created_contract_id;
  insert into contract_security_results values ('other Buyer cannot read contract', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  select count(*) into visible_count from public.contracts where id = created_contract_id;
  insert into contract_security_results values ('Admin can read contract', visible_count = 1, 'visible: ' || visible_count);

  blocked := false;
  begin
    perform public.mark_contract_ready(created_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('Admin cannot mark ready', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    insert into public.contract_events(contract_id, event_type, actor_profile_id, metadata)
    values (created_contract_id, 'contract_ready', admin_id, '{"actor_profile_id":"00000000-0000-0000-0000-000000000000"}'::jsonb);
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('direct contract event forgery denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.contracts set status = 'ready' where id = created_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('direct contract table update denied', blocked, 'blocked: ' || blocked);

  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    select count(*) into visible_count from public.contracts where id = created_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_security_results values ('Anonymous cannot read contract', blocked, 'blocked: ' || blocked);
end;
$$;

select check_name, passed, detail
from contract_security_results
order by check_name;

rollback;
