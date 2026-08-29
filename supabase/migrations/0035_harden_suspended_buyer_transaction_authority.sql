-- Sprint 5D.2: require active Buyer authority for protected transaction access and writes.

begin;

create or replace function public.is_active_buyer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_profile() and public.current_profile_role() = 'buyer'
$$;

revoke all on function public.is_active_buyer() from public, anon, authenticated, service_role;
grant execute on function public.is_active_buyer() to authenticated;

-- Existing trusted-write triggers remain the lifecycle boundary. These helpers now
-- reject a stored Buyer identity whose profile is no longer active, while leaving
-- Manufacturer and Admin behavior to the existing RPC authorization checks.
create or replace function public.is_trusted_purchase_order_write()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(current_setting('app.purchase_order_trusted_write', true), '') = 'on'
    and (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'buyer') or public.is_active_buyer())
$$;

create or replace function public.is_trusted_contract_write()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(current_setting('app.contract_trusted_write', true), '') = 'on'
    and (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'buyer') or public.is_active_buyer())
$$;

create or replace function public.is_trusted_signature_preparation_write()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(current_setting('app.signature_preparation_trusted_write', true), '') = 'on'
    and (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'buyer') or public.is_active_buyer())
$$;

create or replace function public.is_trusted_signature_delivery_write()
returns boolean language sql stable set search_path = public, pg_temp as $$
  select coalesce(current_setting('app.signature_delivery_trusted_write', true), '') = 'on'
    and (not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'buyer') or public.is_active_buyer())
$$;

-- Active-aware participant access helpers. Existing ownership, Manufacturer, Admin,
-- RFQ status, and parent-record conditions are preserved.
create or replace function public.can_access_rfq(rfq_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.rfqs r where r.id = rfq_uuid and (
      (r.buyer_id = auth.uid() and public.is_active_buyer())
      or public.is_admin()
      or (r.status <> 'draft' and public.owns_manufacturer(r.manufacturer_id))
    )
  )
$$;

create or replace function public.can_access_rfq_quote(quote_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.rfq_quotes q join public.rfqs r on r.id = q.rfq_id
    where q.id = quote_uuid and (
      public.is_admin()
      or (r.status <> 'draft' and public.owns_manufacturer(q.manufacturer_id))
      or (r.buyer_id = auth.uid() and public.is_active_buyer() and q.status <> 'draft')
    )
  )
$$;

create or replace function public.can_access_purchase_order(po_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.purchase_orders po where po.id = po_uuid and (
    (po.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(po.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_contract(contract_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.contracts c where c.id = contract_uuid and (
    (c.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(c.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_signature_package(package_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.signature_packages sp where sp.id = package_uuid and (
    (sp.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(sp.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_signature_delivery_request(delivery_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.signature_delivery_requests sdr where sdr.id = delivery_uuid and (
    (sdr.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(sdr.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_invoice(invoice_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.invoices i where i.id = invoice_uuid and (
    (i.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(i.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_payment_record(payment_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.payment_records pr where pr.id = payment_uuid and (
    (pr.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(pr.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_shipping_readiness(shipping_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.shipping_readiness_records sr where sr.id = shipping_uuid and (
    (sr.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(sr.manufacturer_id) or public.is_admin()
  ))
$$;

create or replace function public.can_access_logistics_booking_request(booking_request_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.logistics_booking_requests b where b.id = booking_request_uuid and (
    (b.buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(b.manufacturer_id) or public.is_admin()
  ))
$$;

-- This SECURITY DEFINER projection performs its own authorization and therefore
-- must carry the active-Buyer condition rather than relying on table RLS.
create or replace function public.get_invoice_payment_summary(invoice_uuid uuid)
returns table (
  invoice_id uuid, invoice_number text, currency text, invoice_total numeric,
  recorded_amount numeric, remaining_balance numeric, recorded_payment_count bigint
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare invoice_row public.invoices%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  select * into invoice_row from public.invoices where id = invoice_uuid;
  if invoice_row.id is null then raise exception 'Invoice not found.'; end if;
  if not (
    (invoice_row.buyer_id = auth.uid() and public.is_active_buyer())
    or public.owns_manufacturer(invoice_row.manufacturer_id)
    or public.is_admin()
  ) then
    raise exception 'You are not authorized to access this invoice payment summary.';
  end if;
  return query
  select invoice_row.id, invoice_row.invoice_number, invoice_row.currency, invoice_row.total_amount,
    coalesce(sum(pr.amount) filter (where pr.status = 'recorded'), 0)::numeric(14,2),
    (invoice_row.total_amount - coalesce(sum(pr.amount) filter (where pr.status = 'recorded'), 0))::numeric(14,2),
    count(pr.id) filter (where pr.status = 'recorded')
  from public.invoices i left join public.payment_records pr on pr.invoice_id = i.id
  where i.id = invoice_row.id group by i.id;
end;
$$;

-- Parent and decision policies with direct Buyer predicates are hardened. Child
-- policies continue through the active-aware can_access_* helpers above.
drop policy if exists "rfqs_select_participant_or_admin" on public.rfqs;
create policy "rfqs_select_participant_or_admin" on public.rfqs for select to authenticated using (
  public.is_admin() or (buyer_id = auth.uid() and public.is_active_buyer()) or (status <> 'draft' and public.owns_manufacturer(manufacturer_id))
);

drop policy if exists "rfq_quote_decisions_select_participant_or_admin" on public.rfq_quote_decisions;
create policy "rfq_quote_decisions_select_participant_or_admin" on public.rfq_quote_decisions for select to authenticated using (
  public.is_admin() or (buyer_id = auth.uid() and public.is_active_buyer()) or exists (
    select 1 from public.rfqs r where r.id = rfq_id and r.status <> 'draft' and public.owns_manufacturer(r.manufacturer_id)
  )
);

drop policy if exists "purchase_orders_select_participant_or_admin" on public.purchase_orders;
create policy "purchase_orders_select_participant_or_admin" on public.purchase_orders for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "purchase_order_items_select_participant_or_admin" on public.purchase_order_items;
create policy "purchase_order_items_select_participant_or_admin" on public.purchase_order_items for select to authenticated using (public.can_access_purchase_order(purchase_order_id));
drop policy if exists "purchase_order_events_select_participant_or_admin" on public.purchase_order_events;
create policy "purchase_order_events_select_participant_or_admin" on public.purchase_order_events for select to authenticated using (public.can_access_purchase_order(purchase_order_id));
drop policy if exists "purchase_order_decisions_select_participant_or_admin" on public.purchase_order_decisions;
create policy "purchase_order_decisions_select_participant_or_admin" on public.purchase_order_decisions for select to authenticated using (public.can_access_purchase_order(purchase_order_id));

drop policy if exists "contracts_select_participant_or_admin" on public.contracts;
create policy "contracts_select_participant_or_admin" on public.contracts for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "contract_events_select_participant_or_admin" on public.contract_events;
create policy "contract_events_select_participant_or_admin" on public.contract_events for select to authenticated using (public.can_access_contract(contract_id));
drop policy if exists "contract_review_decisions_select_participant_or_admin" on public.contract_review_decisions;
create policy "contract_review_decisions_select_participant_or_admin" on public.contract_review_decisions for select to authenticated using (public.can_access_contract(contract_id));

drop policy if exists "signature_packages_select_participant_or_admin" on public.signature_packages;
create policy "signature_packages_select_participant_or_admin" on public.signature_packages for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "signature_participants_select_participant_or_admin" on public.signature_participants;
create policy "signature_participants_select_participant_or_admin" on public.signature_participants for select to authenticated using (public.can_access_signature_package(signature_package_id));
drop policy if exists "signature_package_events_select_participant_or_admin" on public.signature_package_events;
create policy "signature_package_events_select_participant_or_admin" on public.signature_package_events for select to authenticated using (public.can_access_signature_package(signature_package_id));

drop policy if exists "signature_delivery_requests_select_participant_or_admin" on public.signature_delivery_requests;
create policy "signature_delivery_requests_select_participant_or_admin" on public.signature_delivery_requests for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "signature_delivery_recipients_select_participant_or_admin" on public.signature_delivery_recipients;
create policy "signature_delivery_recipients_select_participant_or_admin" on public.signature_delivery_recipients for select to authenticated using (public.can_access_signature_delivery_request(delivery_request_id));
drop policy if exists "signature_delivery_events_select_participant_or_admin" on public.signature_delivery_events;
create policy "signature_delivery_events_select_participant_or_admin" on public.signature_delivery_events for select to authenticated using (public.can_access_signature_delivery_request(delivery_request_id));

drop policy if exists "invoices_select_participant_or_admin" on public.invoices;
create policy "invoices_select_participant_or_admin" on public.invoices for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "invoice_line_items_select_participant_or_admin" on public.invoice_line_items;
create policy "invoice_line_items_select_participant_or_admin" on public.invoice_line_items for select to authenticated using (public.can_access_invoice(invoice_id));
drop policy if exists "invoice_events_select_participant_or_admin" on public.invoice_events;
create policy "invoice_events_select_participant_or_admin" on public.invoice_events for select to authenticated using (public.can_access_invoice(invoice_id));

drop policy if exists "payment_records_select_participant_or_admin" on public.payment_records;
create policy "payment_records_select_participant_or_admin" on public.payment_records for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "payment_events_select_participant_or_admin" on public.payment_events;
create policy "payment_events_select_participant_or_admin" on public.payment_events for select to authenticated using (public.can_access_payment_record(payment_record_id));

drop policy if exists "shipping_readiness_select_participant_or_admin" on public.shipping_readiness_records;
create policy "shipping_readiness_select_participant_or_admin" on public.shipping_readiness_records for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);
drop policy if exists "shipping_readiness_events_select_participant_or_admin" on public.shipping_readiness_events;
create policy "shipping_readiness_events_select_participant_or_admin" on public.shipping_readiness_events for select to authenticated using (public.can_access_shipping_readiness(shipping_readiness_id));

drop policy if exists "logistics_booking_requests_select_participant_or_admin" on public.logistics_booking_requests;
create policy "logistics_booking_requests_select_participant_or_admin" on public.logistics_booking_requests for select to authenticated using (
  (buyer_id = auth.uid() and public.is_active_buyer()) or public.owns_manufacturer(manufacturer_id) or public.is_admin()
);

-- Preserve minimal execution grants and harden every replaced SECURITY DEFINER helper.
do $$
declare function_name text;
begin
  foreach function_name in array array[
    'public.is_active_buyer()', 'public.can_access_rfq(uuid)', 'public.can_access_rfq_quote(uuid)',
    'public.can_access_purchase_order(uuid)', 'public.can_access_contract(uuid)',
    'public.can_access_signature_package(uuid)', 'public.can_access_signature_delivery_request(uuid)',
    'public.can_access_invoice(uuid)', 'public.can_access_payment_record(uuid)',
    'public.can_access_shipping_readiness(uuid)', 'public.can_access_logistics_booking_request(uuid)',
    'public.get_invoice_payment_summary(uuid)'
  ] loop
    execute format('alter function %s set search_path = public, pg_temp', function_name);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', function_name);
    execute format('grant execute on function %s to authenticated', function_name);
  end loop;
end $$;

commit;
