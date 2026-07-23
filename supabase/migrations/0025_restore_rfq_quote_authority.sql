-- Sprint 3A.3 RFQ and Quote authority recovery.
-- Forward-only, review-only migration. Do not apply without separate execution authorization.

begin;

-- Fail closed unless the reviewed RFQ/Quote contract from migrations 0011-0013 is present.
do $$
declare
  missing_count integer;
  unexpected_count integer;
  scoped_trigger_count integer;
  record_event_overload_count integer;
  submit_definition text;
  record_event_definition text;
begin
  select count(*) into missing_count
  from unnest(array[
    'public.rfqs',
    'public.rfq_messages',
    'public.rfq_events',
    'public.rfq_quotes',
    'public.rfq_quote_items',
    'public.rfq_quote_decisions'
  ]) as required_table(name)
  where to_regclass(required_table.name) is null;

  if missing_count <> 0 then
    raise exception 'Migration 0025 preflight failed: required RFQ/Quote tables are missing.';
  end if;

  with expected(table_name, column_name, data_type, udt_name) as (
    values
      ('rfqs', 'id', 'uuid', 'uuid'),
      ('rfqs', 'buyer_id', 'uuid', 'uuid'),
      ('rfqs', 'manufacturer_id', 'uuid', 'uuid'),
      ('rfqs', 'product_id', 'uuid', 'uuid'),
      ('rfqs', 'product_snapshot', 'jsonb', 'jsonb'),
      ('rfqs', 'status', 'text', 'text'),
      ('rfqs', 'requested_quantity', 'numeric', 'numeric'),
      ('rfqs', 'requested_currency', 'text', 'text'),
      ('rfqs', 'incoterm', 'text', 'text'),
      ('rfqs', 'destination_country', 'text', 'text'),
      ('rfqs', 'destination_port', 'text', 'text'),
      ('rfqs', 'target_delivery_date', 'date', 'date'),
      ('rfqs', 'buyer_message', 'text', 'text'),
      ('rfq_messages', 'sender_profile_id', 'uuid', 'uuid'),
      ('rfq_messages', 'sender_role', 'text', 'text'),
      ('rfq_events', 'event_type', 'text', 'text'),
      ('rfq_events', 'actor_profile_id', 'uuid', 'uuid'),
      ('rfq_events', 'metadata', 'jsonb', 'jsonb'),
      ('rfq_quotes', 'rfq_id', 'uuid', 'uuid'),
      ('rfq_quotes', 'manufacturer_id', 'uuid', 'uuid'),
      ('rfq_quotes', 'version', 'integer', 'int4'),
      ('rfq_quotes', 'status', 'text', 'text'),
      ('rfq_quotes', 'submitted_at', 'timestamp with time zone', 'timestamptz'),
      ('rfq_quote_items', 'quote_id', 'uuid', 'uuid'),
      ('rfq_quote_decisions', 'quote_id', 'uuid', 'uuid'),
      ('rfq_quote_decisions', 'decision', 'text', 'text')
  )
  select count(*) into missing_count
  from expected e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.table_name
   and c.column_name = e.column_name
   and c.data_type = e.data_type
   and c.udt_name = e.udt_name
  where c.column_name is null;

  if missing_count <> 0 then
    raise exception 'Migration 0025 preflight failed: expected RFQ/Quote columns or types differ.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rfq_quotes'
      and column_name = 'supersedes_quote_id'
  ) then
    raise exception 'Migration 0025 preflight failed: supersedes_quote_id already exists.';
  end if;

  select count(*) into missing_count
  from unnest(array[
    'public.current_profile_role()',
    'public.owns_manufacturer(uuid)',
    'public.is_admin()',
    'public.build_rfq_product_snapshot(uuid,uuid)',
    'public.can_access_rfq(uuid)',
    'public.is_valid_rfq_transition(text,text)',
    'public.protect_rfq_write()',
    'public.protect_rfq_message_insert()',
    'public.record_rfq_lifecycle_event()',
    'public.record_rfq_message_event()',
    'public.protect_rfq_event_insert()',
    'public.record_rfq_event(uuid,text,jsonb)',
    'public.insert_trusted_rfq_event(uuid,text,uuid,jsonb)',
    'public.record_rfq_opened(uuid)',
    'public.record_rfq_quote_opened(uuid)',
    'public.is_trusted_quote_write()',
    'public.is_trusted_quote_decision_write()',
    'public.is_trusted_rfq_opened_write()',
    'public.recalculate_rfq_quote_subtotal(uuid)',
    'public.protect_rfq_quote_write()',
    'public.protect_rfq_quote_item_write()',
    'public.after_rfq_quote_item_change()',
    'public.protect_rfq_quote_decision_write()',
    'public.create_rfq_quote_draft(uuid)',
    'public.create_rfq_quote_revision(uuid)',
    'public.submit_rfq_quote(uuid)',
    'public.delete_rfq_quote_draft(uuid)',
    'public.decide_rfq_quote(uuid,text,text)'
  ]) as required_function(signature)
  where to_regprocedure(required_function.signature) is null;

  if missing_count <> 0 then
    raise exception 'Migration 0025 preflight failed: required RFQ/Quote function signatures are missing.';
  end if;

  select count(*) into record_event_overload_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'record_rfq_event';

  if record_event_overload_count <> 1
     or to_regprocedure('public.record_rfq_event(uuid,text,jsonb)') is null then
    raise exception 'Migration 0025 preflight failed: incompatible record_rfq_event overload state.';
  end if;

  select pg_get_functiondef(to_regprocedure('public.submit_rfq_quote(uuid)'))
    into submit_definition;
  select pg_get_functiondef(to_regprocedure('public.record_rfq_event(uuid,text,jsonb)'))
    into record_event_definition;

  if position('status = ''superseded''' in submit_definition) = 0
     or position('status = ''submitted''' in submit_definition) = 0
     or position('insert_trusted_rfq_event' in submit_definition) = 0 then
    raise exception 'Migration 0025 preflight failed: submit_rfq_quote semantic fingerprint changed.';
  end if;

  if position('insert_trusted_rfq_event' in record_event_definition) = 0
     or position('buyer_opened' in record_event_definition) = 0
     or position('manufacturer_opened' in record_event_definition) = 0 then
    raise exception 'Migration 0025 preflight failed: record_rfq_event semantic fingerprint changed.';
  end if;

  with expected(table_name, trigger_name, function_name) as (
    values
      ('rfqs', 'protect_rfq_write', 'protect_rfq_write'),
      ('rfqs', 'record_rfq_lifecycle_event', 'record_rfq_lifecycle_event'),
      ('rfqs', 'set_rfqs_updated_at', 'set_rfq_updated_at'),
      ('rfq_messages', 'protect_rfq_message_insert', 'protect_rfq_message_insert'),
      ('rfq_messages', 'record_rfq_message_event', 'record_rfq_message_event'),
      ('rfq_events', 'protect_rfq_event_insert', 'protect_rfq_event_insert'),
      ('rfq_quotes', 'protect_rfq_quote_write', 'protect_rfq_quote_write'),
      ('rfq_quotes', 'set_rfq_quote_updated_at', 'set_rfq_quote_updated_at'),
      ('rfq_quote_items', 'protect_rfq_quote_item_write', 'protect_rfq_quote_item_write'),
      ('rfq_quote_items', 'after_rfq_quote_item_change', 'after_rfq_quote_item_change'),
      ('rfq_quote_items', 'set_rfq_quote_item_updated_at', 'set_rfq_quote_item_updated_at'),
      ('rfq_quote_decisions', 'protect_rfq_quote_decision_write', 'protect_rfq_quote_decision_write')
  )
  select count(*) into scoped_trigger_count
  from expected e
  join pg_class c on c.relname = e.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_trigger t on t.tgrelid = c.oid and t.tgname = e.trigger_name and not t.tgisinternal
  join pg_proc p on p.oid = t.tgfoid and p.proname = e.function_name
  where t.tgenabled in ('D', 'O');

  if scoped_trigger_count <> 12 then
    raise exception 'Migration 0025 preflight failed: the 12 scoped triggers do not match reviewed definitions.';
  end if;

  select count(*) into missing_count
  from unnest(array[
    'rfqs_select_participant_or_admin',
    'rfqs_insert_buyer',
    'rfqs_update_draft_buyer_or_admin',
    'rfqs_update_submitted_owned_manufacturer',
    'rfqs_delete_draft_buyer_or_admin',
    'rfq_messages_select_participant_or_admin',
    'rfq_messages_insert_participant',
    'rfq_messages_admin_delete',
    'rfq_events_select_participant_or_admin',
    'rfq_events_admin_delete',
    'rfq_quotes_select_authorized',
    'rfq_quotes_update_own_draft',
    'rfq_quotes_delete_own_draft',
    'rfq_quote_items_select_authorized',
    'rfq_quote_items_insert_own_draft',
    'rfq_quote_items_update_own_draft',
    'rfq_quote_items_delete_own_draft',
    'rfq_quote_decisions_select_participant_or_admin'
  ]) as expected_policy(policy_name)
  where not exists (
    select 1 from pg_policy p where p.polname = expected_policy.policy_name
  );

  if missing_count <> 0 then
    raise exception 'Migration 0025 preflight failed: expected RLS policy state changed.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rfqs'::regclass
      and conname = 'rfqs_status_check'
      and pg_get_constraintdef(oid) like '%revision_requested%'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rfq_quotes'::regclass
      and conname = 'rfq_quotes_status_check'
      and pg_get_constraintdef(oid) like '%revision_requested%'
      and pg_get_constraintdef(oid) like '%superseded%'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rfq_events'::regclass
      and conname = 'rfq_events_type_check'
      and pg_get_constraintdef(oid) like '%quote_revision_requested%'
  ) then
    raise exception 'Migration 0025 preflight failed: lifecycle status/event constraints changed.';
  end if;

  if to_regclass('public.rfq_quotes_one_current_submitted_per_rfq_idx') is null
     or to_regclass('public.rfq_quotes_one_draft_per_rfq_idx') is null then
    raise exception 'Migration 0025 preflight failed: Quote current-version indexes are missing.';
  end if;

  select count(*) into unexpected_count
  from (
    select rfq_id
    from public.rfq_quotes
    where status = 'submitted'
    group by rfq_id
    having count(*) > 1
  ) conflicts;
  if unexpected_count <> 0 then
    raise exception 'Migration 0025 preflight failed: multiple current submitted Quotes exist.';
  end if;

  select count(*) into unexpected_count
  from (
    select rfq_id
    from public.rfq_quotes
    where status = 'draft'
    group by rfq_id
    having count(*) > 1
  ) conflicts;
  if unexpected_count <> 0 then
    raise exception 'Migration 0025 preflight failed: multiple draft Quotes exist.';
  end if;

  select count(*) into unexpected_count
  from (
    select rfq_id
    from public.rfq_events
    where event_type in ('accepted', 'declined', 'cancelled', 'expired')
    group by rfq_id
    having count(*) > 1
  ) conflicts;
  if unexpected_count <> 0 then
    raise exception 'Migration 0025 preflight failed: duplicate terminal RFQ events require review.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
    where n.nspname = 'public'
      and p.proname in (
        'protect_rfq_write', 'protect_rfq_message_insert', 'record_rfq_event',
        'insert_trusted_rfq_event', 'submit_rfq_quote', 'decide_rfq_quote'
      )
      and r.rolname <> 'postgres'
  ) then
    raise exception 'Migration 0025 preflight failed: reviewed function ownership changed.';
  end if;
end;
$$;

alter table public.rfq_quotes
  add column supersedes_quote_id uuid,
  add constraint rfq_quotes_not_self_superseding_check
    check (supersedes_quote_id is null or supersedes_quote_id <> id),
  add constraint rfq_quotes_rfq_id_id_unique unique (rfq_id, id),
  add constraint rfq_quotes_supersedes_same_rfq_fk
    foreign key (rfq_id, supersedes_quote_id)
    references public.rfq_quotes (rfq_id, id)
    on delete restrict;

create index rfq_quotes_supersedes_quote_idx
  on public.rfq_quotes (supersedes_quote_id)
  where supersedes_quote_id is not null;

create unique index rfq_quotes_one_revision_per_source_idx
  on public.rfq_quotes (supersedes_quote_id)
  where supersedes_quote_id is not null;

alter table public.rfq_events
  add column actor_role text,
  add column source_type text,
  add column source_id uuid,
  add column event_key text,
  add constraint rfq_events_actor_role_check
    check (actor_role is null or actor_role in ('buyer', 'manufacturer', 'admin')),
  add constraint rfq_events_source_type_check
    check (source_type is null or source_type in ('rfq', 'quote', 'quote_decision', 'message')),
  add constraint rfq_events_event_key_check
    check (event_key is null or char_length(btrim(event_key)) between 1 and 240);

create unique index rfq_events_rfq_event_key_unique
  on public.rfq_events (rfq_id, event_key)
  where event_key is not null;

create unique index rfq_events_source_event_unique
  on public.rfq_events (event_type, source_type, source_id)
  where source_type is not null and source_id is not null;

create unique index rfq_events_terminal_lifecycle_unique
  on public.rfq_events (rfq_id)
  where event_type in ('accepted', 'declined', 'cancelled', 'expired');

create or replace function public.rfq_write_context()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('app.rfq_write_context', true), '');
$$;

create or replace function public.is_trusted_rfq_message_write()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('app.rfq_message_trusted_write', true), '') = 'on';
$$;

create or replace function public.is_trusted_rfq_event_write()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('app.rfq_event_trusted_write', true), '') = 'on';
$$;

create or replace function public.assert_rfq_values(
  requested_quantity_value numeric,
  requested_currency_value text,
  destination_country_value text,
  incoterm_value text,
  destination_port_value text,
  target_delivery_date_value date,
  buyer_message_value text
)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if requested_quantity_value is null or requested_quantity_value <= 0 then
    raise exception 'RFQ quantity must be greater than zero.';
  end if;

  if requested_currency_value is null
     or upper(btrim(requested_currency_value)) !~ '^[A-Z]{3}$' then
    raise exception 'RFQ currency must be a three-letter code.';
  end if;

  if destination_country_value is null
     or nullif(btrim(destination_country_value), '') is null
     or char_length(btrim(destination_country_value)) > 120 then
    raise exception 'RFQ destination country is required and must be 120 characters or fewer.';
  end if;

  if incoterm_value is not null
     and nullif(btrim(incoterm_value), '') is not null
     and upper(btrim(incoterm_value)) not in ('FOB', 'CIF', 'EXW', 'DDP', 'DAP') then
    raise exception 'RFQ Incoterm is not supported.';
  end if;

  if destination_port_value is not null
     and char_length(btrim(destination_port_value)) > 160 then
    raise exception 'RFQ destination port must be 160 characters or fewer.';
  end if;

  if target_delivery_date_value is not null
     and target_delivery_date_value < current_date then
    raise exception 'RFQ target delivery date cannot be in the past.';
  end if;

  if buyer_message_value is not null and char_length(buyer_message_value) > 2000 then
    raise exception 'RFQ buyer message must be 2000 characters or fewer.';
  end if;
end;
$$;

create or replace function public.can_access_rfq(rfq_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rfqs r
    where r.id = rfq_uuid
      and (
        r.buyer_id = auth.uid()
        or public.is_admin()
        or (
          r.status <> 'draft'
          and public.owns_manufacturer(r.manufacturer_id)
        )
      )
  );
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
        or (r.status <> 'draft' and public.owns_manufacturer(q.manufacturer_id))
        or (r.buyer_id = auth.uid() and q.status <> 'draft')
      )
  );
$$;

create or replace function public.protect_rfq_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  write_context text := public.rfq_write_context();
begin
  new.requested_currency := upper(btrim(new.requested_currency));
  new.incoterm := nullif(upper(btrim(coalesce(new.incoterm, ''))), '');
  new.destination_country := btrim(new.destination_country);
  new.destination_port := nullif(btrim(coalesce(new.destination_port, '')), '');
  new.buyer_message := nullif(btrim(coalesce(new.buyer_message, '')), '');

  if tg_op = 'INSERT' then
    if write_context <> 'buyer_draft'
       or auth.uid() is null
       or public.current_profile_role() <> 'buyer'
       or new.buyer_id is distinct from auth.uid()
       or new.status <> 'draft'
       or coalesce(new.product_snapshot, '{}'::jsonb) = '{}'::jsonb then
      raise exception 'RFQ creation must use the trusted Buyer draft RPC.';
    end if;
    return new;
  end if;

  if old.buyer_id is distinct from new.buyer_id
     or old.manufacturer_id is distinct from new.manufacturer_id
     or old.product_id is distinct from new.product_id
     or old.product_snapshot is distinct from new.product_snapshot then
    raise exception 'RFQ participant, product, and snapshot fields cannot be changed.';
  end if;

  if not public.is_valid_rfq_transition(old.status, new.status) then
    raise exception 'Invalid RFQ status transition from % to %.', old.status, new.status;
  end if;

  if write_context = 'buyer_draft' then
    if auth.uid() is null
       or public.current_profile_role() <> 'buyer'
       or old.buyer_id is distinct from auth.uid()
       or old.status <> 'draft'
       or new.status not in ('draft', 'submitted') then
      raise exception 'Only the RFQ Buyer can edit or submit a draft.';
    end if;
    return new;
  end if;

  if write_context = 'buyer_cancel' then
    if auth.uid() is null
       or public.current_profile_role() <> 'buyer'
       or old.buyer_id is distinct from auth.uid()
       or old.status not in ('draft', 'submitted')
       or new.status <> 'cancelled'
       or old.requested_quantity is distinct from new.requested_quantity
       or old.requested_currency is distinct from new.requested_currency
       or old.incoterm is distinct from new.incoterm
       or old.destination_country is distinct from new.destination_country
       or old.destination_port is distinct from new.destination_port
       or old.target_delivery_date is distinct from new.target_delivery_date
       or old.buyer_message is distinct from new.buyer_message then
      raise exception 'Only the RFQ Buyer can cancel an eligible RFQ without changing request fields.';
    end if;
    return new;
  end if;

  if write_context = 'manufacturer_review' then
    if auth.uid() is null
       or public.current_profile_role() <> 'manufacturer'
       or not public.owns_manufacturer(old.manufacturer_id)
       or old.status <> 'submitted'
       or new.status <> 'manufacturer_review' then
      raise exception 'Only the assigned Manufacturer can begin review.';
    end if;
  elsif write_context = 'quote' then
    if auth.uid() is null
       or public.current_profile_role() <> 'manufacturer'
       or not public.owns_manufacturer(old.manufacturer_id)
       or not (
         (old.status = 'manufacturer_review' and new.status = 'quoted')
         or (old.status = 'revision_requested' and new.status = 'quoted')
       ) then
      raise exception 'Only the assigned Manufacturer Quote flow can mark this RFQ quoted.';
    end if;
  elsif write_context = 'buyer_decision' then
    if auth.uid() is null
       or public.current_profile_role() <> 'buyer'
       or old.buyer_id is distinct from auth.uid()
       or old.status not in ('quoted', 'buyer_review')
       or new.status not in ('accepted', 'declined', 'revision_requested') then
      raise exception 'Only the RFQ Buyer decision flow can decide this Quote.';
    end if;
  elsif write_context = 'buyer_opened' then
    if auth.uid() is null
       or public.current_profile_role() <> 'buyer'
       or old.buyer_id is distinct from auth.uid()
       or old.status <> 'quoted'
       or new.status <> 'buyer_review' then
      raise exception 'Only the RFQ Buyer can open the current Quote.';
    end if;
  else
    raise exception 'RFQ mutations must use a trusted RPC.';
  end if;

  if old.requested_quantity is distinct from new.requested_quantity
     or old.requested_currency is distinct from new.requested_currency
     or old.incoterm is distinct from new.incoterm
     or old.destination_country is distinct from new.destination_country
     or old.destination_port is distinct from new.destination_port
     or old.target_delivery_date is distinct from new.target_delivery_date
     or old.buyer_message is distinct from new.buyer_message then
    raise exception 'Trusted lifecycle operations cannot change Buyer RFQ fields.';
  end if;

  return new;
end;
$$;

create or replace function public.record_rfq_event(
  rfq_uuid uuid,
  event_name text,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  actor_role_value text := public.current_profile_role();
  rfq_record public.rfqs%rowtype;
  quote_record public.rfq_quotes%rowtype;
  decision_record public.rfq_quote_decisions%rowtype;
  message_record public.rfq_messages%rowtype;
  source_type_value text;
  source_uuid uuid;
  event_key_value text;
  safe_metadata jsonb := '{}'::jsonb;
  inserted_id uuid;
  existing_event public.rfq_events%rowtype;
begin
  if actor_uuid is null or actor_role_value not in ('buyer', 'manufacturer', 'admin') then
    raise exception 'Authenticated RFQ event actor is required.';
  end if;

  if event_metadata is null or jsonb_typeof(event_metadata) <> 'object' then
    raise exception 'RFQ event metadata must be a JSON object.';
  end if;

  select * into rfq_record
  from public.rfqs
  where id = rfq_uuid;

  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if event_name in ('draft_created', 'submitted', 'cancelled', 'expired') then
    if event_metadata <> '{}'::jsonb then
      raise exception 'RFQ lifecycle events do not accept client metadata.';
    end if;

    if event_name = 'expired' then
      if actor_role_value <> 'admin' or rfq_record.status <> 'expired' then
        raise exception 'Only an Admin may record an expired RFQ event.';
      end if;
    elsif actor_role_value <> 'buyer'
       or rfq_record.buyer_id is distinct from actor_uuid
       or rfq_record.status <> case event_name
         when 'draft_created' then 'draft'
         when 'submitted' then 'submitted'
         when 'cancelled' then 'cancelled'
       end then
      raise exception 'Buyer RFQ lifecycle event does not match authoritative state.';
    end if;

    source_type_value := 'rfq';
    source_uuid := rfq_uuid;
    event_key_value := format('rfq:%s:%s', rfq_uuid, event_name);
  elsif event_name = 'manufacturer_opened' then
    if event_metadata <> '{}'::jsonb
       or actor_role_value <> 'manufacturer'
       or not public.owns_manufacturer(rfq_record.manufacturer_id)
       or rfq_record.status <> 'manufacturer_review' then
      raise exception 'Manufacturer opened event does not match authoritative state.';
    end if;
    source_type_value := 'rfq';
    source_uuid := rfq_uuid;
    event_key_value := format('rfq:%s:manufacturer_opened:%s', rfq_uuid, actor_uuid);
  elsif event_name = 'manufacturer_replied' then
    if event_metadata - 'message_id' <> '{}'::jsonb
       or not (event_metadata ? 'message_id') then
      raise exception 'Manufacturer reply events require only message_id metadata.';
    end if;

    begin
      source_uuid := (event_metadata->>'message_id')::uuid;
    exception when others then
      raise exception 'Manufacturer reply message_id must be a UUID.';
    end;

    select * into message_record
    from public.rfq_messages
    where id = source_uuid and rfq_id = rfq_uuid;

    if not found
       or actor_role_value <> 'manufacturer'
       or not public.owns_manufacturer(rfq_record.manufacturer_id)
       or message_record.sender_profile_id is distinct from actor_uuid
       or message_record.sender_role <> 'manufacturer'
       or rfq_record.status = 'draft' then
      raise exception 'Manufacturer reply event does not match an authoritative message.';
    end if;

    source_type_value := 'message';
    event_key_value := format('message:%s:manufacturer_replied', source_uuid);
    safe_metadata := jsonb_build_object('message_id', source_uuid);
  elsif event_name = 'quote_created' then
    if event_metadata - 'quote_id' <> '{}'::jsonb or not (event_metadata ? 'quote_id') then
      raise exception 'Quote-created events require only quote_id metadata.';
    end if;

    begin
      source_uuid := (event_metadata->>'quote_id')::uuid;
    exception when others then
      raise exception 'Quote event quote_id must be a UUID.';
    end;

    select * into quote_record
    from public.rfq_quotes
    where id = source_uuid and rfq_id = rfq_uuid;

    if not found
       or actor_role_value <> 'manufacturer'
       or not public.owns_manufacturer(quote_record.manufacturer_id)
       or quote_record.status <> 'submitted'
       or rfq_record.status <> 'quoted' then
      raise exception 'Quote-created event does not match an authoritative submitted Quote.';
    end if;

    source_type_value := 'quote';
    event_key_value := format('quote:%s:submitted', source_uuid);
    safe_metadata := jsonb_build_object(
      'quote_id', source_uuid,
      'version', quote_record.version,
      'supersedes_quote_id', quote_record.supersedes_quote_id
    );
  elsif event_name = 'buyer_opened' then
    if event_metadata - 'quote_id' <> '{}'::jsonb or not (event_metadata ? 'quote_id') then
      raise exception 'Buyer-opened events require only quote_id metadata.';
    end if;

    begin
      source_uuid := (event_metadata->>'quote_id')::uuid;
    exception when others then
      raise exception 'Buyer-opened quote_id must be a UUID.';
    end;

    select * into quote_record
    from public.rfq_quotes
    where id = source_uuid and rfq_id = rfq_uuid;

    if not found
       or actor_role_value <> 'buyer'
       or rfq_record.buyer_id is distinct from actor_uuid
       or quote_record.status <> 'submitted'
       or rfq_record.status <> 'buyer_review' then
      raise exception 'Buyer-opened event does not match the current submitted Quote.';
    end if;

    source_type_value := 'quote';
    event_key_value := format('quote:%s:buyer_opened:%s', source_uuid, actor_uuid);
    safe_metadata := jsonb_build_object('quote_id', source_uuid, 'version', quote_record.version);
  elsif event_name in ('quote_accepted', 'quote_rejected', 'quote_revision_requested') then
    if event_metadata - 'decision_id' <> '{}'::jsonb or not (event_metadata ? 'decision_id') then
      raise exception 'Quote-decision events require only decision_id metadata.';
    end if;

    begin
      source_uuid := (event_metadata->>'decision_id')::uuid;
    exception when others then
      raise exception 'Quote-decision decision_id must be a UUID.';
    end;

    select * into decision_record
    from public.rfq_quote_decisions
    where id = source_uuid and rfq_id = rfq_uuid;

    if not found
       or actor_role_value <> 'buyer'
       or rfq_record.buyer_id is distinct from actor_uuid
       or decision_record.buyer_id is distinct from actor_uuid
       or event_name <> case decision_record.decision
         when 'accepted' then 'quote_accepted'
         when 'rejected' then 'quote_rejected'
         when 'revision_requested' then 'quote_revision_requested'
       end then
      raise exception 'Quote-decision event does not match an authoritative decision.';
    end if;

    select * into quote_record from public.rfq_quotes where id = decision_record.quote_id;
    if not found
       or quote_record.rfq_id is distinct from rfq_uuid
       or quote_record.status is distinct from decision_record.decision
       or rfq_record.status is distinct from case decision_record.decision
         when 'accepted' then 'accepted'
         when 'rejected' then 'declined'
         when 'revision_requested' then 'revision_requested'
       end then
      raise exception 'Quote-decision source Quote does not match the RFQ.';
    end if;

    source_type_value := 'quote_decision';
    event_key_value := format('decision:%s:%s', source_uuid, event_name);
    safe_metadata := jsonb_build_object(
      'decision_id', source_uuid,
      'quote_id', quote_record.id,
      'version', quote_record.version
    );
  elsif event_name in ('accepted', 'declined') then
    if event_metadata - 'decision_id' <> '{}'::jsonb or not (event_metadata ? 'decision_id') then
      raise exception 'Terminal Buyer events require only decision_id metadata.';
    end if;

    begin
      source_uuid := (event_metadata->>'decision_id')::uuid;
    exception when others then
      raise exception 'Terminal event decision_id must be a UUID.';
    end;

    select * into decision_record
    from public.rfq_quote_decisions
    where id = source_uuid and rfq_id = rfq_uuid;

    if not found
       or actor_role_value <> 'buyer'
       or rfq_record.buyer_id is distinct from actor_uuid
       or decision_record.buyer_id is distinct from actor_uuid
       or event_name <> case decision_record.decision
         when 'accepted' then 'accepted'
         when 'rejected' then 'declined'
       end
       or rfq_record.status <> event_name then
      raise exception 'Terminal RFQ event does not match an authoritative Buyer decision.';
    end if;

    source_type_value := 'quote_decision';
    event_key_value := format('rfq:%s:%s', rfq_uuid, event_name);
    safe_metadata := jsonb_build_object('decision_id', source_uuid, 'quote_id', decision_record.quote_id);
  else
    raise exception 'Unsupported trusted RFQ event type.';
  end if;

  safe_metadata := safe_metadata || jsonb_build_object(
    'snapshot', jsonb_build_object(
      'rfq_status', rfq_record.status,
      'rfq_updated_at', rfq_record.updated_at
    )
  );

  perform set_config('app.rfq_event_trusted_write', 'on', true);
  insert into public.rfq_events (
    rfq_id, event_type, actor_profile_id, actor_role,
    source_type, source_id, event_key, metadata
  )
  values (
    rfq_uuid, event_name, actor_uuid, actor_role_value,
    source_type_value, source_uuid, event_key_value, safe_metadata
  )
  on conflict (rfq_id, event_key) where event_key is not null do nothing
  returning id into inserted_id;
  perform set_config('app.rfq_event_trusted_write', '', true);

  if inserted_id is null then
    select * into existing_event
    from public.rfq_events
    where rfq_id = rfq_uuid and event_key = event_key_value;

    if not found
       or existing_event.event_type is distinct from event_name
       or existing_event.actor_profile_id is distinct from actor_uuid
       or existing_event.actor_role is distinct from actor_role_value
       or existing_event.source_type is distinct from source_type_value
       or existing_event.source_id is distinct from source_uuid then
      raise exception 'RFQ event idempotency conflict.';
    end if;
  end if;
exception when others then
  perform set_config('app.rfq_event_trusted_write', '', true);
  raise;
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
begin
  raise exception 'Legacy RFQ event helper is disabled; use a trusted lifecycle RPC.';
end;
$$;

create or replace function public.protect_rfq_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trusted_rfq_event_write() then
    raise exception 'RFQ events can be written only by the trusted event dispatcher.';
  end if;

  if new.actor_profile_id is null
     or new.actor_role is null
     or new.source_type is null
     or new.source_id is null
     or new.event_key is null
     or jsonb_typeof(new.metadata) <> 'object'
     or jsonb_typeof(new.metadata->'snapshot') <> 'object' then
    raise exception 'Trusted RFQ event provenance is incomplete.';
  end if;

  new.created_at := now();
  return new;
end;
$$;

create or replace function public.record_rfq_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_rfq_event(new.id, 'draft_created', '{}'::jsonb);
  elsif old.status is distinct from new.status and new.status = 'manufacturer_review' then
    perform public.record_rfq_event(new.id, 'manufacturer_opened', '{}'::jsonb);
  elsif old.status is distinct from new.status and new.status in ('submitted', 'cancelled', 'expired') then
    perform public.record_rfq_event(new.id, new.status, '{}'::jsonb);
  elsif old.status is distinct from new.status and new.status = 'accepted' then
    null;
  elsif old.status is distinct from new.status and new.status = 'declined' then
    null;
  end if;
  return new;
end;
$$;

create or replace function public.record_rfq_message_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_role = 'manufacturer' then
    perform public.record_rfq_event(
      new.rfq_id,
      'manufacturer_replied',
      jsonb_build_object('message_id', new.id)
    );
  end if;
  return new;
end;
$$;

create or replace function public.protect_rfq_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
  caller_role text := public.current_profile_role();
begin
  if not public.is_trusted_rfq_message_write() or auth.uid() is null then
    raise exception 'RFQ messages must use the trusted message RPC.';
  end if;

  select * into rfq_record from public.rfqs where id = new.rfq_id;
  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if caller_role = 'buyer' and rfq_record.buyer_id = auth.uid() then
    new.sender_role := 'buyer';
  elsif caller_role = 'manufacturer'
    and public.owns_manufacturer(rfq_record.manufacturer_id)
    and rfq_record.status <> 'draft' then
    new.sender_role := 'manufacturer';
  else
    raise exception 'Only RFQ participants can post messages.';
  end if;

  new.sender_profile_id := auth.uid();
  new.message := btrim(new.message);
  new.attachment_path := nullif(btrim(coalesce(new.attachment_path, '')), '');
  new.created_at := now();

  if char_length(new.message) not between 1 and 4000 then
    raise exception 'RFQ message must be between 1 and 4000 characters.';
  end if;

  return new;
end;
$$;

create or replace function public.create_rfq_draft(
  product_uuid uuid,
  requested_quantity_value numeric,
  requested_currency_value text,
  destination_country_value text,
  incoterm_value text default null,
  destination_port_value text default null,
  target_delivery_date_value date default null,
  buyer_message_value text default null
)
returns public.rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  manufacturer_uuid uuid;
  snapshot_value jsonb;
  rfq_record public.rfqs%rowtype;
begin
  if auth.uid() is null or public.current_profile_role() <> 'buyer' then
    raise exception 'Only an authenticated Buyer can create an RFQ draft.';
  end if;

  perform public.assert_rfq_values(
    requested_quantity_value, requested_currency_value, destination_country_value,
    incoterm_value, destination_port_value,
    target_delivery_date_value, buyer_message_value
  );

  select p.manufacturer_id into manufacturer_uuid
  from public.products p
  join public.manufacturers m on m.id = p.manufacturer_id
  where p.id = product_uuid
    and p.status = 'published'
    and m.application_status = 'approved';

  if not found then
    raise exception 'Published Product from an approved Manufacturer is required.';
  end if;

  snapshot_value := public.build_rfq_product_snapshot(product_uuid, manufacturer_uuid);
  if coalesce(snapshot_value, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'RFQ product snapshot could not be created.';
  end if;

  perform set_config('app.rfq_write_context', 'buyer_draft', true);
  insert into public.rfqs (
    buyer_id, manufacturer_id, product_id, product_snapshot, status,
    requested_quantity, requested_currency, incoterm, destination_country,
    destination_port, target_delivery_date, buyer_message
  ) values (
    auth.uid(), manufacturer_uuid, product_uuid, snapshot_value, 'draft',
    requested_quantity_value, requested_currency_value, incoterm_value,
    destination_country_value, destination_port_value,
    target_delivery_date_value, buyer_message_value
  ) returning * into rfq_record;
  perform set_config('app.rfq_write_context', '', true);

  return rfq_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  raise;
end;
$$;

create or replace function public.update_rfq_draft(
  rfq_uuid uuid,
  requested_quantity_value numeric,
  requested_currency_value text,
  destination_country_value text,
  incoterm_value text default null,
  destination_port_value text default null,
  target_delivery_date_value date default null,
  buyer_message_value text default null
)
returns public.rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
begin
  perform public.assert_rfq_values(
    requested_quantity_value, requested_currency_value, destination_country_value,
    incoterm_value, destination_port_value,
    target_delivery_date_value, buyer_message_value
  );

  select * into rfq_record from public.rfqs where id = rfq_uuid for update;
  if not found
     or auth.uid() is null
     or public.current_profile_role() <> 'buyer'
     or rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ Buyer can update this draft.';
  end if;
  if rfq_record.status <> 'draft' then
    raise exception 'Only draft RFQs can be updated.';
  end if;

  perform set_config('app.rfq_write_context', 'buyer_draft', true);
  update public.rfqs set
    requested_quantity = requested_quantity_value,
    requested_currency = requested_currency_value,
    incoterm = incoterm_value,
    destination_country = destination_country_value,
    destination_port = destination_port_value,
    target_delivery_date = target_delivery_date_value,
    buyer_message = buyer_message_value
  where id = rfq_uuid and status = 'draft'
  returning * into rfq_record;
  perform set_config('app.rfq_write_context', '', true);

  if not found then
    raise exception 'RFQ draft lifecycle conflict.';
  end if;
  return rfq_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  raise;
end;
$$;

create or replace function public.submit_rfq(
  rfq_uuid uuid,
  requested_quantity_value numeric,
  requested_currency_value text,
  destination_country_value text,
  incoterm_value text default null,
  destination_port_value text default null,
  target_delivery_date_value date default null,
  buyer_message_value text default null
)
returns public.rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
begin
  perform public.assert_rfq_values(
    requested_quantity_value, requested_currency_value, destination_country_value,
    incoterm_value, destination_port_value,
    target_delivery_date_value, buyer_message_value
  );

  select * into rfq_record from public.rfqs where id = rfq_uuid for update;
  if not found
     or auth.uid() is null
     or public.current_profile_role() <> 'buyer'
     or rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ Buyer can submit this draft.';
  end if;
  if rfq_record.status <> 'draft' then
    raise exception 'Only a draft RFQ can be submitted.';
  end if;

  perform set_config('app.rfq_write_context', 'buyer_draft', true);
  update public.rfqs set
    requested_quantity = requested_quantity_value,
    requested_currency = requested_currency_value,
    incoterm = incoterm_value,
    destination_country = destination_country_value,
    destination_port = destination_port_value,
    target_delivery_date = target_delivery_date_value,
    buyer_message = buyer_message_value,
    status = 'submitted'
  where id = rfq_uuid and status = 'draft'
  returning * into rfq_record;
  perform set_config('app.rfq_write_context', '', true);

  if not found then
    raise exception 'RFQ submission lifecycle conflict.';
  end if;
  return rfq_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  raise;
end;
$$;

create or replace function public.cancel_rfq(rfq_uuid uuid)
returns public.rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
begin
  select * into rfq_record from public.rfqs where id = rfq_uuid for update;
  if not found
     or auth.uid() is null
     or public.current_profile_role() <> 'buyer'
     or rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ Buyer can cancel this RFQ.';
  end if;
  if rfq_record.status not in ('draft', 'submitted') then
    raise exception 'Only draft or submitted RFQs can be cancelled.';
  end if;

  perform set_config('app.rfq_write_context', 'buyer_cancel', true);
  update public.rfqs set status = 'cancelled'
  where id = rfq_uuid and status in ('draft', 'submitted')
  returning * into rfq_record;
  perform set_config('app.rfq_write_context', '', true);

  if not found then
    raise exception 'RFQ cancellation lifecycle conflict.';
  end if;
  return rfq_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  raise;
end;
$$;

create or replace function public.delete_rfq_draft(rfq_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if auth.uid() is null or public.current_profile_role() <> 'buyer' then
    raise exception 'Only an authenticated Buyer can delete an RFQ draft.';
  end if;

  delete from public.rfqs
  where id = rfq_uuid and buyer_id = auth.uid() and status = 'draft'
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'RFQ draft was not found or cannot be deleted.';
  end if;
end;
$$;

create or replace function public.send_rfq_message(
  rfq_uuid uuid,
  message_text text,
  attachment_path_value text default null
)
returns public.rfq_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  message_record public.rfq_messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  perform set_config('app.rfq_message_trusted_write', 'on', true);
  insert into public.rfq_messages (rfq_id, message, attachment_path)
  values (rfq_uuid, message_text, attachment_path_value)
  returning * into message_record;
  perform set_config('app.rfq_message_trusted_write', '', true);
  return message_record;
exception when others then
  perform set_config('app.rfq_message_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.record_rfq_opened(rfq_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
begin
  select * into rfq_record from public.rfqs where id = rfq_uuid for update;
  if not found
     or auth.uid() is null
     or public.current_profile_role() <> 'manufacturer'
     or not public.owns_manufacturer(rfq_record.manufacturer_id) then
    raise exception 'Only the assigned Manufacturer can open this RFQ.';
  end if;
  if rfq_record.status not in ('submitted', 'manufacturer_review') then
    raise exception 'Only a submitted RFQ can enter Manufacturer review.';
  end if;

  if rfq_record.status = 'submitted' then
    perform set_config('app.rfq_write_context', 'manufacturer_review', true);
    update public.rfqs set status = 'manufacturer_review'
    where id = rfq_uuid and status = 'submitted'
    returning * into rfq_record;
    perform set_config('app.rfq_write_context', '', true);
    if not found then
      raise exception 'RFQ review lifecycle conflict.';
    end if;
  end if;

  perform public.record_rfq_event(rfq_uuid, 'manufacturer_opened', '{}'::jsonb);
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  raise;
end;
$$;

create or replace function public.protect_rfq_quote_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.currency := upper(btrim(new.currency));
  new.incoterm := nullif(upper(btrim(coalesce(new.incoterm, ''))), '');

  if tg_op = 'UPDATE' and old.supersedes_quote_id is distinct from new.supersedes_quote_id then
    raise exception 'Quote revision lineage is immutable.';
  end if;

  if public.is_trusted_quote_write() or public.is_trusted_quote_decision_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Quote creation must use a trusted Quote RPC.';
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'draft' then
      raise exception 'Submitted Quote rows are immutable.';
    end if;
    if not public.owns_manufacturer(old.manufacturer_id) then
      raise exception 'Only the assigned Manufacturer can edit draft Quotes.';
    end if;
    if old.rfq_id is distinct from new.rfq_id
       or old.manufacturer_id is distinct from new.manufacturer_id
       or old.version is distinct from new.version
       or old.status is distinct from new.status
       or old.created_by is distinct from new.created_by
       or old.submitted_at is distinct from new.submitted_at
       or old.subtotal is distinct from new.subtotal then
      raise exception 'Quote ownership, version, status, submission, and subtotal fields are database-managed.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.assert_rfq_quote_lineage(
  revision_uuid uuid,
  rfq_uuid uuid,
  source_quote_uuid uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  source_rfq uuid;
  cycle_found boolean;
begin
  if source_quote_uuid is null then
    return;
  end if;
  if revision_uuid = source_quote_uuid then
    raise exception 'A Quote cannot supersede itself.';
  end if;

  select q.rfq_id into source_rfq from public.rfq_quotes q where q.id = source_quote_uuid;
  if source_rfq is distinct from rfq_uuid then
    raise exception 'A Quote revision must supersede a Quote from the same RFQ.';
  end if;

  with recursive ancestry as (
    select q.id, q.supersedes_quote_id, array[q.id]::uuid[] as path, false as cyclic
    from public.rfq_quotes q
    where q.id = source_quote_uuid
    union all
    select q.id, q.supersedes_quote_id, a.path || q.id, q.id = any(a.path)
    from ancestry a
    join public.rfq_quotes q on q.id = a.supersedes_quote_id
    where not a.cyclic
  )
  select coalesce(bool_or(cyclic or id = revision_uuid), false)
  into cycle_found
  from ancestry;

  if cycle_found then
    raise exception 'Quote revision lineage must be acyclic.';
  end if;
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
  if auth.uid() is null or public.current_profile_role() <> 'manufacturer' then
    raise exception 'Only an authenticated Manufacturer can create a Quote draft.';
  end if;

  select * into rfq_record from public.rfqs where id = rfq_uuid for update;
  if not found or not public.owns_manufacturer(rfq_record.manufacturer_id) then
    raise exception 'Only the assigned Manufacturer can create a Quote draft.';
  end if;
  if rfq_record.status not in ('submitted', 'manufacturer_review') then
    raise exception 'Initial Quote drafts require a submitted RFQ.';
  end if;

  select * into quote_record
  from public.rfq_quotes
  where rfq_id = rfq_uuid and status = 'draft'
  order by version desc limit 1;
  if found then
    if quote_record.supersedes_quote_id is not null then
      raise exception 'Existing draft is a revision and cannot be used as an initial Quote.';
    end if;
    return quote_record;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.rfq_quotes where rfq_id = rfq_uuid;

  perform set_config('app.quote_trusted_write', 'on', true);
  if rfq_record.status = 'submitted' then
    perform set_config('app.rfq_write_context', 'manufacturer_review', true);
    update public.rfqs set status = 'manufacturer_review'
    where id = rfq_uuid and status = 'submitted'
    returning * into rfq_record;
    perform set_config('app.rfq_write_context', '', true);
    if not found then
      raise exception 'RFQ review lifecycle conflict.';
    end if;
  end if;

  insert into public.rfq_quotes (
    rfq_id, manufacturer_id, version, status, currency, quantity,
    incoterm, destination_port, created_by, supersedes_quote_id
  ) values (
    rfq_uuid, rfq_record.manufacturer_id, next_version, 'draft',
    rfq_record.requested_currency, rfq_record.requested_quantity,
    rfq_record.incoterm, rfq_record.destination_port, auth.uid(), null
  ) returning * into quote_record;
  perform set_config('app.quote_trusted_write', '', true);

  return quote_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  perform set_config('app.quote_trusted_write', '', true);
  raise;
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
  new_quote_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or public.current_profile_role() <> 'manufacturer' then
    raise exception 'Only an authenticated Manufacturer can create a Quote revision.';
  end if;

  select r.* into rfq_record
  from public.rfqs r
  join public.rfq_quotes q on q.rfq_id = r.id
  where q.id = quote_uuid
  for update of r;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into source_quote from public.rfq_quotes where id = quote_uuid for update;
  if not public.owns_manufacturer(source_quote.manufacturer_id)
     or source_quote.manufacturer_id is distinct from rfq_record.manufacturer_id then
    raise exception 'Only the assigned Manufacturer can create a Quote revision.';
  end if;
  if source_quote.status <> 'revision_requested' or rfq_record.status <> 'revision_requested' then
    raise exception 'A revision requires the current Buyer revision request.';
  end if;

  select * into new_quote
  from public.rfq_quotes
  where rfq_id = source_quote.rfq_id and status = 'draft'
  order by version desc limit 1;
  if found then
    if new_quote.supersedes_quote_id is distinct from source_quote.id then
      raise exception 'Existing Quote draft has conflicting revision lineage.';
    end if;
    return new_quote;
  end if;

  perform public.assert_rfq_quote_lineage(new_quote_id, source_quote.rfq_id, source_quote.id);
  select coalesce(max(version), 0) + 1 into next_version
  from public.rfq_quotes where rfq_id = source_quote.rfq_id;

  perform set_config('app.quote_trusted_write', 'on', true);
  insert into public.rfq_quotes (
    id, rfq_id, manufacturer_id, version, status, currency, unit_price,
    quantity, subtotal, incoterm, origin_port, destination_port,
    production_lead_days, shipping_lead_days, valid_until,
    manufacturer_note, created_by, supersedes_quote_id
  ) values (
    new_quote_id, source_quote.rfq_id, source_quote.manufacturer_id,
    next_version, 'draft', source_quote.currency, source_quote.unit_price,
    source_quote.quantity, 0, source_quote.incoterm, source_quote.origin_port,
    source_quote.destination_port, source_quote.production_lead_days,
    source_quote.shipping_lead_days, source_quote.valid_until,
    source_quote.manufacturer_note, auth.uid(), source_quote.id
  ) returning * into new_quote;

  insert into public.rfq_quote_items (
    quote_id, line_order, item_type, description, quantity, unit, unit_price
  )
  select new_quote.id, line_order, item_type, description, quantity, unit, unit_price
  from public.rfq_quote_items where quote_id = source_quote.id order by line_order;

  perform public.recalculate_rfq_quote_subtotal(new_quote.id);
  select * into new_quote from public.rfq_quotes where id = new_quote.id;
  perform set_config('app.quote_trusted_write', '', true);
  return new_quote;
exception when others then
  perform set_config('app.quote_trusted_write', '', true);
  raise;
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
  source_quote public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
  item_count integer;
  updated_count integer;
begin
  if auth.uid() is null or public.current_profile_role() <> 'manufacturer' then
    raise exception 'Only an authenticated Manufacturer can submit a Quote.';
  end if;

  select r.* into rfq_record
  from public.rfqs r
  join public.rfq_quotes q on q.rfq_id = r.id
  where q.id = quote_uuid
  for update of r;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into quote_record from public.rfq_quotes where id = quote_uuid for update;
  if quote_record.status <> 'draft' then
    raise exception 'Only a draft Quote can be submitted.';
  end if;
  if not public.owns_manufacturer(quote_record.manufacturer_id)
     or quote_record.manufacturer_id is distinct from rfq_record.manufacturer_id then
    raise exception 'Only the assigned Manufacturer can submit this Quote.';
  end if;

  if quote_record.supersedes_quote_id is null then
    if rfq_record.status <> 'manufacturer_review' then
      raise exception 'Initial Quote submission requires Manufacturer review.';
    end if;
  else
    if rfq_record.status <> 'revision_requested' then
      raise exception 'Quote revision submission requires a Buyer revision request.';
    end if;
    select * into source_quote
    from public.rfq_quotes where id = quote_record.supersedes_quote_id for update;
    if not found
       or source_quote.rfq_id is distinct from quote_record.rfq_id
       or source_quote.manufacturer_id is distinct from quote_record.manufacturer_id
       or source_quote.status <> 'revision_requested' then
      raise exception 'Quote revision source is not eligible for superseding.';
    end if;
    perform public.assert_rfq_quote_lineage(quote_record.id, quote_record.rfq_id, source_quote.id);
  end if;

  select count(*) into item_count from public.rfq_quote_items where quote_id = quote_uuid;
  if item_count = 0 then
    raise exception 'Quote must include at least one line item.';
  end if;

  perform public.recalculate_rfq_quote_subtotal(quote_uuid);
  perform set_config('app.quote_trusted_write', 'on', true);

  if quote_record.supersedes_quote_id is not null then
    update public.rfq_quotes set status = 'superseded'
    where id = source_quote.id and status = 'revision_requested';
    get diagnostics updated_count = row_count;
    if updated_count <> 1 then
      raise exception 'Quote revision source lifecycle conflict.';
    end if;
  elsif exists (
    select 1 from public.rfq_quotes
    where rfq_id = quote_record.rfq_id and status = 'submitted' and id <> quote_record.id
  ) then
    raise exception 'An initial submitted Quote already exists for this RFQ.';
  end if;

  update public.rfq_quotes
  set status = 'submitted', submitted_at = now()
  where id = quote_record.id and status = 'draft'
  returning * into quote_record;
  if not found then
    raise exception 'Quote submission lifecycle conflict.';
  end if;

  perform set_config('app.rfq_write_context', 'quote', true);
  update public.rfqs set status = 'quoted'
  where id = quote_record.rfq_id
    and status = case when quote_record.supersedes_quote_id is null
      then 'manufacturer_review' else 'revision_requested' end
  returning * into rfq_record;
  perform set_config('app.rfq_write_context', '', true);
  if not found then
    raise exception 'RFQ Quote submission lifecycle conflict.';
  end if;

  perform public.record_rfq_event(
    quote_record.rfq_id, 'quote_created', jsonb_build_object('quote_id', quote_record.id)
  );
  perform set_config('app.quote_trusted_write', '', true);
  return quote_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  perform set_config('app.quote_trusted_write', '', true);
  raise;
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
  select r.* into rfq_record
  from public.rfqs r
  join public.rfq_quotes q on q.rfq_id = r.id
  where q.id = quote_uuid
  for update of r;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into quote_record from public.rfq_quotes where id = quote_uuid for update;
  if auth.uid() is null
     or public.current_profile_role() <> 'buyer'
     or rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ Buyer can open this Quote.';
  end if;
  if quote_record.status <> 'submitted'
     or rfq_record.status not in ('quoted', 'buyer_review')
     or exists (
       select 1 from public.rfq_quotes q
       where q.rfq_id = quote_record.rfq_id
         and q.id <> quote_record.id and q.status = 'submitted'
     ) then
    raise exception 'Only the current submitted Quote can be opened.';
  end if;

  if rfq_record.status = 'quoted' then
    perform set_config('app.rfq_write_context', 'buyer_opened', true);
    update public.rfqs set status = 'buyer_review'
    where id = rfq_record.id and status = 'quoted'
    returning * into rfq_record;
    perform set_config('app.rfq_write_context', '', true);
    if not found then
      raise exception 'Buyer Quote-open lifecycle conflict.';
    end if;
  end if;

  perform public.record_rfq_event(
    quote_record.rfq_id, 'buyer_opened', jsonb_build_object('quote_id', quote_record.id)
  );
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  raise;
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
  normalized_reason text := nullif(btrim(coalesce(reason_text, '')), '');
  target_rfq_status text;
  target_event text;
begin
  if auth.uid() is null or public.current_profile_role() <> 'buyer' then
    raise exception 'Only an authenticated Buyer can decide a Quote.';
  end if;
  if decision_name not in ('accepted', 'rejected', 'revision_requested') then
    raise exception 'Unsupported Quote decision.';
  end if;
  if decision_name = 'revision_requested' and normalized_reason is null then
    raise exception 'Revision requests require a reason.';
  end if;
  if normalized_reason is not null and char_length(normalized_reason) > 4000 then
    raise exception 'Decision reason must be 4000 characters or fewer.';
  end if;

  select r.* into rfq_record
  from public.rfqs r
  join public.rfq_quotes q on q.rfq_id = r.id
  where q.id = quote_uuid
  for update of r;
  if not found then
    raise exception 'Quote does not exist.';
  end if;

  select * into quote_record from public.rfq_quotes where id = quote_uuid for update;
  if rfq_record.buyer_id is distinct from auth.uid()
     or quote_record.status <> 'submitted'
     or rfq_record.status not in ('quoted', 'buyer_review') then
    raise exception 'Only the RFQ Buyer can decide the current submitted Quote.';
  end if;
  if exists (select 1 from public.rfq_quote_decisions d where d.quote_id = quote_record.id)
     or exists (
       select 1 from public.rfq_quotes q
       where q.rfq_id = quote_record.rfq_id
         and q.id <> quote_record.id and q.status = 'submitted'
     ) then
    raise exception 'Quote decision lifecycle conflict.';
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
  insert into public.rfq_quote_decisions (rfq_id, quote_id, buyer_id, decision, reason)
  values (quote_record.rfq_id, quote_record.id, auth.uid(), decision_name, normalized_reason)
  returning * into decision_record;

  update public.rfq_quotes set status = decision_name
  where id = quote_record.id and status = 'submitted';
  if not found then
    raise exception 'Quote decision lifecycle conflict.';
  end if;

  perform set_config('app.rfq_write_context', 'buyer_decision', true);
  update public.rfqs set status = target_rfq_status
  where id = quote_record.rfq_id and status in ('quoted', 'buyer_review')
  returning * into rfq_record;
  perform set_config('app.rfq_write_context', '', true);
  if not found then
    raise exception 'RFQ decision lifecycle conflict.';
  end if;

  perform public.record_rfq_event(
    quote_record.rfq_id, target_event, jsonb_build_object('decision_id', decision_record.id)
  );
  if target_rfq_status in ('accepted', 'declined') then
    perform public.record_rfq_event(
      quote_record.rfq_id, target_rfq_status,
      jsonb_build_object('decision_id', decision_record.id)
    );
  end if;

  perform set_config('app.quote_decision_trusted_write', '', true);
  return decision_record;
exception when others then
  perform set_config('app.rfq_write_context', '', true);
  perform set_config('app.quote_decision_trusted_write', '', true);
  raise;
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

drop policy if exists "rfqs_select_participant_or_admin" on public.rfqs;
drop policy if exists "rfqs_insert_buyer" on public.rfqs;
drop policy if exists "rfqs_update_draft_buyer_or_admin" on public.rfqs;
drop policy if exists "rfqs_update_submitted_owned_manufacturer" on public.rfqs;
drop policy if exists "rfqs_delete_draft_buyer_or_admin" on public.rfqs;

create policy "rfqs_select_participant_or_admin"
on public.rfqs for select to authenticated
using (
  public.is_admin()
  or buyer_id = auth.uid()
  or (status <> 'draft' and public.owns_manufacturer(manufacturer_id))
);

drop policy if exists "rfq_messages_select_participant_or_admin" on public.rfq_messages;
drop policy if exists "rfq_messages_insert_participant" on public.rfq_messages;
drop policy if exists "rfq_messages_admin_delete" on public.rfq_messages;

create policy "rfq_messages_select_participant_or_admin"
on public.rfq_messages for select to authenticated
using (public.can_access_rfq(rfq_id));

drop policy if exists "rfq_events_select_participant_or_admin" on public.rfq_events;
drop policy if exists "rfq_events_admin_delete" on public.rfq_events;

create policy "rfq_events_select_participant_or_admin"
on public.rfq_events for select to authenticated
using (public.can_access_rfq(rfq_id));

drop policy if exists "rfq_quotes_select_authorized" on public.rfq_quotes;
drop policy if exists "rfq_quotes_update_own_draft" on public.rfq_quotes;
drop policy if exists "rfq_quotes_delete_own_draft" on public.rfq_quotes;

create policy "rfq_quotes_select_authorized"
on public.rfq_quotes for select to authenticated
using (public.can_access_rfq_quote(id));

create policy "rfq_quotes_update_own_draft"
on public.rfq_quotes for update to authenticated
using (
  status = 'draft'
  and public.current_profile_role() = 'manufacturer'
  and public.owns_manufacturer(manufacturer_id)
  and exists (select 1 from public.rfqs r where r.id = rfq_id and r.status <> 'draft')
)
with check (
  status = 'draft'
  and public.current_profile_role() = 'manufacturer'
  and public.owns_manufacturer(manufacturer_id)
  and exists (select 1 from public.rfqs r where r.id = rfq_id and r.status <> 'draft')
);

create policy "rfq_quotes_delete_own_draft"
on public.rfq_quotes for delete to authenticated
using (
  status = 'draft'
  and public.current_profile_role() = 'manufacturer'
  and public.owns_manufacturer(manufacturer_id)
  and exists (select 1 from public.rfqs r where r.id = rfq_id and r.status <> 'draft')
);

drop policy if exists "rfq_quote_items_select_authorized" on public.rfq_quote_items;
drop policy if exists "rfq_quote_items_insert_own_draft" on public.rfq_quote_items;
drop policy if exists "rfq_quote_items_update_own_draft" on public.rfq_quote_items;
drop policy if exists "rfq_quote_items_delete_own_draft" on public.rfq_quote_items;

create policy "rfq_quote_items_select_authorized"
on public.rfq_quote_items for select to authenticated
using (public.can_access_rfq_quote(quote_id));

create policy "rfq_quote_items_insert_own_draft"
on public.rfq_quote_items for insert to authenticated
with check (
  public.current_profile_role() = 'manufacturer'
  and public.can_manage_rfq_quote_draft(quote_id)
  and exists (
    select 1 from public.rfq_quotes q
    join public.rfqs r on r.id = q.rfq_id
    where q.id = quote_id and r.status <> 'draft'
  )
);

create policy "rfq_quote_items_update_own_draft"
on public.rfq_quote_items for update to authenticated
using (
  public.current_profile_role() = 'manufacturer'
  and public.can_manage_rfq_quote_draft(quote_id)
)
with check (
  public.current_profile_role() = 'manufacturer'
  and public.can_manage_rfq_quote_draft(quote_id)
);

create policy "rfq_quote_items_delete_own_draft"
on public.rfq_quote_items for delete to authenticated
using (
  public.current_profile_role() = 'manufacturer'
  and public.can_manage_rfq_quote_draft(quote_id)
);

drop policy if exists "rfq_quote_decisions_select_participant_or_admin" on public.rfq_quote_decisions;
create policy "rfq_quote_decisions_select_participant_or_admin"
on public.rfq_quote_decisions for select to authenticated
using (
  public.is_admin()
  or buyer_id = auth.uid()
  or exists (
    select 1 from public.rfqs r
    where r.id = rfq_id
      and r.status <> 'draft'
      and public.owns_manufacturer(r.manufacturer_id)
  )
);

revoke all on table public.rfqs from anon, authenticated;
revoke all on table public.rfq_messages from anon, authenticated;
revoke all on table public.rfq_events from anon, authenticated;
revoke all on table public.rfq_quotes from anon, authenticated;
revoke all on table public.rfq_quote_items from anon, authenticated;
revoke all on table public.rfq_quote_decisions from anon, authenticated;

grant select on table public.rfqs to authenticated;
grant select on table public.rfq_messages to authenticated;
grant select on table public.rfq_events to authenticated;
grant select, update, delete on table public.rfq_quotes to authenticated;
grant select, insert, update, delete on table public.rfq_quote_items to authenticated;
grant select on table public.rfq_quote_decisions to authenticated;

alter function public.rfq_write_context() owner to postgres;
alter function public.is_trusted_rfq_message_write() owner to postgres;
alter function public.is_trusted_rfq_event_write() owner to postgres;
alter function public.assert_rfq_values(numeric,text,text,text,text,date,text) owner to postgres;
alter function public.can_access_rfq(uuid) owner to postgres;
alter function public.can_access_rfq_quote(uuid) owner to postgres;
alter function public.protect_rfq_write() owner to postgres;
alter function public.record_rfq_event(uuid,text,jsonb) owner to postgres;
alter function public.insert_trusted_rfq_event(uuid,text,uuid,jsonb) owner to postgres;
alter function public.protect_rfq_event_insert() owner to postgres;
alter function public.record_rfq_lifecycle_event() owner to postgres;
alter function public.record_rfq_message_event() owner to postgres;
alter function public.protect_rfq_message_insert() owner to postgres;
alter function public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text) owner to postgres;
alter function public.update_rfq_draft(uuid,numeric,text,text,text,text,date,text) owner to postgres;
alter function public.submit_rfq(uuid,numeric,text,text,text,text,date,text) owner to postgres;
alter function public.cancel_rfq(uuid) owner to postgres;
alter function public.delete_rfq_draft(uuid) owner to postgres;
alter function public.send_rfq_message(uuid,text,text) owner to postgres;
alter function public.record_rfq_opened(uuid) owner to postgres;
alter function public.protect_rfq_quote_write() owner to postgres;
alter function public.assert_rfq_quote_lineage(uuid,uuid,uuid) owner to postgres;
alter function public.create_rfq_quote_draft(uuid) owner to postgres;
alter function public.create_rfq_quote_revision(uuid) owner to postgres;
alter function public.submit_rfq_quote(uuid) owner to postgres;
alter function public.record_rfq_quote_opened(uuid) owner to postgres;
alter function public.decide_rfq_quote(uuid,text,text) owner to postgres;
alter function public.accept_rfq_quote(uuid,text) owner to postgres;
alter function public.reject_rfq_quote(uuid,text) owner to postgres;
alter function public.request_rfq_quote_revision(uuid,text) owner to postgres;
alter function public.is_trusted_quote_write() owner to postgres;
alter function public.is_trusted_quote_decision_write() owner to postgres;
alter function public.is_trusted_rfq_opened_write() owner to postgres;
alter function public.can_manage_rfq_quote_draft(uuid) owner to postgres;
alter function public.recalculate_rfq_quote_subtotal(uuid) owner to postgres;
alter function public.protect_rfq_quote_item_write() owner to postgres;
alter function public.after_rfq_quote_item_change() owner to postgres;
alter function public.protect_rfq_quote_decision_write() owner to postgres;
alter function public.delete_rfq_quote_draft(uuid) owner to postgres;
alter function public.is_valid_rfq_transition(text,text) owner to postgres;
alter function public.build_rfq_product_snapshot(uuid,uuid) owner to postgres;
alter function public.set_rfq_updated_at() owner to postgres;
alter function public.set_rfq_quote_updated_at() owner to postgres;
alter function public.set_rfq_quote_item_updated_at() owner to postgres;

alter function public.is_trusted_quote_write() set search_path = public;
alter function public.is_trusted_quote_decision_write() set search_path = public;
alter function public.is_trusted_rfq_opened_write() set search_path = public;
alter function public.is_valid_rfq_transition(text,text) set search_path = public;
alter function public.set_rfq_updated_at() set search_path = public;
alter function public.set_rfq_quote_updated_at() set search_path = public;
alter function public.set_rfq_quote_item_updated_at() set search_path = public;

revoke all on function public.rfq_write_context() from public, anon, authenticated, service_role;
revoke all on function public.is_trusted_rfq_message_write() from public, anon, authenticated, service_role;
revoke all on function public.is_trusted_rfq_event_write() from public, anon, authenticated, service_role;
revoke all on function public.assert_rfq_values(numeric,text,text,text,text,date,text) from public, anon, authenticated, service_role;
revoke all on function public.protect_rfq_write() from public, anon, authenticated, service_role;
revoke all on function public.record_rfq_event(uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.insert_trusted_rfq_event(uuid,text,uuid,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.protect_rfq_event_insert() from public, anon, authenticated, service_role;
revoke all on function public.record_rfq_lifecycle_event() from public, anon, authenticated, service_role;
revoke all on function public.record_rfq_message_event() from public, anon, authenticated, service_role;
revoke all on function public.protect_rfq_message_insert() from public, anon, authenticated, service_role;
revoke all on function public.protect_rfq_quote_write() from public, anon, authenticated, service_role;
revoke all on function public.assert_rfq_quote_lineage(uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.decide_rfq_quote(uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.is_trusted_quote_write() from public, anon, authenticated, service_role;
revoke all on function public.is_trusted_quote_decision_write() from public, anon, authenticated, service_role;
revoke all on function public.is_trusted_rfq_opened_write() from public, anon, authenticated, service_role;
revoke all on function public.recalculate_rfq_quote_subtotal(uuid) from public, anon, authenticated, service_role;
revoke all on function public.protect_rfq_quote_item_write() from public, anon, authenticated, service_role;
revoke all on function public.after_rfq_quote_item_change() from public, anon, authenticated, service_role;
revoke all on function public.protect_rfq_quote_decision_write() from public, anon, authenticated, service_role;
revoke all on function public.is_valid_rfq_transition(text,text) from public, anon, authenticated, service_role;
revoke all on function public.build_rfq_product_snapshot(uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.set_rfq_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.set_rfq_quote_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.set_rfq_quote_item_updated_at() from public, anon, authenticated, service_role;

revoke all on function public.can_access_rfq(uuid) from public, anon, authenticated;
revoke all on function public.can_access_rfq_quote(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_rfq_quote_draft(uuid) from public, anon, authenticated;
grant execute on function public.can_access_rfq(uuid) to authenticated;
grant execute on function public.can_access_rfq_quote(uuid) to authenticated;
grant execute on function public.can_manage_rfq_quote_draft(uuid) to authenticated;

revoke all on function public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text) from public, anon, authenticated;
revoke all on function public.update_rfq_draft(uuid,numeric,text,text,text,text,date,text) from public, anon, authenticated;
revoke all on function public.submit_rfq(uuid,numeric,text,text,text,text,date,text) from public, anon, authenticated;
revoke all on function public.cancel_rfq(uuid) from public, anon, authenticated;
revoke all on function public.delete_rfq_draft(uuid) from public, anon, authenticated;
revoke all on function public.send_rfq_message(uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_rfq_opened(uuid) from public, anon, authenticated;
revoke all on function public.create_rfq_quote_draft(uuid) from public, anon, authenticated;
revoke all on function public.create_rfq_quote_revision(uuid) from public, anon, authenticated;
revoke all on function public.submit_rfq_quote(uuid) from public, anon, authenticated;
revoke all on function public.record_rfq_quote_opened(uuid) from public, anon, authenticated;
revoke all on function public.accept_rfq_quote(uuid,text) from public, anon, authenticated;
revoke all on function public.reject_rfq_quote(uuid,text) from public, anon, authenticated;
revoke all on function public.request_rfq_quote_revision(uuid,text) from public, anon, authenticated;
revoke all on function public.delete_rfq_quote_draft(uuid) from public, anon, authenticated;

grant execute on function public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text) to authenticated;
grant execute on function public.update_rfq_draft(uuid,numeric,text,text,text,text,date,text) to authenticated;
grant execute on function public.submit_rfq(uuid,numeric,text,text,text,text,date,text) to authenticated;
grant execute on function public.cancel_rfq(uuid) to authenticated;
grant execute on function public.delete_rfq_draft(uuid) to authenticated;
grant execute on function public.send_rfq_message(uuid,text,text) to authenticated;
grant execute on function public.record_rfq_opened(uuid) to authenticated;
grant execute on function public.create_rfq_quote_draft(uuid) to authenticated;
grant execute on function public.create_rfq_quote_revision(uuid) to authenticated;
grant execute on function public.submit_rfq_quote(uuid) to authenticated;
grant execute on function public.record_rfq_quote_opened(uuid) to authenticated;
grant execute on function public.accept_rfq_quote(uuid,text) to authenticated;
grant execute on function public.reject_rfq_quote(uuid,text) to authenticated;
grant execute on function public.request_rfq_quote_revision(uuid,text) to authenticated;
grant execute on function public.delete_rfq_quote_draft(uuid) to authenticated;

alter table public.rfqs enable trigger protect_rfq_write;
alter table public.rfqs enable trigger record_rfq_lifecycle_event;
alter table public.rfqs enable trigger set_rfqs_updated_at;
alter table public.rfq_messages enable trigger protect_rfq_message_insert;
alter table public.rfq_messages enable trigger record_rfq_message_event;
alter table public.rfq_events enable trigger protect_rfq_event_insert;
alter table public.rfq_quotes enable trigger protect_rfq_quote_write;
alter table public.rfq_quotes enable trigger set_rfq_quote_updated_at;
alter table public.rfq_quote_items enable trigger protect_rfq_quote_item_write;
alter table public.rfq_quote_items enable trigger after_rfq_quote_item_change;
alter table public.rfq_quote_items enable trigger set_rfq_quote_item_updated_at;
alter table public.rfq_quote_decisions enable trigger protect_rfq_quote_decision_write;

do $$
declare
  enabled_count integer;
  unexpected_grants integer;
begin
  with expected(table_name, trigger_name) as (
    values
      ('rfqs', 'protect_rfq_write'),
      ('rfqs', 'record_rfq_lifecycle_event'),
      ('rfqs', 'set_rfqs_updated_at'),
      ('rfq_messages', 'protect_rfq_message_insert'),
      ('rfq_messages', 'record_rfq_message_event'),
      ('rfq_events', 'protect_rfq_event_insert'),
      ('rfq_quotes', 'protect_rfq_quote_write'),
      ('rfq_quotes', 'set_rfq_quote_updated_at'),
      ('rfq_quote_items', 'protect_rfq_quote_item_write'),
      ('rfq_quote_items', 'after_rfq_quote_item_change'),
      ('rfq_quote_items', 'set_rfq_quote_item_updated_at'),
      ('rfq_quote_decisions', 'protect_rfq_quote_decision_write')
  )
  select count(*) into enabled_count
  from expected e
  join pg_class c on c.relname = e.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_trigger t on t.tgrelid = c.oid and t.tgname = e.trigger_name and not t.tgisinternal
  where t.tgenabled = 'O';

  if enabled_count <> 12 then
    raise exception 'Migration 0025 postflight failed: all 12 scoped triggers must be enabled.';
  end if;

  if has_table_privilege('authenticated', 'public.rfqs', 'INSERT')
     or has_table_privilege('authenticated', 'public.rfqs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.rfqs', 'DELETE')
     or has_table_privilege('authenticated', 'public.rfq_messages', 'INSERT')
     or has_table_privilege('authenticated', 'public.rfq_messages', 'UPDATE')
     or has_table_privilege('authenticated', 'public.rfq_messages', 'DELETE')
     or has_table_privilege('authenticated', 'public.rfq_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.rfq_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.rfq_events', 'DELETE')
     or has_table_privilege('authenticated', 'public.rfq_quote_decisions', 'INSERT')
     or has_table_privilege('authenticated', 'public.rfq_quote_decisions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.rfq_quote_decisions', 'DELETE') then
    raise exception 'Migration 0025 postflight failed: protected tables retain direct mutation grants.';
  end if;

  select count(*) into unexpected_grants
  from information_schema.routine_privileges
  where specific_schema = 'public'
    and routine_name in (
      'record_rfq_event', 'insert_trusted_rfq_event', 'assert_rfq_quote_lineage',
      'protect_rfq_write', 'protect_rfq_message_insert', 'protect_rfq_event_insert'
    )
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
    and privilege_type = 'EXECUTE';

  if unexpected_grants <> 0 then
    raise exception 'Migration 0025 postflight failed: internal functions remain externally executable.';
  end if;
end;
$$;

comment on column public.rfq_quotes.supersedes_quote_id is
  'Immutable same-RFQ lineage to the Quote version replaced by this revision.';
comment on function public.record_rfq_event(uuid,text,jsonb) is
  'Internal source-aware RFQ event dispatcher. Not client executable.';
comment on function public.send_rfq_message(uuid,text,text) is
  'Participant message RPC; sender identity and role are database-derived.';

commit;
