-- Require an active Buyer profile at the trusted Product-to-RFQ entry boundary.
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
set search_path = public, pg_temp
as $$
declare
  manufacturer_uuid uuid;
  snapshot_value jsonb;
  rfq_record public.rfqs%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'buyer'
      and p.status = 'active'
  ) then
    raise exception 'Only an active authenticated Buyer can create an RFQ draft.';
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

alter function public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text) owner to postgres;
revoke all on function public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text) from public, anon, authenticated, service_role;
grant execute on function public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text) to authenticated;
