-- PH-006B Quote Builder foundation.
-- Additive quote tables, trusted RPCs, and RLS for manufacturer-created RFQ quotes.

create table if not exists public.rfq_quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  version integer not null,
  status text not null default 'draft',
  currency text not null default 'USD',
  unit_price numeric(14,2),
  quantity numeric(12,2),
  subtotal numeric(14,2) not null default 0,
  incoterm text,
  origin_port text,
  destination_port text,
  production_lead_days integer,
  shipping_lead_days integer,
  valid_until date,
  manufacturer_note text,
  created_by uuid not null references public.profiles(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfq_quotes_rfq_version_unique unique (rfq_id, version),
  constraint rfq_quotes_version_check check (version > 0),
  constraint rfq_quotes_status_check check (status in ('draft', 'submitted', 'superseded', 'expired', 'withdrawn')),
  constraint rfq_quotes_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint rfq_quotes_quantity_check check (quantity is null or quantity > 0),
  constraint rfq_quotes_unit_price_check check (unit_price is null or unit_price >= 0),
  constraint rfq_quotes_subtotal_check check (subtotal >= 0),
  constraint rfq_quotes_incoterm_check check (incoterm is null or incoterm in ('FOB', 'CIF', 'EXW', 'DDP', 'DAP')),
  constraint rfq_quotes_production_lead_check check (production_lead_days is null or production_lead_days >= 0),
  constraint rfq_quotes_shipping_lead_check check (shipping_lead_days is null or shipping_lead_days >= 0),
  constraint rfq_quotes_note_length_check check (manufacturer_note is null or char_length(manufacturer_note) <= 4000),
  constraint rfq_quotes_submitted_at_check check (
    (status = 'draft' and submitted_at is null)
    or (status <> 'draft' and submitted_at is not null)
  )
);

create table if not exists public.rfq_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.rfq_quotes(id) on delete cascade,
  line_order integer not null,
  item_type text not null,
  description text not null,
  quantity numeric(12,2) not null,
  unit text,
  unit_price numeric(14,2) not null,
  amount numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfq_quote_items_quote_order_unique unique (quote_id, line_order),
  constraint rfq_quote_items_line_order_check check (line_order > 0),
  constraint rfq_quote_items_type_check check (
    item_type in ('product', 'customization', 'packaging', 'freight', 'insurance', 'tax', 'discount', 'other')
  ),
  constraint rfq_quote_items_description_length_check check (char_length(description) between 1 and 500),
  constraint rfq_quote_items_quantity_check check (quantity > 0),
  constraint rfq_quote_items_unit_price_check check (unit_price >= 0),
  constraint rfq_quote_items_unit_length_check check (unit is null or char_length(unit) <= 40)
);

create index if not exists rfq_quotes_rfq_status_idx
  on public.rfq_quotes (rfq_id, status, version desc);

create index if not exists rfq_quotes_manufacturer_status_idx
  on public.rfq_quotes (manufacturer_id, status, updated_at desc);

create index if not exists rfq_quote_items_quote_order_idx
  on public.rfq_quote_items (quote_id, line_order);

create unique index if not exists rfq_quotes_one_draft_per_rfq_idx
  on public.rfq_quotes (rfq_id)
  where status = 'draft';

alter table public.rfq_quotes enable row level security;
alter table public.rfq_quote_items enable row level security;

grant select, update, delete on table public.rfq_quotes to authenticated;
grant select, insert, update, delete on table public.rfq_quote_items to authenticated;
revoke all on table public.rfq_quotes from anon;
revoke all on table public.rfq_quote_items from anon;

create or replace function public.is_trusted_quote_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.quote_trusted_write', true), '') = 'on';
$$;

create or replace function public.can_access_rfq_quote(quote_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rfq_quotes q
    join public.rfqs r on r.id = q.rfq_id
    where q.id = quote_uuid
      and (
        public.is_admin()
        or public.owns_manufacturer(q.manufacturer_id)
        or (r.buyer_id = auth.uid() and q.status <> 'draft')
      )
  );
$$;

create or replace function public.can_manage_rfq_quote_draft(quote_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rfq_quotes q
    where q.id = quote_uuid
      and q.status = 'draft'
      and public.owns_manufacturer(q.manufacturer_id)
  );
$$;

create or replace function public.set_rfq_quote_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.currency := upper(new.currency);
  new.incoterm := nullif(upper(coalesce(new.incoterm, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_rfq_quote_item_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.description := btrim(new.description);
  new.unit := nullif(btrim(coalesce(new.unit, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.recalculate_rfq_quote_subtotal(quote_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  calculated_subtotal numeric(14,2);
begin
  select coalesce(sum(amount), 0)::numeric(14,2)
  into calculated_subtotal
  from public.rfq_quote_items
  where quote_id = quote_uuid;

  perform set_config('app.quote_trusted_write', 'on', true);
  update public.rfq_quotes
  set subtotal = calculated_subtotal
  where id = quote_uuid;
  perform set_config('app.quote_trusted_write', '', true);
end;
$$;

create or replace function public.protect_rfq_quote_write()
returns trigger
language plpgsql
as $$
begin
  new.currency := upper(new.currency);
  new.incoterm := nullif(upper(coalesce(new.incoterm, '')), '');

  if public.is_trusted_quote_write() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'draft' then
      raise exception 'Submitted quote rows are immutable.';
    end if;

    if not public.owns_manufacturer(old.manufacturer_id) then
      raise exception 'Only the assigned manufacturer can edit draft quotes.';
    end if;

    if old.rfq_id is distinct from new.rfq_id
      or old.manufacturer_id is distinct from new.manufacturer_id
      or old.version is distinct from new.version
      or old.status is distinct from new.status
      or old.created_by is distinct from new.created_by
      or old.submitted_at is distinct from new.submitted_at
      or old.subtotal is distinct from new.subtotal then
      raise exception 'Quote ownership, version, status, submitted timestamp, and subtotal are database-managed.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_rfq_quote_item_write()
returns trigger
language plpgsql
as $$
declare
  quote_record public.rfq_quotes%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into quote_record from public.rfq_quotes where id = old.quote_id;

    if quote_record.status <> 'draft' then
      raise exception 'Submitted quote items are immutable.';
    end if;

    if not public.owns_manufacturer(quote_record.manufacturer_id) then
      raise exception 'Only the assigned manufacturer can edit quote items.';
    end if;

    return old;
  end if;

  select * into quote_record from public.rfq_quotes where id = new.quote_id;

  if not found then
    raise exception 'Quote does not exist.';
  end if;

  if public.is_trusted_quote_write() then
    return new;
  end if;

  if quote_record.status <> 'draft' then
    raise exception 'Submitted quote items are immutable.';
  end if;

  if not public.owns_manufacturer(quote_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can edit quote items.';
  end if;

  if tg_op = 'UPDATE' and old.quote_id is distinct from new.quote_id then
    raise exception 'Quote item ownership is database-managed.';
  end if;

  return new;
end;
$$;

create or replace function public.after_rfq_quote_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_rfq_quote_subtotal(old.quote_id);
    return old;
  end if;

  perform public.recalculate_rfq_quote_subtotal(new.quote_id);
  return new;
end;
$$;

-- PH-006B trusted quote submission may move manufacturer_review -> quoted.
create or replace function public.protect_rfq_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_columns text[];
begin
  if tg_op = 'UPDATE' and not public.is_valid_rfq_transition(old.status, new.status) then
    raise exception 'Invalid RFQ status transition from % to %.', old.status, new.status;
  end if;

  if tg_op = 'UPDATE' then
    if old.buyer_id is distinct from new.buyer_id
      or old.manufacturer_id is distinct from new.manufacturer_id
      or old.product_id is distinct from new.product_id
      or old.product_snapshot is distinct from new.product_snapshot then
      raise exception 'RFQ participant, product, and snapshot fields cannot be changed.';
    end if;

    if public.is_trusted_quote_write()
      and old.status = 'manufacturer_review'
      and new.status = 'quoted'
      and old.requested_quantity is not distinct from new.requested_quantity
      and old.requested_currency is not distinct from new.requested_currency
      and old.incoterm is not distinct from new.incoterm
      and old.destination_country is not distinct from new.destination_country
      and old.destination_port is not distinct from new.destination_port
      and old.target_delivery_date is not distinct from new.target_delivery_date
      and old.buyer_message is not distinct from new.buyer_message then
      return new;
    end if;
  end if;

  if public.is_admin() then
    if tg_op = 'INSERT' and coalesce(new.product_snapshot, '{}'::jsonb) = '{}'::jsonb then
      new.product_snapshot := public.build_rfq_product_snapshot(new.product_id, new.manufacturer_id);
      if coalesce(new.product_snapshot, '{}'::jsonb) = '{}'::jsonb then
        raise exception 'RFQ product snapshot could not be created.';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.product_snapshot is null or new.product_snapshot = '{}'::jsonb then
      new.product_snapshot := public.build_rfq_product_snapshot(new.product_id, new.manufacturer_id);
      if new.product_snapshot is null then
        raise exception 'RFQ product snapshot could not be created.';
      end if;
    end if;

    if new.buyer_id is distinct from auth.uid() then
      raise exception 'Buyers can create only their own RFQs.';
    end if;

    if public.current_profile_role() <> 'buyer' then
      raise exception 'Only buyers can create RFQs.';
    end if;

    if new.status not in ('draft', 'submitted') then
      raise exception 'Buyers can create only draft or submitted RFQs.';
    end if;

    new.product_snapshot := public.build_rfq_product_snapshot(new.product_id, new.manufacturer_id);
    if new.product_snapshot is null then
      raise exception 'RFQ product snapshot could not be created.';
    end if;
  end if;

  if tg_op = 'UPDATE' and public.owns_manufacturer(old.manufacturer_id) then
    if not (
      old.status = 'submitted'
      and new.status = 'manufacturer_review'
    ) then
      raise exception 'Manufacturers can only move submitted RFQs into manufacturer review.';
    end if;

    changed_columns := array_remove(array[
      case when old.status is distinct from new.status then 'status' end,
      case when old.requested_quantity is distinct from new.requested_quantity then 'requested_quantity' end,
      case when old.requested_currency is distinct from new.requested_currency then 'requested_currency' end,
      case when old.incoterm is distinct from new.incoterm then 'incoterm' end,
      case when old.destination_country is distinct from new.destination_country then 'destination_country' end,
      case when old.destination_port is distinct from new.destination_port then 'destination_port' end,
      case when old.target_delivery_date is distinct from new.target_delivery_date then 'target_delivery_date' end,
      case when old.buyer_message is distinct from new.buyer_message then 'buyer_message' end
    ], null);

    if changed_columns <> array['status'] then
      raise exception 'Manufacturers cannot change buyer RFQ data.';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' and old.buyer_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Only the RFQ buyer can update this RFQ.';
  end if;

  if tg_op = 'UPDATE' and public.is_admin() then
    if old.status is distinct from new.status then
      return new;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'Only draft RFQs can be edited by buyers.';
  end if;

  if tg_op = 'UPDATE' and new.status not in ('draft', 'submitted', 'cancelled') then
    raise exception 'Invalid buyer RFQ status transition.';
  end if;

  return new;
end;
$$;

-- PH-006B trusted quote events include quote_created. The public event RPC still rejects it.
create or replace function public.insert_trusted_rfq_event(
  rfq_uuid uuid,
  event_name text,
  actor_uuid uuid,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_events text[] := array[
    'draft_created',
    'submitted',
    'manufacturer_opened',
    'manufacturer_replied',
    'quote_created',
    'buyer_opened',
    'accepted',
    'declined',
    'cancelled',
    'expired'
  ];
begin
  if event_name <> all(allowed_events) then
    raise exception 'RFQ event type must be generated by a trusted flow.';
  end if;

  insert into public.rfq_events (rfq_id, event_type, actor_profile_id, metadata)
  values (
    rfq_uuid,
    event_name,
    actor_uuid,
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.protect_rfq_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
begin
  if new.event_type not in (
    'draft_created',
    'submitted',
    'manufacturer_opened',
    'manufacturer_replied',
    'quote_created',
    'buyer_opened',
    'accepted',
    'declined',
    'cancelled',
    'expired'
  ) then
    raise exception 'Invalid RFQ event type.';
  end if;

  if not public.can_access_rfq(new.rfq_id) then
    raise exception 'Only RFQ participants can record events.';
  end if;

  select * into rfq_record from public.rfqs where id = new.rfq_id;
  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if new.event_type = 'quote_created' then
    if public.is_trusted_quote_write()
      and (public.owns_manufacturer(rfq_record.manufacturer_id) or public.is_admin()) then
      new.actor_profile_id := auth.uid();
      new.metadata := coalesce(new.metadata, '{}'::jsonb);
      return new;
    end if;

    raise exception 'RFQ quote events must be generated by the trusted quote flow.';
  end if;

  if new.event_type in ('draft_created', 'submitted', 'cancelled') and rfq_record.buyer_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Only buyers or admins can create buyer lifecycle RFQ events.';
  end if;

  if new.event_type in ('manufacturer_opened', 'manufacturer_replied') and not public.owns_manufacturer(rfq_record.manufacturer_id) and not public.is_admin() then
    raise exception 'Only assigned manufacturers or admins can create manufacturer RFQ events.';
  end if;

  if new.event_type in ('buyer_opened', 'accepted', 'declined') and rfq_record.buyer_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Only buyers or admins can create buyer RFQ events.';
  end if;

  if new.event_type = 'expired' and not public.is_admin() then
    raise exception 'Only admins can create expired RFQ events.';
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  return new;
end;
$$;

create or replace function public.create_rfq_quote_draft(rfq_uuid uuid)
returns public.rfq_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
  quote_record public.rfq_quotes%rowtype;
  next_version integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into rfq_record from public.rfqs where id = rfq_uuid for update;
  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if not public.owns_manufacturer(rfq_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can create quote drafts.';
  end if;

  if rfq_record.status not in ('submitted', 'manufacturer_review', 'quoted') then
    raise exception 'Quotes can be drafted only after RFQ submission.';
  end if;

  select * into quote_record
  from public.rfq_quotes
  where rfq_id = rfq_uuid and status = 'draft'
  order by version desc
  limit 1;

  if found then
    return quote_record;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.rfq_quotes
  where rfq_id = rfq_uuid;

  perform set_config('app.quote_trusted_write', 'on', true);

  if rfq_record.status = 'submitted' then
    update public.rfqs
    set status = 'manufacturer_review'
    where id = rfq_uuid;
  end if;

  insert into public.rfq_quotes (
    rfq_id,
    manufacturer_id,
    version,
    status,
    currency,
    quantity,
    incoterm,
    destination_port,
    created_by
  )
  values (
    rfq_uuid,
    rfq_record.manufacturer_id,
    next_version,
    'draft',
    rfq_record.requested_currency,
    rfq_record.requested_quantity,
    rfq_record.incoterm,
    rfq_record.destination_port,
    auth.uid()
  )
  returning * into quote_record;

  perform set_config('app.quote_trusted_write', '', true);

  return quote_record;
end;
$$;

create or replace function public.submit_rfq_quote(quote_uuid uuid)
returns public.rfq_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
  item_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into quote_record from public.rfq_quotes where id = quote_uuid for update;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into rfq_record from public.rfqs where id = quote_record.rfq_id for update;
  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if not public.owns_manufacturer(quote_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can submit this quote.';
  end if;

  if quote_record.status <> 'draft' then
    raise exception 'Only draft quotes can be submitted.';
  end if;

  if rfq_record.status <> 'manufacturer_review' then
    raise exception 'RFQ must be in manufacturer review before quote submission.';
  end if;

  select count(*) into item_count
  from public.rfq_quote_items
  where quote_id = quote_uuid;

  if item_count = 0 then
    raise exception 'Quote must include at least one line item.';
  end if;

  perform public.recalculate_rfq_quote_subtotal(quote_uuid);
  perform set_config('app.quote_trusted_write', 'on', true);

  update public.rfq_quotes
  set status = 'superseded'
  where rfq_id = quote_record.rfq_id
    and id <> quote_uuid
    and status = 'submitted';

  update public.rfq_quotes
  set status = 'submitted',
      submitted_at = now()
  where id = quote_uuid
  returning * into quote_record;

  update public.rfqs
  set status = 'quoted'
  where id = quote_record.rfq_id;

  perform public.insert_trusted_rfq_event(
    quote_record.rfq_id,
    'quote_created',
    auth.uid(),
    jsonb_build_object('quote_id', quote_record.id, 'version', quote_record.version)
  );

  perform set_config('app.quote_trusted_write', '', true);

  return quote_record;
end;
$$;

create or replace function public.create_rfq_quote_revision(quote_uuid uuid)
returns public.rfq_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  source_quote public.rfq_quotes%rowtype;
  new_quote public.rfq_quotes%rowtype;
  next_version integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into source_quote from public.rfq_quotes where id = quote_uuid for update;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  if not public.owns_manufacturer(source_quote.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can create quote revisions.';
  end if;

  if source_quote.status not in ('submitted', 'superseded') then
    raise exception 'Revisions can be created only from submitted or superseded quotes.';
  end if;

  select * into new_quote
  from public.rfq_quotes
  where rfq_id = source_quote.rfq_id and status = 'draft'
  order by version desc
  limit 1;

  if found then
    return new_quote;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.rfq_quotes
  where rfq_id = source_quote.rfq_id;

  perform set_config('app.quote_trusted_write', 'on', true);

  insert into public.rfq_quotes (
    rfq_id,
    manufacturer_id,
    version,
    status,
    currency,
    unit_price,
    quantity,
    subtotal,
    incoterm,
    origin_port,
    destination_port,
    production_lead_days,
    shipping_lead_days,
    valid_until,
    manufacturer_note,
    created_by
  )
  values (
    source_quote.rfq_id,
    source_quote.manufacturer_id,
    next_version,
    'draft',
    source_quote.currency,
    source_quote.unit_price,
    source_quote.quantity,
    0,
    source_quote.incoterm,
    source_quote.origin_port,
    source_quote.destination_port,
    source_quote.production_lead_days,
    source_quote.shipping_lead_days,
    source_quote.valid_until,
    source_quote.manufacturer_note,
    auth.uid()
  )
  returning * into new_quote;

  insert into public.rfq_quote_items (
    quote_id,
    line_order,
    item_type,
    description,
    quantity,
    unit,
    unit_price
  )
  select
    new_quote.id,
    line_order,
    item_type,
    description,
    quantity,
    unit,
    unit_price
  from public.rfq_quote_items
  where quote_id = source_quote.id
  order by line_order;

  perform public.recalculate_rfq_quote_subtotal(new_quote.id);

  select * into new_quote from public.rfq_quotes where id = new_quote.id;

  perform set_config('app.quote_trusted_write', '', true);

  return new_quote;
end;
$$;

create or replace function public.delete_rfq_quote_draft(quote_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.rfq_quotes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into quote_record from public.rfq_quotes where id = quote_uuid for update;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  if quote_record.status <> 'draft' then
    raise exception 'Only draft quotes can be deleted.';
  end if;

  if not public.owns_manufacturer(quote_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can delete quote drafts.';
  end if;

  delete from public.rfq_quotes where id = quote_uuid;
end;
$$;

drop trigger if exists set_rfq_quote_updated_at on public.rfq_quotes;
create trigger set_rfq_quote_updated_at
before update on public.rfq_quotes
for each row execute function public.set_rfq_quote_updated_at();

drop trigger if exists protect_rfq_quote_write on public.rfq_quotes;
create trigger protect_rfq_quote_write
before update on public.rfq_quotes
for each row execute function public.protect_rfq_quote_write();

drop trigger if exists set_rfq_quote_item_updated_at on public.rfq_quote_items;
create trigger set_rfq_quote_item_updated_at
before update on public.rfq_quote_items
for each row execute function public.set_rfq_quote_item_updated_at();

drop trigger if exists protect_rfq_quote_item_write on public.rfq_quote_items;
create trigger protect_rfq_quote_item_write
before insert or update or delete on public.rfq_quote_items
for each row execute function public.protect_rfq_quote_item_write();

drop trigger if exists after_rfq_quote_item_change on public.rfq_quote_items;
create trigger after_rfq_quote_item_change
after insert or update or delete on public.rfq_quote_items
for each row execute function public.after_rfq_quote_item_change();

drop policy if exists "rfq_quotes_select_authorized" on public.rfq_quotes;
drop policy if exists "rfq_quotes_update_own_draft" on public.rfq_quotes;
drop policy if exists "rfq_quotes_delete_own_draft" on public.rfq_quotes;

create policy "rfq_quotes_select_authorized"
on public.rfq_quotes
for select
to authenticated
using (public.can_access_rfq_quote(id));

create policy "rfq_quotes_update_own_draft"
on public.rfq_quotes
for update
to authenticated
using (public.can_manage_rfq_quote_draft(id))
with check (public.can_manage_rfq_quote_draft(id));

create policy "rfq_quotes_delete_own_draft"
on public.rfq_quotes
for delete
to authenticated
using (public.can_manage_rfq_quote_draft(id));

drop policy if exists "rfq_quote_items_select_authorized" on public.rfq_quote_items;
drop policy if exists "rfq_quote_items_insert_own_draft" on public.rfq_quote_items;
drop policy if exists "rfq_quote_items_update_own_draft" on public.rfq_quote_items;
drop policy if exists "rfq_quote_items_delete_own_draft" on public.rfq_quote_items;

create policy "rfq_quote_items_select_authorized"
on public.rfq_quote_items
for select
to authenticated
using (public.can_access_rfq_quote(quote_id));

create policy "rfq_quote_items_insert_own_draft"
on public.rfq_quote_items
for insert
to authenticated
with check (public.can_manage_rfq_quote_draft(quote_id));

create policy "rfq_quote_items_update_own_draft"
on public.rfq_quote_items
for update
to authenticated
using (public.can_manage_rfq_quote_draft(quote_id))
with check (public.can_manage_rfq_quote_draft(quote_id));

create policy "rfq_quote_items_delete_own_draft"
on public.rfq_quote_items
for delete
to authenticated
using (public.can_manage_rfq_quote_draft(quote_id));

revoke all on function public.create_rfq_quote_draft(uuid) from public, anon;
revoke all on function public.submit_rfq_quote(uuid) from public, anon;
revoke all on function public.create_rfq_quote_revision(uuid) from public, anon;
revoke all on function public.delete_rfq_quote_draft(uuid) from public, anon;
grant execute on function public.create_rfq_quote_draft(uuid) to authenticated;
grant execute on function public.submit_rfq_quote(uuid) to authenticated;
grant execute on function public.create_rfq_quote_revision(uuid) to authenticated;
grant execute on function public.delete_rfq_quote_draft(uuid) to authenticated;
