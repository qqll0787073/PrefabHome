begin;

-- PH-009A Invoice Foundation.
-- Internal invoice preparation only: no payment processing, email delivery, PDFs, payment links, paid/overdue/refunded states, shipping, customs, or accounting integrations.

create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  contract_number text not null,
  purchase_order_id uuid not null unique references public.purchase_orders(id) on delete restrict,
  purchase_order_number text not null,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'draft',
  version integer not null default 1,
  currency text not null,
  subtotal numeric(14,2) not null,
  tax_amount numeric(14,2) not null default 0,
  shipping_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null,
  issue_date date,
  due_date date,
  billing_name text,
  billing_email text,
  billing_address jsonb,
  contract_snapshot jsonb not null,
  purchase_order_snapshot jsonb not null,
  buyer_snapshot jsonb not null,
  manufacturer_snapshot jsonb not null,
  line_items_snapshot jsonb not null,
  amount_snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_number_format_check check (invoice_number ~ '^INV-[0-9]{4}-[0-9]{6}$'),
  constraint invoices_status_check check (status in ('draft', 'issued', 'cancelled')),
  constraint invoices_version_check check (version > 0),
  constraint invoices_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_amounts_non_negative_check check (
    subtotal >= 0
    and tax_amount >= 0
    and shipping_amount >= 0
    and discount_amount >= 0
    and total_amount >= 0
  ),
  constraint invoices_total_amount_check check (
    total_amount = round((subtotal + tax_amount + shipping_amount - discount_amount)::numeric, 2)
  ),
  constraint invoices_discount_check check (discount_amount <= subtotal + tax_amount + shipping_amount),
  constraint invoices_date_order_check check (
    issue_date is null or due_date is null or due_date >= issue_date
  ),
  constraint invoices_billing_name_length_check check (
    billing_name is null or char_length(billing_name) between 1 and 160
  ),
  constraint invoices_billing_email_length_check check (
    billing_email is null or char_length(billing_email) between 1 and 254
  ),
  constraint invoices_billing_email_format_check check (
    billing_email is null or billing_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint invoices_billing_address_object_check check (
    billing_address is null or jsonb_typeof(billing_address) = 'object'
  ),
  constraint invoices_line_items_snapshot_check check (
    jsonb_typeof(line_items_snapshot) = 'array' and jsonb_array_length(line_items_snapshot) > 0
  ),
  constraint invoices_amount_snapshot_check check (jsonb_typeof(amount_snapshot) = 'object'),
  constraint invoices_lifecycle_check check (
    (status = 'draft' and issued_at is null and cancelled_at is null and cancellation_reason is null)
    or (status = 'issued' and issued_at is not null and cancelled_at is null and cancellation_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and cancellation_reason is not null)
  )
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_number integer not null,
  source_po_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  description text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(14,2) not null,
  line_subtotal numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint invoice_line_items_invoice_line_unique unique (invoice_id, line_number),
  constraint invoice_line_items_source_unique unique (invoice_id, source_po_item_id),
  constraint invoice_line_items_line_number_check check (line_number > 0),
  constraint invoice_line_items_description_length_check check (char_length(description) between 1 and 500),
  constraint invoice_line_items_quantity_check check (quantity > 0),
  constraint invoice_line_items_unit_price_check check (unit_price >= 0),
  constraint invoice_line_items_subtotal_check check (line_subtotal = round((quantity * unit_price)::numeric, 2))
);

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint invoice_events_type_check check (
    event_type in ('invoice_created', 'invoice_updated', 'invoice_issued', 'invoice_cancelled')
  )
);

create index if not exists invoices_buyer_status_idx
  on public.invoices (buyer_id, status, created_at desc);

create index if not exists invoices_manufacturer_status_idx
  on public.invoices (manufacturer_id, status, created_at desc);

create index if not exists invoices_contract_idx
  on public.invoices (contract_id);

create index if not exists invoice_line_items_invoice_line_idx
  on public.invoice_line_items (invoice_id, line_number);

create index if not exists invoice_events_invoice_created_idx
  on public.invoice_events (invoice_id, created_at);

alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_events enable row level security;

grant select on table public.invoices to authenticated;
grant select on table public.invoice_line_items to authenticated;
grant select on table public.invoice_events to authenticated;
revoke all on table public.invoices from anon;
revoke all on table public.invoice_line_items from anon;
revoke all on table public.invoice_events from anon;
revoke insert, update, delete on table public.invoices from authenticated;
revoke insert, update, delete on table public.invoice_line_items from authenticated;
revoke insert, update, delete on table public.invoice_events from authenticated;

create or replace function public.is_trusted_invoice_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.invoice_trusted_write', true), '') = 'on';
$$;

create or replace function public.generate_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sequence_value bigint;
begin
  sequence_value := nextval('public.invoice_number_seq');
  return 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(sequence_value::text, 6, '0');
end;
$$;

create or replace function public.can_access_invoice(invoice_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invoices i
    where i.id = invoice_uuid
      and (
        i.buyer_id = auth.uid()
        or public.owns_manufacturer(i.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.calculate_invoice_total(
  subtotal_value numeric,
  tax_amount_value numeric,
  shipping_amount_value numeric,
  discount_amount_value numeric
)
returns numeric
language sql
immutable
as $$
  select round((
    coalesce(subtotal_value, 0)
    + coalesce(tax_amount_value, 0)
    + coalesce(shipping_amount_value, 0)
    - coalesce(discount_amount_value, 0)
  )::numeric, 2)
$$;

create or replace function public.build_invoice_amount_snapshot(
  subtotal_value numeric,
  tax_amount_value numeric,
  shipping_amount_value numeric,
  discount_amount_value numeric,
  total_amount_value numeric
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'subtotal', subtotal_value,
    'tax_amount', tax_amount_value,
    'shipping_amount', shipping_amount_value,
    'discount_amount', discount_amount_value,
    'total_amount', total_amount_value,
    'tax_is_manual_preparation_only', true,
    'payment_recorded', false
  )
$$;

create or replace function public.build_invoice_line_items_snapshot(invoice_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'line_number', item.line_number,
        'source_po_item_id', item.source_po_item_id,
        'product_id', item.product_id,
        'description', item.description,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'line_subtotal', item.line_subtotal
      )
      order by item.line_number
    ),
    '[]'::jsonb
  )
  from public.invoice_line_items item
  where item.invoice_id = invoice_uuid
$$;

create or replace function public.strip_invoice_event_metadata(event_metadata jsonb)
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
    - 'payment_secret'
    - 'provider_token'
    - 'provider_secret'
    - 'stripe_secret'
    - 'paypal_secret'
    - 'access_token'
    - 'refresh_token'
$$;

create or replace function public.insert_trusted_invoice_event(
  invoice_uuid uuid,
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
  if event_name not in ('invoice_created', 'invoice_updated', 'invoice_issued', 'invoice_cancelled') then
    raise exception 'Invoice event type must be generated by a trusted flow.';
  end if;

  insert into public.invoice_events (
    invoice_id,
    event_type,
    actor_profile_id,
    metadata
  )
  values (
    invoice_uuid,
    event_name,
    actor_uuid,
    public.strip_invoice_event_metadata(event_metadata)
  );
end;
$$;

create or replace function public.assert_invoice_amounts(
  subtotal_value numeric,
  tax_amount_value numeric,
  shipping_amount_value numeric,
  discount_amount_value numeric
)
returns void
language plpgsql
immutable
as $$
begin
  if subtotal_value < 0
    or tax_amount_value < 0
    or shipping_amount_value < 0
    or discount_amount_value < 0 then
    raise exception 'Invoice amounts must be zero or greater.';
  end if;

  if discount_amount_value > subtotal_value + tax_amount_value + shipping_amount_value then
    raise exception 'Discount cannot exceed subtotal plus tax and shipping.';
  end if;
end;
$$;

create or replace function public.normalize_invoice_billing_address(
  billing_address_value jsonb,
  require_complete boolean default false
)
returns jsonb
language plpgsql
immutable
as $$
declare
  address_line1_text text;
  address_line2_text text;
  city_text text;
  state_region_text text;
  postal_code_text text;
  country_code_text text;
begin
  if billing_address_value is null then
    if require_complete then
      raise exception 'Complete billing address is required before issuing.';
    end if;
    return null;
  end if;

  if jsonb_typeof(billing_address_value) <> 'object' then
    raise exception 'Billing address must be a JSON object.';
  end if;

  if billing_address_value ? 'address_line1' and jsonb_typeof(billing_address_value->'address_line1') <> 'string' then
    raise exception 'Billing address line 1 must be a string.';
  end if;
  if billing_address_value ? 'address_line2'
    and billing_address_value->'address_line2' <> 'null'::jsonb
    and jsonb_typeof(billing_address_value->'address_line2') <> 'string' then
    raise exception 'Billing address line 2 must be a string.';
  end if;
  if billing_address_value ? 'city' and jsonb_typeof(billing_address_value->'city') <> 'string' then
    raise exception 'Billing city must be a string.';
  end if;
  if billing_address_value ? 'state_region' and jsonb_typeof(billing_address_value->'state_region') <> 'string' then
    raise exception 'Billing state or region must be a string.';
  end if;
  if billing_address_value ? 'postal_code' and jsonb_typeof(billing_address_value->'postal_code') <> 'string' then
    raise exception 'Billing postal code must be a string.';
  end if;
  if billing_address_value ? 'country_code' and jsonb_typeof(billing_address_value->'country_code') <> 'string' then
    raise exception 'Billing country code must be a string.';
  end if;

  address_line1_text := nullif(btrim(coalesce(billing_address_value->>'address_line1', '')), '');
  address_line2_text := nullif(btrim(coalesce(billing_address_value->>'address_line2', '')), '');
  city_text := nullif(btrim(coalesce(billing_address_value->>'city', '')), '');
  state_region_text := nullif(btrim(coalesce(billing_address_value->>'state_region', '')), '');
  postal_code_text := nullif(btrim(coalesce(billing_address_value->>'postal_code', '')), '');
  country_code_text := nullif(upper(btrim(coalesce(billing_address_value->>'country_code', ''))), '');

  if require_complete and (
    address_line1_text is null
    or city_text is null
    or state_region_text is null
    or postal_code_text is null
    or country_code_text is null
  ) then
    raise exception 'Complete billing address is required before issuing.';
  end if;

  if address_line1_text is not null and char_length(address_line1_text) > 200 then
    raise exception 'Billing address line 1 must be 200 characters or fewer.';
  end if;
  if address_line2_text is not null and char_length(address_line2_text) > 200 then
    raise exception 'Billing address line 2 must be 200 characters or fewer.';
  end if;
  if city_text is not null and char_length(city_text) > 120 then
    raise exception 'Billing city must be 120 characters or fewer.';
  end if;
  if state_region_text is not null and char_length(state_region_text) > 120 then
    raise exception 'Billing state or region must be 120 characters or fewer.';
  end if;
  if postal_code_text is not null and char_length(postal_code_text) > 32 then
    raise exception 'Billing postal code must be 32 characters or fewer.';
  end if;
  if country_code_text is not null and country_code_text !~ '^[A-Z]{2}$' then
    raise exception 'Billing country code must be exactly two letters.';
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'address_line1', address_line1_text,
    'address_line2', address_line2_text,
    'city', city_text,
    'state_region', state_region_text,
    'postal_code', postal_code_text,
    'country_code', country_code_text
  ));
end;
$$;

create or replace function public.assert_invoice_billing_values(
  billing_name_text text,
  billing_email_text text,
  billing_address_value jsonb,
  issue_date_value date,
  due_date_value date,
  require_complete boolean default false
)
returns void
language plpgsql
immutable
as $$
declare
  normalized_name text := nullif(btrim(coalesce(billing_name_text, '')), '');
  normalized_email text := nullif(lower(btrim(coalesce(billing_email_text, ''))), '');
begin
  if normalized_name is not null and char_length(normalized_name) > 160 then
    raise exception 'Billing name must be 160 characters or fewer.';
  end if;

  if normalized_email is not null and (
    char_length(normalized_email) > 254
    or normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ) then
    raise exception 'Billing email must be a valid email address.';
  end if;

  perform public.normalize_invoice_billing_address(billing_address_value, require_complete);

  if issue_date_value is not null and due_date_value is not null and due_date_value < issue_date_value then
    raise exception 'Due date must be on or after the issue date.';
  end if;

  if require_complete and (
    normalized_name is null
    or normalized_email is null
    or billing_address_value is null
    or issue_date_value is null
    or due_date_value is null
  ) then
    raise exception 'Complete billing data, issue date, and due date are required before issuing.';
  end if;
end;
$$;

create or replace function public.protect_invoice_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoices are auditable and cannot be deleted.';
  end if;

  new.currency := upper(new.currency);
  new.billing_name := nullif(btrim(coalesce(new.billing_name, '')), '');
  new.billing_email := nullif(lower(btrim(coalesce(new.billing_email, ''))), '');
  new.cancellation_reason := nullif(btrim(coalesce(new.cancellation_reason, '')), '');
  new.updated_at := now();

  if public.is_trusted_invoice_write() then
    return new;
  end if;

  raise exception 'Invoices must be changed through trusted RPCs.';
end;
$$;

create or replace function public.protect_invoice_line_item_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Invoice line items are immutable.';
  end if;

  new.description := btrim(new.description);

  if public.is_trusted_invoice_write() then
    return new;
  end if;

  raise exception 'Invoice line items must be created by trusted flows.';
end;
$$;

create or replace function public.protect_invoice_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Invoice events are immutable and cannot be changed.';
  end if;

  if public.is_trusted_invoice_write() then
    new.metadata := public.strip_invoice_event_metadata(new.metadata);
    return new;
  end if;

  raise exception 'Invoice events must be generated by trusted flows.';
end;
$$;

create or replace function public.create_invoice_from_purchase_order(purchase_order_uuid uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  po_row public.purchase_orders%rowtype;
  contract_row public.contracts%rowtype;
  package_row public.signature_packages%rowtype;
  invoice_row public.invoices%rowtype;
  copied_subtotal numeric(14,2);
  copied_count integer;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select role into actor_role from public.profiles where id = actor_uuid;
  if actor_role <> 'manufacturer' then
    raise exception 'Only manufacturers can create invoices.';
  end if;

  select * into po_row
  from public.purchase_orders
  where id = purchase_order_uuid
  for update;

  if po_row.id is null then
    raise exception 'Purchase order not found.';
  end if;

  if not public.owns_manufacturer(po_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can create this invoice.';
  end if;

  if po_row.status <> 'confirmed' then
    raise exception 'Invoices require a confirmed purchase order.';
  end if;

  select * into contract_row
  from public.contracts
  where purchase_order_id = po_row.id
    and status = 'accepted'
  for update;

  if contract_row.id is null then
    raise exception 'Invoices require an accepted contract linked to the purchase order.';
  end if;

  select * into package_row
  from public.signature_packages
  where contract_id = contract_row.id
    and status = 'ready_to_send'
  for update;

  if package_row.id is null then
    raise exception 'Invoices require a ready-to-send signature package linked to the accepted contract.';
  end if;

  if exists (select 1 from public.invoices where purchase_order_id = po_row.id) then
    raise exception 'An invoice already exists for this purchase order.';
  end if;

  select coalesce(sum(amount), 0)::numeric(14,2), count(*)
  into copied_subtotal, copied_count
  from public.purchase_order_items
  where purchase_order_id = po_row.id;

  if copied_count = 0 then
    raise exception 'Confirmed purchase order must include line items.';
  end if;

  if copied_subtotal is distinct from po_row.subtotal then
    raise exception 'Purchase order subtotal does not match line items.';
  end if;

  perform set_config('app.invoice_trusted_write', 'on', true);

  insert into public.invoices (
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
    subtotal,
    tax_amount,
    shipping_amount,
    discount_amount,
    total_amount,
    contract_snapshot,
    purchase_order_snapshot,
    buyer_snapshot,
    manufacturer_snapshot,
    line_items_snapshot,
    amount_snapshot,
    created_by
  )
  values (
    public.generate_invoice_number(),
    contract_row.id,
    contract_row.contract_number,
    po_row.id,
    po_row.po_number,
    po_row.buyer_id,
    po_row.manufacturer_id,
    'draft',
    1,
    po_row.currency,
    po_row.subtotal,
    0,
    0,
    0,
    po_row.subtotal,
    jsonb_build_object(
      'contract_id', contract_row.id,
      'contract_number', contract_row.contract_number,
      'status', contract_row.status,
      'accepted_at', contract_row.accepted_at,
      'contract_title', contract_row.contract_title,
      'governing_law', contract_row.governing_law
    ),
    jsonb_build_object(
      'purchase_order_id', po_row.id,
      'po_number', po_row.po_number,
      'status', po_row.status,
      'confirmed_at', po_row.confirmed_at,
      'currency', po_row.currency,
      'subtotal', po_row.subtotal
    ),
    po_row.buyer_snapshot,
    po_row.manufacturer_snapshot,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'source_po_item_id', item.id,
            'line_number', item.line_order,
            'description', item.description,
            'quantity', item.quantity,
            'unit_price', item.unit_price,
            'line_subtotal', item.amount
          )
          order by item.line_order
        ),
        '[]'::jsonb
      )
      from public.purchase_order_items item
      where item.purchase_order_id = po_row.id
    ),
    public.build_invoice_amount_snapshot(po_row.subtotal, 0, 0, 0, po_row.subtotal),
    actor_uuid
  )
  returning * into invoice_row;

  insert into public.invoice_line_items (
    invoice_id,
    line_number,
    source_po_item_id,
    product_id,
    description,
    quantity,
    unit_price,
    line_subtotal
  )
  select
    invoice_row.id,
    item.line_order,
    item.id,
    null,
    item.description,
    item.quantity,
    item.unit_price,
    item.amount
  from public.purchase_order_items item
  where item.purchase_order_id = po_row.id
  order by item.line_order;

  update public.invoices
  set line_items_snapshot = public.build_invoice_line_items_snapshot(invoice_row.id)
  where id = invoice_row.id
  returning * into invoice_row;

  perform public.insert_trusted_invoice_event(
    invoice_row.id,
    'invoice_created',
    actor_uuid,
    jsonb_build_object(
      'invoice_number', invoice_row.invoice_number,
      'purchase_order_id', po_row.id,
      'purchase_order_number', po_row.po_number,
      'contract_id', contract_row.id,
      'contract_number', contract_row.contract_number,
      'issued_means_sent', false,
      'payment_recorded', false
    )
  );

  perform set_config('app.invoice_trusted_write', '', true);
  return invoice_row;
exception when others then
  perform set_config('app.invoice_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.update_invoice_draft(
  invoice_uuid uuid,
  issue_date_value date,
  due_date_value date,
  billing_name_text text,
  billing_email_text text,
  billing_address_value jsonb,
  tax_amount_value numeric,
  shipping_amount_value numeric,
  discount_amount_value numeric
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  invoice_row public.invoices%rowtype;
  normalized_tax numeric(14,2) := round(coalesce(tax_amount_value, 0)::numeric, 2);
  normalized_shipping numeric(14,2) := round(coalesce(shipping_amount_value, 0)::numeric, 2);
  normalized_discount numeric(14,2) := round(coalesce(discount_amount_value, 0)::numeric, 2);
  calculated_total numeric(14,2);
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select * into invoice_row
  from public.invoices
  where id = invoice_uuid
  for update;

  if invoice_row.id is null then
    raise exception 'Invoice not found.';
  end if;

  if not public.owns_manufacturer(invoice_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can update this invoice draft.';
  end if;

  if invoice_row.status <> 'draft' then
    raise exception 'Only draft invoices can be updated.';
  end if;

  perform public.assert_invoice_billing_values(
    billing_name_text,
    billing_email_text,
    billing_address_value,
    issue_date_value,
    due_date_value,
    false
  );
  perform public.assert_invoice_amounts(invoice_row.subtotal, normalized_tax, normalized_shipping, normalized_discount);
  calculated_total := public.calculate_invoice_total(
    invoice_row.subtotal,
    normalized_tax,
    normalized_shipping,
    normalized_discount
  );

  perform set_config('app.invoice_trusted_write', 'on', true);

  update public.invoices
  set issue_date = issue_date_value,
      due_date = due_date_value,
      billing_name = nullif(btrim(coalesce(billing_name_text, '')), ''),
      billing_email = nullif(lower(btrim(coalesce(billing_email_text, ''))), ''),
      billing_address = public.normalize_invoice_billing_address(billing_address_value, false),
      tax_amount = normalized_tax,
      shipping_amount = normalized_shipping,
      discount_amount = normalized_discount,
      total_amount = calculated_total,
      amount_snapshot = public.build_invoice_amount_snapshot(
        subtotal,
        normalized_tax,
        normalized_shipping,
        normalized_discount,
        calculated_total
      )
  where id = invoice_uuid
    and status = 'draft'
  returning * into invoice_row;

  if not found then
    raise exception 'Invoice draft lifecycle conflict while updating.';
  end if;

  perform public.insert_trusted_invoice_event(
    invoice_row.id,
    'invoice_updated',
    actor_uuid,
    jsonb_build_object('invoice_number', invoice_row.invoice_number)
  );

  perform set_config('app.invoice_trusted_write', '', true);
  return invoice_row;
exception when others then
  perform set_config('app.invoice_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.issue_invoice(invoice_uuid uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  invoice_row public.invoices%rowtype;
  po_status text;
  contract_status text;
  package_status text;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  select * into invoice_row
  from public.invoices
  where id = invoice_uuid
  for update;

  if invoice_row.id is null then
    raise exception 'Invoice not found.';
  end if;

  if not public.owns_manufacturer(invoice_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can issue this invoice.';
  end if;

  if invoice_row.status <> 'draft' then
    raise exception 'Only draft invoices can be issued.';
  end if;

  perform public.assert_invoice_billing_values(
    invoice_row.billing_name,
    invoice_row.billing_email,
    invoice_row.billing_address,
    invoice_row.issue_date,
    invoice_row.due_date,
    true
  );
  perform public.assert_invoice_amounts(invoice_row.subtotal, invoice_row.tax_amount, invoice_row.shipping_amount, invoice_row.discount_amount);

  select status into po_status from public.purchase_orders where id = invoice_row.purchase_order_id for update;
  select status into contract_status from public.contracts where id = invoice_row.contract_id for update;
  select status into package_status from public.signature_packages where contract_id = invoice_row.contract_id for update;

  if po_status <> 'confirmed' then
    raise exception 'Source purchase order must remain confirmed before issuing.';
  end if;
  if contract_status <> 'accepted' then
    raise exception 'Source contract must remain accepted before issuing.';
  end if;
  if package_status <> 'ready_to_send' then
    raise exception 'Source signature package must remain ready to send before issuing.';
  end if;
  if jsonb_array_length(invoice_row.line_items_snapshot) = 0 then
    raise exception 'Invoice line items are required before issuing.';
  end if;

  perform set_config('app.invoice_trusted_write', 'on', true);

  update public.invoices
  set status = 'issued',
      issued_at = now(),
      cancelled_at = null,
      cancellation_reason = null,
      amount_snapshot = public.build_invoice_amount_snapshot(
        subtotal,
        tax_amount,
        shipping_amount,
        discount_amount,
        total_amount
      )
  where id = invoice_uuid
    and status = 'draft'
  returning * into invoice_row;

  if not found then
    raise exception 'Invoice lifecycle conflict while issuing.';
  end if;

  perform public.insert_trusted_invoice_event(
    invoice_row.id,
    'invoice_issued',
    actor_uuid,
    jsonb_build_object(
      'invoice_number', invoice_row.invoice_number,
      'issued_means_sent', false,
      'payment_recorded', false
    )
  );

  perform set_config('app.invoice_trusted_write', '', true);
  return invoice_row;
exception when others then
  perform set_config('app.invoice_trusted_write', '', true);
  raise;
end;
$$;

create or replace function public.cancel_invoice(invoice_uuid uuid, reason_text text)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid := auth.uid();
  invoice_row public.invoices%rowtype;
  normalized_reason text := nullif(btrim(coalesce(reason_text, '')), '');
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.';
  end if;

  if normalized_reason is null then
    raise exception 'Cancellation reason is required.';
  end if;

  if char_length(normalized_reason) > 2000 then
    raise exception 'Cancellation reason must be 2000 characters or fewer.';
  end if;

  select * into invoice_row
  from public.invoices
  where id = invoice_uuid
  for update;

  if invoice_row.id is null then
    raise exception 'Invoice not found.';
  end if;

  if not public.owns_manufacturer(invoice_row.manufacturer_id) then
    raise exception 'Only the assigned manufacturer can cancel this invoice.';
  end if;

  if invoice_row.status not in ('draft', 'issued') then
    raise exception 'Only draft or issued invoices can be cancelled.';
  end if;

  perform set_config('app.invoice_trusted_write', 'on', true);

  update public.invoices
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = normalized_reason
  where id = invoice_uuid
    and status in ('draft', 'issued')
  returning * into invoice_row;

  if not found then
    raise exception 'Invoice lifecycle conflict while cancelling.';
  end if;

  perform public.insert_trusted_invoice_event(
    invoice_row.id,
    'invoice_cancelled',
    actor_uuid,
    jsonb_build_object('invoice_number', invoice_row.invoice_number, 'reason', normalized_reason)
  );

  perform set_config('app.invoice_trusted_write', '', true);
  return invoice_row;
exception when others then
  perform set_config('app.invoice_trusted_write', '', true);
  raise;
end;
$$;

drop trigger if exists protect_invoice_write on public.invoices;
create trigger protect_invoice_write
before insert or update or delete on public.invoices
for each row execute function public.protect_invoice_write();

drop trigger if exists protect_invoice_line_item_write on public.invoice_line_items;
create trigger protect_invoice_line_item_write
before insert or update or delete on public.invoice_line_items
for each row execute function public.protect_invoice_line_item_write();

drop trigger if exists protect_invoice_event_write on public.invoice_events;
create trigger protect_invoice_event_write
before insert or update or delete on public.invoice_events
for each row execute function public.protect_invoice_event_write();

drop policy if exists "invoices_select_participant_or_admin" on public.invoices;
create policy "invoices_select_participant_or_admin"
on public.invoices
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

drop policy if exists "invoice_line_items_select_participant_or_admin" on public.invoice_line_items;
create policy "invoice_line_items_select_participant_or_admin"
on public.invoice_line_items
for select
to authenticated
using (public.can_access_invoice(invoice_id));

drop policy if exists "invoice_events_select_participant_or_admin" on public.invoice_events;
create policy "invoice_events_select_participant_or_admin"
on public.invoice_events
for select
to authenticated
using (public.can_access_invoice(invoice_id));

revoke all on function public.is_trusted_invoice_write() from public, anon, authenticated;
revoke all on function public.generate_invoice_number() from public, anon, authenticated;
revoke all on function public.can_access_invoice(uuid) from public, anon, authenticated;
revoke all on function public.calculate_invoice_total(numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.build_invoice_amount_snapshot(numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.build_invoice_line_items_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.strip_invoice_event_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.insert_trusted_invoice_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.assert_invoice_amounts(numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.normalize_invoice_billing_address(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.assert_invoice_billing_values(text, text, jsonb, date, date, boolean) from public, anon, authenticated;
revoke all on function public.protect_invoice_write() from public, anon, authenticated;
revoke all on function public.protect_invoice_line_item_write() from public, anon, authenticated;
revoke all on function public.protect_invoice_event_write() from public, anon, authenticated;

revoke all on function public.create_invoice_from_purchase_order(uuid) from public, anon, authenticated;
revoke all on function public.update_invoice_draft(uuid, date, date, text, text, jsonb, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.issue_invoice(uuid) from public, anon, authenticated;
revoke all on function public.cancel_invoice(uuid, text) from public, anon, authenticated;

grant execute on function public.can_access_invoice(uuid) to authenticated;
grant execute on function public.create_invoice_from_purchase_order(uuid) to authenticated;
grant execute on function public.update_invoice_draft(uuid, date, date, text, text, jsonb, numeric, numeric, numeric) to authenticated;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;

create temp table invoice_security_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

grant select, insert on invoice_security_results to anon, authenticated;

create or replace function pg_temp.record_invoice_check(check_name text, passed boolean, detail text default '')
returns void
language plpgsql
as $$
begin
  insert into invoice_security_results values (check_name, passed, coalesce(detail, ''));
end;
$$;

create or replace function pg_temp.seed_invoice_source(label_text text)
returns table (
  buyer_id uuid,
  manufacturer_owner_id uuid,
  other_manufacturer_owner_id uuid,
  admin_id uuid,
  manufacturer_id uuid,
  purchase_order_id uuid,
  contract_id uuid,
  package_id uuid
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
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', buyer_uuid, 'authenticated', 'authenticated', label_text || '-buyer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Invoice Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Invoice Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-other-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_uuid, 'authenticated', 'authenticated', label_text || '-admin@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Invoice Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

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
  values (manufacturer_uuid, label_text || ' Home', label_text || ' Model', 'Modular', 'Invoice verification product.', 'USD', 'draft')
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
  values (quote_uuid, 1, 'product', label_text || ' module', 2, 'unit', 500);
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
    jsonb_build_object('profile_id', buyer_uuid, 'full_name', 'Invoice Buyer', 'email', label_text || '-buyer@example.test'),
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

  return query select buyer_uuid, manufacturer_owner_uuid, other_manufacturer_owner_uuid, admin_uuid, manufacturer_uuid, po_uuid, contract_uuid, package_uuid;
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
  invoice_row public.invoices%rowtype;
  issued_invoice public.invoices%rowtype;
  cancelled_invoice public.invoices%rowtype;
  blocked boolean;
  visible_count integer;
  event_count integer;
  line_count integer;
  old_total numeric;
begin
  select * into seed from pg_temp.seed_invoice_source('invoice-primary');
  select * into second_seed from pg_temp.seed_invoice_source('invoice-second');

  set local role authenticated;

  perform set_config('request.jwt.claim.sub', seed.manufacturer_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select * into invoice_row from public.create_invoice_from_purchase_order(seed.purchase_order_id);

  perform pg_temp.record_invoice_check('assigned manufacturer creates draft invoice', invoice_row.status = 'draft' and invoice_row.purchase_order_id = seed.purchase_order_id, invoice_row.invoice_number);
  perform pg_temp.record_invoice_check('invoice number is database generated', invoice_row.invoice_number ~ '^INV-[0-9]{4}-[0-9]{6}$', invoice_row.invoice_number);
  perform pg_temp.record_invoice_check('source parties are derived', invoice_row.buyer_id = seed.buyer_id and invoice_row.manufacturer_id = seed.manufacturer_id, 'parties');
  perform pg_temp.record_invoice_check('source references are derived', invoice_row.contract_id = seed.contract_id and invoice_row.purchase_order_id = seed.purchase_order_id, 'sources');
  perform pg_temp.record_invoice_check('subtotal is derived from PO', invoice_row.subtotal = 1000 and invoice_row.total_amount = 1000, 'amounts');

  select count(*) into line_count from public.invoice_line_items where invoice_id = invoice_row.id;
  perform pg_temp.record_invoice_check('line items are derived', line_count = 1, 'line count ' || line_count);
  perform pg_temp.record_invoice_check('line item subtotal formula enforced', exists (select 1 from public.invoice_line_items where invoice_id = invoice_row.id and line_subtotal = quantity * unit_price), 'formula');
  perform pg_temp.record_invoice_check('created event inserted once', (select count(*) from public.invoice_events where invoice_id = invoice_row.id and event_type = 'invoice_created') = 1, 'event');

  blocked := false;
  begin
    perform public.create_invoice_from_purchase_order(seed.purchase_order_id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('duplicate invoice for PO blocked', blocked, 'duplicate blocked');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St"}'::jsonb, 80, 120, 2000);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('discount over available amount blocked', blocked, 'discount blocked');

  select total_amount into old_total from public.invoices where id = invoice_row.id;
  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St"}'::jsonb, 80, 120, 50);
  perform pg_temp.record_invoice_check('draft update recalculates total', invoice_row.total_amount = 1150 and invoice_row.total_amount <> old_total, invoice_row.total_amount::text);
  perform pg_temp.record_invoice_check('amount snapshot updated by trusted draft update', (invoice_row.amount_snapshot->>'total_amount')::numeric = 1150, invoice_row.amount_snapshot::text);
  perform pg_temp.record_invoice_check('updated event inserted', exists (select 1 from public.invoice_events where invoice_id = invoice_row.id and event_type = 'invoice_updated'), 'updated event');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date + 30, current_date, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St"}'::jsonb, 0, 0, 0);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('invalid due date blocked', blocked, 'date blocked');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', null, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('null billing address denied on issue', blocked, 'null address');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('empty billing address denied on issue', blocked, 'empty address');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('missing address_line1 denied on issue', blocked, 'missing line1');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('missing city denied on issue', blocked, 'missing city');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St","city":"Los Angeles","postal_code":"90001","country_code":"US"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('missing state_region denied on issue', blocked, 'missing state');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","country_code":"US"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('missing postal_code denied on issue', blocked, 'missing postal');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('missing country_code denied on issue', blocked, 'missing country');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('blank required address value denied on issue', blocked, 'blank line1');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"   ","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 80, 120, 50);
  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('whitespace required address value denied on issue', blocked, 'whitespace line1');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":123,"city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 80, 120, 50);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('non-string required address value denied', blocked, 'non-string line1');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"USA"}'::jsonb, 80, 120, 50);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('invalid country code denied', blocked, 'bad country');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', jsonb_build_object('address_line1', repeat('x', 201), 'city', 'Los Angeles', 'state_region', 'CA', 'postal_code', '90001', 'country_code', 'US'), 80, 120, 50);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('overlong address value denied', blocked, 'overlong line1');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"1 Main St"}'::jsonb, 80, 120, 50);
  perform pg_temp.record_invoice_check('partial address allowed while draft', invoice_row.status = 'draft' and invoice_row.billing_address = '{"address_line1":"1 Main St"}'::jsonb, invoice_row.billing_address::text);

  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('partial address cannot be issued', blocked, 'partial issue');

  select * into invoice_row from public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Invoice Buyer', 'buyer@example.test', '{"address_line1":"  1 Main St  ","address_line2":"   ","city":" Los Angeles ","state_region":" CA ","postal_code":" 90001 ","country_code":"us","ignored":"safe"}'::jsonb, 80, 120, 50);
  perform pg_temp.record_invoice_check('valid complete billing address accepted', invoice_row.billing_address->>'address_line1' = '1 Main St' and invoice_row.billing_address->>'city' = 'Los Angeles', invoice_row.billing_address::text);
  perform pg_temp.record_invoice_check('address values normalized', invoice_row.billing_address = '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, invoice_row.billing_address::text);

  select * into issued_invoice from public.issue_invoice(invoice_row.id);
  perform pg_temp.record_invoice_check('issue sets issued timestamp', issued_invoice.status = 'issued' and issued_invoice.issued_at is not null and issued_invoice.cancelled_at is null, 'issued');
  perform pg_temp.record_invoice_check('issued event inserted once', (select count(*) from public.invoice_events where invoice_id = invoice_row.id and event_type = 'invoice_issued') = 1, 'issued event');

  blocked := false;
  begin
    perform public.issue_invoice(invoice_row.id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('duplicate issue denied', blocked, 'duplicate issue');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'Other', 'buyer@example.test', '{"line1":"1 Main St"}'::jsonb, 0, 0, 0);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('issued invoice draft update denied', blocked, 'issued immutable');

  select * into cancelled_invoice from public.cancel_invoice(invoice_row.id, 'Commercial pause');
  perform pg_temp.record_invoice_check('issued invoice can be cancelled with timestamp', cancelled_invoice.status = 'cancelled' and cancelled_invoice.cancelled_at is not null and cancelled_invoice.cancellation_reason = 'Commercial pause', 'cancelled');
  perform pg_temp.record_invoice_check('cancel event inserted once', (select count(*) from public.invoice_events where invoice_id = invoice_row.id and event_type = 'invoice_cancelled') = 1, 'cancelled event');

  blocked := false;
  begin
    perform public.cancel_invoice(invoice_row.id, 'Again');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('repeated cancel denied', blocked, 'terminal');

  perform set_config('request.jwt.claim.sub', second_seed.manufacturer_owner_id::text, true);
  select * into invoice_row from public.create_invoice_from_purchase_order(second_seed.purchase_order_id);

  blocked := false;
  begin
    perform public.cancel_invoice(invoice_row.id, '');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('cancel reason required', blocked, 'reason');

  select * into cancelled_invoice from public.cancel_invoice(invoice_row.id, 'Draft cancelled');
  perform pg_temp.record_invoice_check('draft invoice cancellation has cancelled timestamp only', cancelled_invoice.status = 'cancelled' and cancelled_invoice.cancelled_at is not null and cancelled_invoice.issued_at is null, 'draft cancel');

  perform set_config('request.jwt.claim.sub', second_seed.buyer_id::text, true);
  select count(*) into visible_count from public.invoices where id = invoice_row.id;
  perform pg_temp.record_invoice_check('buyer can read own invoice', visible_count = 1, 'buyer select');

  blocked := false;
  begin
    perform public.create_invoice_from_purchase_order(seed.purchase_order_id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('buyer cannot create invoice', blocked, 'buyer denied');

  perform set_config('request.jwt.claim.sub', seed.other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.invoices where id = invoice_row.id;
  perform pg_temp.record_invoice_check('other manufacturer cannot read invoice', visible_count = 0, 'other manufacturer select');

  blocked := false;
  begin
    perform public.update_invoice_draft(invoice_row.id, current_date, current_date + 30, 'X', 'x@example.test', '{}'::jsonb, 0, 0, 0);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('other manufacturer cannot mutate invoice', blocked, 'other manufacturer denied');

  perform set_config('request.jwt.claim.sub', seed.admin_id::text, true);
  select count(*) into visible_count from public.invoices where id = invoice_row.id;
  perform pg_temp.record_invoice_check('admin can read all invoices', visible_count = 1, 'admin select');

  blocked := false;
  begin
    perform public.cancel_invoice(invoice_row.id, 'Admin cancel');
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('admin cannot mutate invoice', blocked, 'admin denied');

  reset role;
  blocked := false;
  begin
    insert into public.invoices(invoice_number, contract_id, contract_number, purchase_order_id, purchase_order_number, buyer_id, manufacturer_id, currency, subtotal, total_amount, contract_snapshot, purchase_order_snapshot, buyer_snapshot, manufacturer_snapshot, line_items_snapshot, amount_snapshot, created_by)
    values ('INV-2099-999999', seed.contract_id, 'CON-X', seed.purchase_order_id, 'PO-X', seed.buyer_id, seed.manufacturer_id, 'USD', 1, 1, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[{}]'::jsonb, '{}'::jsonb, seed.manufacturer_owner_id);
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('direct invoice insert blocked by trigger', blocked, 'direct insert');

  blocked := false;
  begin
    update public.invoices set total_amount = 1 where id = invoice_row.id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('direct invoice update blocked by trigger', blocked, 'direct update');

  blocked := false;
  begin
    delete from public.invoice_events where invoice_id = invoice_row.id;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('invoice events immutable', blocked, 'event delete');

  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin
    select count(*) into visible_count from public.invoices;
  exception when others then blocked := true;
  end;
  perform pg_temp.record_invoice_check('anonymous cannot read invoices', blocked, 'anon select denied');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', seed.manufacturer_owner_id::text, true);
  select count(*) into event_count
  from public.invoice_events
  where invoice_id = (select id from public.invoices where purchase_order_id = seed.purchase_order_id)
    and metadata ?| array['actor_id','actor_profile_id','payment_token','provider_secret','access_token','refresh_token'];
  perform pg_temp.record_invoice_check('event metadata strips impersonation and secret keys', event_count = 0, 'metadata stripped');

  perform pg_temp.record_invoice_check('no payment states exist', not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_status_check'
      and pg_get_constraintdef(oid) ~ 'paid|overdue|refunded|partially_paid|sent'
  ), 'status constraint');
end;
$$;

select check_name, passed, detail
from invoice_security_results
order by check_name;

do $$
declare
  failed_count integer;
  total_count integer;
  failed_checks text;
begin
  select count(*), count(*) filter (where not passed)
  into total_count, failed_count
  from invoice_security_results;

  if failed_count > 0 then
    select string_agg(check_name || ' [' || detail || ']', '; ' order by check_name)
    into failed_checks
    from invoice_security_results
    where not passed;
    raise exception 'Invoice foundation security verification failed: %/% checks failed: %', failed_count, total_count, failed_checks;
  end if;

  raise notice 'Invoice foundation security verification passed: %/% checks', total_count, total_count;
end;
$$;

rollback;




