-- PH-009B Payment Recording Foundation.
-- Internal external-payment recording only: no payment processing, bank verification, settlement, reconciliation, refunds, payment links, invoice PDFs, shipping, customs, or paid invoice states.

begin;

create sequence if not exists public.payment_record_number_seq;

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  payment_number text unique not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_number text not null,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_number text not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  purchase_order_number text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'draft',
  version integer not null default 1,
  currency text not null,
  amount numeric(14,2) not null,
  payment_method text not null,
  payment_date date,
  reference_number text,
  notes text,
  invoice_snapshot jsonb not null,
  party_snapshot jsonb not null,
  payment_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_records_number_format_check check (payment_number ~ '^PAY-[0-9]{4}-[0-9]{6}$'),
  constraint payment_records_status_check check (status in ('draft', 'recorded', 'voided')),
  constraint payment_records_version_check check (version > 0),
  constraint payment_records_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_records_amount_check check (amount > 0),
  constraint payment_records_method_check check (payment_method in ('bank_transfer', 'wire', 'check', 'cash', 'other')),
  constraint payment_records_reference_length_check check (reference_number is null or char_length(reference_number) <= 120),
  constraint payment_records_notes_length_check check (notes is null or char_length(notes) <= 2000),
  constraint payment_records_void_reason_length_check check (void_reason is null or char_length(void_reason) <= 2000),
  constraint payment_records_snapshots_check check (
    jsonb_typeof(invoice_snapshot) = 'object'
    and jsonb_typeof(party_snapshot) = 'object'
    and jsonb_typeof(payment_snapshot) = 'object'
  ),
  constraint payment_records_lifecycle_check check (
    (status = 'draft' and recorded_at is null and voided_at is null and void_reason is null)
    or (status = 'recorded' and recorded_at is not null and voided_at is null and void_reason is null and payment_date is not null)
    or (status = 'voided' and recorded_at is not null and voided_at is not null and void_reason is not null)
  )
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_record_id uuid not null references public.payment_records(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_events_type_check check (
    event_type in ('payment_record_created', 'payment_record_updated', 'payment_recorded', 'payment_record_voided')
  )
);

create index if not exists payment_records_invoice_status_idx
  on public.payment_records (invoice_id, status, created_at desc);

create index if not exists payment_records_buyer_status_idx
  on public.payment_records (buyer_id, status, created_at desc);

create index if not exists payment_records_manufacturer_status_idx
  on public.payment_records (manufacturer_id, status, created_at desc);

create index if not exists payment_events_record_created_idx
  on public.payment_events (payment_record_id, created_at);

alter table public.payment_records enable row level security;
alter table public.payment_events enable row level security;

grant select on table public.payment_records to authenticated;
grant select on table public.payment_events to authenticated;
revoke all on table public.payment_records from anon;
revoke all on table public.payment_events from anon;
revoke insert, update, delete on table public.payment_records from authenticated;
revoke insert, update, delete on table public.payment_events from authenticated;

create or replace function public.is_trusted_payment_record_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.payment_record_trusted_write', true), '') = 'on';
$$;

create or replace function public.generate_payment_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.payment_record_number_seq');
  return 'PAY-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.can_access_payment_record(payment_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payment_records pr
    where pr.id = payment_uuid
      and (
        pr.buyer_id = auth.uid()
        or public.owns_manufacturer(pr.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.calculate_invoice_recorded_amount(invoice_uuid uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric(14,2)
  from public.payment_records
  where invoice_id = invoice_uuid
    and status = 'recorded'
$$;

create or replace function public.get_invoice_payment_summary(invoice_uuid uuid)
returns table (
  invoice_id uuid,
  invoice_number text,
  currency text,
  invoice_total numeric,
  recorded_amount numeric,
  remaining_balance numeric,
  recorded_payment_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row public.invoices%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into invoice_row from public.invoices where id = invoice_uuid;
  if invoice_row.id is null then
    raise exception 'Invoice not found.';
  end if;

  if not (
    invoice_row.buyer_id = auth.uid()
    or public.owns_manufacturer(invoice_row.manufacturer_id)
    or public.is_admin()
  ) then
    raise exception 'You are not authorized to access this invoice payment summary.';
  end if;

  return query
  select
    invoice_row.id,
    invoice_row.invoice_number,
    invoice_row.currency,
    invoice_row.total_amount,
    coalesce(sum(pr.amount) filter (where pr.status = 'recorded'), 0)::numeric(14,2),
    (invoice_row.total_amount - coalesce(sum(pr.amount) filter (where pr.status = 'recorded'), 0))::numeric(14,2),
    count(pr.id) filter (where pr.status = 'recorded')
  from public.invoices i
  left join public.payment_records pr on pr.invoice_id = i.id
  where i.id = invoice_row.id
  group by i.id;
end;
$$;

create or replace function public.assert_payment_record_values(
  amount_value numeric,
  payment_method_value text,
  payment_date_value date default null,
  reference_number_text text default null,
  notes_text text default null,
  require_payment_date boolean default false
)
returns void
language plpgsql
immutable
as $$
declare
  normalized_method text := lower(btrim(coalesce(payment_method_value, '')));
begin
  if amount_value is null or amount_value <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if normalized_method not in ('bank_transfer', 'wire', 'check', 'cash', 'other') then
    raise exception 'Payment method is not supported.';
  end if;

  if require_payment_date and payment_date_value is null then
    raise exception 'Payment date is required before recording.';
  end if;

  if reference_number_text is not null and char_length(btrim(reference_number_text)) > 120 then
    raise exception 'Payment reference must be 120 characters or fewer.';
  end if;

  if notes_text is not null and char_length(btrim(notes_text)) > 2000 then
    raise exception 'Payment notes must be 2000 characters or fewer.';
  end if;
end;
$$;

create or replace function public.build_payment_record_snapshot(
  amount_value numeric,
  payment_method_value text,
  payment_date_value date,
  reference_number_text text,
  notes_text text
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'amount', amount_value,
    'payment_method', payment_method_value,
    'payment_date', payment_date_value,
    'reference_number', nullif(btrim(coalesce(reference_number_text, '')), ''),
    'notes', nullif(btrim(coalesce(notes_text, '')), ''),
    'recorded_means_processed', false,
    'funds_transferred', false,
    'bank_verified', false,
    'settled', false,
    'reconciled', false,
    'invoice_paid', false
  ))
$$;

create or replace function public.strip_payment_event_metadata(event_metadata jsonb)
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
    - 'payment_token'
    - 'provider_token'
    - 'provider_secret'
    - 'bank_token'
    - 'bank_secret'
    - 'account_number'
    - 'routing_number'
    - 'card_number'
    - 'access_token'
    - 'refresh_token'
    - 'webhook_secret'
$$;

create or replace function public.insert_trusted_payment_event(
  payment_uuid uuid,
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
  if event_name not in ('payment_record_created', 'payment_record_updated', 'payment_recorded', 'payment_record_voided') then
    raise exception 'Payment event type must be generated by a trusted flow.';
  end if;

  insert into public.payment_events (
    payment_record_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    payment_uuid,
    event_name,
    actor_uuid,
    public.strip_payment_event_metadata(event_metadata)
  );
end;
$$;

create or replace function public.protect_payment_record_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payment records are auditable and cannot be deleted.';
  end if;

  new.currency := upper(new.currency);
  new.payment_method := lower(btrim(new.payment_method));
  new.reference_number := nullif(btrim(coalesce(new.reference_number, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.void_reason := nullif(btrim(coalesce(new.void_reason, '')), '');
  new.updated_at := now();

  if public.is_trusted_payment_record_write() then
    return new;
  end if;

  raise exception 'Payment records must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_payment_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Payment events are immutable and cannot be changed.';
  end if;

  if public.is_trusted_payment_record_write() then
    new.metadata := public.strip_payment_event_metadata(new.metadata);
    return new;
  end if;

  raise exception 'Payment events must be generated by trusted flows.';
end;
$$;

create or replace function public.create_payment_record(
  invoice_uuid uuid,
  amount_value numeric,
  payment_method_value text
)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  invoice_row public.invoices%rowtype;
  payment_row public.payment_records%rowtype;
  normalized_amount numeric(14,2) := round(coalesce(amount_value, 0)::numeric, 2);
  normalized_method text := lower(btrim(coalesce(payment_method_value, '')));
  recorded_total numeric(14,2);
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select role into actor_role from public.profiles where id = actor_uuid;
  if actor_role <> 'manufacturer' then
    raise exception 'Only manufacturers can create payment records.';
  end if;

  select * into invoice_row
  from public.invoices
  where id = invoice_uuid
  for update;

  if invoice_row.id is null then
    raise exception 'Invoice not found.';
  end if;

  if not public.owns_manufacturer(invoice_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can create payment records for this invoice.';
  end if;

  if invoice_row.status <> 'issued' then
    raise exception 'Payment records require an issued invoice.';
  end if;

  perform public.assert_payment_record_values(normalized_amount, normalized_method);
  recorded_total := public.calculate_invoice_recorded_amount(invoice_row.id);
  if normalized_amount > invoice_row.total_amount - recorded_total then
    raise exception 'Payment amount exceeds remaining balance.';
  end if;

  perform set_config('app.payment_record_trusted_write', 'on', true);

  insert into public.payment_records (
    payment_number,
    invoice_id,
    invoice_number,
    contract_id,
    contract_number,
    purchase_order_id,
    purchase_order_number,
    buyer_id,
    manufacturer_id,
    status,
    version,
    currency,
    amount,
    payment_method,
    invoice_snapshot,
    party_snapshot,
    payment_snapshot,
    created_by
  )
  values (
    public.generate_payment_number(),
    invoice_row.id,
    invoice_row.invoice_number,
    invoice_row.contract_id,
    invoice_row.contract_number,
    invoice_row.purchase_order_id,
    invoice_row.purchase_order_number,
    invoice_row.buyer_id,
    invoice_row.manufacturer_id,
    'draft',
    1,
    invoice_row.currency,
    normalized_amount,
    normalized_method,
    jsonb_build_object(
      'invoice_id', invoice_row.id,
      'invoice_number', invoice_row.invoice_number,
      'status', invoice_row.status,
      'currency', invoice_row.currency,
      'total_amount', invoice_row.total_amount,
      'issued_at', invoice_row.issued_at
    ),
    jsonb_build_object(
      'buyer_id', invoice_row.buyer_id,
      'manufacturer_id', invoice_row.manufacturer_id,
      'buyer_snapshot', invoice_row.buyer_snapshot,
      'manufacturer_snapshot', invoice_row.manufacturer_snapshot
    ),
    public.build_payment_record_snapshot(normalized_amount, normalized_method, null, null, null),
    actor_uuid
  )
  returning * into payment_row;

  perform public.insert_trusted_payment_event(
    payment_row.id,
    'payment_record_created',
    actor_uuid,
    jsonb_build_object(
      'payment_number', payment_row.payment_number,
      'invoice_number', payment_row.invoice_number,
      'recorded_means_processed', false,
      'funds_transferred', false,
      'bank_verified', false,
      'invoice_paid', false
    )
  );

  perform set_config('app.payment_record_trusted_write', '', true);
  return payment_row;
exception when others then
  perform set_config('app.payment_record_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_payment_record_draft(
  payment_uuid uuid,
  amount_value numeric,
  payment_method_value text,
  payment_date_value date,
  reference_number_text text,
  notes_text text
)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  payment_row public.payment_records%rowtype;
  invoice_row public.invoices%rowtype;
  normalized_amount numeric(14,2) := round(coalesce(amount_value, 0)::numeric, 2);
  normalized_method text := lower(btrim(coalesce(payment_method_value, '')));
  recorded_total numeric(14,2);
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select * into payment_row
  from public.payment_records
  where id = payment_uuid
  for update;

  if payment_row.id is null then
    raise exception 'Payment record not found.';
  end if;

  if not public.owns_manufacturer(payment_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can update this payment record draft.';
  end if;

  if payment_row.status <> 'draft' then
    raise exception 'Only draft payment records can be updated.';
  end if;

  select * into invoice_row from public.invoices where id = payment_row.invoice_id for update;
  if invoice_row.status <> 'issued' then
    raise exception 'Source invoice must remain issued.';
  end if;

  perform public.assert_payment_record_values(normalized_amount, normalized_method, payment_date_value, reference_number_text, notes_text);
  recorded_total := public.calculate_invoice_recorded_amount(invoice_row.id);
  if normalized_amount > invoice_row.total_amount - recorded_total then
    raise exception 'Payment amount exceeds remaining balance.';
  end if;

  perform set_config('app.payment_record_trusted_write', 'on', true);

  update public.payment_records
  set amount = normalized_amount,
      payment_method = normalized_method,
      payment_date = payment_date_value,
      reference_number = nullif(btrim(coalesce(reference_number_text, '')), ''),
      notes = nullif(btrim(coalesce(notes_text, '')), ''),
      payment_snapshot = public.build_payment_record_snapshot(
        normalized_amount,
        normalized_method,
        payment_date_value,
        reference_number_text,
        notes_text
      )
  where id = payment_uuid
    and status = 'draft'
  returning * into payment_row;

  if not found then
    raise exception 'Payment record lifecycle conflict while updating.';
  end if;

  perform public.insert_trusted_payment_event(
    payment_row.id,
    'payment_record_updated',
    actor_uuid,
    jsonb_build_object('payment_number', payment_row.payment_number)
  );

  perform set_config('app.payment_record_trusted_write', '', true);
  return payment_row;
exception when others then
  perform set_config('app.payment_record_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.record_payment(payment_uuid uuid)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  payment_row public.payment_records%rowtype;
  invoice_row public.invoices%rowtype;
  recorded_total numeric(14,2);
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select * into payment_row
  from public.payment_records
  where id = payment_uuid
  for update;

  if payment_row.id is null then
    raise exception 'Payment record not found.';
  end if;

  if not public.owns_manufacturer(payment_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can record this payment.';
  end if;

  if payment_row.status <> 'draft' then
    raise exception 'Only draft payment records can be recorded.';
  end if;

  select * into invoice_row
  from public.invoices
  where id = payment_row.invoice_id
  for update;

  if invoice_row.status <> 'issued' then
    raise exception 'Source invoice must remain issued before recording payment.';
  end if;

  perform public.assert_payment_record_values(payment_row.amount, payment_row.payment_method, payment_row.payment_date, payment_row.reference_number, payment_row.notes, true);
  recorded_total := public.calculate_invoice_recorded_amount(invoice_row.id);
  if payment_row.amount > invoice_row.total_amount - recorded_total then
    raise exception 'Payment amount exceeds remaining balance.';
  end if;

  perform set_config('app.payment_record_trusted_write', 'on', true);

  update public.payment_records
  set status = 'recorded',
      recorded_at = now()
  where id = payment_uuid
    and status = 'draft'
  returning * into payment_row;

  if not found then
    raise exception 'Payment record lifecycle conflict while recording.';
  end if;

  perform public.insert_trusted_payment_event(
    payment_row.id,
    'payment_recorded',
    actor_uuid,
    jsonb_build_object(
      'payment_number', payment_row.payment_number,
      'invoice_number', payment_row.invoice_number,
      'recorded_means_processed', false,
      'funds_transferred', false,
      'bank_verified', false,
      'settled', false,
      'reconciled', false,
      'invoice_paid', false
    )
  );

  perform set_config('app.payment_record_trusted_write', '', true);
  return payment_row;
exception when others then
  perform set_config('app.payment_record_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.void_payment_record(payment_uuid uuid, reason_text text)
returns public.payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  payment_row public.payment_records%rowtype;
  normalized_reason text := nullif(btrim(coalesce(reason_text, '')), '');
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  if normalized_reason is null then
    raise exception 'Void reason is required.';
  end if;

  if char_length(normalized_reason) > 2000 then
    raise exception 'Void reason must be 2000 characters or fewer.';
  end if;

  select * into payment_row
  from public.payment_records
  where id = payment_uuid
  for update;

  if payment_row.id is null then
    raise exception 'Payment record not found.';
  end if;

  if not public.owns_manufacturer(payment_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can void this payment record.';
  end if;

  if payment_row.status <> 'recorded' then
    raise exception 'Only recorded payment records can be voided.';
  end if;

  perform set_config('app.payment_record_trusted_write', 'on', true);

  update public.payment_records
  set status = 'voided',
      voided_at = now(),
      void_reason = normalized_reason
  where id = payment_uuid
    and status = 'recorded'
  returning * into payment_row;

  if not found then
    raise exception 'Payment record lifecycle conflict while voiding.';
  end if;

  perform public.insert_trusted_payment_event(
    payment_row.id,
    'payment_record_voided',
    actor_uuid,
    jsonb_build_object('payment_number', payment_row.payment_number, 'reason', normalized_reason)
  );

  perform set_config('app.payment_record_trusted_write', '', true);
  return payment_row;
exception when others then
  perform set_config('app.payment_record_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_payment_record_write on public.payment_records;
create trigger protect_payment_record_write
before insert or update or delete on public.payment_records
for each row execute function public.protect_payment_record_write();

drop trigger if exists protect_payment_event_write on public.payment_events;
create trigger protect_payment_event_write
before insert or update or delete on public.payment_events
for each row execute function public.protect_payment_event_write();

drop policy if exists "payment_records_select_participant_or_admin" on public.payment_records;
create policy "payment_records_select_participant_or_admin"
on public.payment_records
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "payment_events_select_participant_or_admin" on public.payment_events;
create policy "payment_events_select_participant_or_admin"
on public.payment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.payment_records pr
    where pr.id = payment_events.payment_record_id
      and (
        pr.buyer_id = auth.uid()
        or public.owns_manufacturer(pr.manufacturer_id)
        or public.is_admin()
      )
  )
);

revoke all on function public.is_trusted_payment_record_write() from public, anon, authenticated;
revoke all on function public.generate_payment_number() from public, anon, authenticated;
revoke all on function public.can_access_payment_record(uuid) from public, anon, authenticated;
revoke all on function public.calculate_invoice_recorded_amount(uuid) from public, anon, authenticated;
revoke all on function public.get_invoice_payment_summary(uuid) from public, anon, authenticated;
revoke all on function public.assert_payment_record_values(numeric, text, date, text, text, boolean) from public, anon, authenticated;
revoke all on function public.build_payment_record_snapshot(numeric, text, date, text, text) from public, anon, authenticated;
revoke all on function public.strip_payment_event_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.insert_trusted_payment_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.protect_payment_record_write() from public, anon, authenticated;
revoke all on function public.protect_payment_event_write() from public, anon, authenticated;

revoke all on function public.create_payment_record(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.update_payment_record_draft(uuid, numeric, text, date, text, text) from public, anon, authenticated;
revoke all on function public.record_payment(uuid) from public, anon, authenticated;
revoke all on function public.void_payment_record(uuid, text) from public, anon, authenticated;

grant execute on function public.get_invoice_payment_summary(uuid) to authenticated;
grant execute on function public.create_payment_record(uuid, numeric, text) to authenticated;
grant execute on function public.update_payment_record_draft(uuid, numeric, text, date, text, text) to authenticated;
grant execute on function public.record_payment(uuid) to authenticated;
grant execute on function public.void_payment_record(uuid, text) to authenticated;

create temp table payment_recording_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

grant select, insert on payment_recording_results to anon, authenticated;

create or replace function pg_temp.record_payment_check(check_name text, passed boolean, detail text default '')
returns void
language plpgsql
as $$
begin
  insert into payment_recording_results values (check_name, passed, coalesce(detail, ''));
end;
$$;

create or replace function pg_temp.seed_payment_source(label_text text)
returns table (
  buyer_id uuid,
  manufacturer_owner_id uuid,
  other_manufacturer_owner_id uuid,
  admin_id uuid,
  manufacturer_id uuid,
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
    ('00000000-0000-0000-0000-000000000000', buyer_uuid, 'authenticated', 'authenticated', label_text || '-buyer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Payment Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Payment Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-other-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_uuid, 'authenticated', 'authenticated', label_text || '-admin@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Payment Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

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
  set application_status = 'approved',
      reviewed_by = admin_uuid,
      reviewed_at = now()
  where id in (manufacturer_uuid, other_manufacturer_uuid);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_uuid::text, true);
  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_uuid, label_text || ' Home', label_text || ' Model', 'Modular', 'Payment verification product.', 'USD', 'draft')
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
    jsonb_build_object('profile_id', buyer_uuid, 'full_name', 'Payment Buyer', 'email', label_text || '-buyer@example.test'),
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
    invoice_uuid,
    current_date,
    current_date + 30,
    'Payment Buyer',
    label_text || '-buyer@example.test',
    '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb,
    0,
    0,
    0
  );
  select id into invoice_uuid from public.issue_invoice(invoice_uuid);

  return query select buyer_uuid, manufacturer_owner_uuid, other_manufacturer_owner_uuid, admin_uuid, manufacturer_uuid, invoice_uuid;
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
  payment_row public.payment_records%rowtype;
  recorded_payment public.payment_records%rowtype;
  voided_payment public.payment_records%rowtype;
  summary_row record;
  blocked boolean;
  visible_count integer;
  event_count integer;
begin
  select * into seed from pg_temp.seed_payment_source('payment-audit-' || replace(gen_random_uuid()::text, '-', ''));
  select * into second_seed from pg_temp.seed_payment_source('payment-second-' || replace(gen_random_uuid()::text, '-', ''));

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', seed.manufacturer_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select * into summary_row from public.get_invoice_payment_summary(seed.invoice_id);
  perform pg_temp.record_payment_check('issued invoice summary starts at full remaining balance', summary_row.invoice_total = 1000 and summary_row.recorded_amount = 0 and summary_row.remaining_balance = 1000 and summary_row.recorded_payment_count = 0, row_to_json(summary_row)::text);

  select * into payment_row from public.create_payment_record(seed.invoice_id, 400, 'wire');
  perform pg_temp.record_payment_check('manufacturer can create draft payment for issued invoice', payment_row.status = 'draft' and payment_row.amount = 400 and payment_row.currency = 'USD', payment_row.payment_number);
  perform pg_temp.record_payment_check('payment number format is generated', payment_row.payment_number ~ '^PAY-[0-9]{4}-[0-9]{6}$', payment_row.payment_number);
  perform pg_temp.record_payment_check('source identifiers are derived from invoice', payment_row.invoice_id = seed.invoice_id and payment_row.contract_id is not null and payment_row.purchase_order_id is not null, payment_row.invoice_number);
  perform pg_temp.record_payment_check('created event inserted once', (select count(*) from public.payment_events where payment_record_id = payment_row.id and event_type = 'payment_record_created') = 1, 'created event');

  select * into summary_row from public.get_invoice_payment_summary(seed.invoice_id);
  perform pg_temp.record_payment_check('draft payment does not count toward summary', summary_row.recorded_amount = 0 and summary_row.remaining_balance = 1000 and summary_row.recorded_payment_count = 0, row_to_json(summary_row)::text);

  select * into payment_row from public.update_payment_record_draft(payment_row.id, 450, 'bank_transfer', current_date, '  EXT-123  ', '  External record note  ');
  perform pg_temp.record_payment_check('draft update normalizes metadata', payment_row.amount = 450 and payment_row.reference_number = 'EXT-123' and payment_row.notes = 'External record note', payment_row.payment_snapshot::text);
  perform pg_temp.record_payment_check('updated event inserted once', (select count(*) from public.payment_events where payment_record_id = payment_row.id and event_type = 'payment_record_updated') = 1, 'updated event');

  blocked := false;
  begin
    perform public.create_payment_record(seed.invoice_id, 0, 'wire');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('zero amount denied', blocked, 'zero');

  blocked := false;
  begin
    perform public.create_payment_record(seed.invoice_id, 1001, 'wire');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('amount exceeding balance denied', blocked, 'over balance');

  blocked := false;
  begin
    perform public.create_payment_record(seed.invoice_id, 100, 'card');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('unsupported processing method denied', blocked, 'card denied');

  select * into recorded_payment from public.record_payment(payment_row.id);
  perform pg_temp.record_payment_check('record transition sets recorded timestamp only', recorded_payment.status = 'recorded' and recorded_payment.recorded_at is not null and recorded_payment.voided_at is null, 'recorded');
  perform pg_temp.record_payment_check('recorded event inserted once', (select count(*) from public.payment_events where payment_record_id = payment_row.id and event_type = 'payment_recorded') = 1, 'recorded event');

  select * into summary_row from public.get_invoice_payment_summary(seed.invoice_id);
  perform pg_temp.record_payment_check('recorded payment counts toward summary', summary_row.recorded_amount = 450 and summary_row.remaining_balance = 550 and summary_row.recorded_payment_count = 1, row_to_json(summary_row)::text);

  blocked := false;
  begin
    perform public.record_payment(payment_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('duplicate record transition denied', blocked, 'duplicate record');

  blocked := false;
  begin
    perform public.update_payment_record_draft(payment_row.id, 100, 'wire', current_date, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('recorded payment draft update denied', blocked, 'recorded immutable');

  select * into payment_row from public.create_payment_record(seed.invoice_id, 550, 'check');
  select * into payment_row from public.update_payment_record_draft(payment_row.id, 550, 'check', current_date, 'CHK-1', null);
  select * into payment_row from public.record_payment(payment_row.id);
  select * into summary_row from public.get_invoice_payment_summary(seed.invoice_id);
  perform pg_temp.record_payment_check('multiple recorded payments can close remaining balance', summary_row.recorded_amount = 1000 and summary_row.remaining_balance = 0 and summary_row.recorded_payment_count = 2, row_to_json(summary_row)::text);

  blocked := false;
  begin
    perform public.create_payment_record(seed.invoice_id, 1, 'wire');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('over-recording after full balance denied', blocked, 'closed balance');

  select * into voided_payment from public.void_payment_record(payment_row.id, 'Duplicate external reference');
  perform pg_temp.record_payment_check('recorded payment can be voided with timestamp', voided_payment.status = 'voided' and voided_payment.voided_at is not null and voided_payment.void_reason = 'Duplicate external reference', 'voided');
  perform pg_temp.record_payment_check('voided event inserted once', (select count(*) from public.payment_events where payment_record_id = payment_row.id and event_type = 'payment_record_voided') = 1, 'voided event');

  select * into summary_row from public.get_invoice_payment_summary(seed.invoice_id);
  perform pg_temp.record_payment_check('voided payment no longer counts toward summary', summary_row.recorded_amount = 450 and summary_row.remaining_balance = 550 and summary_row.recorded_payment_count = 1, row_to_json(summary_row)::text);

  blocked := false;
  begin
    perform public.void_payment_record(payment_row.id, 'Again');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('duplicate void denied', blocked, 'terminal');

  blocked := false;
  begin
    perform public.void_payment_record(recorded_payment.id, '');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('void reason required', blocked, 'reason');

  select * into payment_row from public.create_payment_record(seed.invoice_id, 550, 'cash');
  select * into payment_row from public.update_payment_record_draft(payment_row.id, 550, 'cash', current_date, 'CASH-1', null);
  select * into payment_row from public.record_payment(payment_row.id);
  select * into summary_row from public.get_invoice_payment_summary(seed.invoice_id);
  perform pg_temp.record_payment_check('amount freed by void can be recorded again', summary_row.recorded_amount = 1000 and summary_row.remaining_balance = 0 and summary_row.recorded_payment_count = 2, row_to_json(summary_row)::text);

  perform set_config('request.jwt.claim.sub', second_seed.manufacturer_owner_id::text, true);
  blocked := false;
  begin
    select * into payment_row from public.create_payment_record(second_seed.invoice_id, 200, 'wire');
    perform public.update_payment_record_draft(payment_row.id, 1200, 'wire', null, null, null);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('draft update cannot exceed remaining balance', blocked, 'draft over balance');

  select * into payment_row from public.create_payment_record(second_seed.invoice_id, 100, 'wire');

  perform set_config('request.jwt.claim.sub', second_seed.buyer_id::text, true);
  blocked := false;
  begin
    perform public.create_payment_record(second_seed.invoice_id, 100, 'wire');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('buyer cannot create payment record', blocked, 'buyer denied');

  select count(*) into visible_count from public.payment_records where invoice_id = second_seed.invoice_id;
  perform pg_temp.record_payment_check('buyer can read own payment records', visible_count = 1, 'buyer visible');

  perform set_config('request.jwt.claim.sub', seed.other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.payment_records where invoice_id = second_seed.invoice_id;
  perform pg_temp.record_payment_check('other manufacturer cannot read payment records', visible_count = 0, 'other manufacturer select');

  blocked := false;
  begin
    perform public.record_payment(recorded_payment.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('other manufacturer cannot mutate payment records', blocked, 'other manufacturer denied');

  perform set_config('request.jwt.claim.sub', seed.admin_id::text, true);
  select count(*) into visible_count from public.payment_records where id = recorded_payment.id;
  perform pg_temp.record_payment_check('admin can read all payment records', visible_count = 1, 'admin select');

  blocked := false;
  begin
    perform public.void_payment_record(recorded_payment.id, 'Admin void');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('admin cannot mutate payment records', blocked, 'admin denied');

  reset role;
  blocked := false;
  begin
    insert into public.payment_records(payment_number, invoice_id, invoice_number, contract_id, contract_number, purchase_order_id, purchase_order_number, buyer_id, manufacturer_id, currency, amount, payment_method, invoice_snapshot, party_snapshot, payment_snapshot, created_by)
    select 'PAY-2099-999999', i.id, i.invoice_number, i.contract_id, i.contract_number, i.purchase_order_id, i.purchase_order_number, i.buyer_id, i.manufacturer_id, i.currency, 1, 'wire', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, seed.manufacturer_owner_id
    from public.invoices i
    where i.id = seed.invoice_id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('direct payment insert blocked by trigger', blocked, 'direct insert');

  blocked := false;
  begin
    update public.payment_records set amount = 1 where id = recorded_payment.id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('direct payment update blocked by trigger', blocked, 'direct update');

  blocked := false;
  begin
    delete from public.payment_events where payment_record_id = recorded_payment.id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('payment events immutable', blocked, 'event delete');

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    select count(*) into visible_count from public.payment_records;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_payment_check('anonymous cannot read payment records', blocked, 'anon select denied');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', seed.manufacturer_owner_id::text, true);
  select count(*) into event_count
  from public.payment_events
  where metadata ?| array['actor_id','actor_profile_id','payment_token','provider_secret','access_token','refresh_token','webhook_secret','card_number','account_number','routing_number'];
  perform pg_temp.record_payment_check('event metadata strips impersonation and payment secrets', event_count = 0, 'metadata stripped');

  perform pg_temp.record_payment_check('no processing lifecycle states exist', not exists (
    select 1
    from pg_constraint
    where conname = 'payment_records_status_check'
      and pg_get_constraintdef(oid) ~ 'processed|settled|reconciled|refunded|chargeback|paid|failed'
  ), 'status constraint');

  perform pg_temp.record_payment_check('no processing payment methods exist', not exists (
    select 1
    from pg_constraint
    where conname = 'payment_records_method_check'
      and pg_get_constraintdef(oid) ~ 'stripe|paypal|ach|card|checkout'
  ), 'method constraint');
end;
$$;

select check_name, passed, detail
from payment_recording_results
order by check_name;

do $$
declare
  failed_count integer;
  total_count integer;
  failed_checks text;
begin
  select count(*), count(*) filter (where not passed)
  into total_count, failed_count
  from payment_recording_results;

  if failed_count > 0 then
    select string_agg(check_name || ' [' || detail || ']', '; ' order by check_name)
    into failed_checks
    from payment_recording_results
    where not passed;
    raise exception 'Payment recording foundation security verification failed: %/% checks failed: %', failed_count, total_count, failed_checks;
  end if;

  raise notice 'Payment recording foundation security verification passed: %/% checks', total_count, total_count;
end;
$$;

rollback;
