-- PH-009B Payment Recording Foundation.
-- Internal external-payment recording only: no payment processing, bank verification, settlement, reconciliation, refunds, payment links, invoice PDFs, shipping, customs, or paid invoice states.

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
stable
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

  if payment_date_value is not null and payment_date_value > current_date then
    raise exception 'Payment date cannot be in the future.';
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
