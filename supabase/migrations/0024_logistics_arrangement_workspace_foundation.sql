-- PH-010C Logistics Arrangement Workspace Foundation.
-- Internal provider-option planning only. This migration does not book freight,
-- reserve capacity, contact providers, track shipments, or perform customs work.

alter table public.logistics_booking_requests
  drop constraint if exists logistics_booking_requests_status_check,
  drop constraint if exists logistics_booking_requests_lifecycle_check;

alter table public.logistics_booking_requests
  add constraint logistics_booking_requests_status_check check (
    status in (
      'booking_draft', 'submitted_for_arrangement', 'carrier_options_available',
      'carrier_selected', 'ready_for_external_booking', 'withdrawn'
    )
  ),
  add constraint logistics_booking_requests_lifecycle_check check (
    (status = 'booking_draft' and submitted_at is null and withdrawn_at is null and withdrawal_reason is null)
    or
    (status in ('submitted_for_arrangement', 'carrier_options_available', 'carrier_selected', 'ready_for_external_booking')
      and submitted_at is not null and withdrawn_at is null and withdrawal_reason is null)
    or
    (status = 'withdrawn' and withdrawn_at is not null and withdrawal_reason is not null)
  );

create table public.logistics_provider_candidates (
  id uuid primary key default gen_random_uuid(),
  logistics_booking_request_id uuid not null references public.logistics_booking_requests(id) on delete cascade,
  provider_name text not null,
  provider_type text not null,
  service_level text,
  estimated_departure_date date,
  estimated_arrival_date date,
  estimated_transit_days integer,
  estimated_cost numeric(14,2),
  currency text,
  quote_reference text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  candidate_status text not null default 'active',
  version integer not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logistics_provider_candidates_request_id_unique unique (id, logistics_booking_request_id),
  constraint logistics_provider_candidates_provider_name_check check (char_length(btrim(provider_name)) between 1 and 200),
  constraint logistics_provider_candidates_provider_type_check check (provider_type in ('carrier','freight_forwarder','broker','multimodal_operator','other')),
  constraint logistics_provider_candidates_status_check check (candidate_status in ('draft','active','withdrawn','rejected','selected')),
  constraint logistics_provider_candidates_version_check check (version > 0),
  constraint logistics_provider_candidates_service_level_check check (service_level is null or char_length(service_level) <= 160),
  constraint logistics_provider_candidates_transit_check check (estimated_transit_days is null or estimated_transit_days between 0 and 3650),
  constraint logistics_provider_candidates_cost_check check (estimated_cost is null or estimated_cost >= 0),
  constraint logistics_provider_candidates_currency_check check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint logistics_provider_candidates_dates_check check (estimated_departure_date is null or estimated_arrival_date is null or estimated_arrival_date >= estimated_departure_date),
  constraint logistics_provider_candidates_text_check check (
    (quote_reference is null or char_length(quote_reference) <= 160)
    and (contact_name is null or char_length(contact_name) <= 160)
    and (contact_email is null or char_length(contact_email) <= 320)
    and (contact_phone is null or char_length(contact_phone) <= 80)
    and (notes is null or char_length(notes) <= 4000)
  )
);

create table public.logistics_provider_selections (
  id uuid primary key default gen_random_uuid(),
  logistics_booking_request_id uuid not null references public.logistics_booking_requests(id) on delete cascade,
  selected_candidate_id uuid not null,
  selection_status text not null default 'selected',
  selection_reason text,
  selected_by uuid not null references public.profiles(id) on delete restrict,
  selected_at timestamptz not null default now(),
  superseded_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logistics_provider_selections_candidate_request_fk foreign key (selected_candidate_id, logistics_booking_request_id)
    references public.logistics_provider_candidates(id, logistics_booking_request_id) on delete restrict,
  constraint logistics_provider_selections_status_check check (selection_status in ('selected','superseded','cancelled')),
  constraint logistics_provider_selections_reason_check check (
    (selection_reason is null or char_length(selection_reason) <= 2000)
    and (cancellation_reason is null or char_length(cancellation_reason) <= 2000)
  ),
  constraint logistics_provider_selections_lifecycle_check check (
    (selection_status = 'selected' and superseded_at is null and cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (selection_status = 'superseded' and superseded_at is not null and cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (selection_status = 'cancelled' and superseded_at is null and cancelled_at is not null and cancelled_by is not null and cancellation_reason is not null)
  )
);

create unique index logistics_provider_selections_one_current_idx
  on public.logistics_provider_selections (logistics_booking_request_id)
  where selection_status = 'selected';

create table public.logistics_arrangement_events (
  id uuid primary key default gen_random_uuid(),
  logistics_booking_request_id uuid not null references public.logistics_booking_requests(id) on delete cascade,
  candidate_id uuid references public.logistics_provider_candidates(id) on delete set null,
  selection_id uuid references public.logistics_provider_selections(id) on delete set null,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint logistics_arrangement_events_type_check check (event_type in (
    'candidate_created','candidate_updated','candidate_withdrawn',
    'carrier_options_available','provider_selected','provider_selection_changed',
    'provider_selection_cancelled','ready_for_external_booking'
  )),
  constraint logistics_arrangement_events_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create index logistics_provider_candidates_request_status_idx on public.logistics_provider_candidates (logistics_booking_request_id, candidate_status, created_at);
create index logistics_provider_selections_request_status_idx on public.logistics_provider_selections (logistics_booking_request_id, selection_status, selected_at desc);
create index logistics_arrangement_events_request_created_idx on public.logistics_arrangement_events (logistics_booking_request_id, created_at, id);

alter table public.logistics_provider_candidates enable row level security;
alter table public.logistics_provider_selections enable row level security;
alter table public.logistics_arrangement_events enable row level security;

revoke all on public.logistics_provider_candidates from anon;
revoke all on public.logistics_provider_selections from anon;
revoke all on public.logistics_arrangement_events from anon;
grant select on public.logistics_provider_candidates, public.logistics_provider_selections, public.logistics_arrangement_events to authenticated;
revoke insert, update, delete on public.logistics_provider_candidates, public.logistics_provider_selections, public.logistics_arrangement_events from authenticated;

create policy logistics_provider_candidates_participant_read on public.logistics_provider_candidates
  for select to authenticated using (public.can_access_logistics_booking_request(logistics_booking_request_id));
create policy logistics_provider_selections_participant_read on public.logistics_provider_selections
  for select to authenticated using (public.can_access_logistics_booking_request(logistics_booking_request_id));
create policy logistics_arrangement_events_participant_read on public.logistics_arrangement_events
  for select to authenticated using (public.can_access_logistics_booking_request(logistics_booking_request_id));

create or replace function public.is_trusted_logistics_arrangement_write()
returns boolean language sql stable as $$
  select coalesce(current_setting('app.logistics_arrangement_trusted_write', true), '') = 'on';
$$;

create or replace function public.assert_logistics_arrangement_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.is_admin() then raise exception 'Administrator access is required for logistics arrangement changes.'; end if;
end;
$$;

create or replace function public.assert_logistics_provider_candidate_values(
  provider_name_value text, provider_type_value text, service_level_value text,
  estimated_departure_date_value date, estimated_arrival_date_value date,
  estimated_transit_days_value integer, estimated_cost_value numeric, currency_value text,
  quote_reference_value text, contact_name_value text, contact_email_value text,
  contact_phone_value text, notes_value text
) returns void language plpgsql stable as $$
begin
  if nullif(btrim(coalesce(provider_name_value, '')), '') is null then raise exception 'Provider name is required.'; end if;
  if char_length(btrim(provider_name_value)) > 200 then raise exception 'Provider name must be 200 characters or fewer.'; end if;
  if lower(btrim(coalesce(provider_type_value, ''))) not in ('carrier','freight_forwarder','broker','multimodal_operator','other') then raise exception 'Provider type is not supported.'; end if;
  if service_level_value is not null and char_length(btrim(service_level_value)) > 160 then raise exception 'Service level must be 160 characters or fewer.'; end if;
  if estimated_transit_days_value is not null and estimated_transit_days_value not between 0 and 3650 then raise exception 'Estimated transit days must be between 0 and 3650.'; end if;
  if estimated_cost_value is not null and estimated_cost_value < 0 then raise exception 'Estimated cost cannot be negative.'; end if;
  if currency_value is not null and btrim(currency_value) <> '' and upper(btrim(currency_value)) !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter code.'; end if;
  if estimated_departure_date_value is not null and estimated_arrival_date_value is not null and estimated_arrival_date_value < estimated_departure_date_value then raise exception 'Estimated arrival cannot be before estimated departure.'; end if;
  if quote_reference_value is not null and char_length(btrim(quote_reference_value)) > 160 then raise exception 'Quote reference must be 160 characters or fewer.'; end if;
  if contact_name_value is not null and char_length(btrim(contact_name_value)) > 160 then raise exception 'Contact name must be 160 characters or fewer.'; end if;
  if contact_email_value is not null and char_length(btrim(contact_email_value)) > 320 then raise exception 'Contact email must be 320 characters or fewer.'; end if;
  if contact_phone_value is not null and char_length(btrim(contact_phone_value)) > 80 then raise exception 'Contact phone must be 80 characters or fewer.'; end if;
  if notes_value is not null and char_length(btrim(notes_value)) > 4000 then raise exception 'Notes must be 4000 characters or fewer.'; end if;
end;
$$;

create or replace function public.strip_logistics_arrangement_event_metadata(event_metadata jsonb)
returns jsonb language sql immutable as $$
  select coalesce(event_metadata, '{}'::jsonb)
    - 'actor_id' - 'actor_profile_id' - 'impersonated_by'
    - 'api_key' - 'access_token' - 'refresh_token' - 'provider_token'
    - 'provider_secret' - 'carrier_credentials' - 'booking_confirmation';
$$;

create or replace function public.insert_trusted_logistics_arrangement_event(
  booking_request_uuid uuid, candidate_uuid uuid, selection_uuid uuid,
  event_name text, actor_uuid uuid, event_metadata jsonb default '{}'::jsonb
) returns public.logistics_arrangement_events
language plpgsql security definer set search_path = public as $$
declare event_row public.logistics_arrangement_events%rowtype;
begin
  if event_name not in ('candidate_created','candidate_updated','candidate_withdrawn','carrier_options_available','provider_selected','provider_selection_changed','provider_selection_cancelled','ready_for_external_booking') then
    raise exception 'Logistics arrangement events must be generated by a trusted flow.';
  end if;
  perform set_config('app.logistics_arrangement_trusted_write', 'on', true);
  insert into public.logistics_arrangement_events(logistics_booking_request_id, candidate_id, selection_id, event_type, actor_profile_id, metadata)
  values (booking_request_uuid, candidate_uuid, selection_uuid, event_name, actor_uuid, public.strip_logistics_arrangement_event_metadata(event_metadata))
  returning * into event_row;
  perform set_config('app.logistics_arrangement_trusted_write', '', true);
  return event_row;
exception when others then
  perform set_config('app.logistics_arrangement_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.protect_logistics_provider_candidate_write()
returns trigger language plpgsql as $$
begin
  if not public.is_trusted_logistics_arrangement_write() then raise exception 'Logistics provider candidates are managed through trusted RPCs.'; end if;
  if tg_op = 'DELETE' then raise exception 'Logistics provider candidate history cannot be deleted.'; end if;
  if tg_op = 'UPDATE' then new.version := old.version + 1; new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_logistics_provider_selection_write()
returns trigger language plpgsql as $$
begin
  if not public.is_trusted_logistics_arrangement_write() then raise exception 'Logistics provider selections are managed through trusted RPCs.'; end if;
  if tg_op = 'DELETE' then raise exception 'Logistics provider selection history cannot be deleted.'; end if;
  if tg_op = 'UPDATE' then
    new.logistics_booking_request_id := old.logistics_booking_request_id;
    new.selected_candidate_id := old.selected_candidate_id;
    new.selected_by := old.selected_by;
    new.selected_at := old.selected_at;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_logistics_arrangement_event_write()
returns trigger language plpgsql as $$
begin
  if not public.is_trusted_logistics_arrangement_write() or tg_op in ('UPDATE','DELETE') then
    raise exception 'Logistics arrangement events are immutable and trusted-flow only.';
  end if;
  return new;
end;
$$;

create trigger protect_logistics_provider_candidate_write before insert or update or delete on public.logistics_provider_candidates for each row execute function public.protect_logistics_provider_candidate_write();
create trigger protect_logistics_provider_selection_write before insert or update or delete on public.logistics_provider_selections for each row execute function public.protect_logistics_provider_selection_write();
create trigger protect_logistics_arrangement_event_write before insert or update or delete on public.logistics_arrangement_events for each row execute function public.protect_logistics_arrangement_event_write();

create or replace function public.admin_create_logistics_provider_candidate(
  booking_request_uuid uuid, provider_name_value text, provider_type_value text,
  service_level_value text default null, estimated_departure_date_value date default null,
  estimated_arrival_date_value date default null, estimated_transit_days_value integer default null,
  estimated_cost_value numeric default null, currency_value text default null,
  quote_reference_value text default null, contact_name_value text default null,
  contact_email_value text default null, contact_phone_value text default null, notes_value text default null
) returns public.logistics_provider_candidates
language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; candidate_row public.logistics_provider_candidates%rowtype;
begin
  perform public.assert_logistics_arrangement_admin();
  select * into booking_row from public.logistics_booking_requests where id = booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if booking_row.status not in ('submitted_for_arrangement','carrier_options_available','carrier_selected') then raise exception 'Provider candidates can only be added while arranging carrier options.'; end if;
  perform public.assert_logistics_provider_candidate_values(provider_name_value, provider_type_value, service_level_value, estimated_departure_date_value, estimated_arrival_date_value, estimated_transit_days_value, estimated_cost_value, currency_value, quote_reference_value, contact_name_value, contact_email_value, contact_phone_value, notes_value);
  perform set_config('app.logistics_arrangement_trusted_write', 'on', true);
  insert into public.logistics_provider_candidates(logistics_booking_request_id, provider_name, provider_type, service_level, estimated_departure_date, estimated_arrival_date, estimated_transit_days, estimated_cost, currency, quote_reference, contact_name, contact_email, contact_phone, notes, candidate_status, created_by, updated_by)
  values (booking_request_uuid, btrim(provider_name_value), lower(btrim(provider_type_value)), nullif(btrim(service_level_value), ''), estimated_departure_date_value, estimated_arrival_date_value, estimated_transit_days_value, estimated_cost_value, nullif(upper(btrim(currency_value)), ''), nullif(btrim(quote_reference_value), ''), nullif(btrim(contact_name_value), ''), nullif(btrim(contact_email_value), ''), nullif(btrim(contact_phone_value), ''), nullif(btrim(notes_value), ''), 'active', actor_uuid, actor_uuid)
  returning * into candidate_row;
  perform set_config('app.logistics_arrangement_trusted_write', '', true);
  if booking_row.status = 'submitted_for_arrangement' then
    perform set_config('app.logistics_booking_request_trusted_write', 'on', true);
    update public.logistics_booking_requests set status = 'carrier_options_available'
      where id = booking_request_uuid and status = 'submitted_for_arrangement' returning * into booking_row;
    if not found then raise exception 'Logistics arrangement lifecycle conflict while publishing carrier options.'; end if;
    perform set_config('app.logistics_booking_request_trusted_write', '', true);
  end if;
  perform public.insert_trusted_logistics_arrangement_event(booking_request_uuid, candidate_row.id, null, 'candidate_created', actor_uuid, jsonb_build_object('candidate_status','active'));
  if booking_row.status = 'carrier_options_available' and not exists (select 1 from public.logistics_arrangement_events where logistics_booking_request_id = booking_request_uuid and event_type = 'carrier_options_available') then
    perform public.insert_trusted_logistics_arrangement_event(booking_request_uuid, candidate_row.id, null, 'carrier_options_available', actor_uuid, '{}'::jsonb);
  end if;
  return candidate_row;
exception when others then
  perform set_config('app.logistics_arrangement_trusted_write', '', true);
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.admin_update_logistics_provider_candidate(
  candidate_uuid uuid, provider_name_value text, provider_type_value text,
  service_level_value text default null, estimated_departure_date_value date default null,
  estimated_arrival_date_value date default null, estimated_transit_days_value integer default null,
  estimated_cost_value numeric default null, currency_value text default null,
  quote_reference_value text default null, contact_name_value text default null,
  contact_email_value text default null, contact_phone_value text default null, notes_value text default null
) returns public.logistics_provider_candidates
language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); candidate_row public.logistics_provider_candidates%rowtype; booking_status text;
begin
  perform public.assert_logistics_arrangement_admin();
  select * into candidate_row from public.logistics_provider_candidates where id = candidate_uuid for update;
  if candidate_row.id is null then raise exception 'Logistics provider candidate not found.'; end if;
  select status into booking_status from public.logistics_booking_requests where id = candidate_row.logistics_booking_request_id for update;
  if booking_status not in ('carrier_options_available','carrier_selected') then raise exception 'Provider candidates cannot be edited in the current arrangement state.'; end if;
  if candidate_row.candidate_status not in ('draft','active') then raise exception 'Only draft or active provider candidates can be edited.'; end if;
  perform public.assert_logistics_provider_candidate_values(provider_name_value, provider_type_value, service_level_value, estimated_departure_date_value, estimated_arrival_date_value, estimated_transit_days_value, estimated_cost_value, currency_value, quote_reference_value, contact_name_value, contact_email_value, contact_phone_value, notes_value);
  perform set_config('app.logistics_arrangement_trusted_write', 'on', true);
  update public.logistics_provider_candidates set provider_name=btrim(provider_name_value), provider_type=lower(btrim(provider_type_value)), service_level=nullif(btrim(service_level_value),''), estimated_departure_date=estimated_departure_date_value, estimated_arrival_date=estimated_arrival_date_value, estimated_transit_days=estimated_transit_days_value, estimated_cost=estimated_cost_value, currency=nullif(upper(btrim(currency_value)),''), quote_reference=nullif(btrim(quote_reference_value),''), contact_name=nullif(btrim(contact_name_value),''), contact_email=nullif(btrim(contact_email_value),''), contact_phone=nullif(btrim(contact_phone_value),''), notes=nullif(btrim(notes_value),''), updated_by=actor_uuid
    where id=candidate_uuid and candidate_status in ('draft','active') returning * into candidate_row;
  if not found then raise exception 'Provider candidate lifecycle conflict while updating.'; end if;
  perform set_config('app.logistics_arrangement_trusted_write', '', true);
  perform public.insert_trusted_logistics_arrangement_event(candidate_row.logistics_booking_request_id, candidate_row.id, null, 'candidate_updated', actor_uuid, jsonb_build_object('version',candidate_row.version));
  return candidate_row;
exception when others then perform set_config('app.logistics_arrangement_trusted_write','',true); raise;
end;
$$;

create or replace function public.admin_withdraw_logistics_provider_candidate(candidate_uuid uuid, reason_text text)
returns public.logistics_provider_candidates language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); candidate_row public.logistics_provider_candidates%rowtype; normalized_reason text := nullif(btrim(coalesce(reason_text,'')),'');
begin
  perform public.assert_logistics_arrangement_admin();
  if normalized_reason is null or char_length(normalized_reason) > 2000 then raise exception 'A withdrawal reason of 2000 characters or fewer is required.'; end if;
  select * into candidate_row from public.logistics_provider_candidates where id=candidate_uuid for update;
  if candidate_row.id is null then raise exception 'Logistics provider candidate not found.'; end if;
  perform 1 from public.logistics_booking_requests where id=candidate_row.logistics_booking_request_id for update;
  if candidate_row.candidate_status not in ('draft','active','rejected') then raise exception 'Selected or withdrawn candidates cannot be withdrawn.'; end if;
  perform set_config('app.logistics_arrangement_trusted_write','on',true);
  update public.logistics_provider_candidates set candidate_status='withdrawn', updated_by=actor_uuid
    where id=candidate_uuid and candidate_status in ('draft','active','rejected') returning * into candidate_row;
  if not found then raise exception 'Provider candidate lifecycle conflict while withdrawing.'; end if;
  perform set_config('app.logistics_arrangement_trusted_write','',true);
  perform public.insert_trusted_logistics_arrangement_event(candidate_row.logistics_booking_request_id,candidate_row.id,null,'candidate_withdrawn',actor_uuid,jsonb_build_object('reason',normalized_reason));
  return candidate_row;
exception when others then perform set_config('app.logistics_arrangement_trusted_write','',true); raise;
end;
$$;

create or replace function public.admin_select_logistics_provider_candidate(booking_request_uuid uuid, candidate_uuid uuid, reason_text text default null, replace_existing boolean default false)
returns public.logistics_provider_selections language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; candidate_row public.logistics_provider_candidates%rowtype; previous_selection public.logistics_provider_selections%rowtype; selection_row public.logistics_provider_selections%rowtype; event_name text := 'provider_selected';
begin
  perform public.assert_logistics_arrangement_admin();
  select * into booking_row from public.logistics_booking_requests where id=booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if booking_row.status not in ('carrier_options_available','carrier_selected') then raise exception 'A provider can only be selected from available carrier options.'; end if;
  select * into candidate_row from public.logistics_provider_candidates where id=candidate_uuid for update;
  if candidate_row.id is null or candidate_row.logistics_booking_request_id <> booking_request_uuid then raise exception 'Provider candidate does not belong to this booking request.'; end if;
  if candidate_row.candidate_status <> 'active' then raise exception 'Only an active provider candidate can be selected.'; end if;
  select * into previous_selection from public.logistics_provider_selections where logistics_booking_request_id=booking_request_uuid and selection_status='selected' for update;
  if previous_selection.id is not null and not replace_existing then raise exception 'A provider is already selected. Explicit replacement is required.'; end if;
  perform set_config('app.logistics_arrangement_trusted_write','on',true);
  if previous_selection.id is not null then
    update public.logistics_provider_selections set selection_status='superseded', superseded_at=now() where id=previous_selection.id and selection_status='selected';
    update public.logistics_provider_candidates set candidate_status='active', updated_by=actor_uuid where id=previous_selection.selected_candidate_id and candidate_status='selected';
    event_name := 'provider_selection_changed';
  end if;
  insert into public.logistics_provider_selections(logistics_booking_request_id,selected_candidate_id,selection_reason,selected_by)
    values(booking_request_uuid,candidate_uuid,nullif(btrim(reason_text),''),actor_uuid) returning * into selection_row;
  update public.logistics_provider_candidates set candidate_status='selected', updated_by=actor_uuid where id=candidate_uuid and candidate_status='active';
  if not found then raise exception 'Provider candidate lifecycle conflict while selecting.'; end if;
  perform set_config('app.logistics_arrangement_trusted_write','',true);
  perform set_config('app.logistics_booking_request_trusted_write','on',true);
  update public.logistics_booking_requests set status='carrier_selected' where id=booking_request_uuid and status in ('carrier_options_available','carrier_selected') returning * into booking_row;
  if not found then raise exception 'Logistics arrangement lifecycle conflict while selecting provider.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write','',true);
  perform public.insert_trusted_logistics_arrangement_event(booking_request_uuid,candidate_uuid,selection_row.id,event_name,actor_uuid,jsonb_build_object('replaced_selection_id',previous_selection.id));
  return selection_row;
exception when others then
  perform set_config('app.logistics_arrangement_trusted_write','',true);
  perform set_config('app.logistics_booking_request_trusted_write','',true);
  raise;
end;
$$;

create or replace function public.admin_cancel_logistics_provider_selection(booking_request_uuid uuid, reason_text text)
returns public.logistics_provider_selections language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; selection_row public.logistics_provider_selections%rowtype; normalized_reason text := nullif(btrim(coalesce(reason_text,'')),'');
begin
  perform public.assert_logistics_arrangement_admin();
  if normalized_reason is null or char_length(normalized_reason) > 2000 then raise exception 'A cancellation reason of 2000 characters or fewer is required.'; end if;
  select * into booking_row from public.logistics_booking_requests where id=booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if booking_row.status <> 'carrier_selected' then raise exception 'Only a selected provider can be cancelled before external-booking readiness.'; end if;
  select * into selection_row from public.logistics_provider_selections where logistics_booking_request_id=booking_request_uuid and selection_status='selected' for update;
  if selection_row.id is null then raise exception 'No active provider selection was found.'; end if;
  perform set_config('app.logistics_arrangement_trusted_write','on',true);
  update public.logistics_provider_selections set selection_status='cancelled',cancelled_at=now(),cancelled_by=actor_uuid,cancellation_reason=normalized_reason
    where id=selection_row.id and selection_status='selected' returning * into selection_row;
  if not found then raise exception 'Provider selection lifecycle conflict while cancelling.'; end if;
  update public.logistics_provider_candidates set candidate_status='active',updated_by=actor_uuid where id=selection_row.selected_candidate_id and candidate_status='selected';
  perform set_config('app.logistics_arrangement_trusted_write','',true);
  perform set_config('app.logistics_booking_request_trusted_write','on',true);
  update public.logistics_booking_requests set status='carrier_options_available' where id=booking_request_uuid and status='carrier_selected' returning * into booking_row;
  if not found then raise exception 'Logistics arrangement lifecycle conflict while cancelling selection.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write','',true);
  perform public.insert_trusted_logistics_arrangement_event(booking_request_uuid,selection_row.selected_candidate_id,selection_row.id,'provider_selection_cancelled',actor_uuid,jsonb_build_object('reason',normalized_reason));
  return selection_row;
exception when others then
  perform set_config('app.logistics_arrangement_trusted_write','',true);
  perform set_config('app.logistics_booking_request_trusted_write','',true);
  raise;
end;
$$;

create or replace function public.admin_mark_ready_for_external_booking(booking_request_uuid uuid)
returns public.logistics_booking_requests language plpgsql security definer set search_path = public as $$
declare actor_uuid uuid := auth.uid(); booking_row public.logistics_booking_requests%rowtype; selection_row public.logistics_provider_selections%rowtype; candidate_row public.logistics_provider_candidates%rowtype;
begin
  perform public.assert_logistics_arrangement_admin();
  select * into booking_row from public.logistics_booking_requests where id=booking_request_uuid for update;
  if booking_row.id is null then raise exception 'Logistics booking request not found.'; end if;
  if booking_row.status <> 'carrier_selected' then raise exception 'A selected provider is required before external-booking readiness.'; end if;
  select * into selection_row from public.logistics_provider_selections where logistics_booking_request_id=booking_request_uuid and selection_status='selected' for update;
  if selection_row.id is null then raise exception 'No active provider selection was found.'; end if;
  select * into candidate_row from public.logistics_provider_candidates where id=selection_row.selected_candidate_id for update;
  if candidate_row.candidate_status <> 'selected' or candidate_row.estimated_departure_date is null or candidate_row.estimated_arrival_date is null or candidate_row.estimated_transit_days is null or candidate_row.estimated_cost is null or candidate_row.currency is null then
    raise exception 'Selected provider details are incomplete for external-booking readiness.';
  end if;
  perform set_config('app.logistics_booking_request_trusted_write','on',true);
  update public.logistics_booking_requests set status='ready_for_external_booking' where id=booking_request_uuid and status='carrier_selected' returning * into booking_row;
  if not found then raise exception 'Logistics arrangement lifecycle conflict while marking ready.'; end if;
  perform set_config('app.logistics_booking_request_trusted_write','',true);
  perform public.insert_trusted_logistics_arrangement_event(booking_request_uuid,candidate_row.id,selection_row.id,'ready_for_external_booking',actor_uuid,jsonb_build_object('external_booking_created',false));
  return booking_row;
exception when others then perform set_config('app.logistics_booking_request_trusted_write','',true); raise;
end;
$$;

revoke all on function public.is_trusted_logistics_arrangement_write() from public, anon, authenticated;
revoke all on function public.assert_logistics_arrangement_admin() from public, anon, authenticated;
revoke all on function public.assert_logistics_provider_candidate_values(text,text,text,date,date,integer,numeric,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.strip_logistics_arrangement_event_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.insert_trusted_logistics_arrangement_event(uuid,uuid,uuid,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.protect_logistics_provider_candidate_write() from public, anon, authenticated;
revoke all on function public.protect_logistics_provider_selection_write() from public, anon, authenticated;
revoke all on function public.protect_logistics_arrangement_event_write() from public, anon, authenticated;

revoke all on function public.admin_create_logistics_provider_candidate(uuid,text,text,text,date,date,integer,numeric,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_update_logistics_provider_candidate(uuid,text,text,text,date,date,integer,numeric,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_withdraw_logistics_provider_candidate(uuid,text) from public, anon, authenticated;
revoke all on function public.admin_select_logistics_provider_candidate(uuid,uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.admin_cancel_logistics_provider_selection(uuid,text) from public, anon, authenticated;
revoke all on function public.admin_mark_ready_for_external_booking(uuid) from public, anon, authenticated;

grant execute on function public.admin_create_logistics_provider_candidate(uuid,text,text,text,date,date,integer,numeric,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_update_logistics_provider_candidate(uuid,text,text,text,date,date,integer,numeric,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_withdraw_logistics_provider_candidate(uuid,text) to authenticated;
grant execute on function public.admin_select_logistics_provider_candidate(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.admin_cancel_logistics_provider_selection(uuid,text) to authenticated;
grant execute on function public.admin_mark_ready_for_external_booking(uuid) to authenticated;
