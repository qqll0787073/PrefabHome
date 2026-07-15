begin;

-- PH-007B Manufacturer PO Confirmation.
-- Additive review rounds, manufacturer decisions, buyer revision resubmission, and trusted events.

alter table public.purchase_orders
  add column if not exists review_round integer not null default 0,
  add column if not exists last_submitted_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists rejected_at timestamptz;

do $$
begin
  perform set_config('app.purchase_order_trusted_write', 'on', true);

  update public.purchase_orders
  set review_round = case when status = 'submitted' and review_round = 0 then 1 else review_round end,
      last_submitted_at = case when status = 'submitted' and last_submitted_at is null then submitted_at else last_submitted_at end
  where status = 'submitted';

  perform set_config('app.purchase_order_trusted_write', '', true);
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check,
  drop constraint if exists purchase_orders_lifecycle_timestamps_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check check (
    status in (
      'draft',
      'submitted',
      'manufacturer_review',
      'revision_requested',
      'confirmed',
      'rejected',
      'cancelled'
    )
  ),
  add constraint purchase_orders_review_round_check check (review_round >= 0),
  add constraint purchase_orders_lifecycle_timestamps_check check (
    (
      status = 'draft'
      and review_round = 0
      and submitted_at is null
      and last_submitted_at is null
      and cancelled_at is null
      and confirmed_at is null
      and rejected_at is null
    )
    or (
      status in ('submitted', 'manufacturer_review', 'revision_requested')
      and review_round > 0
      and submitted_at is not null
      and last_submitted_at is not null
      and cancelled_at is null
      and confirmed_at is null
      and rejected_at is null
    )
    or (
      status = 'confirmed'
      and review_round > 0
      and submitted_at is not null
      and last_submitted_at is not null
      and cancelled_at is null
      and confirmed_at is not null
      and rejected_at is null
    )
    or (
      status = 'rejected'
      and review_round > 0
      and submitted_at is not null
      and last_submitted_at is not null
      and cancelled_at is null
      and confirmed_at is null
      and rejected_at is not null
    )
    or (
      status = 'cancelled'
      and review_round = 0
      and submitted_at is null
      and last_submitted_at is null
      and cancelled_at is not null
      and confirmed_at is null
      and rejected_at is null
    )
  );

alter table public.purchase_order_events
  drop constraint if exists purchase_order_events_type_check;

alter table public.purchase_order_events
  add constraint purchase_order_events_type_check check (
    event_type in (
      'po_created',
      'po_submitted',
      'po_cancelled',
      'po_manufacturer_opened',
      'po_confirmed',
      'po_rejected',
      'po_revision_requested',
      'po_resubmitted'
    )
  );

create table if not exists public.purchase_order_decisions (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  review_round integer not null,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint purchase_order_decisions_round_unique unique (purchase_order_id, review_round),
  constraint purchase_order_decisions_round_check check (review_round > 0),
  constraint purchase_order_decisions_decision_check check (
    decision in ('confirmed', 'rejected', 'revision_requested')
  ),
  constraint purchase_order_decisions_reason_length_check check (
    reason is null or char_length(reason) <= 4000
  ),
  constraint purchase_order_decisions_reason_required_check check (
    decision = 'confirmed'
    or (reason is not null and char_length(btrim(reason)) > 0)
  )
);

create index if not exists purchase_order_decisions_po_created_idx
  on public.purchase_order_decisions (purchase_order_id, created_at);

create index if not exists purchase_order_decisions_manufacturer_idx
  on public.purchase_order_decisions (manufacturer_id, created_at desc);

create index if not exists purchase_orders_review_status_idx
  on public.purchase_orders (manufacturer_id, status, review_round, updated_at desc);

alter table public.purchase_order_decisions enable row level security;

grant select on table public.purchase_order_decisions to authenticated;
revoke all on table public.purchase_order_decisions from anon;
revoke insert, update, delete on table public.purchase_order_decisions from authenticated;

create or replace function public.is_trusted_purchase_order_decision_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.purchase_order_decision_trusted_write', true), '') = 'on';
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
  if event_name not in (
    'po_created',
    'po_submitted',
    'po_cancelled',
    'po_manufacturer_opened',
    'po_confirmed',
    'po_rejected',
    'po_revision_requested',
    'po_resubmitted'
  ) then
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
      - 'manufacturer_id'
  );
end;
$$;

create or replace function public.protect_purchase_order_decision_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  po_record public.purchase_orders%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Purchase order decisions are immutable.';
  end if;

  if not public.is_trusted_purchase_order_decision_write() then
    raise exception 'Purchase order decisions must be created by trusted manufacturer decision flows.';
  end if;

  select * into po_record
  from public.purchase_orders
  where id = new.purchase_order_id;

  if not found then
    raise exception 'Purchase order does not exist.';
  end if;

  new.review_round := po_record.review_round;
  new.manufacturer_id := po_record.manufacturer_id;
  new.actor_profile_id := auth.uid();
  new.reason := nullif(btrim(coalesce(new.reason, '')), '');
  new.created_at := now();

  return new;
end;
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
  submitted_time timestamptz;
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

  submitted_time := now();

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  update public.purchase_orders
  set status = 'submitted',
      review_round = 1,
      submitted_at = submitted_time,
      last_submitted_at = submitted_time,
      cancelled_at = null,
      confirmed_at = null,
      rejected_at = null
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
    jsonb_build_object('po_number', po_record.po_number, 'review_round', po_record.review_round)
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
      review_round = 0,
      submitted_at = null,
      last_submitted_at = null,
      cancelled_at = now(),
      confirmed_at = null,
      rejected_at = null
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

create or replace function public.record_purchase_order_opened(po_uuid uuid)
returns void
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

  if not public.owns_manufacturer(po_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can open this purchase order.';
  end if;

  if po_record.status not in ('submitted', 'manufacturer_review') then
    raise exception 'Only submitted purchase orders can be opened for manufacturer review.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  if po_record.status = 'submitted' then
    update public.purchase_orders
    set status = 'manufacturer_review'
    where id = po_uuid
    returning * into po_record;
  end if;

  if not exists (
    select 1
    from public.purchase_order_events e
    where e.purchase_order_id = po_record.id
      and e.event_type = 'po_manufacturer_opened'
      and e.actor_profile_id = auth.uid()
      and e.metadata->>'review_round' = po_record.review_round::text
  ) then
    perform public.insert_trusted_purchase_order_event(
      po_record.id,
      'po_manufacturer_opened',
      auth.uid(),
      jsonb_build_object('po_number', po_record.po_number, 'review_round', po_record.review_round)
    );
  end if;

  perform set_config('app.purchase_order_trusted_write', '', true);
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.decide_purchase_order(
  po_uuid uuid,
  decision_name text,
  reason_text text default null
)
returns public.purchase_order_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  po_record public.purchase_orders%rowtype;
  decision_record public.purchase_order_decisions%rowtype;
  normalized_reason text;
  target_status text;
  target_event text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if decision_name not in ('confirmed', 'rejected', 'revision_requested') then
    raise exception 'Unsupported purchase order decision.';
  end if;

  normalized_reason := nullif(btrim(coalesce(reason_text, '')), '');

  if decision_name in ('rejected', 'revision_requested') and normalized_reason is null then
    raise exception 'Reject and revision-request decisions require a reason.';
  end if;

  if normalized_reason is not null and char_length(normalized_reason) > 4000 then
    raise exception 'Decision reason must be 4000 characters or fewer.';
  end if;

  select * into po_record
  from public.purchase_orders
  where id = po_uuid
  for update;

  if not found then
    raise exception 'Purchase order does not exist.';
  end if;

  if not public.owns_manufacturer(po_record.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can decide on this purchase order.';
  end if;

  if po_record.status <> 'manufacturer_review' then
    raise exception 'Purchase order must be in manufacturer review before a decision.';
  end if;

  if exists (
    select 1
    from public.purchase_order_decisions d
    where d.purchase_order_id = po_record.id
      and d.review_round = po_record.review_round
  ) then
    raise exception 'This purchase order review round already has a decision.';
  end if;

  target_status := case decision_name
    when 'confirmed' then 'confirmed'
    when 'rejected' then 'rejected'
    else 'revision_requested'
  end;

  target_event := case decision_name
    when 'confirmed' then 'po_confirmed'
    when 'rejected' then 'po_rejected'
    else 'po_revision_requested'
  end;

  perform set_config('app.purchase_order_trusted_write', 'on', true);
  perform set_config('app.purchase_order_decision_trusted_write', 'on', true);

  insert into public.purchase_order_decisions (
    purchase_order_id,
    review_round,
    manufacturer_id,
    actor_profile_id,
    decision,
    reason
  )
  values (
    po_record.id,
    po_record.review_round,
    po_record.manufacturer_id,
    auth.uid(),
    decision_name,
    normalized_reason
  )
  returning * into decision_record;

  update public.purchase_orders
  set status = target_status,
      confirmed_at = case when decision_name = 'confirmed' then now() else null end,
      rejected_at = case when decision_name = 'rejected' then now() else null end
  where id = po_record.id
  returning * into po_record;

  perform public.insert_trusted_purchase_order_event(
    po_record.id,
    target_event,
    auth.uid(),
    jsonb_build_object(
      'po_number', po_record.po_number,
      'review_round', decision_record.review_round,
      'decision_id', decision_record.id
    )
  );

  perform set_config('app.purchase_order_decision_trusted_write', '', true);
  perform set_config('app.purchase_order_trusted_write', '', true);

  return decision_record;
exception when others then
  perform set_config('app.purchase_order_decision_trusted_write', '', true);
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.confirm_purchase_order(
  po_uuid uuid,
  reason_text text default null
)
returns public.purchase_order_decisions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.decide_purchase_order(po_uuid, 'confirmed', reason_text);
end;
$$;

create or replace function public.reject_purchase_order(
  po_uuid uuid,
  reason_text text
)
returns public.purchase_order_decisions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.decide_purchase_order(po_uuid, 'rejected', reason_text);
end;
$$;

create or replace function public.request_purchase_order_revision(
  po_uuid uuid,
  reason_text text
)
returns public.purchase_order_decisions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.decide_purchase_order(po_uuid, 'revision_requested', reason_text);
end;
$$;

create or replace function public.update_purchase_order_revision(
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
    raise exception 'Only the buyer can update this purchase order revision.';
  end if;

  if po_record.status <> 'revision_requested' then
    raise exception 'Only revision-requested purchase orders can be updated.';
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

create or replace function public.resubmit_purchase_order(po_uuid uuid)
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
    raise exception 'Only the buyer can resubmit this purchase order.';
  end if;

  if po_record.status <> 'revision_requested' then
    raise exception 'Only revision-requested purchase orders can be resubmitted.';
  end if;

  if not exists (
    select 1
    from public.purchase_order_decisions d
    where d.purchase_order_id = po_record.id
      and d.review_round = po_record.review_round
      and d.decision = 'revision_requested'
  ) then
    raise exception 'A revision-requested decision is required before resubmission.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);

  update public.purchase_orders
  set status = 'submitted',
      review_round = review_round + 1,
      last_submitted_at = now(),
      confirmed_at = null,
      rejected_at = null
  where id = po_uuid
  returning * into po_record;

  perform public.insert_trusted_purchase_order_event(
    po_record.id,
    'po_resubmitted',
    auth.uid(),
    jsonb_build_object('po_number', po_record.po_number, 'review_round', po_record.review_round)
  );

  perform set_config('app.purchase_order_trusted_write', '', true);

  return po_record;
exception when others then
  perform set_config('app.purchase_order_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_purchase_order_decision_write on public.purchase_order_decisions;
create trigger protect_purchase_order_decision_write
before insert or update or delete on public.purchase_order_decisions
for each row execute function public.protect_purchase_order_decision_write();

drop policy if exists "purchase_order_decisions_select_participant_or_admin" on public.purchase_order_decisions;
create policy "purchase_order_decisions_select_participant_or_admin"
on public.purchase_order_decisions
for select
to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_decisions.purchase_order_id
      and (
        po.buyer_id = auth.uid()
        or public.owns_manufacturer(po.manufacturer_id)
        or public.is_admin()
      )
  )
);

revoke all on function public.is_trusted_purchase_order_decision_write() from public, anon, authenticated;
revoke all on function public.protect_purchase_order_decision_write() from public, anon, authenticated;
revoke all on function public.decide_purchase_order(uuid, text, text) from public, anon, authenticated;

revoke all on function public.record_purchase_order_opened(uuid) from public, anon, authenticated;
revoke all on function public.confirm_purchase_order(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_purchase_order(uuid, text) from public, anon, authenticated;
revoke all on function public.request_purchase_order_revision(uuid, text) from public, anon, authenticated;
revoke all on function public.update_purchase_order_revision(uuid, text, text, date) from public, anon, authenticated;
revoke all on function public.resubmit_purchase_order(uuid) from public, anon, authenticated;

grant execute on function public.record_purchase_order_opened(uuid) to authenticated;
grant execute on function public.confirm_purchase_order(uuid, text) to authenticated;
grant execute on function public.reject_purchase_order(uuid, text) to authenticated;
grant execute on function public.request_purchase_order_revision(uuid, text) to authenticated;
grant execute on function public.update_purchase_order_revision(uuid, text, text, date) to authenticated;
grant execute on function public.resubmit_purchase_order(uuid) to authenticated;

create temp table purchase_order_confirmation_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table purchase_order_confirmation_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on purchase_order_confirmation_results to anon, authenticated;
grant select, insert on purchase_order_confirmation_subjects to anon, authenticated;

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
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'po-confirm-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"PO Confirm Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_buyer_id, 'authenticated', 'authenticated', 'po-confirm-other-buyer-' || other_buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"PO Confirm Other Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_id, 'authenticated', 'authenticated', 'po-confirm-manufacturer-' || manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"PO Confirm Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_id, 'authenticated', 'authenticated', 'po-confirm-other-manufacturer-' || other_manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"PO Confirm Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'po-confirm-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"PO Confirm Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into purchase_order_confirmation_subjects(subject_name, subject_id)
  values
    ('buyer', buyer_id),
    ('other_buyer', other_buyer_id),
    ('manufacturer_owner', manufacturer_owner_id),
    ('other_manufacturer_owner', other_manufacturer_owner_id),
    ('admin', admin_id);
end;
$$;

set local role authenticated;

create or replace function pg_temp.create_submitted_po(
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
  open_po_id uuid;
  confirm_po_id uuid;
  reject_po_id uuid;
  revision_po_id uuid;
  denied_po_id uuid;
  decision_id uuid;
  first_submitted_at timestamptz;
  first_last_submitted_at timestamptz;
  second_last_submitted_at timestamptz;
  visible_count integer := 0;
  event_count integer := 0;
  decision_count integer := 0;
  blocked boolean := false;
begin
  select subject_id into buyer_id from purchase_order_confirmation_subjects where subject_name = 'buyer';
  select subject_id into other_buyer_id from purchase_order_confirmation_subjects where subject_name = 'other_buyer';
  select subject_id into manufacturer_owner_id from purchase_order_confirmation_subjects where subject_name = 'manufacturer_owner';
  select subject_id into other_manufacturer_owner_id from purchase_order_confirmation_subjects where subject_name = 'other_manufacturer_owner';
  select subject_id into admin_id from purchase_order_confirmation_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_id, 'PO Confirm Factory Legal', 'PO Confirm Factory', 'China', 'draft')
  returning id into manufacturer_id;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_id, 'Other PO Confirm Factory Legal', 'Other PO Confirm Factory', 'Vietnam', 'draft')
  returning id into other_manufacturer_id;

  update public.manufacturers
  set application_status = 'approved',
      reviewed_by = admin_id,
      reviewed_at = now()
  where id in (manufacturer_id, other_manufacturer_id);

  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_id, 'PO Confirm Home', 'PO Confirm Model', 'Modular', 'Purchase order confirmation product.', 'USD', 'draft')
  returning id into product_id;

  open_po_id := pg_temp.create_submitted_po('open flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);
  confirm_po_id := pg_temp.create_submitted_po('confirm flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);
  reject_po_id := pg_temp.create_submitted_po('reject flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);
  revision_po_id := pg_temp.create_submitted_po('revision flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);
  denied_po_id := pg_temp.create_submitted_po('denied flow', buyer_id, manufacturer_owner_id, manufacturer_id, product_id);

  insert into purchase_order_confirmation_results values (
    'first submit review round initialized',
    exists (select 1 from public.purchase_orders where id = open_po_id and review_round = 1 and submitted_at is not null and last_submitted_at = submitted_at),
    'round checked'
  );

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.record_purchase_order_opened(open_po_id);
  insert into purchase_order_confirmation_results values (
    'assigned Manufacturer opens submitted PO',
    exists (select 1 from public.purchase_orders where id = open_po_id and status = 'manufacturer_review'),
    'status checked'
  );

  perform public.record_purchase_order_opened(open_po_id);
  select count(*) into event_count
  from public.purchase_order_events
  where purchase_order_id = open_po_id
    and event_type = 'po_manufacturer_opened';
  insert into purchase_order_confirmation_results values ('duplicate open per round deduped', event_count = 1, 'events: ' || event_count);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.record_purchase_order_opened(confirm_po_id);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('other Manufacturer open denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  blocked := false;
  begin
    perform public.record_purchase_order_opened(confirm_po_id);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Buyer open denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  blocked := false;
  begin
    perform public.record_purchase_order_opened(confirm_po_id);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Admin impersonation open denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.record_purchase_order_opened(confirm_po_id);
  select id into decision_id from public.confirm_purchase_order(confirm_po_id, 'confirmed by factory');
  insert into purchase_order_confirmation_results values (
    'confirm assigned PO',
    exists (select 1 from public.purchase_orders where id = confirm_po_id and status = 'confirmed' and confirmed_at is not null and rejected_at is null),
    'confirmed checked'
  );
  insert into purchase_order_confirmation_results values (
    'trusted confirm event',
    exists (select 1 from public.purchase_order_events where purchase_order_id = confirm_po_id and event_type = 'po_confirmed' and metadata->>'decision_id' = decision_id::text),
    'event checked'
  );
  insert into purchase_order_confirmation_results values (
    'actor manufacturer round database-derived',
    exists (
      select 1
      from public.purchase_order_decisions pod
      where pod.id = decision_id
        and pod.actor_profile_id = manufacturer_owner_id
        and pod.manufacturer_id = (
          select m.id
          from public.manufacturers m
          where m.owner_id = manufacturer_owner_id
          limit 1
        )
        and pod.review_round = 1
        and pod.created_at is not null
    ),
    'decision checked'
  );

  blocked := false;
  begin
    perform public.confirm_purchase_order(confirm_po_id, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('duplicate decision same round denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    perform public.update_purchase_order_revision(confirm_po_id, 'bad', null, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('confirmed PO immutable', blocked, 'blocked: ' || blocked);

  perform public.record_purchase_order_opened(reject_po_id);
  blocked := false;
  begin
    perform public.reject_purchase_order(reject_po_id, '');
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('reject reason required', blocked, 'blocked: ' || blocked);
  perform public.reject_purchase_order(reject_po_id, 'reject reason');
  insert into purchase_order_confirmation_results values (
    'reject assigned PO',
    exists (select 1 from public.purchase_orders where id = reject_po_id and status = 'rejected' and rejected_at is not null and confirmed_at is null),
    'rejected checked'
  );
  insert into purchase_order_confirmation_results values (
    'trusted reject event',
    exists (select 1 from public.purchase_order_events where purchase_order_id = reject_po_id and event_type = 'po_rejected'),
    'event checked'
  );
  blocked := false;
  begin
    perform public.update_purchase_order_revision(reject_po_id, 'bad', null, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('rejected PO immutable', blocked, 'blocked: ' || blocked);

  perform public.record_purchase_order_opened(revision_po_id);
  blocked := false;
  begin
    perform public.request_purchase_order_revision(revision_po_id, '');
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('revision reason required', blocked, 'blocked: ' || blocked);
  perform public.request_purchase_order_revision(revision_po_id, 'revise delivery details');
  insert into purchase_order_confirmation_results values (
    'request revision assigned PO',
    exists (select 1 from public.purchase_orders where id = revision_po_id and status = 'revision_requested' and review_round = 1),
    'revision checked'
  );
  insert into purchase_order_confirmation_results values (
    'trusted revision event',
    exists (select 1 from public.purchase_order_events where purchase_order_id = revision_po_id and event_type = 'po_revision_requested'),
    'event checked'
  );

  blocked := false;
  begin
    update public.purchase_orders set subtotal = 1 where id = revision_po_id;
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('revision-requested PO commercial fields immutable', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform public.update_purchase_order_revision(revision_po_id, 'buyer ref v2', 'buyer note v2', '2026-12-01');
  insert into purchase_order_confirmation_results values (
    'Buyer limited revision update allowed',
    exists (select 1 from public.purchase_orders where id = revision_po_id and buyer_reference = 'buyer ref v2' and requested_delivery_date = '2026-12-01'),
    'revision fields checked'
  );

  blocked := false;
  begin
    update public.purchase_orders set product_snapshot = '{}'::jsonb where id = revision_po_id;
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Buyer commercial snapshot mutation denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.purchase_order_items set amount = 1 where purchase_order_id = revision_po_id;
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Buyer item mutation denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);
  blocked := false;
  begin
    perform public.update_purchase_order_revision(revision_po_id, 'bad', null, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('other Buyer revision update denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.update_purchase_order_revision(revision_po_id, 'bad', null, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Manufacturer revision update denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  blocked := false;
  begin
    perform public.update_purchase_order_revision(revision_po_id, 'bad', null, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Admin revision update denied', blocked, 'blocked: ' || blocked);

  select submitted_at, last_submitted_at into first_submitted_at, first_last_submitted_at
  from public.purchase_orders
  where id = revision_po_id;

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform public.resubmit_purchase_order(revision_po_id);
  select last_submitted_at into second_last_submitted_at from public.purchase_orders where id = revision_po_id;
  insert into purchase_order_confirmation_results values (
    'Buyer resubmit allowed',
    exists (select 1 from public.purchase_orders where id = revision_po_id and status = 'submitted'),
    'resubmit checked'
  );
  insert into purchase_order_confirmation_results values (
    'resubmit returns submitted',
    exists (select 1 from public.purchase_orders where id = revision_po_id and status = 'submitted'),
    'status checked'
  );
  insert into purchase_order_confirmation_results values (
    'resubmit increments round',
    exists (select 1 from public.purchase_orders where id = revision_po_id and review_round = 2),
    'round checked'
  );
  insert into purchase_order_confirmation_results values (
    'submitted_at preserved',
    exists (select 1 from public.purchase_orders where id = revision_po_id and submitted_at = first_submitted_at),
    'submitted_at checked'
  );
  insert into purchase_order_confirmation_results values (
    'last_submitted_at updated',
    second_last_submitted_at is not null and second_last_submitted_at >= first_last_submitted_at,
    'last submitted checked'
  );
  insert into purchase_order_confirmation_results values (
    'po_resubmitted trusted event',
    exists (select 1 from public.purchase_order_events where purchase_order_id = revision_po_id and event_type = 'po_resubmitted' and metadata->>'review_round' = '2'),
    'event checked'
  );

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.record_purchase_order_opened(revision_po_id);
  perform public.confirm_purchase_order(revision_po_id, null);
  insert into purchase_order_confirmation_results values (
    'new round can receive new decision',
    exists (select 1 from public.purchase_order_decisions where purchase_order_id = revision_po_id and review_round = 2 and decision = 'confirmed'),
    'new round decision checked'
  );
  select count(*) into decision_count from public.purchase_order_decisions where purchase_order_id = revision_po_id;
  insert into purchase_order_confirmation_results values ('previous decisions preserved', decision_count = 2, 'decisions: ' || decision_count);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.record_purchase_order_opened(denied_po_id);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  blocked := false;
  begin
    perform public.confirm_purchase_order(denied_po_id, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('other Manufacturer decision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  blocked := false;
  begin
    perform public.confirm_purchase_order(denied_po_id, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Buyer decision denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  blocked := false;
  begin
    perform public.confirm_purchase_order(denied_po_id, null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Admin decision denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    insert into public.purchase_order_events(purchase_order_id, event_type, actor_profile_id, metadata)
    values (denied_po_id, 'po_confirmed', admin_id, '{"review_round":1}'::jsonb);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('direct event forgery denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    insert into public.purchase_order_decisions(purchase_order_id, review_round, manufacturer_id, actor_profile_id, decision)
    values (denied_po_id, 1, manufacturer_id, admin_id, 'confirmed');
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('direct decision forgery denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  perform public.confirm_purchase_order(denied_po_id, null);
  blocked := false;
  begin
    update public.purchase_order_decisions set reason = 'bad' where purchase_order_id = denied_po_id;
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('decision rows immutable', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    delete from public.purchase_order_decisions where purchase_order_id = denied_po_id;
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('decision rows undeletable', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select count(*) into visible_count from public.purchase_order_decisions where purchase_order_id in (confirm_po_id, revision_po_id);
  insert into purchase_order_confirmation_results values ('Buyer read isolation', visible_count = 3, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);
  select count(*) into visible_count from public.purchase_order_decisions where purchase_order_id in (confirm_po_id, revision_po_id);
  insert into purchase_order_confirmation_results values ('other Buyer read denied', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.purchase_order_decisions where purchase_order_id in (confirm_po_id, revision_po_id);
  insert into purchase_order_confirmation_results values ('assigned Manufacturer read', visible_count = 3, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.purchase_order_decisions where purchase_order_id in (confirm_po_id, revision_po_id);
  insert into purchase_order_confirmation_results values ('other Manufacturer denied', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  select count(*) into visible_count from public.purchase_order_decisions where purchase_order_id in (confirm_po_id, revision_po_id);
  insert into purchase_order_confirmation_results values ('Admin read', visible_count = 3, 'visible: ' || visible_count);
end;
$$;

set local role anon;

do $$
declare
  blocked boolean := false;
  visible_count integer := 0;
begin
  begin
    perform public.record_purchase_order_opened(gen_random_uuid());
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Anonymous open denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    perform public.confirm_purchase_order(gen_random_uuid(), null);
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Anonymous decision denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    select count(*) into visible_count from public.purchase_order_decisions;
  exception when others then
    blocked := true;
  end;
  insert into purchase_order_confirmation_results values ('Anonymous read denied', blocked or visible_count = 0, 'blocked: ' || blocked || ', visible: ' || visible_count);
end;
$$;

select check_name, passed, detail
from purchase_order_confirmation_results
order by check_name;

rollback;
