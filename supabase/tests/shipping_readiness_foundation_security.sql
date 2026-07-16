begin;

-- PH-010A Shipping Readiness Foundation.
-- Internal readiness only: no carrier booking, pickup, tracking, customs filing, delivery confirmation, freight-provider APIs, labels, bills of lading, insurance, tariff calculation, or logistics advice.

create sequence if not exists public.shipping_readiness_number_seq;

create table if not exists public.shipping_readiness_records (
  id uuid primary key default gen_random_uuid(),
  shipping_number text unique not null,
  purchase_order_id uuid not null unique references public.purchase_orders(id) on delete restrict,
  purchase_order_number text not null,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_number text not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_number text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'shipping_draft',
  version integer not null default 1,
  shipping_mode text not null,
  incoterm text,
  origin_country_code text,
  origin_address jsonb,
  destination_country_code text,
  destination_address jsonb,
  cargo_description text,
  package_count integer,
  gross_weight_kg numeric(14,3),
  volume_cbm numeric(14,3),
  requested_ship_date date,
  estimated_ready_date date,
  special_instructions text,
  purchase_order_snapshot jsonb not null,
  contract_snapshot jsonb not null,
  invoice_snapshot jsonb not null,
  party_snapshot jsonb not null,
  cargo_snapshot jsonb not null,
  readiness_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  ready_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_readiness_number_format_check check (shipping_number ~ '^SHP-[0-9]{4}-[0-9]{6}$'),
  constraint shipping_readiness_status_check check (status in ('shipping_draft', 'ready_for_logistics', 'cancelled')),
  constraint shipping_readiness_version_check check (version > 0),
  constraint shipping_readiness_mode_check check (shipping_mode in ('ocean', 'air', 'truck', 'rail', 'multimodal', 'other')),
  constraint shipping_readiness_incoterm_check check (
    incoterm is null or incoterm in ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'OTHER', 'UNSPECIFIED')
  ),
  constraint shipping_readiness_origin_country_check check (origin_country_code is null or origin_country_code ~ '^[A-Z]{2}$'),
  constraint shipping_readiness_destination_country_check check (destination_country_code is null or destination_country_code ~ '^[A-Z]{2}$'),
  constraint shipping_readiness_address_object_check check (
    (origin_address is null or jsonb_typeof(origin_address) = 'object')
    and (destination_address is null or jsonb_typeof(destination_address) = 'object')
  ),
  constraint shipping_readiness_cargo_description_check check (
    cargo_description is null or char_length(cargo_description) between 1 and 1000
  ),
  constraint shipping_readiness_package_count_check check (package_count is null or package_count > 0),
  constraint shipping_readiness_weight_check check (gross_weight_kg is null or gross_weight_kg > 0),
  constraint shipping_readiness_volume_check check (volume_cbm is null or volume_cbm > 0),
  constraint shipping_readiness_special_instructions_check check (
    special_instructions is null or char_length(special_instructions) <= 2000
  ),
  constraint shipping_readiness_snapshots_check check (
    jsonb_typeof(purchase_order_snapshot) = 'object'
    and jsonb_typeof(contract_snapshot) = 'object'
    and jsonb_typeof(invoice_snapshot) = 'object'
    and jsonb_typeof(party_snapshot) = 'object'
    and jsonb_typeof(cargo_snapshot) = 'object'
    and jsonb_typeof(readiness_snapshot) = 'object'
  ),
  constraint shipping_readiness_lifecycle_check check (
    (status = 'shipping_draft' and ready_at is null and cancelled_at is null and cancellation_reason is null)
    or (status = 'ready_for_logistics' and ready_at is not null and cancelled_at is null and cancellation_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and cancellation_reason is not null)
  )
);

create table if not exists public.shipping_readiness_events (
  id uuid primary key default gen_random_uuid(),
  shipping_readiness_id uuid not null references public.shipping_readiness_records(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint shipping_readiness_events_type_check check (
    event_type in (
      'shipping_readiness_created',
      'shipping_readiness_updated',
      'shipping_readiness_marked_ready',
      'shipping_readiness_cancelled'
    )
  )
);

create index if not exists shipping_readiness_buyer_status_idx
  on public.shipping_readiness_records (buyer_id, status, created_at desc);

create index if not exists shipping_readiness_manufacturer_status_idx
  on public.shipping_readiness_records (manufacturer_id, status, created_at desc);

create index if not exists shipping_readiness_invoice_idx
  on public.shipping_readiness_records (invoice_id);

create index if not exists shipping_readiness_events_record_created_idx
  on public.shipping_readiness_events (shipping_readiness_id, created_at);

alter table public.shipping_readiness_records enable row level security;
alter table public.shipping_readiness_events enable row level security;

grant select on table public.shipping_readiness_records to authenticated;
grant select on table public.shipping_readiness_events to authenticated;
revoke all on table public.shipping_readiness_records from anon;
revoke all on table public.shipping_readiness_events from anon;
revoke insert, update, delete on table public.shipping_readiness_records from authenticated;
revoke insert, update, delete on table public.shipping_readiness_events from authenticated;

create or replace function public.is_trusted_shipping_readiness_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.shipping_readiness_trusted_write', true), '') = 'on';
$$;

create or replace function public.generate_shipping_readiness_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.shipping_readiness_number_seq');
  return 'SHP-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.can_access_shipping_readiness(shipping_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shipping_readiness_records sr
    where sr.id = shipping_uuid
      and (
        sr.buyer_id = auth.uid()
        or public.owns_manufacturer(sr.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.normalize_shipping_address(address_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  normalized jsonb := '{}'::jsonb;
  line1 text;
  line2 text;
  city_value text;
  state_value text;
  postal_value text;
  country_value text;
begin
  if address_value is null then
    return null;
  end if;
  if jsonb_typeof(address_value) <> 'object' then
    raise exception 'Shipping address must be an object.';
  end if;

  if address_value ? 'address_line1' then
    if jsonb_typeof(address_value->'address_line1') <> 'string' then raise exception 'Address line 1 must be text.'; end if;
    line1 := btrim(address_value->>'address_line1');
    if line1 <> '' then normalized := normalized || jsonb_build_object('address_line1', line1); end if;
  end if;
  if address_value ? 'address_line2' then
    if jsonb_typeof(address_value->'address_line2') <> 'string' then raise exception 'Address line 2 must be text.'; end if;
    line2 := btrim(address_value->>'address_line2');
    if line2 <> '' then normalized := normalized || jsonb_build_object('address_line2', line2); end if;
  end if;
  if address_value ? 'city' then
    if jsonb_typeof(address_value->'city') <> 'string' then raise exception 'City must be text.'; end if;
    city_value := btrim(address_value->>'city');
    if city_value <> '' then normalized := normalized || jsonb_build_object('city', city_value); end if;
  end if;
  if address_value ? 'state_region' then
    if jsonb_typeof(address_value->'state_region') <> 'string' then raise exception 'State or region must be text.'; end if;
    state_value := btrim(address_value->>'state_region');
    if state_value <> '' then normalized := normalized || jsonb_build_object('state_region', state_value); end if;
  end if;
  if address_value ? 'postal_code' then
    if jsonb_typeof(address_value->'postal_code') <> 'string' then raise exception 'Postal code must be text.'; end if;
    postal_value := btrim(address_value->>'postal_code');
    if postal_value <> '' then normalized := normalized || jsonb_build_object('postal_code', postal_value); end if;
  end if;
  if address_value ? 'country_code' then
    if jsonb_typeof(address_value->'country_code') <> 'string' then raise exception 'Country code must be text.'; end if;
    country_value := upper(btrim(address_value->>'country_code'));
    if country_value <> '' then normalized := normalized || jsonb_build_object('country_code', country_value); end if;
  end if;

  if normalized ? 'address_line1' and char_length(normalized->>'address_line1') > 200 then raise exception 'Address line 1 must be 200 characters or fewer.'; end if;
  if normalized ? 'address_line2' and char_length(normalized->>'address_line2') > 200 then raise exception 'Address line 2 must be 200 characters or fewer.'; end if;
  if normalized ? 'city' and char_length(normalized->>'city') > 120 then raise exception 'City must be 120 characters or fewer.'; end if;
  if normalized ? 'state_region' and char_length(normalized->>'state_region') > 120 then raise exception 'State or region must be 120 characters or fewer.'; end if;
  if normalized ? 'postal_code' and char_length(normalized->>'postal_code') > 32 then raise exception 'Postal code must be 32 characters or fewer.'; end if;
  if normalized ? 'country_code' and (normalized->>'country_code') !~ '^[A-Z]{2}$' then raise exception 'Country code must be exactly two uppercase letters.'; end if;

  return normalized;
end;
$$;

create or replace function public.assert_shipping_address_ready(address_value jsonb, label_text text)
returns void
language plpgsql
immutable
as $$
begin
  if address_value is null then
    raise exception '% address is required before marking ready.', label_text;
  end if;
  if not (
    address_value ? 'address_line1'
    and address_value ? 'city'
    and address_value ? 'state_region'
    and address_value ? 'postal_code'
    and address_value ? 'country_code'
  ) then
    raise exception '% address is incomplete.', label_text;
  end if;
end;
$$;

create or replace function public.assert_shipping_readiness_values(
  shipping_mode_value text,
  incoterm_value text default null,
  origin_address_value jsonb default null,
  destination_address_value jsonb default null,
  cargo_description_text text default null,
  package_count_value integer default null,
  gross_weight_kg_value numeric default null,
  volume_cbm_value numeric default null,
  requested_ship_date_value date default null,
  estimated_ready_date_value date default null,
  special_instructions_text text default null,
  require_complete boolean default false
)
returns void
language plpgsql
stable
as $$
declare
  normalized_mode text := lower(btrim(coalesce(shipping_mode_value, '')));
  normalized_incoterm text := upper(btrim(coalesce(incoterm_value, 'UNSPECIFIED')));
begin
  if normalized_mode not in ('ocean', 'air', 'truck', 'rail', 'multimodal', 'other') then
    raise exception 'Shipping mode is not supported.';
  end if;
  if normalized_incoterm not in ('EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'OTHER', 'UNSPECIFIED') then
    raise exception 'Incoterm is not supported.';
  end if;
  if cargo_description_text is not null and char_length(btrim(cargo_description_text)) > 1000 then
    raise exception 'Cargo description must be 1000 characters or fewer.';
  end if;
  if special_instructions_text is not null and char_length(btrim(special_instructions_text)) > 2000 then
    raise exception 'Special instructions must be 2000 characters or fewer.';
  end if;
  if package_count_value is not null and package_count_value <= 0 then
    raise exception 'Package count must be greater than zero.';
  end if;
  if gross_weight_kg_value is not null and gross_weight_kg_value <= 0 then
    raise exception 'Gross weight must be greater than zero.';
  end if;
  if volume_cbm_value is not null and volume_cbm_value <= 0 then
    raise exception 'Volume must be greater than zero.';
  end if;
  if requested_ship_date_value is not null and requested_ship_date_value < current_date then
    raise exception 'Requested ship date cannot be in the past.';
  end if;
  if estimated_ready_date_value is not null and estimated_ready_date_value < current_date then
    raise exception 'Estimated ready date cannot be in the past.';
  end if;
  if requested_ship_date_value is not null and estimated_ready_date_value is not null and requested_ship_date_value < estimated_ready_date_value then
    raise exception 'Requested ship date must be on or after estimated ready date.';
  end if;

  if require_complete then
    perform public.assert_shipping_address_ready(origin_address_value, 'Origin');
    perform public.assert_shipping_address_ready(destination_address_value, 'Destination');
    if cargo_description_text is null or btrim(cargo_description_text) = '' then
      raise exception 'Cargo description is required before marking ready.';
    end if;
    if package_count_value is null or package_count_value <= 0 then
      raise exception 'Package count is required before marking ready.';
    end if;
    if gross_weight_kg_value is null or gross_weight_kg_value <= 0 then
      raise exception 'Gross weight is required before marking ready.';
    end if;
    if volume_cbm_value is null or volume_cbm_value <= 0 then
      raise exception 'Volume is required before marking ready.';
    end if;
    if estimated_ready_date_value is null then
      raise exception 'Estimated ready date is required before marking ready.';
    end if;
    if requested_ship_date_value is null then
      raise exception 'Requested ship date is required before marking ready.';
    end if;
  end if;
end;
$$;

create or replace function public.build_shipping_cargo_snapshot(
  cargo_description_text text,
  package_count_value integer,
  gross_weight_kg_value numeric,
  volume_cbm_value numeric
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'cargo_description', nullif(btrim(coalesce(cargo_description_text, '')), ''),
    'package_count', package_count_value,
    'gross_weight_kg', gross_weight_kg_value,
    'volume_cbm', volume_cbm_value
  )
$$;

create or replace function public.build_shipping_readiness_snapshot(
  shipping_mode_value text,
  incoterm_value text,
  requested_ship_date_value date,
  estimated_ready_date_value date,
  special_instructions_text text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'shipping_mode', lower(btrim(coalesce(shipping_mode_value, ''))),
    'incoterm', upper(btrim(coalesce(incoterm_value, 'UNSPECIFIED'))),
    'requested_ship_date', requested_ship_date_value,
    'estimated_ready_date', estimated_ready_date_value,
    'special_instructions', nullif(btrim(coalesce(special_instructions_text, '')), ''),
    'ready_for_logistics_means_booked', false,
    'carrier_booked', false,
    'freight_forwarder_engaged', false,
    'pickup_scheduled', false,
    'cargo_dispatched', false,
    'shipment_in_transit', false,
    'customs_cleared', false,
    'delivered', false
  )
$$;

create or replace function public.strip_shipping_event_metadata(event_metadata jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(event_metadata, '{}'::jsonb)
    - 'actor_profile_id'
    - 'actor_id'
    - 'carrier_credentials'
    - 'carrier_token'
    - 'provider_token'
    - 'provider_secret'
    - 'api_key'
    - 'webhook_secret'
    - 'access_token'
    - 'refresh_token'
    - 'bank_credentials'
    - 'payment_credentials'
    - 'tracking_token'
    - 'customs_credentials'
$$;

create or replace function public.insert_trusted_shipping_readiness_event(
  shipping_uuid uuid,
  event_type_value text,
  actor_uuid uuid,
  metadata_value jsonb default '{}'::jsonb
)
returns public.shipping_readiness_events
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.shipping_readiness_events%rowtype;
begin
  if event_type_value not in (
    'shipping_readiness_created',
    'shipping_readiness_updated',
    'shipping_readiness_marked_ready',
    'shipping_readiness_cancelled'
  ) then
    raise exception 'Unsupported shipping readiness event type.';
  end if;

  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  insert into public.shipping_readiness_events (
    shipping_readiness_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    shipping_uuid,
    event_type_value,
    actor_uuid,
    public.strip_shipping_event_metadata(metadata_value)
  )
  returning * into event_row;
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  return event_row;
exception when others then
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.protect_shipping_readiness_write()
returns trigger
language plpgsql
as $$
begin
  if not public.is_trusted_shipping_readiness_write() then
    raise exception 'Shipping readiness records are managed through trusted RPCs.';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Shipping readiness records cannot be deleted.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_shipping_readiness_event_write()
returns trigger
language plpgsql
as $$
begin
  if not public.is_trusted_shipping_readiness_write() then
    raise exception 'Shipping readiness events are immutable and cannot be changed.';
  end if;
  if tg_op <> 'INSERT' then
    raise exception 'Shipping readiness events are immutable and cannot be changed.';
  end if;
  return new;
end;
$$;

create or replace function public.create_shipping_readiness(purchase_order_uuid uuid)
returns public.shipping_readiness_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  po_row public.purchase_orders%rowtype;
  contract_row public.contracts%rowtype;
  invoice_row public.invoices%rowtype;
  shipping_row public.shipping_readiness_records%rowtype;
  default_mode text := 'ocean';
  default_incoterm text := 'UNSPECIFIED';
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;
  select * into po_row from public.purchase_orders where id = purchase_order_uuid for update;
  if not found or po_row.status <> 'confirmed' then
    raise exception 'Shipping readiness requires a confirmed purchase order.';
  end if;
  if not public.owns_manufacturer(po_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can create shipping readiness.';
  end if;
  select * into contract_row
  from public.contracts
  where purchase_order_id = po_row.id and status = 'accepted'
  order by accepted_at desc nulls last, created_at desc
  limit 1;
  if not found then
    raise exception 'Shipping readiness requires an accepted contract.';
  end if;
  select * into invoice_row
  from public.invoices
  where purchase_order_id = po_row.id and status = 'issued'
  order by issued_at desc nulls last, created_at desc
  limit 1;
  if not found then
    raise exception 'Shipping readiness requires an issued invoice.';
  end if;
  if exists (select 1 from public.shipping_readiness_records where purchase_order_id = po_row.id) then
    raise exception 'Shipping readiness already exists for this purchase order.';
  end if;

  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  insert into public.shipping_readiness_records (
    shipping_number,
    purchase_order_id,
    purchase_order_number,
    contract_id,
    contract_number,
    invoice_id,
    invoice_number,
    buyer_id,
    manufacturer_id,
    status,
    shipping_mode,
    incoterm,
    purchase_order_snapshot,
    contract_snapshot,
    invoice_snapshot,
    party_snapshot,
    cargo_snapshot,
    readiness_snapshot,
    created_by
  )
  values (
    public.generate_shipping_readiness_number(),
    po_row.id,
    po_row.po_number,
    contract_row.id,
    contract_row.contract_number,
    invoice_row.id,
    invoice_row.invoice_number,
    po_row.buyer_id,
    po_row.manufacturer_id,
    'shipping_draft',
    default_mode,
    default_incoterm,
    to_jsonb(po_row),
    to_jsonb(contract_row),
    to_jsonb(invoice_row),
    jsonb_build_object(
      'buyer_id', po_row.buyer_id,
      'manufacturer_id', po_row.manufacturer_id,
      'buyer_snapshot', po_row.buyer_snapshot,
      'manufacturer_snapshot', po_row.manufacturer_snapshot
    ),
    public.build_shipping_cargo_snapshot(null, null, null, null),
    public.build_shipping_readiness_snapshot(default_mode, default_incoterm, null, null, null),
    actor_uuid
  )
  returning * into shipping_row;
  perform set_config('app.shipping_readiness_trusted_write', '', true);

  perform public.insert_trusted_shipping_readiness_event(
    shipping_row.id,
    'shipping_readiness_created',
    actor_uuid,
    jsonb_build_object('shipping_number', shipping_row.shipping_number)
  );

  return shipping_row;
exception when unique_violation then
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  raise exception 'Shipping readiness already exists for this purchase order.';
when others then
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_shipping_readiness_draft(
  shipping_uuid uuid,
  shipping_mode_value text,
  incoterm_value text,
  origin_address_value jsonb,
  destination_address_value jsonb,
  cargo_description_text text,
  package_count_value integer,
  gross_weight_kg_value numeric,
  volume_cbm_value numeric,
  requested_ship_date_value date,
  estimated_ready_date_value date,
  special_instructions_text text
)
returns public.shipping_readiness_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  shipping_row public.shipping_readiness_records%rowtype;
  normalized_origin jsonb;
  normalized_destination jsonb;
  normalized_mode text := lower(btrim(coalesce(shipping_mode_value, '')));
  normalized_incoterm text := upper(btrim(coalesce(incoterm_value, 'UNSPECIFIED')));
  normalized_cargo text := nullif(btrim(coalesce(cargo_description_text, '')), '');
  normalized_instructions text := nullif(btrim(coalesce(special_instructions_text, '')), '');
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  select * into shipping_row from public.shipping_readiness_records where id = shipping_uuid for update;
  if not found then raise exception 'Shipping readiness record not found.'; end if;
  if not public.owns_manufacturer(shipping_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can update this shipping readiness draft.';
  end if;
  if shipping_row.status <> 'shipping_draft' then
    raise exception 'Only shipping draft records can be updated.';
  end if;

  normalized_origin := public.normalize_shipping_address(origin_address_value);
  normalized_destination := public.normalize_shipping_address(destination_address_value);
  perform public.assert_shipping_readiness_values(
    normalized_mode,
    normalized_incoterm,
    normalized_origin,
    normalized_destination,
    normalized_cargo,
    package_count_value,
    gross_weight_kg_value,
    volume_cbm_value,
    requested_ship_date_value,
    estimated_ready_date_value,
    normalized_instructions,
    false
  );

  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  update public.shipping_readiness_records
  set shipping_mode = normalized_mode,
      incoterm = normalized_incoterm,
      origin_address = normalized_origin,
      origin_country_code = normalized_origin->>'country_code',
      destination_address = normalized_destination,
      destination_country_code = normalized_destination->>'country_code',
      cargo_description = normalized_cargo,
      package_count = package_count_value,
      gross_weight_kg = gross_weight_kg_value,
      volume_cbm = volume_cbm_value,
      requested_ship_date = requested_ship_date_value,
      estimated_ready_date = estimated_ready_date_value,
      special_instructions = normalized_instructions,
      cargo_snapshot = public.build_shipping_cargo_snapshot(normalized_cargo, package_count_value, gross_weight_kg_value, volume_cbm_value),
      readiness_snapshot = public.build_shipping_readiness_snapshot(normalized_mode, normalized_incoterm, requested_ship_date_value, estimated_ready_date_value, normalized_instructions)
  where id = shipping_uuid and status = 'shipping_draft'
  returning * into shipping_row;
  if not found then
    raise exception 'Shipping readiness lifecycle conflict while updating draft.';
  end if;
  perform set_config('app.shipping_readiness_trusted_write', '', true);

  perform public.insert_trusted_shipping_readiness_event(
    shipping_row.id,
    'shipping_readiness_updated',
    actor_uuid,
    jsonb_build_object('shipping_number', shipping_row.shipping_number)
  );

  return shipping_row;
exception when others then
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.mark_shipping_readiness_ready(shipping_uuid uuid)
returns public.shipping_readiness_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  shipping_row public.shipping_readiness_records%rowtype;
  po_status text;
  contract_status text;
  invoice_status text;
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  select * into shipping_row from public.shipping_readiness_records where id = shipping_uuid for update;
  if not found then raise exception 'Shipping readiness record not found.'; end if;
  if not public.owns_manufacturer(shipping_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can mark shipping readiness ready.';
  end if;
  if shipping_row.status <> 'shipping_draft' then
    raise exception 'Only shipping draft records can be marked ready.';
  end if;

  select status into po_status from public.purchase_orders where id = shipping_row.purchase_order_id for update;
  select status into contract_status from public.contracts where id = shipping_row.contract_id for update;
  select status into invoice_status from public.invoices where id = shipping_row.invoice_id for update;
  if po_status <> 'confirmed' then raise exception 'Source purchase order must remain confirmed.'; end if;
  if contract_status <> 'accepted' then raise exception 'Source contract must remain accepted.'; end if;
  if invoice_status <> 'issued' then raise exception 'Source invoice must remain issued.'; end if;

  perform public.assert_shipping_readiness_values(
    shipping_row.shipping_mode,
    shipping_row.incoterm,
    shipping_row.origin_address,
    shipping_row.destination_address,
    shipping_row.cargo_description,
    shipping_row.package_count,
    shipping_row.gross_weight_kg,
    shipping_row.volume_cbm,
    shipping_row.requested_ship_date,
    shipping_row.estimated_ready_date,
    shipping_row.special_instructions,
    true
  );

  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  update public.shipping_readiness_records
  set status = 'ready_for_logistics',
      ready_at = now()
  where id = shipping_uuid and status = 'shipping_draft'
  returning * into shipping_row;
  if not found then
    raise exception 'Shipping readiness lifecycle conflict while marking ready.';
  end if;
  perform set_config('app.shipping_readiness_trusted_write', '', true);

  perform public.insert_trusted_shipping_readiness_event(
    shipping_row.id,
    'shipping_readiness_marked_ready',
    actor_uuid,
    jsonb_build_object('shipping_number', shipping_row.shipping_number, 'ready_for_logistics_means_booked', false)
  );

  return shipping_row;
exception when others then
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.cancel_shipping_readiness(shipping_uuid uuid, reason_text text)
returns public.shipping_readiness_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  shipping_row public.shipping_readiness_records%rowtype;
  normalized_reason text := btrim(coalesce(reason_text, ''));
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  if normalized_reason = '' then raise exception 'Cancellation reason is required.'; end if;
  if char_length(normalized_reason) > 2000 then raise exception 'Cancellation reason must be 2000 characters or fewer.'; end if;
  select * into shipping_row from public.shipping_readiness_records where id = shipping_uuid for update;
  if not found then raise exception 'Shipping readiness record not found.'; end if;
  if not public.owns_manufacturer(shipping_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can cancel shipping readiness.';
  end if;
  if shipping_row.status not in ('shipping_draft', 'ready_for_logistics') then
    raise exception 'Only draft or ready shipping readiness records can be cancelled.';
  end if;

  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  update public.shipping_readiness_records
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = normalized_reason
  where id = shipping_uuid and status in ('shipping_draft', 'ready_for_logistics')
  returning * into shipping_row;
  if not found then
    raise exception 'Shipping readiness lifecycle conflict while cancelling.';
  end if;
  perform set_config('app.shipping_readiness_trusted_write', '', true);

  perform public.insert_trusted_shipping_readiness_event(
    shipping_row.id,
    'shipping_readiness_cancelled',
    actor_uuid,
    jsonb_build_object('shipping_number', shipping_row.shipping_number, 'reason', normalized_reason)
  );

  return shipping_row;
exception when others then
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_shipping_readiness_write on public.shipping_readiness_records;
create trigger protect_shipping_readiness_write
before insert or update or delete on public.shipping_readiness_records
for each row execute function public.protect_shipping_readiness_write();

drop trigger if exists protect_shipping_readiness_event_write on public.shipping_readiness_events;
create trigger protect_shipping_readiness_event_write
before insert or update or delete on public.shipping_readiness_events
for each row execute function public.protect_shipping_readiness_event_write();

drop policy if exists "shipping_readiness_select_participant_or_admin" on public.shipping_readiness_records;
create policy "shipping_readiness_select_participant_or_admin"
on public.shipping_readiness_records
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "shipping_readiness_events_select_participant_or_admin" on public.shipping_readiness_events;
create policy "shipping_readiness_events_select_participant_or_admin"
on public.shipping_readiness_events
for select
to authenticated
using (
  exists (
    select 1
    from public.shipping_readiness_records sr
    where sr.id = shipping_readiness_events.shipping_readiness_id
      and (
        sr.buyer_id = auth.uid()
        or public.owns_manufacturer(sr.manufacturer_id)
        or public.is_admin()
      )
  )
);

revoke all on function public.is_trusted_shipping_readiness_write() from public, anon, authenticated;
revoke all on function public.generate_shipping_readiness_number() from public, anon, authenticated;
revoke all on function public.can_access_shipping_readiness(uuid) from public, anon, authenticated;
revoke all on function public.normalize_shipping_address(jsonb) from public, anon, authenticated;
revoke all on function public.assert_shipping_address_ready(jsonb, text) from public, anon, authenticated;
revoke all on function public.assert_shipping_readiness_values(text, text, jsonb, jsonb, text, integer, numeric, numeric, date, date, text, boolean) from public, anon, authenticated;
revoke all on function public.build_shipping_cargo_snapshot(text, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.build_shipping_readiness_snapshot(text, text, date, date, text) from public, anon, authenticated;
revoke all on function public.strip_shipping_event_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.insert_trusted_shipping_readiness_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_shipping_readiness_write() from public, anon, authenticated;
revoke all on function public.protect_shipping_readiness_event_write() from public, anon, authenticated;

revoke all on function public.create_shipping_readiness(uuid) from public, anon, authenticated;
revoke all on function public.update_shipping_readiness_draft(uuid, text, text, jsonb, jsonb, text, integer, numeric, numeric, date, date, text) from public, anon, authenticated;
revoke all on function public.mark_shipping_readiness_ready(uuid) from public, anon, authenticated;
revoke all on function public.cancel_shipping_readiness(uuid, text) from public, anon, authenticated;

grant execute on function public.create_shipping_readiness(uuid) to authenticated;
grant execute on function public.update_shipping_readiness_draft(uuid, text, text, jsonb, jsonb, text, integer, numeric, numeric, date, date, text) to authenticated;
grant execute on function public.mark_shipping_readiness_ready(uuid) to authenticated;
grant execute on function public.cancel_shipping_readiness(uuid, text) to authenticated;

create temp table shipping_readiness_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

grant select, insert on shipping_readiness_results to anon, authenticated;

create or replace function pg_temp.record_shipping_check(check_name text, passed boolean, detail text default '')
returns void
language plpgsql
as $$
begin
  insert into shipping_readiness_results values (check_name, passed, coalesce(detail, ''));
end;
$$;

create or replace function pg_temp.seed_shipping_source(label_text text)
returns table (
  buyer_id uuid,
  manufacturer_owner_id uuid,
  other_manufacturer_owner_id uuid,
  admin_id uuid,
  manufacturer_id uuid,
  purchase_order_id uuid,
  contract_id uuid,
  invoice_id uuid
)
language plpgsql
as $$
declare
  buyer_uuid uuid := gen_random_uuid();
  manufacturer_owner_uuid uuid := gen_random_uuid();
  other_manufacturer_owner_uuid uuid := gen_random_uuid();
  admin_uuid uuid := gen_random_uuid();
  manufacturer_uuid uuid;
  other_manufacturer_uuid uuid;
  product_uuid uuid;
  rfq_uuid uuid;
  quote_uuid uuid;
  decision_uuid uuid;
  po_uuid uuid;
  po_item_uuid uuid;
  contract_uuid uuid;
  package_uuid uuid;
  invoice_uuid uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', buyer_uuid, 'authenticated', 'authenticated', label_text || '-buyer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Shipping Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Shipping Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-other-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_uuid, 'authenticated', 'authenticated', label_text || '-admin@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Shipping Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_uuid;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_uuid, label_text || ' Factory Legal', label_text || ' Factory', 'China', 'draft')
  returning id into manufacturer_uuid;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_uuid, label_text || ' Other Factory Legal', label_text || ' Other Factory', 'Vietnam', 'draft')
  returning id into other_manufacturer_uuid;

  perform set_config('request.jwt.claim.sub', admin_uuid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  update public.manufacturers
  set application_status = 'approved', reviewed_by = admin_uuid, reviewed_at = now()
  where id in (manufacturer_uuid, other_manufacturer_uuid);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_uuid::text, true);
  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_uuid, label_text || ' Home', label_text || ' Model', 'Modular', 'Shipping verification product.', 'USD', 'draft')
  returning id into product_uuid;

  perform set_config('request.jwt.claim.sub', buyer_uuid::text, true);
  insert into public.rfqs(buyer_id, manufacturer_id, product_id, product_snapshot, status, requested_quantity, requested_currency, incoterm, destination_country)
  values (buyer_uuid, manufacturer_uuid, product_uuid, jsonb_build_object('name', label_text || ' Home'), 'submitted', 1, 'USD', 'FOB', 'United States')
  returning id into rfq_uuid;

  perform set_config('app.quote_trusted_write', 'on', true);
  insert into public.rfq_quotes(rfq_id, manufacturer_id, version, status, currency, subtotal, incoterm, created_by, submitted_at)
  values (rfq_uuid, manufacturer_uuid, 1, 'accepted', 'USD', 1000, 'FOB', manufacturer_owner_uuid, now())
  returning id into quote_uuid;
  insert into public.rfq_quote_items(quote_id, line_order, item_type, description, quantity, unit, unit_price)
  values (quote_uuid, 1, 'product', label_text || ' module', 2, 'unit', 500)
  returning id into po_item_uuid;
  perform set_config('app.quote_trusted_write', '', true);

  perform set_config('app.quote_decision_trusted_write', 'on', true);
  insert into public.rfq_quote_decisions(rfq_id, quote_id, buyer_id, decision, reason)
  values (rfq_uuid, quote_uuid, buyer_uuid, 'accepted', label_text || ' accepted')
  returning id into decision_uuid;
  perform set_config('app.quote_decision_trusted_write', '', true);

  perform set_config('app.purchase_order_trusted_write', 'on', true);
  insert into public.purchase_orders(
    po_number, rfq_id, quote_id, quote_decision_id, buyer_id, manufacturer_id, status,
    currency, subtotal, incoterm, quote_snapshot, buyer_snapshot, manufacturer_snapshot,
    product_snapshot, created_by, submitted_at, last_submitted_at, confirmed_at, review_round
  )
  values (
    'PO-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), rfq_uuid, quote_uuid, decision_uuid,
    buyer_uuid, manufacturer_uuid, 'confirmed', 'USD', 1000, 'FOB',
    jsonb_build_object('quote_id', quote_uuid, 'version', 1),
    jsonb_build_object('profile_id', buyer_uuid, 'full_name', 'Shipping Buyer', 'email', label_text || '-buyer@example.test'),
    jsonb_build_object('manufacturer_id', manufacturer_uuid, 'company_display_name', label_text || ' Factory', 'country', 'China'),
    jsonb_build_object('product_id', product_uuid, 'name', label_text || ' Home'),
    buyer_uuid, now(), now(), now(), 1
  )
  returning id into po_uuid;

  insert into public.purchase_order_items(purchase_order_id, source_quote_item_id, line_order, item_type, description, quantity, unit, unit_price, amount)
  select po_uuid, item.id, item.line_order, item.item_type, item.description, item.quantity, item.unit, item.unit_price, item.amount
  from public.rfq_quote_items item
  where item.quote_id = quote_uuid
  returning id into po_item_uuid;
  perform set_config('app.purchase_order_trusted_write', '', true);

  perform set_config('app.contract_trusted_write', 'on', true);
  insert into public.contracts(
    contract_number, purchase_order_id, po_number, rfq_id, quote_id, quote_decision_id,
    buyer_id, manufacturer_id, status, currency, subtotal, contract_title,
    purchase_order_snapshot, buyer_snapshot, manufacturer_snapshot, quote_snapshot, product_snapshot,
    line_items_snapshot, created_by, ready_at, review_round, first_ready_at, last_ready_at, accepted_at
  )
  values (
    'CON-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), po_uuid, (select po_number from public.purchase_orders where id = po_uuid),
    rfq_uuid, quote_uuid, decision_uuid, buyer_uuid, manufacturer_uuid, 'accepted', 'USD', 1000,
    label_text || ' Contract', jsonb_build_object('purchase_order_id', po_uuid),
    jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid),
    jsonb_build_object('quote_id', quote_uuid), jsonb_build_object('product_id', product_uuid),
    jsonb_build_array(jsonb_build_object('source_purchase_order_item_id', po_item_uuid, 'amount', 1000)),
    buyer_uuid, now(), 1, now(), now(), now()
  )
  returning id into contract_uuid;
  perform set_config('app.contract_trusted_write', '', true);

  perform set_config('app.signature_preparation_trusted_write', 'on', true);
  insert into public.signature_packages(
    package_number, contract_id, contract_number, buyer_id, manufacturer_id, status, version,
    contract_snapshot, buyer_snapshot, manufacturer_snapshot, decision_snapshot, signing_content_snapshot,
    created_by, ready_at
  )
  values (
    'SIG-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), contract_uuid,
    (select contract_number from public.contracts where id = contract_uuid), buyer_uuid, manufacturer_uuid,
    'ready_to_send', 1, jsonb_build_object('contract_id', contract_uuid), jsonb_build_object('profile_id', buyer_uuid),
    jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('decision', 'accepted'),
    jsonb_build_object('internal_only', true), buyer_uuid, now()
  )
  returning id into package_uuid;
  perform set_config('app.signature_preparation_trusted_write', '', true);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_uuid::text, true);
  select id into invoice_uuid from public.create_invoice_from_purchase_order(po_uuid);
  perform public.update_invoice_draft(
    invoice_uuid, current_date, current_date + 30, 'Shipping Buyer', label_text || '-buyer@example.test',
    '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb,
    0, 0, 0
  );
  select id into invoice_uuid from public.issue_invoice(invoice_uuid);

  return query select buyer_uuid, manufacturer_owner_uuid, other_manufacturer_owner_uuid, admin_uuid, manufacturer_uuid, po_uuid, contract_uuid, invoice_uuid;
exception when others then
  perform set_config('app.quote_trusted_write', '', true);
  perform set_config('app.quote_decision_trusted_write', '', true);
  perform set_config('app.purchase_order_trusted_write', '', true);
  perform set_config('app.contract_trusted_write', '', true);
  perform set_config('app.signature_preparation_trusted_write', '', true);
  raise;
end;
$$;

do $$
declare
  seed record;
  second_seed record;
  shipping_row public.shipping_readiness_records%rowtype;
  ready_row public.shipping_readiness_records%rowtype;
  cancelled_row public.shipping_readiness_records%rowtype;
  blocked boolean;
  visible_count integer;
  event_count integer;
  volatility text;
begin
  select * into seed from pg_temp.seed_shipping_source('shipping-primary');
  select * into second_seed from pg_temp.seed_shipping_source('shipping-second');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', seed.manufacturer_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into shipping_row from public.create_shipping_readiness(seed.purchase_order_id);
  perform pg_temp.record_shipping_check('assigned manufacturer creates shipping draft', shipping_row.status = 'shipping_draft' and shipping_row.purchase_order_id = seed.purchase_order_id, shipping_row.shipping_number);
  perform pg_temp.record_shipping_check('shipping number format is generated', shipping_row.shipping_number ~ '^SHP-[0-9]{4}-[0-9]{6}$', shipping_row.shipping_number);
  perform pg_temp.record_shipping_check('source identifiers are frozen', shipping_row.contract_id = seed.contract_id and shipping_row.invoice_id = seed.invoice_id, 'source ids');
  perform pg_temp.record_shipping_check('created event inserted once', (select count(*) from public.shipping_readiness_events where shipping_readiness_id = shipping_row.id and event_type = 'shipping_readiness_created') = 1, 'created event');

  blocked := false;
  begin
    perform public.create_shipping_readiness(seed.purchase_order_id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('duplicate shipping record denied', blocked, 'one per PO');

  select * into shipping_row from public.update_shipping_readiness_draft(
    shipping_row.id, 'air', 'CIF',
    '{"address_line1":"  10 Factory Rd  ","city":" Shenzhen ","country_code":"cn","unsupported":"drop"}'::jsonb,
    '{"address_line1":" Port Gate ","city":" Los Angeles ","country_code":"us"}'::jsonb,
    null, null, null, null, null, null, null
  );
  perform pg_temp.record_shipping_check('partial draft address accepted and normalized', shipping_row.origin_address->>'address_line1' = '10 Factory Rd' and shipping_row.origin_address->>'country_code' = 'CN' and not (shipping_row.origin_address ? 'unsupported'), shipping_row.origin_address::text);

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'air', 'CIF', '[]'::jsonb, null, null, null, null, null, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('non-object address denied', blocked, 'address object');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', '{"country_code":"USA"}'::jsonb, null, null, null, null, null, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('invalid country code denied in draft', blocked, 'country code');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'space', 'FOB', null, null, null, null, null, null, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('unsupported mode denied', blocked, 'mode');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'XYZ', null, null, null, null, null, null, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('unsupported incoterm denied', blocked, 'incoterm');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', null, null, repeat('x', 1001), null, null, null, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('overlong cargo description denied', blocked, 'cargo length');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', null, null, null, 0, 1, 1, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('invalid package count denied', blocked, 'package count');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', null, null, null, 1, 0, 1, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('invalid gross weight denied', blocked, 'weight');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', null, null, null, 1, 1, 0, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('invalid volume denied', blocked, 'volume');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', null, null, null, null, null, null, current_date - 1, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('past requested ship date denied', blocked, 'requested date');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(shipping_row.id, 'ocean', 'FOB', null, null, null, null, null, null, current_date + 1, current_date + 3, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('requested before estimated date denied', blocked, 'date order');

  blocked := false;
  begin
    perform public.mark_shipping_readiness_ready(shipping_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('incomplete draft cannot be marked ready', blocked, 'ready completeness');

  select * into shipping_row from public.update_shipping_readiness_draft(
    shipping_row.id, 'ocean', 'FOB',
    '{"address_line1":"10 Factory Rd","city":"Shenzhen","state_region":"Guangdong","postal_code":"518000","country_code":"CN"}'::jsonb,
    '{"address_line1":"1 Port Way","address_line2":"Dock 2","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb,
    'Two prefabricated home modules', 2, 12000.5, 88.25, current_date + 14, current_date + 7, 'Liftgate required'
  );
  select * into ready_row from public.mark_shipping_readiness_ready(shipping_row.id);
  perform pg_temp.record_shipping_check('complete record can be marked ready', ready_row.status = 'ready_for_logistics' and ready_row.ready_at is not null, ready_row.status);
  perform pg_temp.record_shipping_check('ready event inserted once', (select count(*) from public.shipping_readiness_events where shipping_readiness_id = ready_row.id and event_type = 'shipping_readiness_marked_ready') = 1, 'ready event');
  perform pg_temp.record_shipping_check('cargo snapshot freezes ready values', ready_row.cargo_snapshot->>'cargo_description' = 'Two prefabricated home modules' and (ready_row.cargo_snapshot->>'package_count')::int = 2, ready_row.cargo_snapshot::text);

  blocked := false;
  begin
    perform public.mark_shipping_readiness_ready(ready_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('repeated ready transition denied', blocked, 'same state');

  blocked := false;
  begin
    perform public.update_shipping_readiness_draft(ready_row.id, 'air', 'FOB', null, null, null, null, null, null, null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('ready record cannot be edited', blocked, 'ready immutable');

  blocked := false;
  begin
    perform public.cancel_shipping_readiness(ready_row.id, '');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('cancellation reason required', blocked, 'reason');

  select * into cancelled_row from public.cancel_shipping_readiness(ready_row.id, 'Buyer changed logistics timing');
  perform pg_temp.record_shipping_check('ready record can be cancelled terminally', cancelled_row.status = 'cancelled' and cancelled_row.cancelled_at is not null and cancelled_row.cancellation_reason = 'Buyer changed logistics timing', cancelled_row.status);
  perform pg_temp.record_shipping_check('cancelled event inserted once', (select count(*) from public.shipping_readiness_events where shipping_readiness_id = cancelled_row.id and event_type = 'shipping_readiness_cancelled') = 1, 'cancel event');

  blocked := false;
  begin
    perform public.cancel_shipping_readiness(cancelled_row.id, 'Again');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('repeated cancellation denied', blocked, 'terminal');

  perform set_config('request.jwt.claim.sub', second_seed.manufacturer_owner_id::text, true);
  select * into shipping_row from public.create_shipping_readiness(second_seed.purchase_order_id);
  select * into cancelled_row from public.cancel_shipping_readiness(shipping_row.id, 'Cancelled before readiness');
  perform pg_temp.record_shipping_check('draft can be cancelled without ready timestamp', cancelled_row.status = 'cancelled' and cancelled_row.ready_at is null and cancelled_row.cancelled_at is not null, cancelled_row.status);

  perform set_config('request.jwt.claim.sub', second_seed.buyer_id::text, true);
  select count(*) into visible_count from public.shipping_readiness_records where id = cancelled_row.id;
  perform pg_temp.record_shipping_check('buyer can read own shipping readiness', visible_count = 1, 'buyer select');
  blocked := false;
  begin
    perform public.cancel_shipping_readiness(cancelled_row.id, 'Buyer cancellation');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('buyer cannot mutate shipping readiness', blocked, 'buyer mutate');

  perform set_config('request.jwt.claim.sub', seed.other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.shipping_readiness_records where id = ready_row.id;
  perform pg_temp.record_shipping_check('other manufacturer cannot read shipping readiness', visible_count = 0, 'other manufacturer select');
  blocked := false;
  begin
    perform public.cancel_shipping_readiness(ready_row.id, 'Other manufacturer');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('other manufacturer cannot mutate shipping readiness', blocked, 'other manufacturer mutate');

  perform set_config('request.jwt.claim.sub', seed.admin_id::text, true);
  select count(*) into visible_count from public.shipping_readiness_records where id = ready_row.id;
  perform pg_temp.record_shipping_check('admin can read all shipping readiness', visible_count = 1, 'admin select');
  blocked := false;
  begin
    perform public.cancel_shipping_readiness(ready_row.id, 'Admin cancellation');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('admin cannot mutate shipping readiness', blocked, 'admin mutate');

  reset role;
  blocked := false;
  begin
    insert into public.shipping_readiness_records(
      shipping_number, purchase_order_id, purchase_order_number, contract_id, contract_number, invoice_id, invoice_number,
      buyer_id, manufacturer_id, status, shipping_mode, incoterm, purchase_order_snapshot, contract_snapshot, invoice_snapshot,
      cargo_snapshot, readiness_snapshot, created_by
    )
    values (
      'SHP-2099-999999', seed.purchase_order_id, 'PO-DIRECT', seed.contract_id, 'CON-DIRECT', seed.invoice_id, 'INV-DIRECT',
      seed.buyer_id, seed.manufacturer_id, 'shipping_draft', 'ocean', 'FOB', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, seed.manufacturer_owner_id
    );
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('direct shipping insert blocked by trigger', blocked, 'direct insert');

  blocked := false;
  begin
    update public.shipping_readiness_records set status = 'ready_for_logistics' where id = cancelled_row.id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('direct shipping update blocked by trigger', blocked, 'direct update');

  blocked := false;
  begin
    delete from public.shipping_readiness_events where shipping_readiness_id = cancelled_row.id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('shipping events are immutable', blocked, 'event delete');

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    select count(*) into visible_count from public.shipping_readiness_records;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_shipping_check('anonymous cannot read shipping readiness', blocked, 'anon select');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', seed.manufacturer_owner_id::text, true);
  select count(*) into event_count
  from public.shipping_readiness_events
  where metadata ?| array['access_token','refresh_token','password','provider_token','provider_secret','signed_url','carrier_credentials','tracking_token','customs_credentials','actor_id','actor_profile_id'];
  perform pg_temp.record_shipping_check('event metadata strips impersonation logistics and token fields', event_count = 0, 'metadata stripped');

  perform pg_temp.record_shipping_check('no execution logistics statuses exist', not exists (
    select 1 from pg_constraint
    where conname = 'shipping_readiness_status_check'
      and pg_get_constraintdef(oid) ~ 'booked|picked_up|departed|in_transit|arrived|delivered|cleared|label|bol|tracking'
  ), 'status constraint');

  perform pg_temp.record_shipping_check('no provider or carrier fields added', not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shipping_readiness_records'
      and column_name ~ 'carrier|provider|tracking|booking|label|bol|customs|tariff|insurance'
  ), 'column scan');

  select provolatile into volatility
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname = 'assert_shipping_readiness_values'
  limit 1;
  perform pg_temp.record_shipping_check('date validator is stable not immutable', volatility = 's', coalesce(volatility, 'missing'));
end;
$$;

select check_name, passed, detail
from shipping_readiness_results
order by check_name;

do $$
declare
  failed_count integer;
  total_count integer;
  failed_checks text;
begin
  select count(*), count(*) filter (where not passed)
  into total_count, failed_count
  from shipping_readiness_results;

  if failed_count > 0 then
    select string_agg(check_name || ' [' || detail || ']', '; ' order by check_name)
    into failed_checks
    from shipping_readiness_results
    where not passed;
    raise exception 'Shipping readiness foundation security verification failed: %/% checks failed: %', failed_count, total_count, failed_checks;
  end if;

  raise notice 'Shipping readiness foundation security verification passed: %/% checks', total_count, total_count;
end;
$$;

rollback;
