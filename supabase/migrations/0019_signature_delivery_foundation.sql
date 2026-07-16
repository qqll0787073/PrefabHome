-- PH-008D Signature Delivery Foundation.
-- Internal queue only: no provider calls, signing links, email, sent/viewed/signed/completed states, execution, legal effectiveness, payments, shipping, or automation.

create sequence if not exists public.signature_delivery_number_seq;

create table if not exists public.signature_delivery_requests (
  id uuid primary key default gen_random_uuid(),
  delivery_number text unique not null,
  signature_package_id uuid not null unique references public.signature_packages(id) on delete restrict,
  package_number text not null,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_number text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'delivery_draft',
  provider_key text not null default 'unconfigured',
  package_snapshot jsonb not null,
  recipient_snapshot jsonb not null,
  request_payload_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  queued_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signature_delivery_number_format_check check (delivery_number ~ '^SDL-[0-9]{4}-[0-9]{6}$'),
  constraint signature_delivery_status_check check (status in ('delivery_draft', 'queued', 'cancelled')),
  constraint signature_delivery_provider_check check (provider_key = 'unconfigured'),
  constraint signature_delivery_cancel_reason_length_check check (
    cancellation_reason is null or char_length(cancellation_reason) <= 2000
  ),
  constraint signature_delivery_lifecycle_check check (
    (status = 'delivery_draft' and queued_at is null and cancelled_at is null and cancellation_reason is null)
    or (status = 'queued' and queued_at is not null and cancelled_at is null and cancellation_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and cancellation_reason is not null)
  )
);

create table if not exists public.signature_delivery_recipients (
  id uuid primary key default gen_random_uuid(),
  delivery_request_id uuid not null references public.signature_delivery_requests(id) on delete cascade,
  source_participant_id uuid not null references public.signature_participants(id) on delete restrict,
  participant_role text not null,
  profile_id uuid references public.profiles(id) on delete restrict,
  organization_id uuid references public.manufacturers(id) on delete restrict,
  full_name text not null,
  email text not null,
  title text,
  signing_order integer not null,
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint signature_delivery_recipients_role_check check (participant_role in ('buyer_signer', 'manufacturer_signer')),
  constraint signature_delivery_recipients_status_check check (delivery_status = 'pending'),
  constraint signature_delivery_recipients_name_length_check check (char_length(full_name) between 1 and 160),
  constraint signature_delivery_recipients_email_length_check check (char_length(email) between 1 and 254),
  constraint signature_delivery_recipients_email_format_check check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint signature_delivery_recipients_title_length_check check (title is null or char_length(title) <= 120),
  constraint signature_delivery_recipients_role_unique unique (delivery_request_id, participant_role),
  constraint signature_delivery_recipients_order_unique unique (delivery_request_id, signing_order),
  constraint signature_delivery_recipients_source_unique unique (delivery_request_id, source_participant_id),
  constraint signature_delivery_recipients_fixed_order_check check (
    (participant_role = 'buyer_signer' and signing_order = 1)
    or (participant_role = 'manufacturer_signer' and signing_order = 2)
  )
);

create table if not exists public.signature_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_request_id uuid not null references public.signature_delivery_requests(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint signature_delivery_events_type_check check (
    event_type in (
      'signature_delivery_created',
      'signature_delivery_queued',
      'signature_delivery_cancelled'
    )
  )
);

create index if not exists signature_delivery_requests_buyer_status_idx
  on public.signature_delivery_requests (buyer_id, status, created_at desc);

create index if not exists signature_delivery_requests_manufacturer_status_idx
  on public.signature_delivery_requests (manufacturer_id, status, created_at desc);

create index if not exists signature_delivery_recipients_request_order_idx
  on public.signature_delivery_recipients (delivery_request_id, signing_order);

create index if not exists signature_delivery_events_request_created_idx
  on public.signature_delivery_events (delivery_request_id, created_at);

alter table public.signature_delivery_requests enable row level security;
alter table public.signature_delivery_recipients enable row level security;
alter table public.signature_delivery_events enable row level security;

grant select on table public.signature_delivery_requests to authenticated;
grant select on table public.signature_delivery_recipients to authenticated;
grant select on table public.signature_delivery_events to authenticated;
revoke all on table public.signature_delivery_requests from anon;
revoke all on table public.signature_delivery_recipients from anon;
revoke all on table public.signature_delivery_events from anon;
revoke insert, update, delete on table public.signature_delivery_requests from authenticated;
revoke insert, update, delete on table public.signature_delivery_recipients from authenticated;
revoke insert, update, delete on table public.signature_delivery_events from authenticated;

create or replace function public.is_trusted_signature_delivery_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.signature_delivery_trusted_write', true), '') = 'on';
$$;

create or replace function public.generate_signature_delivery_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.signature_delivery_number_seq');
  return 'SDL-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.can_access_signature_delivery_request(delivery_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.signature_delivery_requests sdr
    where sdr.id = delivery_uuid
      and (
        sdr.buyer_id = auth.uid()
        or public.owns_manufacturer(sdr.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.strip_signature_delivery_event_metadata(event_metadata jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(event_metadata, '{}'::jsonb)
    - 'actor_profile_id'
    - 'actor_id'
    - 'sender_profile_id'
    - 'sender_role'
    - 'buyer_id'
    - 'manufacturer_id'
    - 'profile_id'
    - 'organization_id'
    - 'provider_id'
    - 'provider_token'
    - 'provider_secret'
    - 'envelope_id'
    - 'signing_url'
    - 'webhook_secret'
$$;

create or replace function public.insert_trusted_signature_delivery_event(
  delivery_uuid uuid,
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
  if event_name not in (
    'signature_delivery_created',
    'signature_delivery_queued',
    'signature_delivery_cancelled'
  ) then
    raise exception 'Signature delivery event type must be generated by a trusted flow.';
  end if;

  insert into public.signature_delivery_events (
    delivery_request_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    delivery_uuid,
    event_name,
    actor_uuid,
    public.strip_signature_delivery_event_metadata(event_metadata)
  );
end;
$$;

create or replace function public.protect_signature_delivery_request_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Signature delivery requests are auditable and cannot be deleted.';
  end if;

  new.updated_at := now();

  if public.is_trusted_signature_delivery_write() then
    return new;
  end if;

  raise exception 'Signature delivery requests must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_signature_delivery_recipient_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Signature delivery recipients are immutable and cannot be changed.';
  end if;

  new.full_name := btrim(new.full_name);
  new.email := lower(btrim(new.email));
  new.title := nullif(btrim(coalesce(new.title, '')), '');

  if public.is_trusted_signature_delivery_write() then
    return new;
  end if;

  raise exception 'Signature delivery recipients must be created by trusted flows.';
end;
$$;

create or replace function public.protect_signature_delivery_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Signature delivery events are immutable and cannot be changed.';
  end if;

  if public.is_trusted_signature_delivery_write() then
    new.metadata := public.strip_signature_delivery_event_metadata(new.metadata);
    return new;
  end if;

  raise exception 'Signature delivery events must be generated by trusted flows.';
end;
$$;

create or replace function public.signature_delivery_participant_is_complete(
  participant public.signature_participants
)
returns boolean
language sql
stable
as $$
  select participant.full_name is not null
    and btrim(participant.full_name) <> ''
    and participant.email is not null
    and participant.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
$$;

create or replace function public.build_signature_delivery_package_snapshot(
  package_row public.signature_packages
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', package_row.id,
    'package_number', package_row.package_number,
    'contract_id', package_row.contract_id,
    'contract_number', package_row.contract_number,
    'buyer_id', package_row.buyer_id,
    'manufacturer_id', package_row.manufacturer_id,
    'status', package_row.status,
    'version', package_row.version,
    'contract_snapshot', package_row.contract_snapshot,
    'buyer_snapshot', package_row.buyer_snapshot,
    'manufacturer_snapshot', package_row.manufacturer_snapshot,
    'decision_snapshot', package_row.decision_snapshot,
    'signing_content_snapshot', package_row.signing_content_snapshot,
    'created_by', package_row.created_by,
    'ready_at', package_row.ready_at,
    'created_at', package_row.created_at
  )
$$;

create or replace function public.build_signature_delivery_recipient_snapshot(package_uuid uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_participant_id', sp.id,
        'participant_role', sp.participant_role,
        'profile_id', sp.profile_id,
        'organization_id', sp.organization_id,
        'full_name', sp.full_name,
        'email', sp.email,
        'title', sp.title,
        'signing_order', sp.signing_order,
        'status', sp.status
      )
      order by sp.signing_order
    ),
    '[]'::jsonb
  )
  from public.signature_participants sp
  where sp.signature_package_id = package_uuid
$$;

create or replace function public.build_signature_delivery_payload_snapshot(
  package_row public.signature_packages,
  recipient_rows jsonb
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'provider_key', 'unconfigured',
    'delivery_mode', 'internal_queue_only',
    'package_number', package_row.package_number,
    'contract_number', package_row.contract_number,
    'contract_id', package_row.contract_id,
    'signature_package_id', package_row.id,
    'recipients', recipient_rows,
    'queued_means_sent', false,
    'provider_contacted', false,
    'email_sent', false,
    'signing_link_created', false,
    'contract_signed', false,
    'contract_executed', false,
    'legally_effective', false
  )
$$;

create or replace function public.assert_signature_delivery_package_ready(package_uuid uuid)
returns public.signature_packages
language plpgsql
security definer
set search_path = public
as $$
declare
  package_row public.signature_packages%rowtype;
  participant_count integer;
  buyer_complete boolean;
  manufacturer_complete boolean;
begin
  select *
  into package_row
  from public.signature_packages
  where id = package_uuid;

  if package_row.id is null then
    raise exception 'Signature package not found.';
  end if;

  if package_row.status <> 'ready_to_send' then
    raise exception 'Signature delivery requests require ready-to-send signature packages.';
  end if;

  select
    count(*),
    bool_or(participant_role = 'buyer_signer' and signing_order = 1 and public.signature_delivery_participant_is_complete(sp)),
    bool_or(participant_role = 'manufacturer_signer' and signing_order = 2 and public.signature_delivery_participant_is_complete(sp))
  into participant_count, buyer_complete, manufacturer_complete
  from public.signature_participants sp
  where sp.signature_package_id = package_uuid;

  if participant_count <> 2 then
    raise exception 'Signature delivery requests require exactly two recipients.';
  end if;

  if not coalesce(buyer_complete, false) then
    raise exception 'Buyer signer must be complete before signature delivery.';
  end if;

  if not coalesce(manufacturer_complete, false) then
    raise exception 'Manufacturer signer must be complete before signature delivery.';
  end if;

  return package_row;
end;
$$;

create or replace function public.create_signature_delivery_request(package_uuid uuid)
returns public.signature_delivery_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  package_row public.signature_packages%rowtype;
  delivery_row public.signature_delivery_requests%rowtype;
  recipient_snapshot jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select role into actor_role from public.profiles where id = actor_uuid;
  if actor_role <> 'buyer' then
    raise exception 'Only buyers can create signature delivery requests.';
  end if;

  package_row := public.assert_signature_delivery_package_ready(package_uuid);

  if package_row.buyer_id <> actor_uuid then
    raise exception 'You are not authorized to create delivery for this signature package.';
  end if;

  if exists (select 1 from public.signature_delivery_requests where signature_package_id = package_uuid) then
    raise exception 'A signature delivery request already exists for this package.';
  end if;

  recipient_snapshot := public.build_signature_delivery_recipient_snapshot(package_uuid);

  perform set_config('app.signature_delivery_trusted_write', 'on', true);

  insert into public.signature_delivery_requests (
    delivery_number,
    signature_package_id,
    package_number,
    contract_id,
    contract_number,
    buyer_id,
    manufacturer_id,
    status,
    provider_key,
    package_snapshot,
    recipient_snapshot,
    request_payload_snapshot,
    created_by
  )
  values (
    public.generate_signature_delivery_number(),
    package_row.id,
    package_row.package_number,
    package_row.contract_id,
    package_row.contract_number,
    package_row.buyer_id,
    package_row.manufacturer_id,
    'delivery_draft',
    'unconfigured',
    public.build_signature_delivery_package_snapshot(package_row),
    recipient_snapshot,
    public.build_signature_delivery_payload_snapshot(package_row, recipient_snapshot),
    actor_uuid
  )
  returning * into delivery_row;

  insert into public.signature_delivery_recipients (
    delivery_request_id,
    source_participant_id,
    participant_role,
    profile_id,
    organization_id,
    full_name,
    email,
    title,
    signing_order,
    delivery_status
  )
  select
    delivery_row.id,
    sp.id,
    sp.participant_role,
    sp.profile_id,
    sp.organization_id,
    sp.full_name,
    sp.email,
    sp.title,
    sp.signing_order,
    'pending'
  from public.signature_participants sp
  where sp.signature_package_id = package_row.id
  order by sp.signing_order;

  perform public.insert_trusted_signature_delivery_event(
    delivery_row.id,
    'signature_delivery_created',
    actor_uuid,
    jsonb_build_object(
      'delivery_number', delivery_row.delivery_number,
      'package_number', delivery_row.package_number,
      'contract_number', delivery_row.contract_number,
      'provider_key', delivery_row.provider_key,
      'queued_means_sent', false
    )
  );

  perform set_config('app.signature_delivery_trusted_write', '', true);
  return delivery_row;
exception when others then
  perform set_config('app.signature_delivery_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.assert_signature_delivery_integrity(delivery_row public.signature_delivery_requests)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  package_row public.signature_packages%rowtype;
  recipient_count integer;
  source_snapshot jsonb;
begin
  package_row := public.assert_signature_delivery_package_ready(delivery_row.signature_package_id);

  if package_row.id <> delivery_row.signature_package_id
    or package_row.package_number <> delivery_row.package_number
    or package_row.contract_id <> delivery_row.contract_id
    or package_row.contract_number <> delivery_row.contract_number
    or package_row.buyer_id <> delivery_row.buyer_id
    or package_row.manufacturer_id <> delivery_row.manufacturer_id then
    raise exception 'Signature delivery request source fields do not match the ready package.';
  end if;

  select count(*) into recipient_count
  from public.signature_delivery_recipients
  where delivery_request_id = delivery_row.id
    and delivery_status = 'pending'
    and (
      (participant_role = 'buyer_signer' and signing_order = 1)
      or (participant_role = 'manufacturer_signer' and signing_order = 2)
    );

  if recipient_count <> 2 then
    raise exception 'Signature delivery request recipients are incomplete.';
  end if;

  source_snapshot := public.build_signature_delivery_recipient_snapshot(delivery_row.signature_package_id);
  if source_snapshot <> delivery_row.recipient_snapshot then
    raise exception 'Signature delivery recipient snapshot cannot be changed before queueing.';
  end if;
end;
$$;

create or replace function public.queue_signature_delivery_request(delivery_uuid uuid)
returns public.signature_delivery_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  delivery_row public.signature_delivery_requests%rowtype;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select role into actor_role from public.profiles where id = actor_uuid;
  if actor_role <> 'buyer' then
    raise exception 'Only buyers can queue signature delivery requests.';
  end if;

  select * into delivery_row from public.signature_delivery_requests where id = delivery_uuid;
  if delivery_row.id is null then
    raise exception 'Signature delivery request not found.';
  end if;

  if delivery_row.buyer_id <> actor_uuid then
    raise exception 'You are not authorized to queue this signature delivery request.';
  end if;

  if delivery_row.status <> 'delivery_draft' then
    raise exception 'Only draft signature delivery requests can be queued.';
  end if;

  perform public.assert_signature_delivery_integrity(delivery_row);

  perform set_config('app.signature_delivery_trusted_write', 'on', true);

  update public.signature_delivery_requests
  set status = 'queued',
      queued_at = now()
  where id = delivery_uuid
  returning * into delivery_row;

  perform public.insert_trusted_signature_delivery_event(
    delivery_row.id,
    'signature_delivery_queued',
    actor_uuid,
    jsonb_build_object(
      'delivery_number', delivery_row.delivery_number,
      'package_number', delivery_row.package_number,
      'contract_number', delivery_row.contract_number,
      'provider_key', delivery_row.provider_key,
      'provider_contacted', false,
      'email_sent', false,
      'signing_link_created', false,
      'contract_signed', false
    )
  );

  perform set_config('app.signature_delivery_trusted_write', '', true);
  return delivery_row;
exception when others then
  perform set_config('app.signature_delivery_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.cancel_signature_delivery_request(
  delivery_uuid uuid,
  reason_text text
)
returns public.signature_delivery_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  delivery_row public.signature_delivery_requests%rowtype;
  normalized_reason text := nullif(btrim(coalesce(reason_text, '')), '');
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select role into actor_role from public.profiles where id = actor_uuid;
  if actor_role <> 'buyer' then
    raise exception 'Only buyers can cancel signature delivery requests.';
  end if;

  if normalized_reason is null then
    raise exception 'Cancellation reason is required.';
  end if;

  if char_length(normalized_reason) > 2000 then
    raise exception 'Cancellation reason must be 2000 characters or fewer.';
  end if;

  select * into delivery_row from public.signature_delivery_requests where id = delivery_uuid;
  if delivery_row.id is null then
    raise exception 'Signature delivery request not found.';
  end if;

  if delivery_row.buyer_id <> actor_uuid then
    raise exception 'You are not authorized to cancel this signature delivery request.';
  end if;

  if delivery_row.status not in ('delivery_draft', 'queued') then
    raise exception 'Only draft or queued signature delivery requests can be cancelled.';
  end if;

  perform set_config('app.signature_delivery_trusted_write', 'on', true);

  update public.signature_delivery_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = normalized_reason
  where id = delivery_uuid
  returning * into delivery_row;

  perform public.insert_trusted_signature_delivery_event(
    delivery_row.id,
    'signature_delivery_cancelled',
    actor_uuid,
    jsonb_build_object(
      'delivery_number', delivery_row.delivery_number,
      'package_number', delivery_row.package_number,
      'contract_number', delivery_row.contract_number,
      'reason', normalized_reason
    )
  );

  perform set_config('app.signature_delivery_trusted_write', '', true);
  return delivery_row;
exception when others then
  perform set_config('app.signature_delivery_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_signature_delivery_request_write on public.signature_delivery_requests;
create trigger protect_signature_delivery_request_write
before insert or update or delete on public.signature_delivery_requests
for each row execute function public.protect_signature_delivery_request_write();

drop trigger if exists protect_signature_delivery_recipient_write on public.signature_delivery_recipients;
create trigger protect_signature_delivery_recipient_write
before insert or update or delete on public.signature_delivery_recipients
for each row execute function public.protect_signature_delivery_recipient_write();

drop trigger if exists protect_signature_delivery_event_write on public.signature_delivery_events;
create trigger protect_signature_delivery_event_write
before insert or update or delete on public.signature_delivery_events
for each row execute function public.protect_signature_delivery_event_write();

drop policy if exists "signature_delivery_requests_select_participant_or_admin" on public.signature_delivery_requests;
create policy "signature_delivery_requests_select_participant_or_admin"
on public.signature_delivery_requests
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "signature_delivery_recipients_select_participant_or_admin" on public.signature_delivery_recipients;
create policy "signature_delivery_recipients_select_participant_or_admin"
on public.signature_delivery_recipients
for select
to authenticated
using (public.can_access_signature_delivery_request(delivery_request_id));

drop policy if exists "signature_delivery_events_select_participant_or_admin" on public.signature_delivery_events;
create policy "signature_delivery_events_select_participant_or_admin"
on public.signature_delivery_events
for select
to authenticated
using (public.can_access_signature_delivery_request(delivery_request_id));

revoke all on function public.is_trusted_signature_delivery_write() from public, anon, authenticated;
revoke all on function public.generate_signature_delivery_number() from public, anon, authenticated;
revoke all on function public.can_access_signature_delivery_request(uuid) from public, anon, authenticated;
revoke all on function public.strip_signature_delivery_event_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.insert_trusted_signature_delivery_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_signature_delivery_request_write() from public, anon, authenticated;
revoke all on function public.protect_signature_delivery_recipient_write() from public, anon, authenticated;
revoke all on function public.protect_signature_delivery_event_write() from public, anon, authenticated;
revoke all on function public.signature_delivery_participant_is_complete(public.signature_participants) from public, anon, authenticated;
revoke all on function public.build_signature_delivery_package_snapshot(public.signature_packages) from public, anon, authenticated;
revoke all on function public.build_signature_delivery_recipient_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.build_signature_delivery_payload_snapshot(public.signature_packages, jsonb) from public, anon, authenticated;
revoke all on function public.assert_signature_delivery_package_ready(uuid) from public, anon, authenticated;
revoke all on function public.assert_signature_delivery_integrity(public.signature_delivery_requests) from public, anon, authenticated;

revoke all on function public.create_signature_delivery_request(uuid) from public, anon, authenticated;
revoke all on function public.queue_signature_delivery_request(uuid) from public, anon, authenticated;
revoke all on function public.cancel_signature_delivery_request(uuid, text) from public, anon, authenticated;

grant execute on function public.can_access_signature_delivery_request(uuid) to anon, authenticated;
grant execute on function public.create_signature_delivery_request(uuid) to authenticated;
grant execute on function public.queue_signature_delivery_request(uuid) to authenticated;
grant execute on function public.cancel_signature_delivery_request(uuid, text) to authenticated;
