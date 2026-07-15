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
