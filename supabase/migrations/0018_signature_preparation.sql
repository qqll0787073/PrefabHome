-- PH-008C Signature Preparation.
-- Preparation only: no sending, signing, execution, legal effectiveness, payments, invoices, shipping, or automation.

create sequence if not exists public.signature_package_number_seq;

create table if not exists public.signature_packages (
  id uuid primary key default gen_random_uuid(),
  package_number text unique not null,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_number text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'draft',
  version integer not null default 1,
  contract_snapshot jsonb not null,
  buyer_snapshot jsonb not null,
  manufacturer_snapshot jsonb not null,
  decision_snapshot jsonb not null,
  signing_content_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signature_packages_contract_unique unique (contract_id),
  constraint signature_packages_number_format_check check (package_number ~ '^SIG-[0-9]{4}-[0-9]{6}$'),
  constraint signature_packages_status_check check (status in ('draft', 'ready_to_send')),
  constraint signature_packages_version_check check (version > 0),
  constraint signature_packages_lifecycle_check check (
    (status = 'draft' and ready_at is null)
    or (status = 'ready_to_send' and ready_at is not null)
  )
);

create table if not exists public.signature_participants (
  id uuid primary key default gen_random_uuid(),
  signature_package_id uuid not null references public.signature_packages(id) on delete cascade,
  participant_role text not null,
  profile_id uuid references public.profiles(id) on delete restrict,
  organization_id uuid references public.manufacturers(id) on delete restrict,
  full_name text,
  email text,
  title text,
  signing_order integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signature_participants_role_check check (participant_role in ('buyer_signer', 'manufacturer_signer')),
  constraint signature_participants_status_check check (status = 'pending'),
  constraint signature_participants_order_check check (signing_order > 0),
  constraint signature_participants_name_length_check check (full_name is null or char_length(full_name) <= 160),
  constraint signature_participants_email_length_check check (email is null or char_length(email) <= 254),
  constraint signature_participants_email_format_check check (
    email is null
    or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint signature_participants_title_length_check check (title is null or char_length(title) <= 120),
  constraint signature_participants_role_unique unique (signature_package_id, participant_role),
  constraint signature_participants_order_unique unique (signature_package_id, signing_order),
  constraint signature_participants_fixed_order_check check (
    (participant_role = 'buyer_signer' and signing_order = 1)
    or (participant_role = 'manufacturer_signer' and signing_order = 2)
  )
);

create table if not exists public.signature_package_events (
  id uuid primary key default gen_random_uuid(),
  signature_package_id uuid not null references public.signature_packages(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint signature_package_events_type_check check (
    event_type in (
      'signature_package_created',
      'signature_participant_updated',
      'signature_package_ready'
    )
  )
);

create index if not exists signature_packages_buyer_status_idx
  on public.signature_packages (buyer_id, status, created_at desc);

create index if not exists signature_packages_manufacturer_status_idx
  on public.signature_packages (manufacturer_id, status, created_at desc);

create index if not exists signature_participants_package_order_idx
  on public.signature_participants (signature_package_id, signing_order);

create index if not exists signature_package_events_package_created_idx
  on public.signature_package_events (signature_package_id, created_at);

alter table public.signature_packages enable row level security;
alter table public.signature_participants enable row level security;
alter table public.signature_package_events enable row level security;

grant select on table public.signature_packages to authenticated;
grant select on table public.signature_participants to authenticated;
grant select on table public.signature_package_events to authenticated;
revoke all on table public.signature_packages from anon;
revoke all on table public.signature_participants from anon;
revoke all on table public.signature_package_events from anon;
revoke insert, update, delete on table public.signature_packages from authenticated;
revoke insert, update, delete on table public.signature_participants from authenticated;
revoke insert, update, delete on table public.signature_package_events from authenticated;

create or replace function public.is_trusted_signature_preparation_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.signature_preparation_trusted_write', true), '') = 'on';
$$;

create or replace function public.generate_signature_package_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.signature_package_number_seq');
  return 'SIG-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.can_access_signature_package(package_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.signature_packages sp
    where sp.id = package_uuid
      and (
        sp.buyer_id = auth.uid()
        or public.owns_manufacturer(sp.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.insert_trusted_signature_package_event(
  package_uuid uuid,
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
    'signature_package_created',
    'signature_participant_updated',
    'signature_package_ready'
  ) then
    raise exception 'Signature package event type must be generated by a trusted flow.';
  end if;

  insert into public.signature_package_events (
    signature_package_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    package_uuid,
    event_name,
    actor_uuid,
    coalesce(event_metadata, '{}'::jsonb)
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role'
      - 'buyer_id'
      - 'manufacturer_id'
      - 'profile_id'
      - 'organization_id'
  );
end;
$$;

create or replace function public.protect_signature_package_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Signature packages are auditable and cannot be deleted.';
  end if;

  new.updated_at := now();

  if public.is_trusted_signature_preparation_write() then
    return new;
  end if;

  raise exception 'Signature packages must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_signature_participant_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Signature participants are auditable and cannot be deleted.';
  end if;

  new.full_name := nullif(btrim(coalesce(new.full_name, '')), '');
  new.email := lower(nullif(btrim(coalesce(new.email, '')), ''));
  new.title := nullif(btrim(coalesce(new.title, '')), '');
  new.updated_at := now();

  if public.is_trusted_signature_preparation_write() then
    return new;
  end if;

  raise exception 'Signature participants must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_signature_package_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Signature package events are immutable and cannot be changed.';
  end if;

  if public.is_trusted_signature_preparation_write() then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role'
      - 'buyer_id'
      - 'manufacturer_id'
      - 'profile_id'
      - 'organization_id';
    return new;
  end if;

  raise exception 'Signature package events must be generated by trusted flows.';
end;
$$;

create or replace function public.signature_participant_is_complete(
  participant public.signature_participants
)
returns boolean
language sql
immutable
as $$
  select participant.full_name is not null
    and btrim(participant.full_name) <> ''
    and participant.email is not null
    and participant.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
$$;

create or replace function public.build_signature_contract_snapshot(
  contract_record public.contracts
)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'contract_id', contract_record.id,
    'contract_number', contract_record.contract_number,
    'status', contract_record.status,
    'review_round', contract_record.review_round,
    'contract_title', contract_record.contract_title,
    'governing_law', contract_record.governing_law,
    'contract_terms', contract_record.contract_terms,
    'po_number', contract_record.po_number,
    'currency', contract_record.currency,
    'subtotal', contract_record.subtotal,
    'ready_at', contract_record.ready_at,
    'first_ready_at', contract_record.first_ready_at,
    'last_ready_at', contract_record.last_ready_at,
    'accepted_at', contract_record.accepted_at
  ))
$$;

create or replace function public.build_signature_decision_snapshot(
  decision_record public.contract_review_decisions
)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'decision_id', decision_record.id,
    'contract_id', decision_record.contract_id,
    'review_round', decision_record.review_round,
    'manufacturer_id', decision_record.manufacturer_id,
    'actor_profile_id', decision_record.actor_profile_id,
    'decision', decision_record.decision,
    'reason', decision_record.reason,
    'created_at', decision_record.created_at
  ))
$$;

create or replace function public.build_signature_signing_content_snapshot(
  contract_record public.contracts
)
returns jsonb
language sql
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'contract_title', contract_record.contract_title,
    'governing_law', contract_record.governing_law,
    'contract_terms', contract_record.contract_terms,
    'purchase_order_snapshot', contract_record.purchase_order_snapshot,
    'quote_snapshot', contract_record.quote_snapshot,
    'product_snapshot', contract_record.product_snapshot,
    'line_items_snapshot', contract_record.line_items_snapshot
  ))
$$;

create or replace function public.validate_signature_participant_input(
  full_name_text text,
  email_text text,
  title_text text
)
returns void
language plpgsql
stable
as $$
declare
  normalized_name text := nullif(btrim(coalesce(full_name_text, '')), '');
  normalized_email text := lower(nullif(btrim(coalesce(email_text, '')), ''));
  normalized_title text := nullif(btrim(coalesce(title_text, '')), '');
begin
  if normalized_name is null then
    raise exception 'Signer name is required.';
  end if;

  if char_length(normalized_name) > 160 then
    raise exception 'Signer name must be 160 characters or fewer.';
  end if;

  if normalized_email is null then
    raise exception 'Signer email is required.';
  end if;

  if char_length(normalized_email) > 254
    or normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  then
    raise exception 'Signer email must be valid.';
  end if;

  if normalized_title is not null and char_length(normalized_title) > 120 then
    raise exception 'Signer title must be 120 characters or fewer.';
  end if;
end;
$$;

create or replace function public.create_signature_package(contract_uuid uuid)
returns public.signature_packages
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
  decision_record public.contract_review_decisions%rowtype;
  package_record public.signature_packages%rowtype;
  manufacturer_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if public.current_profile_role() <> 'buyer' then
    raise exception 'Only buyers can create signature packages.';
  end if;

  select * into contract_record
  from public.contracts
  where id = contract_uuid
  for update;

  if not found then
    raise exception 'Contract does not exist.';
  end if;

  if contract_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the contract buyer can create this signature package.';
  end if;

  if contract_record.status <> 'accepted' then
    raise exception 'Signature packages can be created only from accepted contracts.';
  end if;

  select * into decision_record
  from public.contract_review_decisions
  where contract_id = contract_record.id
    and review_round = contract_record.review_round
    and decision = 'accepted'
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Accepted contract decision is required before signature preparation.';
  end if;

  if exists (select 1 from public.signature_packages where contract_id = contract_record.id) then
    raise exception 'A signature package already exists for this contract.';
  end if;

  select owner_id into manufacturer_owner
  from public.manufacturers
  where id = contract_record.manufacturer_id;

  perform set_config('app.signature_preparation_trusted_write', 'on', true);

  insert into public.signature_packages (
    package_number,
    contract_id,
    contract_number,
    buyer_id,
    manufacturer_id,
    status,
    version,
    contract_snapshot,
    buyer_snapshot,
    manufacturer_snapshot,
    decision_snapshot,
    signing_content_snapshot,
    created_by
  )
  values (
    public.generate_signature_package_number(),
    contract_record.id,
    contract_record.contract_number,
    contract_record.buyer_id,
    contract_record.manufacturer_id,
    'draft',
    1,
    public.build_signature_contract_snapshot(contract_record),
    contract_record.buyer_snapshot,
    contract_record.manufacturer_snapshot,
    public.build_signature_decision_snapshot(decision_record),
    public.build_signature_signing_content_snapshot(contract_record),
    auth.uid()
  )
  returning * into package_record;

  insert into public.signature_participants (
    signature_package_id,
    participant_role,
    profile_id,
    organization_id,
    signing_order,
    status
  )
  values
    (package_record.id, 'buyer_signer', contract_record.buyer_id, null, 1, 'pending'),
    (package_record.id, 'manufacturer_signer', manufacturer_owner, contract_record.manufacturer_id, 2, 'pending');

  perform public.insert_trusted_signature_package_event(
    package_record.id,
    'signature_package_created',
    auth.uid(),
    jsonb_build_object(
      'package_number', package_record.package_number,
      'contract_number', package_record.contract_number
    )
  );

  perform set_config('app.signature_preparation_trusted_write', '', true);

  return package_record;
exception when others then
  perform set_config('app.signature_preparation_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_signature_participant(
  package_uuid uuid,
  participant_role_name text,
  full_name_text text,
  email_text text,
  title_text text
)
returns public.signature_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  package_record public.signature_packages%rowtype;
  participant_record public.signature_participants%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if participant_role_name not in ('buyer_signer', 'manufacturer_signer') then
    raise exception 'Unsupported signature participant role.';
  end if;

  perform public.validate_signature_participant_input(full_name_text, email_text, title_text);

  select * into package_record
  from public.signature_packages
  where id = package_uuid
  for update;

  if not found then
    raise exception 'Signature package does not exist.';
  end if;

  if package_record.status <> 'draft' then
    raise exception 'Only draft signature packages can be changed.';
  end if;

  if participant_role_name = 'buyer_signer' then
    if package_record.buyer_id is distinct from auth.uid() then
      raise exception 'Only the buyer can update the buyer signer.';
    end if;
  else
    if not public.owns_manufacturer(package_record.manufacturer_id) then
      raise exception 'Only the assigned manufacturer can update the manufacturer signer.';
    end if;
  end if;

  perform set_config('app.signature_preparation_trusted_write', 'on', true);

  update public.signature_participants
  set full_name = full_name_text,
      email = email_text,
      title = title_text
  where signature_package_id = package_record.id
    and participant_role = participant_role_name
  returning * into participant_record;

  if not found then
    raise exception 'Signature participant does not exist.';
  end if;

  perform public.insert_trusted_signature_package_event(
    package_record.id,
    'signature_participant_updated',
    auth.uid(),
    jsonb_build_object(
      'package_number', package_record.package_number,
      'contract_number', package_record.contract_number,
      'participant_role', participant_record.participant_role
    )
  );

  perform set_config('app.signature_preparation_trusted_write', '', true);

  return participant_record;
exception when others then
  perform set_config('app.signature_preparation_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_buyer_signature_participant(
  package_uuid uuid,
  full_name_text text,
  email_text text,
  title_text text
)
returns public.signature_participants
language sql
security definer
set search_path = public
as $$
  select public.update_signature_participant(package_uuid, 'buyer_signer', full_name_text, email_text, title_text)
$$;

create or replace function public.update_manufacturer_signature_participant(
  package_uuid uuid,
  full_name_text text,
  email_text text,
  title_text text
)
returns public.signature_participants
language sql
security definer
set search_path = public
as $$
  select public.update_signature_participant(package_uuid, 'manufacturer_signer', full_name_text, email_text, title_text)
$$;

create or replace function public.mark_signature_package_ready(package_uuid uuid)
returns public.signature_packages
language plpgsql
security definer
set search_path = public
as $$
declare
  package_record public.signature_packages%rowtype;
  contract_record public.contracts%rowtype;
  buyer_participant public.signature_participants%rowtype;
  manufacturer_participant public.signature_participants%rowtype;
  ready_timestamp timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into package_record
  from public.signature_packages
  where id = package_uuid
  for update;

  if not found then
    raise exception 'Signature package does not exist.';
  end if;

  if package_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the buyer can mark this signature package ready.';
  end if;

  if package_record.status <> 'draft' then
    raise exception 'Only draft signature packages can be marked ready to send.';
  end if;

  select * into contract_record
  from public.contracts
  where id = package_record.contract_id;

  if not found or contract_record.status <> 'accepted' then
    raise exception 'Contract must still be accepted before signature preparation is ready.';
  end if;

  select * into buyer_participant
  from public.signature_participants
  where signature_package_id = package_record.id
    and participant_role = 'buyer_signer';

  if not found or not public.signature_participant_is_complete(buyer_participant) then
    raise exception 'Buyer signer must be complete before marking ready to send.';
  end if;

  select * into manufacturer_participant
  from public.signature_participants
  where signature_package_id = package_record.id
    and participant_role = 'manufacturer_signer';

  if not found or not public.signature_participant_is_complete(manufacturer_participant) then
    raise exception 'Manufacturer signer must be complete before marking ready to send.';
  end if;

  if package_record.contract_snapshot is null
    or package_record.buyer_snapshot is null
    or package_record.manufacturer_snapshot is null
    or package_record.decision_snapshot is null
    or package_record.signing_content_snapshot is null
  then
    raise exception 'Signature package snapshots must be complete.';
  end if;

  perform set_config('app.signature_preparation_trusted_write', 'on', true);

  update public.signature_packages
  set status = 'ready_to_send',
      ready_at = ready_timestamp
  where id = package_record.id
    and status = 'draft'
  returning * into package_record;

  perform public.insert_trusted_signature_package_event(
    package_record.id,
    'signature_package_ready',
    auth.uid(),
    jsonb_build_object(
      'package_number', package_record.package_number,
      'contract_number', package_record.contract_number
    )
  );

  perform set_config('app.signature_preparation_trusted_write', '', true);

  return package_record;
exception when others then
  perform set_config('app.signature_preparation_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_signature_package_write on public.signature_packages;
create trigger protect_signature_package_write
before insert or update or delete on public.signature_packages
for each row execute function public.protect_signature_package_write();

drop trigger if exists protect_signature_participant_write on public.signature_participants;
create trigger protect_signature_participant_write
before insert or update or delete on public.signature_participants
for each row execute function public.protect_signature_participant_write();

drop trigger if exists protect_signature_package_event_write on public.signature_package_events;
create trigger protect_signature_package_event_write
before insert or update or delete on public.signature_package_events
for each row execute function public.protect_signature_package_event_write();

drop policy if exists "signature_packages_select_participant_or_admin" on public.signature_packages;
create policy "signature_packages_select_participant_or_admin"
on public.signature_packages
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "signature_participants_select_participant_or_admin" on public.signature_participants;
create policy "signature_participants_select_participant_or_admin"
on public.signature_participants
for select
to authenticated
using (public.can_access_signature_package(signature_package_id));

drop policy if exists "signature_package_events_select_participant_or_admin" on public.signature_package_events;
create policy "signature_package_events_select_participant_or_admin"
on public.signature_package_events
for select
to authenticated
using (public.can_access_signature_package(signature_package_id));

revoke all on function public.is_trusted_signature_preparation_write() from public, anon, authenticated;
revoke all on function public.generate_signature_package_number() from public, anon, authenticated;
revoke all on function public.can_access_signature_package(uuid) from public, anon, authenticated;
revoke all on function public.insert_trusted_signature_package_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_signature_package_write() from public, anon, authenticated;
revoke all on function public.protect_signature_participant_write() from public, anon, authenticated;
revoke all on function public.protect_signature_package_event_write() from public, anon, authenticated;
revoke all on function public.signature_participant_is_complete(public.signature_participants) from public, anon, authenticated;
revoke all on function public.build_signature_contract_snapshot(public.contracts) from public, anon, authenticated;
revoke all on function public.build_signature_decision_snapshot(public.contract_review_decisions) from public, anon, authenticated;
revoke all on function public.build_signature_signing_content_snapshot(public.contracts) from public, anon, authenticated;
revoke all on function public.validate_signature_participant_input(text, text, text) from public, anon, authenticated;
revoke all on function public.update_signature_participant(uuid, text, text, text, text) from public, anon, authenticated;

revoke all on function public.create_signature_package(uuid) from public, anon, authenticated;
revoke all on function public.update_buyer_signature_participant(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_manufacturer_signature_participant(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_signature_package_ready(uuid) from public, anon, authenticated;

grant execute on function public.can_access_signature_package(uuid) to anon, authenticated;
grant execute on function public.create_signature_package(uuid) to authenticated;
grant execute on function public.update_buyer_signature_participant(uuid, text, text, text) to authenticated;
grant execute on function public.update_manufacturer_signature_participant(uuid, text, text, text) to authenticated;
grant execute on function public.mark_signature_package_ready(uuid) to authenticated;
