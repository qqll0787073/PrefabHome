begin;

-- PH-010B Logistics Booking Request Foundation.
-- Internal booking request only: no carrier selection, freight-forwarder selection, cargo-space reservation, pickup scheduling, booking confirmation, tracking, customs filing, delivery confirmation, provider APIs, labels, waybills, bills of lading, insurance, tariff calculation, payment, tax, or logistics advice.

create sequence if not exists public.logistics_booking_request_number_seq;

create table if not exists public.logistics_booking_requests (
  id uuid primary key default gen_random_uuid(),
  booking_request_number text unique not null,
  shipping_readiness_id uuid not null unique references public.shipping_readiness_records(id) on delete restrict,
  shipping_number text not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  purchase_order_number text not null,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_number text not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_number text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'booking_draft',
  version integer not null default 1,
  requested_transport_mode text not null,
  requested_incoterm text,
  preferred_departure_date date,
  latest_acceptable_departure_date date,
  origin_location jsonb,
  destination_location jsonb,
  cargo_description text,
  package_count integer,
  gross_weight_kg numeric(14,3),
  volume_cbm numeric(14,3),
  container_preference text,
  equipment_notes text,
  handling_requirements text,
  booking_notes text,
  shipping_readiness_snapshot jsonb not null,
  source_snapshot jsonb not null,
  party_snapshot jsonb not null,
  cargo_snapshot jsonb not null,
  booking_request_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logistics_booking_requests_number_check check (booking_request_number ~ '^BKR-[0-9]{4}-[0-9]{6}$'),
  constraint logistics_booking_requests_status_check check (status in ('booking_draft', 'submitted_for_arrangement', 'withdrawn')),
  constraint logistics_booking_requests_version_check check (version > 0),
  constraint logistics_booking_requests_mode_check check (requested_transport_mode in ('ocean', 'air', 'truck', 'rail', 'multimodal', 'other')),
  constraint logistics_booking_requests_incoterm_check check (requested_incoterm is null or requested_incoterm in ('EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP','OTHER','UNSPECIFIED')),
  constraint logistics_booking_requests_container_check check (container_preference is null or container_preference in ('20ft_standard','40ft_standard','40ft_high_cube','flat_rack','open_top','reefer','less_than_container_load','air_cargo','truckload','less_than_truckload','not_specified','other')),
  constraint logistics_booking_requests_location_object_check check ((origin_location is null or jsonb_typeof(origin_location) = 'object') and (destination_location is null or jsonb_typeof(destination_location) = 'object')),
  constraint logistics_booking_requests_cargo_check check (cargo_description is null or char_length(cargo_description) between 1 and 1000),
  constraint logistics_booking_requests_package_check check (package_count is null or package_count > 0),
  constraint logistics_booking_requests_weight_check check (gross_weight_kg is null or gross_weight_kg > 0),
  constraint logistics_booking_requests_volume_check check (volume_cbm is null or volume_cbm > 0),
  constraint logistics_booking_requests_text_check check ((equipment_notes is null or char_length(equipment_notes) <= 2000) and (handling_requirements is null or char_length(handling_requirements) <= 2000) and (booking_notes is null or char_length(booking_notes) <= 2000) and (withdrawal_reason is null or char_length(withdrawal_reason) <= 2000)),
  constraint logistics_booking_requests_snapshots_check check (jsonb_typeof(shipping_readiness_snapshot) = 'object' and jsonb_typeof(source_snapshot) = 'object' and jsonb_typeof(party_snapshot) = 'object' and jsonb_typeof(cargo_snapshot) = 'object' and jsonb_typeof(booking_request_snapshot) = 'object'),
  constraint logistics_booking_requests_lifecycle_check check ((status = 'booking_draft' and submitted_at is null and withdrawn_at is null and withdrawal_reason is null) or (status = 'submitted_for_arrangement' and submitted_at is not null and withdrawn_at is null and withdrawal_reason is null) or (status = 'withdrawn' and withdrawn_at is not null and withdrawal_reason is not null))
);

create table if not exists public.logistics_booking_request_events (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.logistics_booking_requests(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint logistics_booking_request_events_type_check check (event_type in ('booking_request_created','booking_request_updated','booking_request_submitted','booking_request_withdrawn'))
);

create index if not exists logistics_booking_requests_buyer_status_idx on public.logistics_booking_requests (buyer_id, status, created_at desc);
create index if not exists logistics_booking_requests_manufacturer_status_idx on public.logistics_booking_requests (manufacturer_id, status, created_at desc);
create index if not exists logistics_booking_requests_shipping_idx on public.logistics_booking_requests (shipping_readiness_id);
create index if not exists logistics_booking_request_events_request_created_idx on public.logistics_booking_request_events (booking_request_id, created_at);

alter table public.logistics_booking_requests enable row level security;
alter table public.logistics_booking_request_events enable row level security;

grant select on table public.logistics_booking_requests to authenticated;
grant select on table public.logistics_booking_request_events to authenticated;
revoke all on table public.logistics_booking_requests from anon;
revoke all on table public.logistics_booking_request_events from anon;
revoke insert, update, delete on table public.logistics_booking_requests from authenticated;
revoke insert, update, delete on table public.logistics_booking_request_events from authenticated;

create or replace function public.is_trusted_logistics_booking_request_write()
returns boolean language sql stable as $$ select coalesce(current_setting('app.logistics_booking_request_trusted_write', true), '') = 'on'; $$;

create or replace function public.generate_logistics_booking_request_number()
returns text language plpgsql security definer set search_path = public as $$
declare sequence_value bigint;
begin
  sequence_value := nextval('public.logistics_booking_request_number_seq');
  return 'BKR-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.can_access_logistics_booking_request(booking_request_uuid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.logistics_booking_requests b where b.id = booking_request_uuid and (b.buyer_id = auth.uid() or public.owns_manufacturer(b.manufacturer_id) or public.is_admin()));
$$;

create or replace function public.normalize_logistics_booking_location(location_value jsonb)
returns jsonb language plpgsql immutable as $$
declare normalized jsonb := '{}'::jsonb; key text; value text; allowed_keys text[] := array['address_line1','address_line2','city','state_region','postal_code','country_code'];
begin
  if location_value is null then return null; end if;
  if jsonb_typeof(location_value) <> 'object' then raise exception 'Location must be a JSON object.'; end if;
  foreach key in array allowed_keys loop
    if location_value ? key then
      if jsonb_typeof(location_value -> key) <> 'string' then raise exception 'Location field % must be a string.', key; end if;
      value := btrim(location_value ->> key);
      if value <> '' then if key = 'country_code' then value := upper(value); end if; normalized := normalized || jsonb_build_object(key, value); end if;
    end if;
  end loop;
  if normalized = '{}'::jsonb then return null; end if;
  if normalized ? 'address_line1' and char_length(normalized ->> 'address_line1') > 200 then raise exception 'Address line 1 must be 200 characters or fewer.'; end if;
  if normalized ? 'address_line2' and char_length(normalized ->> 'address_line2') > 200 then raise exception 'Address line 2 must be 200 characters or fewer.'; end if;
  if normalized ? 'city' and char_length(normalized ->> 'city') > 120 then raise exception 'City must be 120 characters or fewer.'; end if;
  if normalized ? 'state_region' and char_length(normalized ->> 'state_region') > 120 then raise exception 'State or region must be 120 characters or fewer.'; end if;
  if normalized ? 'postal_code' and char_length(normalized ->> 'postal_code') > 32 then raise exception 'Postal code must be 32 characters or fewer.'; end if;
  if normalized ? 'country_code' and not (normalized ->> 'country_code' ~ '^[A-Z]{2}$') then raise exception 'Country code must be exactly two uppercase letters.'; end if;
  return normalized;
end;
$$;

create or replace function public.assert_logistics_booking_location_complete(location_value jsonb, label_text text)
returns void language plpgsql immutable as $$
begin
  if location_value is null then raise exception '% location is required before submission.', label_text; end if;
  if not (location_value ? 'address_line1' and location_value ? 'city' and location_value ? 'state_region' and location_value ? 'postal_code' and location_value ? 'country_code') then raise exception '% location is incomplete.', label_text; end if;
end;
$$;

create or replace function public.assert_logistics_booking_request_values(requested_transport_mode_value text, requested_incoterm_value text, preferred_departure_date_value date, latest_acceptable_departure_date_value date, origin_location_value jsonb, destination_location_value jsonb, container_preference_value text, equipment_notes_text text, handling_requirements_text text, booking_notes_text text, require_submission boolean default false)
returns void language plpgsql stable as $$
declare mode_value text := lower(btrim(coalesce(requested_transport_mode_value, ''))); container_value text := lower(btrim(coalesce(container_preference_value, '')));
begin
  if mode_value not in ('ocean','air','truck','rail','multimodal','other') then raise exception 'Requested transport mode is not supported.'; end if;
  if requested_incoterm_value is not null and btrim(requested_incoterm_value) not in ('EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP','OTHER','UNSPECIFIED') then raise exception 'Requested Incoterm is not supported.'; end if;
  if container_preference_value is not null and container_value not in ('20ft_standard','40ft_standard','40ft_high_cube','flat_rack','open_top','reefer','less_than_container_load','air_cargo','truckload','less_than_truckload','not_specified','other') then raise exception 'Container preference is not supported.'; end if;
  if equipment_notes_text is not null and char_length(btrim(equipment_notes_text)) > 2000 then raise exception 'Equipment notes must be 2000 characters or fewer.'; end if;
  if handling_requirements_text is not null and char_length(btrim(handling_requirements_text)) > 2000 then raise exception 'Handling requirements must be 2000 characters or fewer.'; end if;
  if booking_notes_text is not null and char_length(btrim(booking_notes_text)) > 2000 then raise exception 'Booking notes must be 2000 characters or fewer.'; end if;
  if preferred_departure_date_value is not null and preferred_departure_date_value < current_date then raise exception 'Preferred departure date cannot be in the past.'; end if;
  if latest_acceptable_departure_date_value is not null and latest_acceptable_departure_date_value < current_date then raise exception 'Latest acceptable departure date cannot be in the past.'; end if;
  if preferred_departure_date_value is not null and latest_acceptable_departure_date_value is not null and latest_acceptable_departure_date_value < preferred_departure_date_value then raise exception 'Latest acceptable departure date must be on or after preferred departure date.'; end if;
  if require_submission then
    perform public.assert_logistics_booking_location_complete(origin_location_value, 'Origin');
    perform public.assert_logistics_booking_location_complete(destination_location_value, 'Destination');
    if preferred_departure_date_value is null then raise exception 'Preferred departure date is required before submission.'; end if;
    if latest_acceptable_departure_date_value is null then raise exception 'Latest acceptable departure date is required before submission.'; end if;
  end if;
end;
$$;

create or replace function public.build_logistics_booking_cargo_snapshot(cargo_description_text text, package_count_value integer, gross_weight_kg_value numeric, volume_cbm_value numeric)
returns jsonb language sql immutable as $$ select jsonb_build_object('cargo_description', cargo_description_text, 'package_count', package_count_value, 'gross_weight_kg', gross_weight_kg_value, 'volume_cbm', volume_cbm_value) $$;

create or replace function public.build_logistics_booking_request_snapshot(requested_transport_mode_value text, requested_incoterm_value text, preferred_departure_date_value date, latest_acceptable_departure_date_value date, origin_location_value jsonb, destination_location_value jsonb, container_preference_value text, equipment_notes_text text, handling_requirements_text text, booking_notes_text text)
returns jsonb language sql immutable as $$
  select jsonb_build_object('requested_transport_mode', requested_transport_mode_value, 'requested_incoterm', requested_incoterm_value, 'preferred_departure_date', preferred_departure_date_value, 'latest_acceptable_departure_date', latest_acceptable_departure_date_value, 'origin_location', origin_location_value, 'destination_location', destination_location_value, 'container_preference', container_preference_value, 'equipment_notes', equipment_notes_text, 'handling_requirements', handling_requirements_text, 'booking_notes', booking_notes_text, 'submitted_for_arrangement_means_carrier_selected', false, 'carrier_selected', false, 'freight_forwarder_selected', false, 'cargo_space_reserved', false, 'equipment_reserved', false, 'pickup_scheduled', false, 'booking_confirmed', false, 'shipment_dispatched', false, 'in_transit', false, 'customs_cleared', false, 'delivered', false)
$$;

create or replace function public.strip_logistics_booking_request_event_metadata(event_metadata jsonb)
returns jsonb language sql immutable as $$
  select coalesce(event_metadata, '{}'::jsonb) - 'actor_id' - 'actor_profile_id' - 'impersonated_by' - 'carrier_credentials' - 'carrier_token' - 'freight_provider_token' - 'provider_token' - 'provider_secret' - 'api_key' - 'webhook_secret' - 'access_token' - 'refresh_token' - 'tracking_credentials' - 'tracking_token' - 'customs_credentials' - 'bank_credentials' - 'payment_credentials' - 'private_key' - 'booking_confirmation' - 'booking_confirmation_id'
$$;

create or replace function public.insert_trusted_logistics_booking_request_event(booking_request_uuid uuid, event_name text, actor_uuid uuid, event_metadata jsonb default '{}'::jsonb)
returns public.logistics_booking_request_events language plpgsql security definer set search_path = public as $$
declare event_row public.logistics_booking_request_events%rowtype;
begin
  if event_name not in ('booking_request_created','booking_request_updated','booking_request_submitted','booking_request_withdrawn') then raise exception 'Logistics booking request event type must be generated by a trusted flow.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write', 'on', true);
  insert into public.logistics_booking_request_events(booking_request_id, event_type, actor_profile_id, metadata) values (booking_request_uuid, event_name, actor_uuid, public.strip_logistics_booking_request_event_metadata(event_metadata)) returning * into event_row;
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  return event_row;
exception when others then perform set_config('app.logistics_booking_request_trusted_write', '', true); raise;
end;
$$;

create or replace function public.protect_logistics_booking_request_write()
returns trigger language plpgsql as $$
begin
  if not public.is_trusted_logistics_booking_request_write() then raise exception 'Logistics booking requests are managed through trusted RPCs.'; end if;
  if tg_op = 'DELETE' then raise exception 'Logistics booking requests cannot be deleted.'; end if;
  new.updated_at := now(); return new;
end;
$$;

create or replace function public.protect_logistics_booking_request_event_write()
returns trigger language plpgsql as $$
begin
  if not public.is_trusted_logistics_booking_request_write() then raise exception 'Logistics booking request events are immutable and cannot be changed.'; end if;
  if tg_op in ('UPDATE','DELETE') then raise exception 'Logistics booking request events are immutable and cannot be changed.'; end if;
  return new;
end;
$$;

create or replace function public.create_logistics_booking_request(shipping_readiness_uuid uuid)
returns public.logistics_booking_requests language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); sr public.shipping_readiness_records%rowtype; po_status text; contract_status text; invoice_status text; booking_row public.logistics_booking_requests%rowtype;
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  select * into sr from public.shipping_readiness_records where id = shipping_readiness_uuid for update;
  if sr.id is null then raise exception 'Shipping readiness record not found.'; end if;
  if not public.owns_manufacturer(sr.manufacturer_id) then raise exception 'Only the assigned manufacturer can create a logistics booking request.'; end if;
  if sr.status <> 'ready_for_logistics' then raise exception 'Shipping readiness must be ready for logistics before creating a booking request.'; end if;
  select status into po_status from public.purchase_orders where id = sr.purchase_order_id for update;
  select status into contract_status from public.contracts where id = sr.contract_id for update;
  select status into invoice_status from public.invoices where id = sr.invoice_id for update;
  if po_status <> 'confirmed' then raise exception 'Source purchase order must remain confirmed.'; end if;
  if contract_status <> 'accepted' then raise exception 'Source contract must remain accepted.'; end if;
  if invoice_status <> 'issued' then raise exception 'Source invoice must remain issued.'; end if;
  if exists (select 1 from public.logistics_booking_requests where shipping_readiness_id = sr.id) then raise exception 'A logistics booking request already exists for this shipping readiness record.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write', 'on', true);
  insert into public.logistics_booking_requests(booking_request_number, shipping_readiness_id, shipping_number, purchase_order_id, purchase_order_number, contract_id, contract_number, invoice_id, invoice_number, buyer_id, manufacturer_id, status, requested_transport_mode, requested_incoterm, origin_location, destination_location, cargo_description, package_count, gross_weight_kg, volume_cbm, container_preference, shipping_readiness_snapshot, source_snapshot, party_snapshot, cargo_snapshot, booking_request_snapshot, created_by)
  values (public.generate_logistics_booking_request_number(), sr.id, sr.shipping_number, sr.purchase_order_id, sr.purchase_order_number, sr.contract_id, sr.contract_number, sr.invoice_id, sr.invoice_number, sr.buyer_id, sr.manufacturer_id, 'booking_draft', sr.shipping_mode, sr.incoterm, sr.origin_address, sr.destination_address, sr.cargo_description, sr.package_count, sr.gross_weight_kg, sr.volume_cbm, 'not_specified', to_jsonb(sr), jsonb_build_object('purchase_order_id', sr.purchase_order_id, 'purchase_order_number', sr.purchase_order_number, 'contract_id', sr.contract_id, 'contract_number', sr.contract_number, 'invoice_id', sr.invoice_id, 'invoice_number', sr.invoice_number), jsonb_build_object('buyer_id', sr.buyer_id, 'manufacturer_id', sr.manufacturer_id), public.build_logistics_booking_cargo_snapshot(sr.cargo_description, sr.package_count, sr.gross_weight_kg, sr.volume_cbm), public.build_logistics_booking_request_snapshot(sr.shipping_mode, sr.incoterm, null, null, sr.origin_address, sr.destination_address, 'not_specified', null, null, null), actor_uuid) returning * into booking_row;
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  perform public.insert_trusted_logistics_booking_request_event(booking_row.id, 'booking_request_created', actor_uuid, jsonb_build_object('booking_request_number', booking_row.booking_request_number));
  return booking_row;
exception when others then perform set_config('app.logistics_booking_request_trusted_write', '', true); raise;
end;
$$;

create or replace function public.update_logistics_booking_request_draft(booking_request_uuid uuid, requested_transport_mode_value text, requested_incoterm_value text, preferred_departure_date_value date, latest_acceptable_departure_date_value date, origin_location_value jsonb, destination_location_value jsonb, container_preference_value text, equipment_notes_text text, handling_requirements_text text, booking_notes_text text)
returns public.logistics_booking_requests language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; normalized_origin jsonb := public.normalize_logistics_booking_location(origin_location_value); normalized_destination jsonb := public.normalize_logistics_booking_location(destination_location_value); normalized_mode text := lower(btrim(coalesce(requested_transport_mode_value, ''))); normalized_container text := lower(btrim(coalesce(container_preference_value, '')));
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  select * into booking_row from public.logistics_booking_requests where id = booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if not public.owns_manufacturer(booking_row.manufacturer_id) then raise exception 'Only the assigned manufacturer can update this logistics booking request.'; end if;
  if booking_row.status <> 'booking_draft' then raise exception 'Only draft logistics booking requests can be updated.'; end if;
  perform public.assert_logistics_booking_request_values(normalized_mode, requested_incoterm_value, preferred_departure_date_value, latest_acceptable_departure_date_value, normalized_origin, normalized_destination, normalized_container, equipment_notes_text, handling_requirements_text, booking_notes_text, false);
  perform set_config('app.logistics_booking_request_trusted_write', 'on', true);
  update public.logistics_booking_requests set requested_transport_mode = normalized_mode, requested_incoterm = nullif(btrim(requested_incoterm_value), ''), preferred_departure_date = preferred_departure_date_value, latest_acceptable_departure_date = latest_acceptable_departure_date_value, origin_location = normalized_origin, destination_location = normalized_destination, container_preference = nullif(normalized_container, ''), equipment_notes = nullif(btrim(equipment_notes_text), ''), handling_requirements = nullif(btrim(handling_requirements_text), ''), booking_notes = nullif(btrim(booking_notes_text), ''), booking_request_snapshot = public.build_logistics_booking_request_snapshot(normalized_mode, nullif(btrim(requested_incoterm_value), ''), preferred_departure_date_value, latest_acceptable_departure_date_value, normalized_origin, normalized_destination, nullif(normalized_container, ''), nullif(btrim(equipment_notes_text), ''), nullif(btrim(handling_requirements_text), ''), nullif(btrim(booking_notes_text), '')) where id = booking_request_uuid and status = 'booking_draft' returning * into booking_row;
  if not found then raise exception 'Logistics booking request lifecycle conflict while updating draft.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  perform public.insert_trusted_logistics_booking_request_event(booking_row.id, 'booking_request_updated', actor_uuid, jsonb_build_object('booking_request_number', booking_row.booking_request_number));
  return booking_row;
exception when others then perform set_config('app.logistics_booking_request_trusted_write', '', true); raise;
end;
$$;

create or replace function public.submit_logistics_booking_request(booking_request_uuid uuid)
returns public.logistics_booking_requests language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; sr_status text; po_status text; contract_status text; invoice_status text;
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  select * into booking_row from public.logistics_booking_requests where id = booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if not public.owns_manufacturer(booking_row.manufacturer_id) then raise exception 'Only the assigned manufacturer can submit this logistics booking request.'; end if;
  if booking_row.status <> 'booking_draft' then raise exception 'Only draft logistics booking requests can be submitted.'; end if;
  select status into sr_status from public.shipping_readiness_records where id = booking_row.shipping_readiness_id for update;
  select status into po_status from public.purchase_orders where id = booking_row.purchase_order_id for update;
  select status into contract_status from public.contracts where id = booking_row.contract_id for update;
  select status into invoice_status from public.invoices where id = booking_row.invoice_id for update;
  if sr_status <> 'ready_for_logistics' then raise exception 'Shipping readiness must remain ready for logistics.'; end if;
  if po_status <> 'confirmed' then raise exception 'Source purchase order must remain confirmed.'; end if;
  if contract_status <> 'accepted' then raise exception 'Source contract must remain accepted.'; end if;
  if invoice_status <> 'issued' then raise exception 'Source invoice must remain issued.'; end if;
  perform public.assert_logistics_booking_request_values(booking_row.requested_transport_mode, booking_row.requested_incoterm, booking_row.preferred_departure_date, booking_row.latest_acceptable_departure_date, booking_row.origin_location, booking_row.destination_location, booking_row.container_preference, booking_row.equipment_notes, booking_row.handling_requirements, booking_row.booking_notes, true);
  perform set_config('app.logistics_booking_request_trusted_write', 'on', true);
  update public.logistics_booking_requests set status = 'submitted_for_arrangement', submitted_at = now() where id = booking_request_uuid and status = 'booking_draft' returning * into booking_row;
  if not found then raise exception 'Logistics booking request lifecycle conflict while submitting.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  perform public.insert_trusted_logistics_booking_request_event(booking_row.id, 'booking_request_submitted', actor_uuid, jsonb_build_object('booking_request_number', booking_row.booking_request_number, 'submitted_for_arrangement_means_booking_confirmed', false));
  return booking_row;
exception when others then perform set_config('app.logistics_booking_request_trusted_write', '', true); raise;
end;
$$;

create or replace function public.withdraw_logistics_booking_request(booking_request_uuid uuid, reason_text text)
returns public.logistics_booking_requests language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; normalized_reason text := nullif(btrim(coalesce(reason_text, '')), '');
begin
  if actor_uuid is null then raise exception 'Authentication is required.'; end if;
  if normalized_reason is null then raise exception 'Withdrawal reason is required.'; end if;
  if char_length(normalized_reason) > 2000 then raise exception 'Withdrawal reason must be 2000 characters or fewer.'; end if;
  select * into booking_row from public.logistics_booking_requests where id = booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if not public.owns_manufacturer(booking_row.manufacturer_id) then raise exception 'Only the assigned manufacturer can withdraw this logistics booking request.'; end if;
  if booking_row.status not in ('booking_draft', 'submitted_for_arrangement') then raise exception 'Only draft or submitted logistics booking requests can be withdrawn.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write', 'on', true);
  update public.logistics_booking_requests set status = 'withdrawn', withdrawn_at = now(), withdrawal_reason = normalized_reason where id = booking_request_uuid and status in ('booking_draft', 'submitted_for_arrangement') returning * into booking_row;
  if not found then raise exception 'Logistics booking request lifecycle conflict while withdrawing.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  perform public.insert_trusted_logistics_booking_request_event(booking_row.id, 'booking_request_withdrawn', actor_uuid, jsonb_build_object('booking_request_number', booking_row.booking_request_number, 'reason', normalized_reason, 'external_arrangement_cancelled', false));
  return booking_row;
exception when others then perform set_config('app.logistics_booking_request_trusted_write', '', true); raise;
end;
$$;

drop trigger if exists protect_logistics_booking_request_write on public.logistics_booking_requests;
create trigger protect_logistics_booking_request_write before insert or update or delete on public.logistics_booking_requests for each row execute function public.protect_logistics_booking_request_write();

drop trigger if exists protect_logistics_booking_request_event_write on public.logistics_booking_request_events;
create trigger protect_logistics_booking_request_event_write before insert or update or delete on public.logistics_booking_request_events for each row execute function public.protect_logistics_booking_request_event_write();

drop policy if exists "logistics_booking_requests_select_participant_or_admin" on public.logistics_booking_requests;
create policy "logistics_booking_requests_select_participant_or_admin" on public.logistics_booking_requests for select to authenticated using (buyer_id = auth.uid() or public.owns_manufacturer(manufacturer_id) or public.is_admin());

drop policy if exists "logistics_booking_request_events_select_participant_or_admin" on public.logistics_booking_request_events;
create policy "logistics_booking_request_events_select_participant_or_admin" on public.logistics_booking_request_events for select to authenticated using (public.can_access_logistics_booking_request(booking_request_id));

revoke all on function public.is_trusted_logistics_booking_request_write() from public, anon, authenticated;
revoke all on function public.generate_logistics_booking_request_number() from public, anon, authenticated;
revoke all on function public.can_access_logistics_booking_request(uuid) from public, anon, authenticated;
revoke all on function public.normalize_logistics_booking_location(jsonb) from public, anon, authenticated;
revoke all on function public.assert_logistics_booking_location_complete(jsonb, text) from public, anon, authenticated;
revoke all on function public.assert_logistics_booking_request_values(text, text, date, date, jsonb, jsonb, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.build_logistics_booking_cargo_snapshot(text, integer, numeric, numeric) from public, anon, authenticated;
revoke all on function public.build_logistics_booking_request_snapshot(text, text, date, date, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.strip_logistics_booking_request_event_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.insert_trusted_logistics_booking_request_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_logistics_booking_request_write() from public, anon, authenticated;
revoke all on function public.protect_logistics_booking_request_event_write() from public, anon, authenticated;
revoke all on function public.create_logistics_booking_request(uuid) from public, anon, authenticated;
revoke all on function public.update_logistics_booking_request_draft(uuid, text, text, date, date, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.submit_logistics_booking_request(uuid) from public, anon, authenticated;
revoke all on function public.withdraw_logistics_booking_request(uuid, text) from public, anon, authenticated;

grant execute on function public.create_logistics_booking_request(uuid) to authenticated;
grant execute on function public.update_logistics_booking_request_draft(uuid, text, text, date, date, jsonb, jsonb, text, text, text, text) to authenticated;
grant execute on function public.submit_logistics_booking_request(uuid) to authenticated;
grant execute on function public.withdraw_logistics_booking_request(uuid, text) to authenticated;
grant execute on function public.can_access_logistics_booking_request(uuid) to authenticated;

create temp table logistics_booking_request_results(check_name text primary key, passed boolean not null, detail text not null default '') on commit drop;
grant select, insert, update, delete on table logistics_booking_request_results to authenticated, anon;

create or replace function pg_temp.record_lbr_check(p_check_name text, p_passed boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into logistics_booking_request_results values (p_check_name, p_passed, coalesce(p_detail, ''))
  on conflict (check_name) do update set passed = excluded.passed, detail = excluded.detail;
end;
$$;

create or replace function pg_temp.logistics_location(label_text text)
returns jsonb language sql immutable as $$
  select jsonb_build_object('address_line1', label_text || ' Dock', 'city', label_text || ' City', 'state_region', label_text || ' State', 'postal_code', '10001', 'country_code', 'US', 'ignored', 'strip');
$$;

create or replace function pg_temp.set_actor(actor_uuid uuid)
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', actor_uuid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.expect_blocked(check_name text, statement_text text)
returns void language plpgsql as $$
declare blocked boolean := false;
begin
  begin
    execute statement_text;
  exception when others then
    blocked := true;
  end;
  perform pg_temp.record_lbr_check(check_name, blocked, statement_text);
end;
$$;

create or replace function pg_temp.seed_logistics_chain(label_text text)
returns table (
  buyer_id uuid,
  manufacturer_owner_id uuid,
  other_manufacturer_owner_id uuid,
  admin_id uuid,
  manufacturer_id uuid,
  other_manufacturer_id uuid,
  purchase_order_id uuid,
  contract_id uuid,
  invoice_id uuid,
  shipping_readiness_id uuid
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
  invoice_uuid uuid;
  shipping_uuid uuid;
begin
  reset role;
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  values
    ('00000000-0000-0000-0000-000000000000', buyer_uuid, 'authenticated', 'authenticated', label_text || '-buyer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Logistics Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Logistics Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-other@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_uuid, 'authenticated', 'authenticated', label_text || '-admin@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Logistics Admin","role":"buyer"}'::jsonb, now(), now(), false, false);
  update public.profiles set role = 'admin' where id = admin_uuid;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_uuid, label_text || ' Factory Legal', label_text || ' Factory', 'China', 'draft')
  returning id into manufacturer_uuid;
  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_uuid, label_text || ' Other Legal', label_text || ' Other', 'Vietnam', 'draft')
  returning id into other_manufacturer_uuid;
  perform pg_temp.set_actor(admin_uuid);
  update public.manufacturers set application_status = 'approved', reviewed_by = admin_uuid, reviewed_at = now() where id in (manufacturer_uuid, other_manufacturer_uuid);

  perform pg_temp.set_actor(manufacturer_owner_uuid);
  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_uuid, label_text || ' Home', label_text || ' Model', 'Modular', 'Logistics product', 'USD', 'draft')
  returning id into product_uuid;

  perform pg_temp.set_actor(buyer_uuid);
  insert into public.rfqs(buyer_id, manufacturer_id, product_id, product_snapshot, status, requested_quantity, requested_currency, incoterm, destination_country)
  values (buyer_uuid, manufacturer_uuid, product_uuid, jsonb_build_object('name', label_text || ' Home'), 'submitted', 1, 'USD', 'FOB', 'United States')
  returning id into rfq_uuid;

  reset role;
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
  values (rfq_uuid, quote_uuid, buyer_uuid, 'accepted', 'accepted')
  returning id into decision_uuid;
  perform set_config('app.quote_decision_trusted_write', '', true);

  reset role;
  perform set_config('app.purchase_order_trusted_write', 'on', true);
  insert into public.purchase_orders(po_number, rfq_id, quote_id, quote_decision_id, buyer_id, manufacturer_id, status, currency, subtotal, incoterm, quote_snapshot, buyer_snapshot, manufacturer_snapshot, product_snapshot, created_by, submitted_at, last_submitted_at, confirmed_at, review_round)
  values ('PO-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), rfq_uuid, quote_uuid, decision_uuid, buyer_uuid, manufacturer_uuid, 'confirmed', 'USD', 1000, 'FOB', jsonb_build_object('quote_id', quote_uuid), jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('product_id', product_uuid), buyer_uuid, now(), now(), now(), 1)
  returning id into po_uuid;
  insert into public.purchase_order_items(purchase_order_id, source_quote_item_id, line_order, item_type, description, quantity, unit, unit_price, amount)
  select po_uuid, item.id, item.line_order, item.item_type, item.description, item.quantity, item.unit, item.unit_price, item.amount from public.rfq_quote_items item where item.quote_id = quote_uuid
  returning id into po_item_uuid;
  perform set_config('app.purchase_order_trusted_write', '', true);

  reset role;
  perform set_config('app.contract_trusted_write', 'on', true);
  insert into public.contracts(contract_number, purchase_order_id, po_number, rfq_id, quote_id, quote_decision_id, buyer_id, manufacturer_id, status, currency, subtotal, contract_title, purchase_order_snapshot, buyer_snapshot, manufacturer_snapshot, quote_snapshot, product_snapshot, line_items_snapshot, created_by, ready_at, review_round, first_ready_at, last_ready_at, accepted_at)
  values ('CON-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), po_uuid, (select po_number from public.purchase_orders where id = po_uuid), rfq_uuid, quote_uuid, decision_uuid, buyer_uuid, manufacturer_uuid, 'accepted', 'USD', 1000, label_text || ' Contract', jsonb_build_object('purchase_order_id', po_uuid), jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('quote_id', quote_uuid), jsonb_build_object('product_id', product_uuid), jsonb_build_array(jsonb_build_object('source_purchase_order_item_id', po_item_uuid, 'amount', 1000)), buyer_uuid, now(), 1, now(), now(), now())
  returning id into contract_uuid;
  perform set_config('app.contract_trusted_write', '', true);

  reset role;
  perform set_config('app.signature_preparation_trusted_write', 'on', true);
  insert into public.signature_packages(package_number, contract_id, contract_number, buyer_id, manufacturer_id, status, version, contract_snapshot, buyer_snapshot, manufacturer_snapshot, decision_snapshot, signing_content_snapshot, created_by, ready_at)
  values ('SIG-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), contract_uuid, (select contract_number from public.contracts where id = contract_uuid), buyer_uuid, manufacturer_uuid, 'ready_to_send', 1, jsonb_build_object('contract_id', contract_uuid), jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('decision', 'accepted'), jsonb_build_object('internal_only', true), buyer_uuid, now());
  perform set_config('app.signature_preparation_trusted_write', '', true);

  perform pg_temp.set_actor(manufacturer_owner_uuid);
  select id into invoice_uuid from public.create_invoice_from_purchase_order(po_uuid);
  perform public.update_invoice_draft(invoice_uuid, current_date, current_date + 30, 'Logistics Buyer', label_text || '-buyer@example.test', '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 0, 0, 0);
  select id into invoice_uuid from public.issue_invoice(invoice_uuid);

  select id into shipping_uuid from public.create_shipping_readiness(po_uuid);
  perform public.update_shipping_readiness_draft(shipping_uuid, 'ocean', 'FOB', pg_temp.logistics_location('Origin'), pg_temp.logistics_location('Destination'), label_text || ' packed modules', 3, 12000, 72, current_date + 10, current_date + 5, 'Ready');
  select id into shipping_uuid from public.mark_shipping_readiness_ready(shipping_uuid);

  return query select buyer_uuid, manufacturer_owner_uuid, other_manufacturer_owner_uuid, admin_uuid, manufacturer_uuid, other_manufacturer_uuid, po_uuid, contract_uuid, invoice_uuid, shipping_uuid;
exception when others then
  perform set_config('app.quote_trusted_write', '', true);
  perform set_config('app.quote_decision_trusted_write', '', true);
  perform set_config('app.purchase_order_trusted_write', '', true);
  perform set_config('app.contract_trusted_write', '', true);
  perform set_config('app.signature_preparation_trusted_write', '', true);
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  raise;
end;
$$;

do $$
declare
  volatility text;
  direct_blocked boolean := false;
  seed record;
  seed2 record;
  seed3 record;
  booking public.logistics_booking_requests%rowtype;
  other_booking public.logistics_booking_requests%rowtype;
  updated public.logistics_booking_requests%rowtype;
  submitted public.logistics_booking_requests%rowtype;
  withdrawn public.logistics_booking_requests%rowtype;
  event_count integer;
  visible_count integer;
begin
  perform pg_temp.record_lbr_check('booking request table exists', to_regclass('public.logistics_booking_requests') is not null, 'table');
  perform pg_temp.record_lbr_check('booking request events table exists', to_regclass('public.logistics_booking_request_events') is not null, 'events');
  perform pg_temp.record_lbr_check('booking number format enforced', exists (select 1 from pg_constraint where conname = 'logistics_booking_requests_number_check' and pg_get_constraintdef(oid) like '%BKR%'), 'number');
  perform pg_temp.record_lbr_check('only internal lifecycle statuses exist', not exists (select 1 from pg_constraint where conname = 'logistics_booking_requests_status_check' and pg_get_constraintdef(oid) ~ 'carrier_confirmed|booked|pickup_scheduled|departed|in_transit|customs_cleared|delivered|returned|lost|damaged'), 'status');
  perform pg_temp.record_lbr_check('supported transport modes enforced', exists (select 1 from pg_constraint where conname = 'logistics_booking_requests_mode_check' and pg_get_constraintdef(oid) ~ 'multimodal'), 'mode');
  perform pg_temp.record_lbr_check('supported container preferences enforced', exists (select 1 from pg_constraint where conname = 'logistics_booking_requests_container_check' and pg_get_constraintdef(oid) ~ '40ft_high_cube'), 'container');
  select provolatile into volatility from pg_proc where pronamespace = 'public'::regnamespace and proname = 'assert_logistics_booking_request_values' limit 1;
  perform pg_temp.record_lbr_check('date validator is stable', volatility = 's', coalesce(volatility, 'missing'));
  perform pg_temp.record_lbr_check('anonymous has no table privileges', not has_table_privilege('anon', 'public.logistics_booking_requests', 'select'), 'anon');
  perform pg_temp.record_lbr_check('authenticated has select only on requests', has_table_privilege('authenticated', 'public.logistics_booking_requests', 'select') and not has_table_privilege('authenticated', 'public.logistics_booking_requests', 'insert') and not has_table_privilege('authenticated', 'public.logistics_booking_requests', 'update') and not has_table_privilege('authenticated', 'public.logistics_booking_requests', 'delete'), 'privileges');
  perform pg_temp.record_lbr_check('create RPC granted authenticated', has_function_privilege('authenticated', 'public.create_logistics_booking_request(uuid)', 'execute'), 'create rpc');
  perform pg_temp.record_lbr_check('submit RPC granted authenticated', has_function_privilege('authenticated', 'public.submit_logistics_booking_request(uuid)', 'execute'), 'submit rpc');
  perform pg_temp.record_lbr_check('internal number helper not executable', not has_function_privilege('authenticated', 'public.generate_logistics_booking_request_number()', 'execute'), 'helper revoke');
  perform pg_temp.record_lbr_check('event metadata strips token fields', not (public.strip_logistics_booking_request_event_metadata('{"access_token":"x","booking_confirmation":"x","safe":"ok"}'::jsonb) ? 'access_token') and not (public.strip_logistics_booking_request_event_metadata('{"access_token":"x","booking_confirmation":"x","safe":"ok"}'::jsonb) ? 'booking_confirmation') and public.strip_logistics_booking_request_event_metadata('{"access_token":"x","safe":"ok"}'::jsonb)->>'safe' = 'ok', 'strip');
  perform pg_temp.record_lbr_check('location normalization trims and uppercases', public.normalize_logistics_booking_location('{"address_line1":" 1 Dock ","country_code":"us","ignored":"x"}'::jsonb)->>'address_line1' = '1 Dock' and public.normalize_logistics_booking_location('{"country_code":"us"}'::jsonb)->>'country_code' = 'US' and public.normalize_logistics_booking_location('{"ignored":"x"}'::jsonb) is null, 'location');
  begin
    perform public.normalize_logistics_booking_location('[]'::jsonb);
  exception when others then direct_blocked := true;
  end;
  perform pg_temp.record_lbr_check('malformed location denied', direct_blocked, 'location malformed');
  perform pg_temp.record_lbr_check('request snapshot records no external booking claims', public.build_logistics_booking_request_snapshot('ocean','FOB',current_date,current_date,null,null,'not_specified',null,null,null)->>'booking_confirmed' = 'false', 'snapshot');
  perform pg_temp.record_lbr_check('events are trusted types only', exists (select 1 from pg_constraint where conname = 'logistics_booking_request_events_type_check' and pg_get_constraintdef(oid) ~ 'booking_request_submitted'), 'events');
  perform pg_temp.record_lbr_check('no external logistics columns exist', not exists (select 1 from information_schema.columns where table_schema='public' and table_name='logistics_booking_requests' and column_name ~ 'carrier|forwarder|tracking|waybill|vessel|flight|eta|customs|tariff|insurance'), 'columns');

  select * into seed from pg_temp.seed_logistics_chain('lbr-primary');
  perform pg_temp.set_actor(seed.manufacturer_owner_id);
  select * into booking from public.create_logistics_booking_request(seed.shipping_readiness_id);
  perform pg_temp.record_lbr_check('assigned manufacturer can create from eligible upstream chain', booking.status = 'booking_draft' and booking.buyer_id = seed.buyer_id and booking.manufacturer_id = seed.manufacturer_id and booking.shipping_readiness_id = seed.shipping_readiness_id, booking.status);
  perform pg_temp.record_lbr_check('created booking derives source ids and snapshots', booking.purchase_order_id = seed.purchase_order_id and booking.contract_id = seed.contract_id and booking.invoice_id = seed.invoice_id and jsonb_typeof(booking.shipping_readiness_snapshot) = 'object' and jsonb_typeof(booking.source_snapshot) = 'object' and booking.package_count = 3, 'snapshot');
  perform pg_temp.record_lbr_check('created booking does not mutate source statuses', (select status from public.shipping_readiness_records where id = seed.shipping_readiness_id) = 'ready_for_logistics' and (select status from public.purchase_orders where id = seed.purchase_order_id) = 'confirmed' and (select status from public.contracts where id = seed.contract_id) = 'accepted' and (select status from public.invoices where id = seed.invoice_id) = 'issued', 'sources');
  select count(*) into event_count from public.logistics_booking_request_events where booking_request_id = booking.id and event_type = 'booking_request_created';
  perform pg_temp.record_lbr_check('created booking emits exactly one created event', event_count = 1, event_count::text);
  perform pg_temp.expect_blocked('duplicate booking for same shipping readiness denied', format('select public.create_logistics_booking_request(%L::uuid)', seed.shipping_readiness_id));

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-create-denied');
  perform pg_temp.set_actor(seed2.other_manufacturer_owner_id);
  perform pg_temp.expect_blocked('other manufacturer cannot create booking', format('select public.create_logistics_booking_request(%L::uuid)', seed2.shipping_readiness_id));
  perform pg_temp.set_actor(seed2.buyer_id);
  perform pg_temp.expect_blocked('buyer cannot create booking', format('select public.create_logistics_booking_request(%L::uuid)', seed2.shipping_readiness_id));
  perform pg_temp.set_actor(seed2.admin_id);
  perform pg_temp.expect_blocked('admin cannot create booking', format('select public.create_logistics_booking_request(%L::uuid)', seed2.shipping_readiness_id));
  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.expect_blocked('anonymous cannot create booking', format('select public.create_logistics_booking_request(%L::uuid)', seed2.shipping_readiness_id));

  select * into seed3 from pg_temp.seed_logistics_chain('lbr-source-denied');
  reset role;
  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  update public.shipping_readiness_records set status = 'shipping_draft', ready_at = null, cancelled_at = null, cancellation_reason = null where id = seed3.shipping_readiness_id;
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  perform pg_temp.set_actor(seed3.manufacturer_owner_id);
  perform pg_temp.expect_blocked('create denied unless shipping readiness is ready_for_logistics', format('select public.create_logistics_booking_request(%L::uuid)', seed3.shipping_readiness_id));
  reset role;
  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  update public.shipping_readiness_records set status = 'ready_for_logistics', ready_at = now(), cancelled_at = null, cancellation_reason = null where id = seed3.shipping_readiness_id;
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  reset role;
  perform set_config('app.invoice_trusted_write', 'on', true);
  update public.invoices set status = 'draft', issued_at = null, cancelled_at = null, cancellation_reason = null where id = seed3.invoice_id;
  perform set_config('app.invoice_trusted_write', '', true);
  perform pg_temp.expect_blocked('create denied unless invoice remains issued', format('select public.create_logistics_booking_request(%L::uuid)', seed3.shipping_readiness_id));

  perform pg_temp.set_actor(seed.manufacturer_owner_id);
  select * into updated from public.update_logistics_booking_request_draft(booking.id, ' AIR ', 'FOB', current_date + 20, current_date + 25, '{"address_line1":" 22 Port Road ","address_line2":" ","city":" Ningbo ","state_region":" Zhejiang ","postal_code":" 315000 ","country_code":" cn ","ignored":"x"}'::jsonb, '{"address_line1":" 500 Market St ","city":" Seattle ","state_region":" WA ","postal_code":" 98101 ","country_code":" us "}'::jsonb, ' 40FT_HIGH_CUBE ', ' Keep dry ', ' Forklift required ', ' Arrange after inspection ');
  perform pg_temp.record_lbr_check('draft update normalizes editable fields', updated.requested_transport_mode = 'air' and updated.container_preference = '40ft_high_cube' and updated.origin_location->>'country_code' = 'CN' and not (updated.origin_location ? 'ignored') and not (updated.origin_location ? 'address_line2') and updated.equipment_notes = 'Keep dry', 'updated');
  perform pg_temp.record_lbr_check('draft update preserves source fields', updated.purchase_order_id = booking.purchase_order_id and updated.contract_id = booking.contract_id and updated.invoice_id = booking.invoice_id and updated.cargo_description = booking.cargo_description, 'source');
  select count(*) into event_count from public.logistics_booking_request_events where booking_request_id = booking.id and event_type = 'booking_request_updated';
  perform pg_temp.record_lbr_check('draft update emits one updated event', event_count = 1, event_count::text);
  perform pg_temp.expect_blocked('invalid transport mode denied', format('select public.update_logistics_booking_request_draft(%L::uuid,''spaceship'',''FOB'',current_date + 1,current_date + 2,''{}''::jsonb,''{}''::jsonb,''not_specified'',null,null,null)', booking.id));
  perform pg_temp.expect_blocked('invalid incoterm denied', format('select public.update_logistics_booking_request_draft(%L::uuid,''ocean'',''BAD'',current_date + 1,current_date + 2,''{}''::jsonb,''{}''::jsonb,''not_specified'',null,null,null)', booking.id));
  perform pg_temp.expect_blocked('malformed location denied', format('select public.update_logistics_booking_request_draft(%L::uuid,''ocean'',''FOB'',current_date + 1,current_date + 2,''[]''::jsonb,''{}''::jsonb,''not_specified'',null,null,null)', booking.id));
  perform pg_temp.expect_blocked('invalid country code denied', format('select public.update_logistics_booking_request_draft(%L::uuid,''ocean'',''FOB'',current_date + 1,current_date + 2,''{""country_code"":""USA""}''::jsonb,''{}''::jsonb,''not_specified'',null,null,null)', booking.id));
  perform pg_temp.expect_blocked('past departure date denied', format('select public.update_logistics_booking_request_draft(%L::uuid,''ocean'',''FOB'',current_date - 1,current_date + 2,''{}''::jsonb,''{}''::jsonb,''not_specified'',null,null,null)', booking.id));

  select * into submitted from public.submit_logistics_booking_request(booking.id);
  perform pg_temp.record_lbr_check('valid submit succeeds once', submitted.status = 'submitted_for_arrangement' and submitted.submitted_at is not null, submitted.status);
  select count(*) into event_count from public.logistics_booking_request_events where booking_request_id = booking.id and event_type = 'booking_request_submitted';
  perform pg_temp.record_lbr_check('submit emits one submitted event', event_count = 1, event_count::text);
  perform pg_temp.expect_blocked('duplicate submit denied', format('select public.submit_logistics_booking_request(%L::uuid)', booking.id));
  perform pg_temp.expect_blocked('submitted booking cannot be edited by manufacturer', format('select public.update_logistics_booking_request_draft(%L::uuid,''ocean'',''FOB'',current_date + 1,current_date + 2,''{}''::jsonb,''{}''::jsonb,''not_specified'',null,null,null)', booking.id));

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-incomplete-submit');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.update_logistics_booking_request_draft(other_booking.id, 'ocean', 'FOB', null, null, null, null, 'not_specified', null, null, null);
  perform pg_temp.expect_blocked('incomplete draft cannot be submitted', format('select public.submit_logistics_booking_request(%L::uuid)', other_booking.id));

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-submit-source');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.update_logistics_booking_request_draft(other_booking.id, 'ocean', 'FOB', current_date + 10, current_date + 12, pg_temp.logistics_location('Origin'), pg_temp.logistics_location('Destination'), 'not_specified', null, null, null);
  reset role;
  perform set_config('app.shipping_readiness_trusted_write', 'on', true);
  update public.shipping_readiness_records set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'source cancelled' where id = seed2.shipping_readiness_id;
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  perform pg_temp.expect_blocked('submit denied when source shipping readiness no longer ready', format('select public.submit_logistics_booking_request(%L::uuid)', other_booking.id));

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-withdraw-draft');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  select * into withdrawn from public.withdraw_logistics_booking_request(other_booking.id, ' draft no longer needed ');
  perform pg_temp.record_lbr_check('draft withdraw succeeds terminally', withdrawn.status = 'withdrawn' and withdrawn.submitted_at is null and withdrawn.withdrawn_at is not null and withdrawn.withdrawal_reason = 'draft no longer needed', withdrawn.status);
  select count(*) into event_count from public.logistics_booking_request_events where booking_request_id = other_booking.id and event_type = 'booking_request_withdrawn';
  perform pg_temp.record_lbr_check('draft withdraw emits one withdrawn event', event_count = 1, event_count::text);
  perform pg_temp.expect_blocked('withdrawn booking cannot be withdrawn again', format('select public.withdraw_logistics_booking_request(%L::uuid,''again'')', other_booking.id));
  perform pg_temp.expect_blocked('withdrawn booking cannot be submitted', format('select public.submit_logistics_booking_request(%L::uuid)', other_booking.id));
  perform pg_temp.record_lbr_check('withdraw event records no external cancellation claim', exists (select 1 from public.logistics_booking_request_events where booking_request_id = other_booking.id and event_type = 'booking_request_withdrawn' and metadata->>'external_arrangement_cancelled' = 'false'), 'metadata');

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-withdraw-submitted');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.update_logistics_booking_request_draft(other_booking.id, 'ocean', 'FOB', current_date + 10, current_date + 12, pg_temp.logistics_location('Origin'), pg_temp.logistics_location('Destination'), 'not_specified', null, null, null);
  perform public.submit_logistics_booking_request(other_booking.id);
  select * into withdrawn from public.withdraw_logistics_booking_request(other_booking.id, 'submitted withdrawn');
  perform pg_temp.record_lbr_check('submitted withdraw succeeds and preserves submitted_at history', withdrawn.status = 'withdrawn' and withdrawn.submitted_at is not null and withdrawn.withdrawn_at is not null, withdrawn.status);
  perform pg_temp.expect_blocked('blank withdraw reason denied', format('select public.withdraw_logistics_booking_request(%L::uuid,''   '')', booking.id));

  -- State-conditional conflict simulation in one rollback SQL session: repeated stale lifecycle calls exercise the same UPDATE ... WHERE status guards that serialize concurrent transactions.
  select * into seed2 from pg_temp.seed_logistics_chain('lbr-conflict-submit-submit');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.update_logistics_booking_request_draft(other_booking.id, 'ocean', 'FOB', current_date + 10, current_date + 12, pg_temp.logistics_location('Origin'), pg_temp.logistics_location('Destination'), 'not_specified', null, null, null);
  perform public.submit_logistics_booking_request(other_booking.id);
  perform pg_temp.expect_blocked('state-conditional submit-submit conflict denies second submit', format('select public.submit_logistics_booking_request(%L::uuid)', other_booking.id));
  perform pg_temp.record_lbr_check('state-conditional submit-submit creates no duplicate event', (select count(*) from public.logistics_booking_request_events where booking_request_id = other_booking.id and event_type = 'booking_request_submitted') = 1, 'submit-submit');

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-conflict-withdraw-withdraw');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.withdraw_logistics_booking_request(other_booking.id, 'first');
  perform pg_temp.expect_blocked('state-conditional withdraw-withdraw conflict denies second withdraw', format('select public.withdraw_logistics_booking_request(%L::uuid,''second'')', other_booking.id));
  perform pg_temp.record_lbr_check('state-conditional withdraw-withdraw creates no duplicate event', (select count(*) from public.logistics_booking_request_events where booking_request_id = other_booking.id and event_type = 'booking_request_withdrawn') = 1, 'withdraw-withdraw');

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-conflict-submit-withdraw');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.update_logistics_booking_request_draft(other_booking.id, 'ocean', 'FOB', current_date + 10, current_date + 12, pg_temp.logistics_location('Origin'), pg_temp.logistics_location('Destination'), 'not_specified', null, null, null);
  perform public.submit_logistics_booking_request(other_booking.id);
  perform public.withdraw_logistics_booking_request(other_booking.id, 'cancel submitted arrangement request');
  perform pg_temp.record_lbr_check('state-conditional submit-then-withdraw serializes final terminal state', (select status from public.logistics_booking_requests where id = other_booking.id) = 'withdrawn' and (select count(*) from public.logistics_booking_request_events where booking_request_id = other_booking.id and event_type in ('booking_request_submitted','booking_request_withdrawn')) = 2, 'submit-withdraw');

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-conflict-withdraw-submit');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform public.withdraw_logistics_booking_request(other_booking.id, 'withdraw first');
  perform pg_temp.expect_blocked('state-conditional withdraw-submit conflict denies submit after terminal withdraw', format('select public.submit_logistics_booking_request(%L::uuid)', other_booking.id));

  select * into seed2 from pg_temp.seed_logistics_chain('lbr-rls-other');
  perform pg_temp.set_actor(seed2.manufacturer_owner_id);
  select * into other_booking from public.create_logistics_booking_request(seed2.shipping_readiness_id);
  perform pg_temp.set_actor(seed.buyer_id);
  select count(*) into visible_count from public.logistics_booking_requests where id = booking.id;
  perform pg_temp.record_lbr_check('buyer can read own booking request', visible_count = 1, visible_count::text);
  select count(*) into visible_count from public.logistics_booking_requests where id = other_booking.id;
  perform pg_temp.record_lbr_check('buyer cannot read another buyer booking request', visible_count = 0, visible_count::text);
  select count(*) into visible_count from public.logistics_booking_request_events where booking_request_id = booking.id;
  perform pg_temp.record_lbr_check('buyer can read own booking events', visible_count >= 1, visible_count::text);
  perform pg_temp.set_actor(seed.manufacturer_owner_id);
  select count(*) into visible_count from public.logistics_booking_requests where id = booking.id;
  perform pg_temp.record_lbr_check('assigned manufacturer can read own booking request', visible_count = 1, visible_count::text);
  perform pg_temp.set_actor(seed.other_manufacturer_owner_id);
  select count(*) into visible_count from public.logistics_booking_requests where id = booking.id;
  perform pg_temp.record_lbr_check('other manufacturer cannot read booking request', visible_count = 0, visible_count::text);
  perform pg_temp.set_actor(seed.admin_id);
  select count(*) into visible_count from public.logistics_booking_requests where id in (booking.id, other_booking.id);
  perform pg_temp.record_lbr_check('admin can read all booking requests', visible_count = 2, visible_count::text);
  reset role;
  set local role anon;
  begin
    select count(*) into visible_count from public.logistics_booking_requests where id = booking.id;
  exception when others then
    visible_count := 0;
  end;
  perform pg_temp.record_lbr_check('anonymous cannot read booking requests', visible_count = 0, visible_count::text);
  perform pg_temp.set_actor(seed.manufacturer_owner_id);
  perform pg_temp.expect_blocked('direct request insert denied', 'insert into public.logistics_booking_requests(booking_request_number, shipping_readiness_id, shipping_number, purchase_order_id, purchase_order_number, contract_id, contract_number, invoice_id, invoice_number, buyer_id, manufacturer_id, requested_transport_mode, shipping_readiness_snapshot, source_snapshot, party_snapshot, cargo_snapshot, booking_request_snapshot, created_by) values (''BKR-2099-999999'', gen_random_uuid(), ''SHIP'', gen_random_uuid(), ''PO'', gen_random_uuid(), ''CON'', gen_random_uuid(), ''INV'', auth.uid(), gen_random_uuid(), ''ocean'', ''{}''::jsonb, ''{}''::jsonb, ''{}''::jsonb, ''{}''::jsonb, ''{}''::jsonb, auth.uid())');
  perform pg_temp.expect_blocked('direct request update denied', format('update public.logistics_booking_requests set status = ''withdrawn'' where id = %L::uuid', booking.id));
  perform pg_temp.expect_blocked('direct request delete denied', format('delete from public.logistics_booking_requests where id = %L::uuid', booking.id));
  perform pg_temp.expect_blocked('direct event insert denied', format('insert into public.logistics_booking_request_events(booking_request_id,event_type,actor_profile_id,metadata) values (%L::uuid,''booking_request_submitted'',auth.uid(),''{""actor_profile_id"":""spoof""}''::jsonb)', booking.id));
  perform pg_temp.expect_blocked('direct event update denied', format('update public.logistics_booking_request_events set metadata = ''{""tampered"":true}''::jsonb where booking_request_id = %L::uuid', booking.id));
  perform pg_temp.expect_blocked('direct event delete denied', format('delete from public.logistics_booking_request_events where booking_request_id = %L::uuid', booking.id));
end;
$$;

select check_name, passed, detail from logistics_booking_request_results order by check_name;

do $$
declare failed_count integer; total_count integer; failed_checks text;
begin
  select count(*), count(*) filter (where not passed) into total_count, failed_count from logistics_booking_request_results;
  if failed_count > 0 then
    select string_agg(check_name || ' [' || detail || ']', '; ' order by check_name) into failed_checks from logistics_booking_request_results where not passed;
    raise exception 'Logistics booking request foundation verification failed: %/% checks failed: %', failed_count, total_count, failed_checks;
  end if;
  raise notice 'Logistics booking request foundation verification passed: %/% checks', total_count, total_count;
end;
$$;

rollback;
