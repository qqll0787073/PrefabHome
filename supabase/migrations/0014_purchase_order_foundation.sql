-- PH-007A Purchase Order Foundation.
-- Additive purchase order tables, trusted RPCs, immutable snapshots, and RLS.

create sequence if not exists public.purchase_order_number_seq;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique not null,
  rfq_id uuid not null references public.rfqs(id) on delete restrict,
  quote_id uuid not null references public.rfq_quotes(id) on delete restrict,
  quote_decision_id uuid not null references public.rfq_quote_decisions(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'draft',
  currency text not null,
  subtotal numeric(14,2) not null,
  incoterm text,
  origin_port text,
  destination_port text,
  production_lead_days integer,
  shipping_lead_days integer,
  requested_delivery_date date,
  buyer_reference text,
  buyer_note text,
  quote_snapshot jsonb not null,
  buyer_snapshot jsonb not null,
  manufacturer_snapshot jsonb not null,
  product_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_status_check check (status in ('draft', 'submitted', 'cancelled')),
  constraint purchase_orders_subtotal_check check (subtotal >= 0),
  constraint purchase_orders_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint purchase_orders_lead_days_check check (
    (production_lead_days is null or production_lead_days >= 0)
    and (shipping_lead_days is null or shipping_lead_days >= 0)
  ),
  constraint purchase_orders_buyer_reference_length_check check (
    buyer_reference is null or char_length(buyer_reference) <= 120
  ),
  constraint purchase_orders_buyer_note_length_check check (
    buyer_note is null or char_length(buyer_note) <= 2000
  ),
  constraint purchase_orders_lifecycle_timestamps_check check (
    (status = 'draft' and submitted_at is null and cancelled_at is null)
    or (status = 'submitted' and submitted_at is not null and cancelled_at is null)
    or (status = 'cancelled' and submitted_at is null and cancelled_at is not null)
  ),
  constraint purchase_orders_quote_unique unique (quote_id)
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  source_quote_item_id uuid references public.rfq_quote_items(id) on delete set null,
  line_order integer not null,
  item_type text not null,
  description text not null,
  quantity numeric(12,2) not null,
  unit text,
  unit_price numeric(14,2) not null,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_order_unique unique (purchase_order_id, line_order),
  constraint purchase_order_items_line_order_check check (line_order > 0),
  constraint purchase_order_items_type_check check (
    item_type in ('product', 'customization', 'packaging', 'freight', 'insurance', 'tax', 'discount', 'other')
  ),
  constraint purchase_order_items_description_length_check check (char_length(description) between 1 and 500),
  constraint purchase_order_items_quantity_check check (quantity > 0),
  constraint purchase_order_items_unit_price_check check (unit_price >= 0),
  constraint purchase_order_items_amount_check check (amount = round((quantity * unit_price)::numeric, 2)),
  constraint purchase_order_items_unit_length_check check (unit is null or char_length(unit) <= 40)
);

create table if not exists public.purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint purchase_order_events_type_check check (
    event_type in ('po_created', 'po_submitted', 'po_cancelled')
  )
);

create index if not exists purchase_orders_buyer_status_idx
  on public.purchase_orders (buyer_id, status, created_at desc);

create index if not exists purchase_orders_manufacturer_status_idx
  on public.purchase_orders (manufacturer_id, status, created_at desc);

create index if not exists purchase_orders_rfq_idx
  on public.purchase_orders (rfq_id);

create index if not exists purchase_order_items_po_order_idx
  on public.purchase_order_items (purchase_order_id, line_order);

create index if not exists purchase_order_events_po_created_idx
  on public.purchase_order_events (purchase_order_id, created_at);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_events enable row level security;

grant select on table public.purchase_orders to authenticated;
grant select on table public.purchase_order_items to authenticated;
grant select on table public.purchase_order_events to authenticated;
revoke all on table public.purchase_orders from anon;
revoke all on table public.purchase_order_items from anon;
revoke all on table public.purchase_order_events from anon;
revoke insert, update, delete on table public.purchase_orders from authenticated;
revoke insert, update, delete on table public.purchase_order_items from authenticated;
revoke insert, update, delete on table public.purchase_order_events from authenticated;

create or replace function public.is_trusted_purchase_order_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.purchase_order_trusted_write', true), '') = 'on';
$$;

create or replace function public.can_access_purchase_order(po_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.purchase_orders po
    where po.id = po_uuid
      and (
        po.buyer_id = auth.uid()
        or public.owns_manufacturer(po.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.generate_purchase_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.purchase_order_number_seq');
  return 'PO-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.insert_trusted_purchase_order_event(
  po_uuid uuid,
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
  if event_name not in ('po_created', 'po_submitted', 'po_cancelled') then
    raise exception 'Purchase order event type must be generated by a trusted flow.';
  end if;

  insert into public.purchase_order_events (
    purchase_order_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    po_uuid,
    event_name,
    actor_uuid,
    coalesce(event_metadata, '{}'::jsonb)
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role'
  );
end;
$$;

create or replace function public.build_purchase_order_quote_snapshot(
  quote_record public.rfq_quotes
)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'quote_id', quote_record.id,
    'rfq_id', quote_record.rfq_id,
    'version', quote_record.version,
    'status', quote_record.status,
    'currency', quote_record.currency,
    'subtotal', quote_record.subtotal,
    'incoterm', quote_record.incoterm,
    'origin_port', quote_record.origin_port,
    'destination_port', quote_record.destination_port,
    'production_lead_days', quote_record.production_lead_days,
    'shipping_lead_days', quote_record.shipping_lead_days,
    'valid_until', quote_record.valid_until,
    'manufacturer_note', quote_record.manufacturer_note,
    'submitted_at', quote_record.submitted_at
  ))
$$;

create or replace function public.build_purchase_order_buyer_snapshot(
  buyer_uuid uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'profile_id', p.id,
    'full_name', p.full_name,
    'email', p.email
  ))
  from public.profiles p
  where p.id = buyer_uuid
$$;

create or replace function public.build_purchase_order_manufacturer_snapshot(
  manufacturer_uuid uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'manufacturer_id', m.id,
    'company_name', m.company_name,
    'company_display_name', m.company_display_name,
    'country', m.country
  ))
  from public.manufacturers m
  where m.id = manufacturer_uuid
$$;

create or replace function public.protect_purchase_order_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Purchase orders are auditable and cannot be deleted.';
  end if;

  new.currency := upper(new.currency);
  new.buyer_reference := nullif(btrim(coalesce(new.buyer_reference, '')), '');
  new.buyer_note := nullif(btrim(coalesce(new.buyer_note, '')), '');
  new.updated_at := now();

  if public.is_trusted_purchase_order_write() then
    return new;
  end if;

  raise exception 'Purchase orders must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_purchase_order_item_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_purchase_order_write() then
    return coalesce(new, old);
  end if;

  raise exception 'Purchase order items are immutable.';
end;
$$;

create or replace function public.protect_purchase_order_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_purchase_order_write() then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role';
    return new;
  end if;

  raise exception 'Purchase order events must be generated by trusted flows.';
end;
$$;

create or replace function public.create_purchase_order_from_quote(
  quote_uuid uuid
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
  decision_record public.rfq_quote_decisions%rowtype;
  po_record public.purchase_orders%rowtype;
  copied_subtotal numeric(14,2);
  copied_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if public.current_profile_role() <> 'buyer' then
    raise exception 'Only buyers can create purchase orders.';
  end if;

  select * into quote_record
  from public.rfq_quotes
  where id = quote_uuid
  for update;

  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into rfq_record
  from public.rfqs
  where id = quote_record.rfq_id
  for update;

  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ buyer can create a purchase order.';
  end if;

  if quote_record.status <> 'accepted' then
    raise exception 'Purchase orders can be created only from accepted quotes.';
  end if;

  if rfq_record.status <> 'accepted' then
    raise exception 'RFQ must be accepted before purchase order creation.';
  end if;

  select * into decision_record
  from public.rfq_quote_decisions
  where quote_id = quote_record.id
    and rfq_id = rfq_record.id
    and buyer_id = rfq_record.buyer_id
    and decision = 'accepted'
  for update;

  if not found then
    raise exception 'Accepted quote decision is required.';
  end if;

  if exists (select 1 from public.purchase_orders where quote_id = quote_record.id) then
    raise exception 'A purchase order already exists for this quote.';
  end if;

  select coalesce(sum(amount), 0)::numeric(14,2), count(*)
  into copied_subtotal, copied_count
  from public.rfq_quote_items
  where quote_id = quote_record.id;

  if copied_count = 0 then
    raise exception 'Accepted quote must include line items.';
  end if;

  if copied_subtotal is distinct from quote_record.subtotal then
    raise exception 'Accepted quote subtotal does not match line items.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  insert into public.purchase_orders (
    po_number,
    rfq_id,
    quote_id,
    quote_decision_id,
    buyer_id,
    manufacturer_id,
    status,
    currency,
    subtotal,
    incoterm,
    origin_port,
    destination_port,
    production_lead_days,
    shipping_lead_days,
    quote_snapshot,
    buyer_snapshot,
    manufacturer_snapshot,
    product_snapshot,
    created_by
  )
  values (
    public.generate_purchase_order_number(),
    rfq_record.id,
    quote_record.id,
    decision_record.id,
    rfq_record.buyer_id,
    quote_record.manufacturer_id,
    'draft',
    quote_record.currency,
    quote_record.subtotal,
    quote_record.incoterm,
    quote_record.origin_port,
    quote_record.destination_port,
    quote_record.production_lead_days,
    quote_record.shipping_lead_days,
    public.build_purchase_order_quote_snapshot(quote_record),
    public.build_purchase_order_buyer_snapshot(rfq_record.buyer_id),
    public.build_purchase_order_manufacturer_snapshot(quote_record.manufacturer_id),
    rfq_record.product_snapshot,
    auth.uid()
  )
  returning * into po_record;

  insert into public.purchase_order_items (
    purchase_order_id,
    source_quote_item_id,
    line_order,
    item_type,
    description,
    quantity,
    unit,
    unit_price,
    amount
  )
  select
    po_record.id,
    item.id,
    item.line_order,
    item.item_type,
    item.description,
    item.quantity,
    item.unit,
    item.unit_price,
    item.amount
  from public.rfq_quote_items item
  where item.quote_id = quote_record.id
  order by item.line_order;

  perform public.insert_trusted_purchase_order_event(
    po_record.id,
    'po_created',
    auth.uid(),
    jsonb_build_object('quote_id', quote_record.id, 'quote_version', quote_record.version)
  );

  perform set_config('app.purchase_order_trusted_write', '', true);

  return po_record;
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_purchase_order_draft(
  po_uuid uuid,
  buyer_reference_text text,
  buyer_note_text text,
  requested_delivery_date_value date
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  po_record public.purchase_orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into po_record
  from public.purchase_orders
  where id = po_uuid
  for update;

  if not found then
    raise exception 'Purchase order does not exist.';
  end if;

  if po_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can update this purchase order draft.';
  end if;

  if po_record.status <> 'draft' then
    raise exception 'Only draft purchase orders can be updated.';
  end if;

  if buyer_reference_text is not null and char_length(btrim(buyer_reference_text)) > 120 then
    raise exception 'Buyer reference must be 120 characters or fewer.';
  end if;

  if buyer_note_text is not null and char_length(btrim(buyer_note_text)) > 2000 then
    raise exception 'Buyer note must be 2000 characters or fewer.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  update public.purchase_orders
  set buyer_reference = nullif(btrim(coalesce(buyer_reference_text, '')), ''),
      buyer_note = nullif(btrim(coalesce(buyer_note_text, '')), ''),
      requested_delivery_date = requested_delivery_date_value
  where id = po_uuid
  returning * into po_record;

  perform set_config('app.purchase_order_trusted_write', '', true);

  return po_record;
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.submit_purchase_order(
  po_uuid uuid
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  po_record public.purchase_orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into po_record
  from public.purchase_orders
  where id = po_uuid
  for update;

  if not found then
    raise exception 'Purchase order does not exist.';
  end if;

  if po_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can submit this purchase order.';
  end if;

  if po_record.status <> 'draft' then
    raise exception 'Only draft purchase orders can be submitted.';
  end if;

  if po_record.subtotal < 0 or po_record.currency !~ '^[A-Z]{3}$' then
    raise exception 'Purchase order commercial terms are invalid.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  update public.purchase_orders
  set status = 'submitted',
      submitted_at = now(),
      cancelled_at = null
  where id = po_uuid
    and status = 'draft'
  returning * into po_record;

  if not found then
    raise exception 'Purchase order was already submitted or cancelled.';
  end if;

  perform public.insert_trusted_purchase_order_event(
    po_record.id,
    'po_submitted',
    auth.uid(),
    jsonb_build_object('po_number', po_record.po_number)
  );

  perform set_config('app.purchase_order_trusted_write', '', true);

  return po_record;
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.cancel_purchase_order_draft(
  po_uuid uuid
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  po_record public.purchase_orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into po_record
  from public.purchase_orders
  where id = po_uuid
  for update;

  if not found then
    raise exception 'Purchase order does not exist.';
  end if;

  if po_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can cancel this purchase order draft.';
  end if;

  if po_record.status <> 'draft' then
    raise exception 'Only draft purchase orders can be cancelled.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  update public.purchase_orders
  set status = 'cancelled',
      submitted_at = null,
      cancelled_at = now()
  where id = po_uuid
    and status = 'draft'
  returning * into po_record;

  if not found then
    raise exception 'Purchase order was already submitted or cancelled.';
  end if;

  perform public.insert_trusted_purchase_order_event(
    po_record.id,
    'po_cancelled',
    auth.uid(),
    jsonb_build_object('po_number', po_record.po_number)
  );

  perform set_config('app.purchase_order_trusted_write', '', true);

  return po_record;
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_purchase_order_write on public.purchase_orders;
create trigger protect_purchase_order_write
before insert or update or delete on public.purchase_orders
for each row execute function public.protect_purchase_order_write();

drop trigger if exists protect_purchase_order_item_write on public.purchase_order_items;
create trigger protect_purchase_order_item_write
before insert or update or delete on public.purchase_order_items
for each row execute function public.protect_purchase_order_item_write();

drop trigger if exists protect_purchase_order_event_write on public.purchase_order_events;
create trigger protect_purchase_order_event_write
before insert or update or delete on public.purchase_order_events
for each row execute function public.protect_purchase_order_event_write();

drop policy if exists "purchase_orders_select_participant_or_admin" on public.purchase_orders;
create policy "purchase_orders_select_participant_or_admin"
on public.purchase_orders
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "purchase_order_items_select_participant_or_admin" on public.purchase_order_items;
create policy "purchase_order_items_select_participant_or_admin"
on public.purchase_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_items.purchase_order_id
      and (
        po.buyer_id = auth.uid()
        or public.owns_manufacturer(po.manufacturer_id)
        or public.is_admin()
      )
  )
);

drop policy if exists "purchase_order_events_select_participant_or_admin" on public.purchase_order_events;
create policy "purchase_order_events_select_participant_or_admin"
on public.purchase_order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_events.purchase_order_id
      and (
        po.buyer_id = auth.uid()
        or public.owns_manufacturer(po.manufacturer_id)
        or public.is_admin()
      )
  )
);

revoke all on function public.is_trusted_purchase_order_write() from public, anon, authenticated;
revoke all on function public.can_access_purchase_order(uuid) from public, anon, authenticated;
revoke all on function public.generate_purchase_order_number() from public, anon, authenticated;
revoke all on function public.insert_trusted_purchase_order_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.build_purchase_order_quote_snapshot(public.rfq_quotes) from public, anon, authenticated;
revoke all on function public.build_purchase_order_buyer_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.build_purchase_order_manufacturer_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.protect_purchase_order_write() from public, anon, authenticated;
revoke all on function public.protect_purchase_order_item_write() from public, anon, authenticated;
revoke all on function public.protect_purchase_order_event_write() from public, anon, authenticated;

revoke all on function public.create_purchase_order_from_quote(uuid) from public, anon, authenticated;
revoke all on function public.update_purchase_order_draft(uuid, text, text, date) from public, anon, authenticated;
revoke all on function public.submit_purchase_order(uuid) from public, anon, authenticated;
revoke all on function public.cancel_purchase_order_draft(uuid) from public, anon, authenticated;
grant execute on function public.create_purchase_order_from_quote(uuid) to authenticated;
grant execute on function public.update_purchase_order_draft(uuid, text, text, date) to authenticated;
grant execute on function public.submit_purchase_order(uuid) to authenticated;
grant execute on function public.cancel_purchase_order_draft(uuid) to authenticated;
