begin;

-- PH-008B Contract Participant Review.
-- Additive review-round workflow for Buyer-ready contracts.
-- Manufacturer acceptance means content acceptance only; it is not signing,
-- execution, legal effectiveness, payment, invoice, shipping, or automation.

alter table public.contracts
  add column if not exists review_round integer not null default 0,
  add column if not exists first_ready_at timestamptz,
  add column if not exists last_ready_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz;

select set_config('app.contract_trusted_write', 'on', true);

update public.contracts
set review_round = 1,
    first_ready_at = coalesce(first_ready_at, ready_at, updated_at, created_at, now()),
    last_ready_at = coalesce(last_ready_at, ready_at, updated_at, created_at, now()),
    ready_at = coalesce(ready_at, last_ready_at, updated_at, created_at, now())
where status = 'ready'
  and review_round = 0;

select set_config('app.contract_trusted_write', '', true);

create table if not exists public.contract_review_decisions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  review_round integer not null,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint contract_review_decisions_decision_check
    check (decision in ('accepted', 'rejected', 'revision_requested')),
  constraint contract_review_decisions_round_check check (review_round > 0),
  constraint contract_review_decisions_reason_length_check
    check (reason is null or char_length(reason) <= 4000),
  constraint contract_review_decisions_reason_required_check check (
    decision = 'accepted'
    or (reason is not null and btrim(reason) <> '')
  ),
  constraint contract_review_decisions_one_per_round_unique unique (contract_id, review_round)
);

create index if not exists contract_review_decisions_contract_created_idx
  on public.contract_review_decisions (contract_id, created_at);

create index if not exists contract_review_decisions_manufacturer_created_idx
  on public.contract_review_decisions (manufacturer_id, created_at desc);

alter table public.contract_review_decisions enable row level security;

grant select on table public.contract_review_decisions to authenticated;
revoke all on table public.contract_review_decisions from anon;
revoke insert, update, delete on table public.contract_review_decisions from authenticated;

alter table public.contracts
  drop constraint if exists contracts_status_check,
  drop constraint if exists contracts_review_lifecycle_check,
  drop constraint if exists contracts_ready_timestamp_check;

alter table public.contracts
  add constraint contracts_status_check
  check (status in ('draft', 'ready', 'participant_review', 'revision_requested', 'accepted', 'rejected'));

alter table public.contracts
  add constraint contracts_review_lifecycle_check
  check (
    (
      status = 'draft'
      and review_round = 0
      and ready_at is null
      and first_ready_at is null
      and last_ready_at is null
      and accepted_at is null
      and rejected_at is null
    )
    or (
      status in ('ready', 'participant_review', 'revision_requested')
      and review_round > 0
      and ready_at is not null
      and first_ready_at is not null
      and last_ready_at is not null
      and ready_at = last_ready_at
      and accepted_at is null
      and rejected_at is null
    )
    or (
      status = 'accepted'
      and review_round > 0
      and ready_at is not null
      and first_ready_at is not null
      and last_ready_at is not null
      and ready_at = last_ready_at
      and accepted_at is not null
      and rejected_at is null
    )
    or (
      status = 'rejected'
      and review_round > 0
      and ready_at is not null
      and first_ready_at is not null
      and last_ready_at is not null
      and ready_at = last_ready_at
      and accepted_at is null
      and rejected_at is not null
    )
  );

alter table public.contract_events
  drop constraint if exists contract_events_type_check;

alter table public.contract_events
  add constraint contract_events_type_check
  check (
    event_type in (
      'contract_created',
      'contract_updated',
      'contract_ready',
      'contract_participant_opened',
      'contract_revision_requested',
      'contract_resubmitted',
      'contract_accepted',
      'contract_rejected'
    )
  );

create or replace function public.is_trusted_contract_decision_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.contract_decision_trusted_write', true), '') = 'on';
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
  if event_name not in (
    'contract_created',
    'contract_updated',
    'contract_ready',
    'contract_participant_opened',
    'contract_revision_requested',
    'contract_resubmitted',
    'contract_accepted',
    'contract_rejected'
  ) then
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
  if tg_op <> 'INSERT' then
    raise exception 'Contract events are immutable and cannot be changed.';
  end if;

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

create or replace function public.protect_contract_review_decision_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Contract review decisions are immutable and cannot be changed.';
  end if;

  if not public.is_trusted_contract_decision_write() then
    raise exception 'Contract review decisions must be generated by trusted RPCs.';
  end if;

  new.reason := nullif(btrim(coalesce(new.reason, '')), '');
  return new;
end;
$$;

drop trigger if exists protect_contract_review_decision_write on public.contract_review_decisions;
create trigger protect_contract_review_decision_write
before insert or update or delete on public.contract_review_decisions
for each row execute function public.protect_contract_review_decision_write();

create or replace function public.mark_contract_ready(contract_uuid uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
  ready_timestamp timestamptz := now();
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
      review_round = 1,
      first_ready_at = ready_timestamp,
      last_ready_at = ready_timestamp,
      ready_at = ready_timestamp,
      accepted_at = null,
      rejected_at = null
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
    jsonb_build_object('contract_number', contract_record.contract_number, 'review_round', contract_record.review_round)
  );

  perform set_config('app.contract_trusted_write', '', true);

  return contract_record;
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.record_contract_opened(contract_uuid uuid)
returns void
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

  if not public.owns_manufacturer(contract_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can open this contract for review.';
  end if;

  if contract_record.status not in ('ready', 'participant_review') then
    raise exception 'Only ready contracts can be opened for participant review.';
  end if;

  perform set_config('app.contract_trusted_write', 'on', true);

  if contract_record.status = 'ready' then
    update public.contracts
    set status = 'participant_review'
    where id = contract_record.id
    returning * into contract_record;
  end if;

  if not exists (
    select 1
    from public.contract_events e
    where e.contract_id = contract_record.id
      and e.event_type = 'contract_participant_opened'
      and e.actor_profile_id = auth.uid()
      and (e.metadata->>'review_round')::integer = contract_record.review_round
  ) then
    perform public.insert_trusted_contract_event(
      contract_record.id,
      'contract_participant_opened',
      auth.uid(),
      jsonb_build_object('contract_number', contract_record.contract_number, 'review_round', contract_record.review_round)
    );
  end if;

  perform set_config('app.contract_trusted_write', '', true);
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.decide_contract_review(
  contract_uuid uuid,
  decision_name text,
  reason_text text default null
)
returns public.contract_review_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
  decision_record public.contract_review_decisions%rowtype;
  normalized_reason text := nullif(btrim(coalesce(reason_text, '')), '');
  event_name text;
  decision_timestamp timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if decision_name not in ('accepted', 'rejected', 'revision_requested') then
    raise exception 'Unsupported contract decision.';
  end if;

  if decision_name in ('rejected', 'revision_requested') and normalized_reason is null then
    raise exception 'A reason is required.';
  end if;

  if normalized_reason is not null and char_length(normalized_reason) > 4000 then
    raise exception 'Reason must be 4000 characters or fewer.';
  end if;

  select * into contract_record
  from public.contracts
  where id = contract_uuid
  for update;

  if not found then
    raise exception 'Contract does not exist.';
  end if;

  if not public.owns_manufacturer(contract_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can review this contract.';
  end if;

  if contract_record.status <> 'participant_review' then
    raise exception 'Contract must be in participant review.';
  end if;

  if exists (
    select 1
    from public.contract_review_decisions d
    where d.contract_id = contract_record.id
      and d.review_round = contract_record.review_round
  ) then
    raise exception 'A decision already exists for this review round.';
  end if;

  perform set_config('app.contract_decision_trusted_write', 'on', true);
  insert into public.contract_review_decisions (
    contract_id,
    review_round,
    manufacturer_id,
    actor_profile_id,
    decision,
    reason
  )
  values (
    contract_record.id,
    contract_record.review_round,
    contract_record.manufacturer_id,
    auth.uid(),
    decision_name,
    normalized_reason
  )
  returning * into decision_record;
  perform set_config('app.contract_decision_trusted_write', '', true);

  perform set_config('app.contract_trusted_write', 'on', true);

  if decision_name = 'accepted' then
    update public.contracts
    set status = 'accepted',
        accepted_at = decision_timestamp,
        rejected_at = null
    where id = contract_record.id
    returning * into contract_record;
    event_name := 'contract_accepted';
  elsif decision_name = 'rejected' then
    update public.contracts
    set status = 'rejected',
        rejected_at = decision_timestamp,
        accepted_at = null
    where id = contract_record.id
    returning * into contract_record;
    event_name := 'contract_rejected';
  else
    update public.contracts
    set status = 'revision_requested',
        accepted_at = null,
        rejected_at = null
    where id = contract_record.id
    returning * into contract_record;
    event_name := 'contract_revision_requested';
  end if;

  perform public.insert_trusted_contract_event(
    contract_record.id,
    event_name,
    auth.uid(),
    jsonb_build_object(
      'contract_number', contract_record.contract_number,
      'review_round', decision_record.review_round,
      'decision_id', decision_record.id
    )
  );

  perform set_config('app.contract_trusted_write', '', true);

  return decision_record;
exception when others then
  perform set_config('app.contract_decision_trusted_write', '', true);
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.accept_contract(
  contract_uuid uuid,
  note_text text default null
)
returns public.contract_review_decisions
language sql
security definer
set search_path = public
as $$
  select public.decide_contract_review(contract_uuid, 'accepted', note_text)
$$;

create or replace function public.reject_contract(
  contract_uuid uuid,
  reason_text text
)
returns public.contract_review_decisions
language sql
security definer
set search_path = public
as $$
  select public.decide_contract_review(contract_uuid, 'rejected', reason_text)
$$;

create or replace function public.request_contract_revision(
  contract_uuid uuid,
  reason_text text
)
returns public.contract_review_decisions
language sql
security definer
set search_path = public
as $$
  select public.decide_contract_review(contract_uuid, 'revision_requested', reason_text)
$$;

create or replace function public.update_contract_revision(
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
    raise exception 'Only the buyer can update this contract revision.';
  end if;

  if contract_record.status <> 'revision_requested' then
    raise exception 'Only revision-requested contracts can be updated.';
  end if;

  if not exists (
    select 1
    from public.contract_review_decisions d
    where d.contract_id = contract_record.id
      and d.review_round = contract_record.review_round
      and d.decision = 'revision_requested'
  ) then
    raise exception 'A revision request decision is required before updating the contract.';
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
    jsonb_build_object('contract_number', contract_record.contract_number, 'review_round', contract_record.review_round)
  );

  perform set_config('app.contract_trusted_write', '', true);

  return contract_record;
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.resubmit_contract(contract_uuid uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_record public.contracts%rowtype;
  resubmitted_at timestamptz := now();
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
    raise exception 'Only the buyer can resubmit this contract.';
  end if;

  if contract_record.status <> 'revision_requested' then
    raise exception 'Only revision-requested contracts can be resubmitted.';
  end if;

  if contract_record.contract_title is null then
    raise exception 'Contract title is required before resubmission.';
  end if;

  if not exists (
    select 1
    from public.contract_review_decisions d
    where d.contract_id = contract_record.id
      and d.review_round = contract_record.review_round
      and d.decision = 'revision_requested'
  ) then
    raise exception 'A revision request decision is required before resubmission.';
  end if;

  perform set_config('app.contract_trusted_write', 'on', true);

  update public.contracts
  set status = 'ready',
      review_round = contract_record.review_round + 1,
      first_ready_at = contract_record.first_ready_at,
      last_ready_at = resubmitted_at,
      ready_at = resubmitted_at,
      accepted_at = null,
      rejected_at = null
  where id = contract_record.id
  returning * into contract_record;

  perform public.insert_trusted_contract_event(
    contract_record.id,
    'contract_resubmitted',
    auth.uid(),
    jsonb_build_object('contract_number', contract_record.contract_number, 'review_round', contract_record.review_round)
  );

  perform set_config('app.contract_trusted_write', '', true);

  return contract_record;
exception when others then
  perform set_config('app.contract_trusted_write', '', true);
  raise;
end;
$$;

drop policy if exists "contract_review_decisions_select_participant_or_admin" on public.contract_review_decisions;
create policy "contract_review_decisions_select_participant_or_admin"
on public.contract_review_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.contracts c
    where c.id = contract_review_decisions.contract_id
      and (
        c.buyer_id = auth.uid()
        or public.owns_manufacturer(c.manufacturer_id)
        or public.is_admin()
      )
  )
);

revoke all on function public.is_trusted_contract_decision_write() from public, anon, authenticated;
revoke all on function public.protect_contract_review_decision_write() from public, anon, authenticated;
revoke all on function public.decide_contract_review(uuid, text, text) from public, anon, authenticated;

revoke all on function public.record_contract_opened(uuid) from public, anon, authenticated;
revoke all on function public.accept_contract(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_contract(uuid, text) from public, anon, authenticated;
revoke all on function public.request_contract_revision(uuid, text) from public, anon, authenticated;
revoke all on function public.update_contract_revision(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.resubmit_contract(uuid) from public, anon, authenticated;

grant execute on function public.record_contract_opened(uuid) to authenticated;
grant execute on function public.accept_contract(uuid, text) to authenticated;
grant execute on function public.reject_contract(uuid, text) to authenticated;
grant execute on function public.request_contract_revision(uuid, text) to authenticated;
grant execute on function public.update_contract_revision(uuid, text, text, text) to authenticated;
grant execute on function public.resubmit_contract(uuid) to authenticated;

create temp table contract_participant_review_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table contract_participant_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant all on table contract_participant_review_results to authenticated, anon;
grant all on table contract_participant_subjects to authenticated, anon;

do $$
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
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'contract-review-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Review Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_buyer_id, 'authenticated', 'authenticated', 'contract-review-other-buyer-' || other_buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Contract Review Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_id, 'authenticated', 'authenticated', 'contract-review-manufacturer-' || manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Review Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_id, 'authenticated', 'authenticated', 'contract-review-other-manufacturer-' || other_manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Contract Review Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'contract-review-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Contract Review Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into contract_participant_subjects(subject_name, subject_id)
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

create or replace function pg_temp.create_ready_contract(
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
  po_uuid uuid;
  contract_uuid uuid;
begin
  po_uuid := pg_temp.create_confirmed_po(label_text, buyer_uuid, manufacturer_owner_uuid, manufacturer_uuid, product_uuid);
  perform set_config('request.jwt.claim.sub', buyer_uuid::text, true);
  select id into contract_uuid from public.create_contract_from_po(po_uuid);
  perform public.update_contract_draft(contract_uuid, label_text || ' contract', 'Delaware', label_text || ' terms');
  perform public.mark_contract_ready(contract_uuid);
  return contract_uuid;
end;
$$;

do $$
<<contract_review_checks>>
declare
  buyer_id uuid;
  other_buyer_id uuid;
  manufacturer_owner_id uuid;
  other_manufacturer_owner_id uuid;
  admin_id uuid;
  manufacturer_uuid uuid;
  other_manufacturer_uuid uuid;
  product_uuid uuid;
  open_contract_id uuid;
  decision_contract_id uuid;
  accept_contract_id uuid;
  reject_contract_id uuid;
  revision_contract_id uuid;
  direct_contract_id uuid;
  decision_id uuid;
  second_decision_id uuid;
  visible_count integer := 0;
  event_count integer := 0;
  decision_count integer := 0;
  blocked boolean := false;
  before_first_ready timestamptz;
  before_last_ready timestamptz;
  before_snapshot jsonb;
  after_snapshot jsonb;
  before_round integer;
  after_round integer;
begin
  select subject_id into buyer_id from contract_participant_subjects where subject_name = 'buyer';
  select subject_id into other_buyer_id from contract_participant_subjects where subject_name = 'other_buyer';
  select subject_id into manufacturer_owner_id from contract_participant_subjects where subject_name = 'manufacturer_owner';
  select subject_id into other_manufacturer_owner_id from contract_participant_subjects where subject_name = 'other_manufacturer_owner';
  select subject_id into admin_id from contract_participant_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_id, 'Contract Review Factory Legal', 'Contract Review Factory', 'China', 'draft')
  returning id into manufacturer_uuid;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_id, 'Other Contract Review Factory Legal', 'Other Contract Review Factory', 'Vietnam', 'draft')
  returning id into other_manufacturer_uuid;

  update public.manufacturers
  set application_status = 'approved',
      reviewed_by = admin_id,
      reviewed_at = now()
  where id in (manufacturer_uuid, other_manufacturer_uuid);

  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_uuid, 'Contract Review Home', 'Contract Review Model', 'Modular', 'Contract review verification product.', 'USD', 'draft')
  returning id into product_uuid;

  open_contract_id := pg_temp.create_ready_contract('open flow', buyer_id, manufacturer_owner_id, manufacturer_uuid, product_uuid);
  decision_contract_id := pg_temp.create_ready_contract('decision denial flow', buyer_id, manufacturer_owner_id, manufacturer_uuid, product_uuid);
  accept_contract_id := pg_temp.create_ready_contract('accept flow', buyer_id, manufacturer_owner_id, manufacturer_uuid, product_uuid);
  reject_contract_id := pg_temp.create_ready_contract('reject flow', buyer_id, manufacturer_owner_id, manufacturer_uuid, product_uuid);
  revision_contract_id := pg_temp.create_ready_contract('revision flow', buyer_id, manufacturer_owner_id, manufacturer_uuid, product_uuid);
  direct_contract_id := pg_temp.create_ready_contract('direct flow', buyer_id, manufacturer_owner_id, manufacturer_uuid, product_uuid);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.record_contract_opened(open_contract_id);
  insert into contract_participant_review_results values (
    'assigned Manufacturer opens ready Contract',
    exists (select 1 from public.contracts where id = open_contract_id and status = 'participant_review'),
    'opened'
  );

  insert into contract_participant_review_results values (
    'ready to participant_review transition',
    exists (select 1 from public.contracts where id = open_contract_id and status = 'participant_review' and review_round = 1),
    'transition checked'
  );

  perform public.record_contract_opened(open_contract_id);
  select count(*) into event_count
  from public.contract_events e
  where e.contract_id = open_contract_id
    and e.event_type = 'contract_participant_opened'
    and (e.metadata->>'review_round')::integer = 1;
  insert into contract_participant_review_results values ('duplicate open per round deduped', event_count = 1, 'events: ' || event_count);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.record_contract_opened(open_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('other Manufacturer open denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  blocked := false;
  begin
    perform public.record_contract_opened(open_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Buyer open denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  blocked := false;
  begin
    perform public.record_contract_opened(open_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Admin open denied', blocked, 'blocked: ' || blocked);

  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    perform public.record_contract_opened(open_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Anonymous open denied', blocked, 'blocked: ' || blocked);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.record_contract_opened(decision_contract_id);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.accept_contract(decision_contract_id, 'other');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('other Manufacturer decision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  blocked := false;
  begin
    perform public.accept_contract(decision_contract_id, 'buyer');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Buyer decision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  blocked := false;
  begin
    perform public.accept_contract(decision_contract_id, 'admin');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Admin decision denied', blocked, 'blocked: ' || blocked);

  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    perform public.accept_contract(decision_contract_id, 'anon');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Anonymous decision denied', blocked, 'blocked: ' || blocked);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select id into decision_id from public.accept_contract(decision_contract_id, 'content accepted');
  insert into contract_participant_review_results values (
    'accept assigned Contract',
    exists (select 1 from public.contracts where id = decision_contract_id and status = 'accepted' and accepted_at is not null and rejected_at is null),
    'accepted'
  );

  insert into contract_participant_review_results values (
    'actor Manufacturer round timestamp database-derived',
    exists (
      select 1
      from public.contract_review_decisions d
      where d.id = decision_id
        and d.contract_id = decision_contract_id
        and d.manufacturer_id = manufacturer_uuid
        and d.actor_profile_id = manufacturer_owner_id
        and d.review_round = 1
        and d.created_at is not null
    ),
    'derived fields checked'
  );

  blocked := false;
  begin
    perform public.reject_contract(decision_contract_id, 'duplicate');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('concurrent duplicate decision denied', blocked, 'blocked: ' || blocked);

  perform public.record_contract_opened(accept_contract_id);
  select id into second_decision_id from public.accept_contract(accept_contract_id, null);
  insert into contract_participant_review_results values (
    'accept optional note allowed',
    exists (select 1 from public.contract_review_decisions where id = second_decision_id and decision = 'accepted'),
    'accepted'
  );

  perform public.record_contract_opened(reject_contract_id);
  blocked := false;
  begin
    perform public.reject_contract(reject_contract_id, '');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('reject reason required', blocked, 'blocked: ' || blocked);
  perform public.reject_contract(reject_contract_id, 'Rejected for rollback verification.');
  insert into contract_participant_review_results values (
    'reject assigned Contract',
    exists (select 1 from public.contracts where id = reject_contract_id and status = 'rejected' and rejected_at is not null and accepted_at is null),
    'rejected'
  );

  perform public.record_contract_opened(revision_contract_id);
  blocked := false;
  begin
    perform public.request_contract_revision(revision_contract_id, '');
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('revision reason required', blocked, 'blocked: ' || blocked);
  perform public.request_contract_revision(revision_contract_id, 'Please clarify governing law.');
  insert into contract_participant_review_results values (
    'request revision assigned Contract',
    exists (select 1 from public.contracts where id = revision_contract_id and status = 'revision_requested' and review_round = 1),
    'revision requested'
  );

  blocked := false;
  begin
    update public.contract_review_decisions set reason = 'changed' where contract_id = revision_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('decision rows immutable', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    delete from public.contract_review_decisions where contract_id = revision_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('decision rows undeletable', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.contracts set contract_title = 'blocked accepted' where id = decision_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('accepted Contract immutable', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.contracts set contract_title = 'blocked rejected' where id = reject_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('rejected Contract immutable', blocked, 'blocked: ' || blocked);

  select line_items_snapshot into before_snapshot from public.contracts where id = revision_contract_id;
  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform public.update_contract_revision(revision_contract_id, 'Revision Title', 'New York', 'Revision terms');
  select line_items_snapshot into after_snapshot from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('Buyer limited revision update allowed', after_snapshot = before_snapshot, 'snapshot preserved');

  insert into contract_participant_review_results values (
    'revision-requested commercial snapshots immutable',
    exists (
      select 1
      from public.contracts
      where id = revision_contract_id
        and currency = 'USD'
        and subtotal = 100000
        and line_items_snapshot = before_snapshot
    ),
    'commercial fields checked'
  );

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);
  blocked := false;
  begin
    perform public.update_contract_revision(revision_contract_id, 'Other Buyer', null, null);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('other Buyer revision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.update_contract_revision(revision_contract_id, 'Manufacturer', null, null);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Manufacturer revision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  blocked := false;
  begin
    perform public.update_contract_revision(revision_contract_id, 'Admin', null, null);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Admin revision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select review_round, first_ready_at, last_ready_at into before_round, before_first_ready, before_last_ready
  from public.contracts where id = revision_contract_id;
  perform public.resubmit_contract(revision_contract_id);
  select review_round, line_items_snapshot into after_round, after_snapshot from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('Buyer resubmit allowed', exists (select 1 from public.contracts where id = revision_contract_id and status = 'ready'), 'ready');
  insert into contract_participant_review_results values ('resubmit increments round', after_round = before_round + 1, 'round: ' || after_round);
  insert into contract_participant_review_results values (
    'first-ready timestamp preserved',
    exists (select 1 from public.contracts where id = revision_contract_id and first_ready_at = before_first_ready),
    'first_ready_at checked'
  );
  insert into contract_participant_review_results values (
    'last-ready timestamp updated',
    exists (select 1 from public.contracts where id = revision_contract_id and last_ready_at is not null and last_ready_at >= before_last_ready),
    'last_ready_at checked'
  );
  insert into contract_participant_review_results values ('resubmit returns ready', exists (select 1 from public.contracts where id = revision_contract_id and status = 'ready'), 'ready');
  insert into contract_participant_review_results values (
    'trusted resubmit event',
    exists (select 1 from public.contract_events where contract_id = revision_contract_id and event_type = 'contract_resubmitted' and (metadata->>'review_round')::integer = after_round),
    'event checked'
  );
  insert into contract_participant_review_results values (
    'previous decisions preserved',
    exists (select 1 from public.contract_review_decisions where contract_id = revision_contract_id and review_round = 1 and decision = 'revision_requested'),
    'decision preserved'
  );

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.record_contract_opened(revision_contract_id);
  perform public.accept_contract(revision_contract_id, 'new round accepted');
  insert into contract_participant_review_results values (
    'new round permits new decision',
    exists (select 1 from public.contract_review_decisions where contract_id = revision_contract_id and review_round = after_round and decision = 'accepted'),
    'new decision checked'
  );

  blocked := false;
  begin
    perform public.resubmit_contract(accept_contract_id);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('revision decision required before resubmit', blocked, 'blocked: ' || blocked);

  insert into contract_participant_review_results values (
    'trusted opened accepted rejected revision events',
    exists (select 1 from public.contract_events where contract_id = open_contract_id and event_type = 'contract_participant_opened')
    and exists (select 1 from public.contract_events where contract_id = decision_contract_id and event_type = 'contract_accepted')
    and exists (select 1 from public.contract_events where contract_id = reject_contract_id and event_type = 'contract_rejected')
    and exists (select 1 from public.contract_events where contract_id = revision_contract_id and event_type in ('contract_revision_requested', 'contract_resubmitted')),
    'events checked'
  );

  blocked := false;
  begin
    insert into public.contract_events(contract_id, event_type, actor_profile_id, metadata)
    values (direct_contract_id, 'contract_accepted', manufacturer_owner_id, '{"actor_profile_id":"00000000-0000-0000-0000-000000000000"}'::jsonb);
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('direct event forgery denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select count(*) into visible_count from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('Buyer read isolation own contract', visible_count = 1, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);
  select count(*) into visible_count from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('Buyer read isolation other contract denied', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('assigned Manufacturer read', visible_count = 1, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('other Manufacturer denied', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  select count(*) into visible_count from public.contracts where id = revision_contract_id;
  insert into contract_participant_review_results values ('Admin read', visible_count = 1, 'visible: ' || visible_count);

  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    select count(*) into visible_count from public.contracts where id = revision_contract_id;
  exception when others then
    blocked := true;
  end;
  insert into contract_participant_review_results values ('Anonymous denied', blocked, 'blocked: ' || blocked);
end;
$$;

select check_name, passed, detail
from contract_participant_review_results
order by check_name;

rollback;
