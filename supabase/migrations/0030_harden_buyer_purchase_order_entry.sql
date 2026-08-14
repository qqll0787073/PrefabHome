-- Sprint 5B.9: make the existing accepted Quote -> Purchase Order boundary
-- active-Buyer-only and idempotent. No second Order model is introduced.
begin;

create or replace function public.create_purchase_order_from_quote(quote_uuid uuid)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quote_record public.rfq_quotes%rowtype;
  rfq_record public.rfqs%rowtype;
  decision_record public.rfq_quote_decisions%rowtype;
  po_record public.purchase_orders%rowtype;
  copied_subtotal numeric(14,2);
  copied_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'buyer' and p.status = 'active'
  ) then
    raise exception 'An active Buyer account is required.';
  end if;

  select * into quote_record from public.rfq_quotes where id = quote_uuid for update;
  if not found then raise exception 'Quote does not exist.'; end if;

  select * into rfq_record from public.rfqs where id = quote_record.rfq_id for update;
  if not found or rfq_record.buyer_id is distinct from auth.uid() then
    raise exception 'Quote is not available to this Buyer.';
  end if;

  -- A retry or concurrent request returns the one authoritative commercial object.
  select * into po_record from public.purchase_orders
  where quote_id = quote_record.id and buyer_id = auth.uid();
  if found then return po_record; end if;

  if quote_record.status <> 'accepted' or rfq_record.status <> 'accepted' then
    raise exception 'An accepted Quote and RFQ are required.';
  end if;
  if quote_record.valid_until is not null and quote_record.valid_until < current_date then
    raise exception 'The accepted Quote has expired.';
  end if;
  if not exists (
    select 1 from public.manufacturers m
    where m.id = quote_record.manufacturer_id
      and m.verification_status = 'approved'
      and m.application_status = 'approved'
  ) then raise exception 'Manufacturer is not eligible.'; end if;

  select * into decision_record from public.rfq_quote_decisions
  where quote_id = quote_record.id and rfq_id = rfq_record.id
    and buyer_id = auth.uid() and decision = 'accepted' for update;
  if not found then raise exception 'Accepted Quote decision is required.'; end if;

  select coalesce(sum(amount), 0)::numeric(14,2), count(*) into copied_subtotal, copied_count
  from public.rfq_quote_items where quote_id = quote_record.id;
  if copied_count = 0 or copied_subtotal is distinct from quote_record.subtotal then
    raise exception 'Accepted Quote commercial terms are invalid.';
  end if;

  perform set_config('app.purchase_order_trusted_write', 'on', true);
  insert into public.purchase_orders (
    po_number, rfq_id, quote_id, quote_decision_id, buyer_id, manufacturer_id,
    status, currency, subtotal, incoterm, origin_port, destination_port,
    production_lead_days, shipping_lead_days, quote_snapshot, buyer_snapshot,
    manufacturer_snapshot, product_snapshot, created_by
  ) values (
    public.generate_purchase_order_number(), rfq_record.id, quote_record.id,
    decision_record.id, auth.uid(), quote_record.manufacturer_id, 'draft',
    quote_record.currency, quote_record.subtotal, quote_record.incoterm,
    quote_record.origin_port, quote_record.destination_port,
    quote_record.production_lead_days, quote_record.shipping_lead_days,
    public.build_purchase_order_quote_snapshot(quote_record),
    public.build_purchase_order_buyer_snapshot(auth.uid()),
    public.build_purchase_order_manufacturer_snapshot(quote_record.manufacturer_id),
    rfq_record.product_snapshot, auth.uid()
  ) returning * into po_record;

  insert into public.purchase_order_items (
    purchase_order_id, source_quote_item_id, line_order, item_type,
    description, quantity, unit, unit_price, amount
  ) select po_record.id, item.id, item.line_order, item.item_type,
    item.description, item.quantity, item.unit, item.unit_price, item.amount
  from public.rfq_quote_items item where item.quote_id = quote_record.id
  order by item.line_order;

  perform public.insert_trusted_purchase_order_event(
    po_record.id, 'po_created', auth.uid(),
    jsonb_build_object('quote_id', quote_record.id, 'quote_version', quote_record.version)
  );
  perform set_config('app.purchase_order_trusted_write', '', true);
  return po_record;
exception
  when unique_violation then
    perform set_config('app.purchase_order_trusted_write', '', true);
    select * into po_record from public.purchase_orders
      where quote_id = quote_uuid and buyer_id = auth.uid();
    if found then return po_record; end if;
    raise;
  when others then
    perform set_config('app.purchase_order_trusted_write', '', true);
    raise;
end;
$$;

alter function public.create_purchase_order_from_quote(uuid) owner to postgres;
revoke all on function public.create_purchase_order_from_quote(uuid) from public, anon, authenticated;
grant execute on function public.create_purchase_order_from_quote(uuid) to authenticated;

commit;
