-- PH-006C Buyer Quote Review.
-- Additive buyer decision workflow for submitted RFQ quotes.

alter table public.rfq_quotes
  drop constraint if exists rfq_quotes_status_check;

alter table public.rfq_quotes
  add constraint rfq_quotes_status_check check (
    status in (
      'draft',
      'submitted',
      'superseded',
      'accepted',
      'rejected',
      'revision_requested',
      'expired',
      'withdrawn'
    )
  );

alter table public.rfqs
  drop constraint if exists rfqs_status_check;

alter table public.rfqs
  add constraint rfqs_status_check check (
    status in (
      'draft',
      'submitted',
      'manufacturer_review',
      'quoted',
      'buyer_review',
      'revision_requested',
      'accepted',
      'declined',
      'expired',
      'cancelled'
    )
  );

alter table public.rfq_events
  drop constraint if exists rfq_events_type_check;

alter table public.rfq_events
  add constraint rfq_events_type_check check (
    event_type in (
      'draft_created',
      'submitted',
      'manufacturer_opened',
      'manufacturer_replied',
      'quote_created',
      'buyer_opened',
      'quote_accepted',
      'quote_rejected',
      'quote_revision_requested',
      'accepted',
      'declined',
      'cancelled',
      'expired'
    )
  );

create table if not exists public.rfq_quote_decisions (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  quote_id uuid not null references public.rfq_quotes(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint rfq_quote_decisions_quote_unique unique (quote_id),
  constraint rfq_quote_decisions_decision_check check (
    decision in ('accepted', 'rejected', 'revision_requested')
  ),
  constraint rfq_quote_decisions_reason_length_check check (
    reason is null or char_length(reason) <= 4000
  ),
  constraint rfq_quote_decisions_revision_reason_check check (
    decision <> 'revision_requested'
    or (reason is not null and char_length(btrim(reason)) > 0)
  )
);

create index if not exists rfq_quote_decisions_rfq_created_idx
  on public.rfq_quote_decisions (rfq_id, created_at);

create index if not exists rfq_quote_decisions_buyer_idx
  on public.rfq_quote_decisions (buyer_id, created_at desc);

create index if not exists rfq_quote_decisions_quote_idx
  on public.rfq_quote_decisions (quote_id);

alter table public.rfq_quote_decisions enable row level security;

grant select on table public.rfq_quote_decisions to authenticated;
revoke all on table public.rfq_quote_decisions from anon;
revoke insert, update, delete on table public.rfq_quote_decisions from authenticated;

create or replace function public.is_trusted_quote_decision_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.quote_decision_trusted_write', true), '') = 'on';
$$;

create or replace function public.is_trusted_rfq_opened_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.rfq_opened_trusted_write', true), '') = 'on';
$$;

create or replace function public.is_valid_rfq_transition(
  old_status text,
  new_status text
)
returns boolean
language sql
immutable
as $$
  select
    old_status = new_status
    or (old_status = 'draft' and new_status in ('submitted', 'cancelled'))
    or (old_status = 'submitted' and new_status in ('manufacturer_review', 'cancelled'))
    or (old_status = 'manufacturer_review' and new_status = 'quoted')
    or (old_status = 'quoted' and new_status in ('buyer_review', 'accepted', 'declined', 'revision_requested'))
    or (old_status = 'buyer_review' and new_status in ('accepted', 'declined', 'revision_requested'))
    or (old_status = 'revision_requested' and new_status = 'quoted')
    or (old_status in ('submitted', 'manufacturer_review', 'quoted', 'buyer_review', 'revision_requested') and new_status = 'expired')
$$;

create or replace function public.protect_rfq_quote_decision_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'Quote decision rows are immutable.';
  end if;

  if not public.is_trusted_quote_decision_write() then
    raise exception 'Quote decisions must be created by the trusted buyer decision flow.';
  end if;

  select * into quote_record
  from public.rfq_quotes
  where id = new.quote_id;

  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into rfq_record
  from public.rfqs
  where id = quote_record.rfq_id;

  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ buyer can decide on this quote.';
  end if;

  new.rfq_id := quote_record.rfq_id;
  new.buyer_id := auth.uid();
  new.reason := nullif(btrim(coalesce(new.reason, '')), '');
  new.created_at := now();

  return new;
end;
$$;

create or replace function public.protect_rfq_quote_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.currency := upper(new.currency);
  new.incoterm := nullif(upper(coalesce(new.incoterm, '')), '');

  if public.is_trusted_quote_write() or public.is_trusted_quote_decision_write() then
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

create or replace function public.protect_rfq_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_columns text[];
begin
  new.requested_currency := upper(new.requested_currency);
  new.incoterm := nullif(upper(coalesce(new.incoterm, '')), '');

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
      and (
        (old.status = 'manufacturer_review' and new.status = 'quoted')
        or (old.status = 'revision_requested' and new.status = 'quoted')
      )
      and old.requested_quantity is not distinct from new.requested_quantity
      and old.requested_currency is not distinct from new.requested_currency
      and old.incoterm is not distinct from new.incoterm
      and old.destination_country is not distinct from new.destination_country
      and old.destination_port is not distinct from new.destination_port
      and old.target_delivery_date is not distinct from new.target_delivery_date
      and old.buyer_message is not distinct from new.buyer_message then
      return new;
    end if;

    if public.is_trusted_quote_decision_write()
      and old.status in ('quoted', 'buyer_review')
      and new.status in ('accepted', 'declined', 'revision_requested')
      and old.requested_quantity is not distinct from new.requested_quantity
      and old.requested_currency is not distinct from new.requested_currency
      and old.incoterm is not distinct from new.incoterm
      and old.destination_country is not distinct from new.destination_country
      and old.destination_port is not distinct from new.destination_port
      and old.target_delivery_date is not distinct from new.target_delivery_date
      and old.buyer_message is not distinct from new.buyer_message then
      return new;
    end if;

    if public.is_trusted_rfq_opened_write()
      and old.status = 'quoted'
      and new.status = 'buyer_review'
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

    if tg_op = 'UPDATE' and old.status is distinct from new.status
      and new.status in ('accepted', 'declined', 'revision_requested') then
      raise exception 'Buyer quote decisions must use the trusted decision RPCs.';
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
    'quote_accepted',
    'quote_rejected',
    'quote_revision_requested',
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
      - 'actor_profile_id'
      - 'actor_id'
      - 'sender_profile_id'
      - 'sender_role'
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
    'quote_accepted',
    'quote_rejected',
    'quote_revision_requested',
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

  if new.event_type in ('quote_accepted', 'quote_rejected', 'quote_revision_requested') then
    if public.is_trusted_quote_decision_write() and rfq_record.buyer_id = auth.uid() then
      new.actor_profile_id := auth.uid();
      new.metadata := coalesce(new.metadata, '{}'::jsonb);
      return new;
    end if;

    raise exception 'RFQ quote decision events must be generated by the trusted buyer decision flow.';
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

create or replace function public.record_rfq_opened(rfq_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  opened_event text;
  rfq_record public.rfqs%rowtype;
begin
  if not public.can_access_rfq(rfq_uuid) then
    raise exception 'Only RFQ participants can record events.';
  end if;

  select * into rfq_record
  from public.rfqs r
  where r.id = rfq_uuid
  for update;

  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  opened_event := case
    when rfq_record.buyer_id = auth.uid() then 'buyer_opened'
    when public.owns_manufacturer(rfq_record.manufacturer_id) then 'manufacturer_opened'
    else null
  end;

  if opened_event is null then
    raise exception 'Only RFQ buyers or assigned manufacturers can record opened events.';
  end if;

  if opened_event = 'buyer_opened' and rfq_record.status = 'quoted' then
    perform set_config('app.rfq_opened_trusted_write', 'on', true);
    update public.rfqs
    set status = 'buyer_review'
    where id = rfq_uuid;
    perform set_config('app.rfq_opened_trusted_write', '', true);
  end if;

  if not exists (
    select 1
    from public.rfq_events e
    where e.rfq_id = rfq_uuid
      and e.event_type = opened_event
      and e.actor_profile_id = auth.uid()
  ) then
    perform public.insert_trusted_rfq_event(rfq_uuid, opened_event, auth.uid(), '{}'::jsonb);
  end if;
end;
$$;

create or replace function public.record_rfq_quote_opened(quote_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
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
    raise exception 'Only the RFQ buyer can open this quote.';
  end if;

  if quote_record.status <> 'submitted' then
    raise exception 'Only the current submitted quote can be opened for buyer review.';
  end if;

  if exists (
    select 1
    from public.rfq_quotes q
    where q.rfq_id = quote_record.rfq_id
      and q.id <> quote_record.id
      and q.status = 'submitted'
  ) then
    raise exception 'Only the current submitted quote can be opened for buyer review.';
  end if;

  if rfq_record.status not in ('quoted', 'buyer_review') then
    raise exception 'RFQ must be quoted or in buyer review before quote opening.';
  end if;

  if rfq_record.status = 'quoted' then
    perform set_config('app.rfq_opened_trusted_write', 'on', true);
    update public.rfqs
    set status = 'buyer_review'
    where id = quote_record.rfq_id;
    perform set_config('app.rfq_opened_trusted_write', '', true);
  end if;

  if not exists (
    select 1
    from public.rfq_events e
    where e.rfq_id = quote_record.rfq_id
      and e.event_type = 'buyer_opened'
      and e.actor_profile_id = auth.uid()
      and e.metadata->>'quote_id' = quote_record.id::text
  ) then
    perform public.insert_trusted_rfq_event(
      quote_record.rfq_id,
      'buyer_opened',
      auth.uid(),
      jsonb_build_object('quote_id', quote_record.id, 'version', quote_record.version)
    );
  end if;
end;
$$;

create or replace function public.decide_rfq_quote(
  quote_uuid uuid,
  decision_name text,
  reason_text text default null
)
returns public.rfq_quote_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
  decision_record public.rfq_quote_decisions%rowtype;
  normalized_reason text;
  target_rfq_status text;
  target_event text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if decision_name not in ('accepted', 'rejected', 'revision_requested') then
    raise exception 'Unsupported quote decision.';
  end if;

  normalized_reason := nullif(btrim(coalesce(reason_text, '')), '');

  if decision_name = 'revision_requested' and normalized_reason is null then
    raise exception 'Revision requests require a reason.';
  end if;

  if normalized_reason is not null and char_length(normalized_reason) > 4000 then
    raise exception 'Decision reason must be 4000 characters or fewer.';
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
    raise exception 'Only the RFQ buyer can decide on this quote.';
  end if;

  if quote_record.status <> 'submitted' then
    raise exception 'Only the current submitted quote can receive a buyer decision.';
  end if;

  if rfq_record.status not in ('quoted', 'buyer_review') then
    raise exception 'RFQ must be quoted or in buyer review before a buyer decision.';
  end if;

  if exists (
    select 1
    from public.rfq_quote_decisions d
    where d.quote_id = quote_record.id
  ) then
    raise exception 'This quote already has a buyer decision.';
  end if;

  if exists (
    select 1
    from public.rfq_quotes q
    where q.rfq_id = quote_record.rfq_id
      and q.id <> quote_record.id
      and q.status = 'submitted'
  ) then
    raise exception 'Only the current submitted quote can receive a buyer decision.';
  end if;

  target_rfq_status := case decision_name
    when 'accepted' then 'accepted'
    when 'rejected' then 'declined'
    else 'revision_requested'
  end;

  target_event := case decision_name
    when 'accepted' then 'quote_accepted'
    when 'rejected' then 'quote_rejected'
    else 'quote_revision_requested'
  end;

  perform set_config('app.quote_decision_trusted_write', 'on', true);

  insert into public.rfq_quote_decisions (
    rfq_id,
    quote_id,
    buyer_id,
    decision,
    reason
  )
  values (
    quote_record.rfq_id,
    quote_record.id,
    auth.uid(),
    decision_name,
    normalized_reason
  )
  returning * into decision_record;

  update public.rfq_quotes
  set status = decision_name
  where id = quote_record.id;

  update public.rfqs
  set status = target_rfq_status
  where id = quote_record.rfq_id;

  perform public.insert_trusted_rfq_event(
    quote_record.rfq_id,
    target_event,
    auth.uid(),
    jsonb_build_object(
      'quote_id', quote_record.id,
      'version', quote_record.version,
      'decision_id', decision_record.id
    )
  );

  perform set_config('app.quote_decision_trusted_write', '', true);

  return decision_record;
end;
$$;

create or replace function public.accept_rfq_quote(
  quote_uuid uuid,
  reason_text text default null
)
returns public.rfq_quote_decisions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.decide_rfq_quote(quote_uuid, 'accepted', reason_text);
end;
$$;

create or replace function public.reject_rfq_quote(
  quote_uuid uuid,
  reason_text text default null
)
returns public.rfq_quote_decisions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.decide_rfq_quote(quote_uuid, 'rejected', reason_text);
end;
$$;

create or replace function public.request_rfq_quote_revision(
  quote_uuid uuid,
  reason_text text
)
returns public.rfq_quote_decisions
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.decide_rfq_quote(quote_uuid, 'revision_requested', reason_text);
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

  if rfq_record.status not in ('submitted', 'manufacturer_review') then
    raise exception 'Initial quote drafts can be created only before a quote is sent.';
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

create or replace function public.create_rfq_quote_revision(quote_uuid uuid)
returns public.rfq_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  source_quote public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
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

  select * into rfq_record
  from public.rfqs
  where id = source_quote.rfq_id
  for update;

  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if not public.owns_manufacturer(source_quote.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can create quote revisions.';
  end if;

  if source_quote.status <> 'revision_requested' or rfq_record.status <> 'revision_requested' then
    raise exception 'Revisions can be created only after the buyer requests a revision.';
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

  if rfq_record.status not in ('manufacturer_review', 'revision_requested') then
    raise exception 'RFQ must be in manufacturer review or revision requested before quote submission.';
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

drop trigger if exists protect_rfq_quote_decision_write on public.rfq_quote_decisions;
create trigger protect_rfq_quote_decision_write
before insert or update or delete on public.rfq_quote_decisions
for each row execute function public.protect_rfq_quote_decision_write();

drop policy if exists "rfq_quote_decisions_select_participant_or_admin" on public.rfq_quote_decisions;
drop policy if exists "rfq_quote_decisions_insert_denied" on public.rfq_quote_decisions;
drop policy if exists "rfq_quote_decisions_update_denied" on public.rfq_quote_decisions;
drop policy if exists "rfq_quote_decisions_delete_denied" on public.rfq_quote_decisions;

create policy "rfq_quote_decisions_select_participant_or_admin"
on public.rfq_quote_decisions
for select
to authenticated
using (
  public.is_admin()
  or buyer_id = auth.uid()
  or exists (
    select 1
    from public.rfqs r
    where r.id = rfq_quote_decisions.rfq_id
      and public.owns_manufacturer(r.manufacturer_id)
  )
);

revoke all on function public.is_trusted_quote_decision_write() from public, anon, authenticated;
revoke all on function public.is_trusted_rfq_opened_write() from public, anon, authenticated;
revoke all on function public.protect_rfq_quote_decision_write() from public, anon, authenticated;
revoke all on function public.decide_rfq_quote(uuid, text, text) from public, anon, authenticated;

revoke all on function public.accept_rfq_quote(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_rfq_quote(uuid, text) from public, anon, authenticated;
revoke all on function public.request_rfq_quote_revision(uuid, text) from public, anon, authenticated;
grant execute on function public.accept_rfq_quote(uuid, text) to authenticated;
grant execute on function public.reject_rfq_quote(uuid, text) to authenticated;
grant execute on function public.request_rfq_quote_revision(uuid, text) to authenticated;

revoke all on function public.protect_rfq_quote_write() from public, anon, authenticated;
revoke all on function public.protect_rfq_write() from public, anon, authenticated;
revoke all on function public.insert_trusted_rfq_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_rfq_event_insert() from public, anon, authenticated;
revoke all on function public.record_rfq_opened(uuid) from public, anon;
grant execute on function public.record_rfq_opened(uuid) to authenticated;
revoke all on function public.record_rfq_quote_opened(uuid) from public, anon, authenticated;
grant execute on function public.record_rfq_quote_opened(uuid) to authenticated;

revoke all on function public.create_rfq_quote_draft(uuid) from public, anon, authenticated;
revoke all on function public.submit_rfq_quote(uuid) from public, anon, authenticated;
revoke all on function public.create_rfq_quote_revision(uuid) from public, anon, authenticated;
grant execute on function public.create_rfq_quote_draft(uuid) to authenticated;
grant execute on function public.submit_rfq_quote(uuid) to authenticated;
grant execute on function public.create_rfq_quote_revision(uuid) to authenticated;
