-- PH-010C rollback-only authority verification.
-- Run only after 0024 exists in the target transaction/database. No rows persist.
begin;

create temp table logistics_arrangement_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;
grant select, insert, update, delete on logistics_arrangement_results to authenticated, anon;

create or replace function pg_temp.record_arrangement_check(check_name text, passed boolean, detail text default '')
returns void language plpgsql as $$
begin
  insert into logistics_arrangement_results values (check_name, passed, coalesce(detail, ''));
end;
$$;

create or replace function pg_temp.set_arrangement_actor(actor_uuid uuid)
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', actor_uuid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.expect_arrangement_blocked(check_name text, statement_text text)
returns void language plpgsql as $$
declare blocked boolean := false;
begin
  begin
    execute statement_text;
  exception when others then
    blocked := true;
  end;
  perform pg_temp.record_arrangement_check(check_name, blocked, statement_text);
end;
$$;

do $$
declare
  relation_name text;
  rpc_name text;
  helper_name text;
  definition text;
  allowed_rpc_names text[] := array[
    'admin_create_logistics_provider_candidate',
    'admin_update_logistics_provider_candidate',
    'admin_withdraw_logistics_provider_candidate',
    'admin_select_logistics_provider_candidate',
    'admin_cancel_logistics_provider_selection',
    'admin_mark_ready_for_external_booking'
  ];
  participant_read_rpc_names text[] := array[
    'get_participant_logistics_provider_candidates',
    'get_participant_logistics_provider_selections',
    'get_participant_logistics_arrangement_events'
  ];
  admin_read_rpc_names text[] := array[
    'admin_list_logistics_provider_candidates',
    'admin_list_logistics_provider_selections',
    'admin_list_logistics_arrangement_events'
  ];
begin
  foreach relation_name in array array['logistics_provider_candidates','logistics_provider_selections','logistics_arrangement_events'] loop
    perform pg_temp.record_arrangement_check(
      relation_name || ' exists',
      to_regclass('public.' || relation_name) is not null,
      relation_name
    );
    perform pg_temp.record_arrangement_check(
      relation_name || ' has RLS enabled',
      exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=relation_name and c.relrowsecurity),
      relation_name
    );
    perform pg_temp.record_arrangement_check(
      'anonymous has no privileges on ' || relation_name,
      not exists (select 1 from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=relation_name and g.grantee='anon'),
      relation_name
    );
    perform pg_temp.record_arrangement_check(
      'authenticated has no direct access on ' || relation_name,
      not has_table_privilege('authenticated', 'public.' || relation_name, 'select')
        and not has_table_privilege('authenticated', 'public.' || relation_name, 'insert')
        and not has_table_privilege('authenticated', 'public.' || relation_name, 'update')
        and not has_table_privilege('authenticated', 'public.' || relation_name, 'delete'),
      relation_name
    );
  end loop;

  perform pg_temp.record_arrangement_check(
    'booking request status constraint includes all arrangement states',
    exists (
      select 1 from pg_constraint
      where conrelid='public.logistics_booking_requests'::regclass
        and conname='logistics_booking_requests_status_check'
        and pg_get_constraintdef(oid) like '%carrier_options_available%'
        and pg_get_constraintdef(oid) like '%carrier_selected%'
        and pg_get_constraintdef(oid) like '%ready_for_external_booking%'
    ),
    'status constraint'
  );
  perform pg_temp.record_arrangement_check(
    'booking request lifecycle preserves submission history',
    exists (
      select 1 from pg_constraint
      where conrelid='public.logistics_booking_requests'::regclass
        and conname='logistics_booking_requests_lifecycle_check'
        and pg_get_constraintdef(oid) like '%submitted_at IS NOT NULL%'
    ),
    'lifecycle constraint'
  );
  perform pg_temp.record_arrangement_check(
    'candidate status constraint blocks arbitrary states',
    exists (select 1 from pg_constraint where conrelid='public.logistics_provider_candidates'::regclass and conname='logistics_provider_candidates_status_check'),
    'candidate status'
  );
  perform pg_temp.record_arrangement_check(
    'candidate transport mode constraint is independent',
    exists (
      select 1 from pg_constraint
      where conrelid='public.logistics_provider_candidates'::regclass
        and conname='logistics_provider_candidates_transport_mode_check'
        and pg_get_constraintdef(oid) like '%trucking%'
        and pg_get_constraintdef(oid) like '%ocean%'
    ),
    'transport mode'
  );
  perform pg_temp.record_arrangement_check(
    'selection lifecycle constraint is present',
    exists (select 1 from pg_constraint where conrelid='public.logistics_provider_selections'::regclass and conname='logistics_provider_selections_lifecycle_check'),
    'selection lifecycle'
  );
  perform pg_temp.record_arrangement_check(
    'candidate must belong to selection request',
    exists (select 1 from pg_constraint where conrelid='public.logistics_provider_selections'::regclass and conname='logistics_provider_selections_candidate_request_fk' and contype='f'),
    'composite foreign key'
  );
  perform pg_temp.record_arrangement_check(
    'only one current selection is indexed',
    exists (select 1 from pg_indexes where schemaname='public' and indexname='logistics_provider_selections_one_current_idx' and indexdef like '%WHERE (selection_status = ''selected''%'),
    'partial unique index'
  );

  perform pg_temp.record_arrangement_check(
    'candidate base policy is admin only',
    exists (select 1 from pg_policies where schemaname='public' and tablename='logistics_provider_candidates' and roles @> array['authenticated']::name[] and qual like '%is_admin%'),
    'candidate RLS'
  );
  perform pg_temp.record_arrangement_check(
    'selection base policy is admin only',
    exists (select 1 from pg_policies where schemaname='public' and tablename='logistics_provider_selections' and roles @> array['authenticated']::name[] and qual like '%is_admin%'),
    'selection RLS'
  );
  perform pg_temp.record_arrangement_check(
    'event base policy is admin only',
    exists (select 1 from pg_policies where schemaname='public' and tablename='logistics_arrangement_events' and roles @> array['authenticated']::name[] and qual like '%is_admin%'),
    'event RLS'
  );

  foreach relation_name in array array['logistics_provider_candidates','logistics_provider_selections','logistics_arrangement_events'] loop
    perform pg_temp.record_arrangement_check(
      relation_name || ' trusted-write trigger exists',
      exists (select 1 from pg_trigger where tgrelid=('public.' || relation_name)::regclass and not tgisinternal),
      relation_name
    );
  end loop;

  foreach rpc_name in array allowed_rpc_names loop
    perform pg_temp.record_arrangement_check(
      rpc_name || ' is authenticated-only',
      exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=rpc_name
          and has_function_privilege('authenticated', p.oid, 'execute')
          and not has_function_privilege('anon', p.oid, 'execute')
      ),
      rpc_name
    );
    select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=rpc_name limit 1;
    perform pg_temp.record_arrangement_check(
      rpc_name || ' enforces admin authority',
      definition ilike '%assert_logistics_arrangement_admin%',
      rpc_name
    );
  end loop;

  foreach rpc_name in array participant_read_rpc_names loop
    perform pg_temp.record_arrangement_check(
      rpc_name || ' is authenticated-only',
      exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=rpc_name
          and has_function_privilege('authenticated', p.oid, 'execute')
          and not has_function_privilege('anon', p.oid, 'execute')
      ),
      rpc_name
    );
    select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=rpc_name limit 1;
    perform pg_temp.record_arrangement_check(
      rpc_name || ' enforces booking ownership',
      definition ilike '%can_access_logistics_booking_request%',
      rpc_name
    );
  end loop;

  foreach rpc_name in array admin_read_rpc_names loop
    perform pg_temp.record_arrangement_check(
      rpc_name || ' is authenticated-only',
      exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=rpc_name
          and has_function_privilege('authenticated', p.oid, 'execute')
          and not has_function_privilege('anon', p.oid, 'execute')
      ),
      rpc_name
    );
    select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=rpc_name limit 1;
    perform pg_temp.record_arrangement_check(
      rpc_name || ' enforces admin authority',
      definition ilike '%assert_logistics_arrangement_admin%',
      rpc_name
    );
  end loop;

  select pg_get_function_result(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_participant_logistics_provider_candidates' limit 1;
  perform pg_temp.record_arrangement_check('participant candidate result excludes contact name', definition not ilike '%contact_name%', definition);
  perform pg_temp.record_arrangement_check('participant candidate result excludes contact email', definition not ilike '%contact_email%', definition);
  perform pg_temp.record_arrangement_check('participant candidate result excludes contact phone', definition not ilike '%contact_phone%', definition);
  perform pg_temp.record_arrangement_check('participant candidate result excludes internal notes', definition not ilike '%notes%', definition);
  perform pg_temp.record_arrangement_check('participant candidate result includes provider role and transport mode', definition ilike '%provider_type%' and definition ilike '%transport_mode%', definition);

  select pg_get_function_result(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_participant_logistics_arrangement_events' limit 1;
  perform pg_temp.record_arrangement_check('participant event result excludes metadata', definition not ilike '%metadata%', definition);
  perform pg_temp.record_arrangement_check('participant event result excludes actor profile', definition not ilike '%actor_profile_id%', definition);

  foreach helper_name in array array[
    'is_trusted_logistics_arrangement_write',
    'assert_logistics_arrangement_admin',
    'assert_logistics_provider_candidate_values',
    'strip_logistics_arrangement_event_metadata',
    'insert_trusted_logistics_arrangement_event',
    'protect_logistics_provider_candidate_write',
    'protect_logistics_provider_selection_write',
    'protect_logistics_arrangement_event_write'
  ] loop
    perform pg_temp.record_arrangement_check(
      helper_name || ' is not client executable',
      not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=helper_name
          and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
      ),
      helper_name
    );
  end loop;

  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_select_logistics_provider_candidate' limit 1;
  perform pg_temp.record_arrangement_check('selection locks booking request', definition ilike '%for update%', 'select RPC');
  perform pg_temp.record_arrangement_check('selection rejects cross-request candidate', definition ilike '%does not belong to this booking request%', 'select RPC');
  perform pg_temp.record_arrangement_check('selection requires active candidate', definition ilike '%candidate_status <> ''active''%', 'select RPC');
  perform pg_temp.record_arrangement_check('selection replacement is explicit', definition ilike '%not replace_existing%', 'select RPC');
  perform pg_temp.record_arrangement_check('selection lifecycle update is state conditional', definition ilike '%status in (''carrier_options_available'',''carrier_selected'')%', 'select RPC');
  perform pg_temp.record_arrangement_check('selection creates trusted event after success', definition ilike '%insert_trusted_logistics_arrangement_event%', 'select RPC');

  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_create_logistics_provider_candidate' limit 1;
  perform pg_temp.record_arrangement_check('replacement options may be added while carrier selected', definition ilike '%''carrier_selected''%', 'create RPC');

  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_cancel_logistics_provider_selection' limit 1;
  perform pg_temp.record_arrangement_check('cancel locks lifecycle rows', definition ilike '%for update%', 'cancel RPC');
  perform pg_temp.record_arrangement_check('cancel only permits carrier selected state', definition ilike '%status <> ''carrier_selected''%', 'cancel RPC');
  perform pg_temp.record_arrangement_check('cancel returns to carrier options', definition ilike '%status=''carrier_options_available''%', 'cancel RPC');
  perform pg_temp.record_arrangement_check('cancel is state conditional', definition ilike '%selection_status=''selected''%', 'cancel RPC');

  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_mark_ready_for_external_booking' limit 1;
  perform pg_temp.record_arrangement_check('ready flow locks lifecycle rows', definition ilike '%for update%', 'ready RPC');
  perform pg_temp.record_arrangement_check('ready flow requires selected provider', definition ilike '%status <> ''carrier_selected''%', 'ready RPC');
  perform pg_temp.record_arrangement_check('ready flow validates complete estimate', definition ilike '%estimated_departure_date is null%' and definition ilike '%estimated_cost is null%' and definition ilike '%currency is null%', 'ready RPC');
  perform pg_temp.record_arrangement_check('ready transition is state conditional', definition ilike '%where id=booking_request_uuid and status=''carrier_selected''%', 'ready RPC');

  perform pg_temp.record_arrangement_check(
    'event types exclude external fulfillment claims',
    exists (
      select 1 from pg_constraint where conrelid='public.logistics_arrangement_events'::regclass
        and conname='logistics_arrangement_events_type_check'
        and pg_get_constraintdef(oid) not ilike '%booked%'
        and pg_get_constraintdef(oid) not ilike '%dispatched%'
        and pg_get_constraintdef(oid) not ilike '%delivered%'
    ),
    'event constraint'
  );
end;
$$;

create or replace function pg_temp.arrangement_location(label_text text)
returns jsonb language sql immutable as $$
  select jsonb_build_object('address_line1', label_text || ' Port Road', 'city', 'Ningbo', 'state_region', 'Zhejiang', 'postal_code', '315000', 'country_code', 'CN');
$$;

create or replace function pg_temp.seed_arrangement_chain(label_text text)
returns table (
  buyer_id uuid,
  manufacturer_owner_id uuid,
  other_manufacturer_owner_id uuid,
  admin_id uuid,
  manufacturer_id uuid,
  other_manufacturer_id uuid,
  shipping_readiness_id uuid
)
language plpgsql as $$
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
  invoice_uuid uuid;
  shipping_uuid uuid;
begin
  reset role;
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  values
    ('00000000-0000-0000-0000-000000000000', buyer_uuid, 'authenticated', 'authenticated', label_text || '-buyer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Arrangement Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-manufacturer@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Arrangement Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_uuid, 'authenticated', 'authenticated', label_text || '-other@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_uuid, 'authenticated', 'authenticated', label_text || '-admin@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Arrangement Admin","role":"buyer"}'::jsonb, now(), now(), false, false);
  update public.profiles set role='admin' where id=admin_uuid;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_uuid, label_text || ' Factory Legal', label_text || ' Factory', 'China', 'draft') returning id into manufacturer_uuid;
  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_uuid, label_text || ' Other Legal', label_text || ' Other', 'Vietnam', 'draft') returning id into other_manufacturer_uuid;
  perform pg_temp.set_arrangement_actor(admin_uuid);
  update public.manufacturers set application_status='approved', reviewed_by=admin_uuid, reviewed_at=now() where id in (manufacturer_uuid, other_manufacturer_uuid);

  perform pg_temp.set_arrangement_actor(manufacturer_owner_uuid);
  insert into public.products(manufacturer_id, name, model_name, category, description, currency, status)
  values (manufacturer_uuid, label_text || ' Home', label_text || ' Model', 'Modular', 'Arrangement product', 'USD', 'draft') returning id into product_uuid;

  perform pg_temp.set_arrangement_actor(buyer_uuid);
  insert into public.rfqs(buyer_id, manufacturer_id, product_id, product_snapshot, status, requested_quantity, requested_currency, incoterm, destination_country)
  values (buyer_uuid, manufacturer_uuid, product_uuid, jsonb_build_object('name', label_text || ' Home'), 'submitted', 1, 'USD', 'FOB', 'United States') returning id into rfq_uuid;

  reset role;
  perform set_config('app.quote_trusted_write', 'on', true);
  insert into public.rfq_quotes(rfq_id, manufacturer_id, version, status, currency, subtotal, incoterm, created_by, submitted_at)
  values (rfq_uuid, manufacturer_uuid, 1, 'accepted', 'USD', 1000, 'FOB', manufacturer_owner_uuid, now()) returning id into quote_uuid;
  insert into public.rfq_quote_items(quote_id, line_order, item_type, description, quantity, unit, unit_price)
  values (quote_uuid, 1, 'product', label_text || ' module', 2, 'unit', 500) returning id into po_item_uuid;
  perform set_config('app.quote_trusted_write', '', true);

  perform set_config('app.quote_decision_trusted_write', 'on', true);
  insert into public.rfq_quote_decisions(rfq_id, quote_id, buyer_id, decision, reason)
  values (rfq_uuid, quote_uuid, buyer_uuid, 'accepted', 'accepted') returning id into decision_uuid;
  perform set_config('app.quote_decision_trusted_write', '', true);

  perform set_config('app.purchase_order_trusted_write', 'on', true);
  insert into public.purchase_orders(po_number, rfq_id, quote_id, quote_decision_id, buyer_id, manufacturer_id, status, currency, subtotal, incoterm, quote_snapshot, buyer_snapshot, manufacturer_snapshot, product_snapshot, created_by, submitted_at, last_submitted_at, confirmed_at, review_round)
  values ('PO-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), rfq_uuid, quote_uuid, decision_uuid, buyer_uuid, manufacturer_uuid, 'confirmed', 'USD', 1000, 'FOB', jsonb_build_object('quote_id', quote_uuid), jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('product_id', product_uuid), buyer_uuid, now(), now(), now(), 1) returning id into po_uuid;
  insert into public.purchase_order_items(purchase_order_id, source_quote_item_id, line_order, item_type, description, quantity, unit, unit_price, amount)
  select po_uuid, item.id, item.line_order, item.item_type, item.description, item.quantity, item.unit, item.unit_price, item.amount from public.rfq_quote_items item where item.quote_id=quote_uuid returning id into po_item_uuid;
  perform set_config('app.purchase_order_trusted_write', '', true);

  perform set_config('app.contract_trusted_write', 'on', true);
  insert into public.contracts(contract_number, purchase_order_id, po_number, rfq_id, quote_id, quote_decision_id, buyer_id, manufacturer_id, status, currency, subtotal, contract_title, purchase_order_snapshot, buyer_snapshot, manufacturer_snapshot, quote_snapshot, product_snapshot, line_items_snapshot, created_by, ready_at, review_round, first_ready_at, last_ready_at, accepted_at)
  values ('CON-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), po_uuid, (select po_number from public.purchase_orders where id=po_uuid), rfq_uuid, quote_uuid, decision_uuid, buyer_uuid, manufacturer_uuid, 'accepted', 'USD', 1000, label_text || ' Contract', jsonb_build_object('purchase_order_id', po_uuid), jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('quote_id', quote_uuid), jsonb_build_object('product_id', product_uuid), jsonb_build_array(jsonb_build_object('source_purchase_order_item_id', po_item_uuid, 'amount', 1000)), buyer_uuid, now(), 1, now(), now(), now()) returning id into contract_uuid;
  perform set_config('app.contract_trusted_write', '', true);

  perform set_config('app.signature_preparation_trusted_write', 'on', true);
  insert into public.signature_packages(package_number, contract_id, contract_number, buyer_id, manufacturer_id, status, version, contract_snapshot, buyer_snapshot, manufacturer_snapshot, decision_snapshot, signing_content_snapshot, created_by, ready_at)
  values ('SIG-2099-' || lpad((floor(random() * 999999))::int::text, 6, '0'), contract_uuid, (select contract_number from public.contracts where id=contract_uuid), buyer_uuid, manufacturer_uuid, 'ready_to_send', 1, jsonb_build_object('contract_id', contract_uuid), jsonb_build_object('profile_id', buyer_uuid), jsonb_build_object('manufacturer_id', manufacturer_uuid), jsonb_build_object('decision', 'accepted'), jsonb_build_object('internal_only', true), buyer_uuid, now());
  perform set_config('app.signature_preparation_trusted_write', '', true);

  perform pg_temp.set_arrangement_actor(manufacturer_owner_uuid);
  select id into invoice_uuid from public.create_invoice_from_purchase_order(po_uuid);
  perform public.update_invoice_draft(invoice_uuid, current_date, current_date + 30, 'Arrangement Buyer', label_text || '-buyer@example.test', '{"address_line1":"1 Main St","city":"Los Angeles","state_region":"CA","postal_code":"90001","country_code":"US"}'::jsonb, 0, 0, 0);
  select id into invoice_uuid from public.issue_invoice(invoice_uuid);
  select id into shipping_uuid from public.create_shipping_readiness(po_uuid);
  perform public.update_shipping_readiness_draft(shipping_uuid, 'ocean', 'FOB', pg_temp.arrangement_location('Origin'), pg_temp.arrangement_location('Destination'), label_text || ' packed modules', 3, 12000, 72, current_date + 10, current_date + 5, 'Ready');
  select id into shipping_uuid from public.mark_shipping_readiness_ready(shipping_uuid);

  return query select buyer_uuid, manufacturer_owner_uuid, other_manufacturer_owner_uuid, admin_uuid, manufacturer_uuid, other_manufacturer_uuid, shipping_uuid;
exception when others then
  perform set_config('app.quote_trusted_write', '', true);
  perform set_config('app.quote_decision_trusted_write', '', true);
  perform set_config('app.purchase_order_trusted_write', '', true);
  perform set_config('app.contract_trusted_write', '', true);
  perform set_config('app.signature_preparation_trusted_write', '', true);
  perform set_config('app.shipping_readiness_trusted_write', '', true);
  perform set_config('app.logistics_booking_request_trusted_write', '', true);
  raise;
end;
$$;

do $$
declare
  seed record;
  buyer_uuid uuid;
  manufacturer_owner_uuid uuid;
  other_manufacturer_owner_uuid uuid;
  admin_uuid uuid;
  manufacturer_uuid uuid;
  other_manufacturer_uuid uuid;
  booking_uuid uuid := gen_random_uuid();
  candidate_one public.logistics_provider_candidates%rowtype;
  candidate_two public.logistics_provider_candidates%rowtype;
  visible_count integer;
begin
  select * into seed from pg_temp.seed_arrangement_chain('arrangement-' || substr(gen_random_uuid()::text, 1, 8));
  buyer_uuid := seed.buyer_id;
  manufacturer_owner_uuid := seed.manufacturer_owner_id;
  other_manufacturer_owner_uuid := seed.other_manufacturer_owner_id;
  admin_uuid := seed.admin_id;
  manufacturer_uuid := seed.manufacturer_id;
  other_manufacturer_uuid := seed.other_manufacturer_id;
  perform pg_temp.set_arrangement_actor(manufacturer_owner_uuid);
  select id into booking_uuid from public.create_logistics_booking_request(seed.shipping_readiness_id);
  perform public.update_logistics_booking_request_draft(
    booking_uuid, 'ocean', 'FOB', current_date + 10, current_date + 20,
    pg_temp.arrangement_location('Origin'), pg_temp.arrangement_location('Destination'),
    '40ft_high_cube', 'Keep dry', 'Forklift required', 'Arrangement security verification'
  );
  select id into booking_uuid from public.submit_logistics_booking_request(booking_uuid);

  perform pg_temp.set_arrangement_actor(admin_uuid);
  select * into candidate_one from public.admin_create_logistics_provider_candidate(
    booking_uuid, 'Ocean Forwarder', 'freight_forwarder', 'ocean', 'Port to port',
    current_date + 10, current_date + 20, 10, 12500, 'usd', 'Q-OCEAN-1',
    'Private Contact', 'private@example.test', '+1-555-0100', 'Admin-only ocean notes'
  );
  select * into candidate_two from public.admin_create_logistics_provider_candidate(
    booking_uuid, 'Road Carrier', 'carrier', 'trucking', 'Door to door',
    current_date + 11, current_date + 13, 2, 3500, 'usd', 'Q-TRUCK-1',
    'Road Contact', 'road-private@example.test', '+1-555-0200', 'Admin-only trucking notes'
  );
  perform pg_temp.record_arrangement_check('freight forwarder plus ocean is accepted', candidate_one.provider_type='freight_forwarder' and candidate_one.transport_mode='ocean', candidate_one.provider_type || '/' || candidate_one.transport_mode);
  perform pg_temp.record_arrangement_check('carrier plus trucking is accepted', candidate_two.provider_type='carrier' and candidate_two.transport_mode='trucking', candidate_two.provider_type || '/' || candidate_two.transport_mode);
  perform pg_temp.expect_arrangement_blocked(
    'invalid transport mode is rejected',
    format('select public.admin_create_logistics_provider_candidate(%L::uuid,''Invalid Mode'',''carrier'',''space'',null::text,null::date,null::date,null::integer,null::numeric,null::text,null::text,null::text,null::text,null::text)', booking_uuid)
  );
  select count(*) into visible_count from public.admin_list_logistics_provider_candidates(booking_uuid);
  perform pg_temp.record_arrangement_check('invalid transport mode creates no candidate', visible_count=2, visible_count::text);

  perform pg_temp.set_arrangement_actor(buyer_uuid);
  select count(*) into visible_count from public.get_participant_logistics_provider_candidates(booking_uuid);
  perform pg_temp.record_arrangement_check('buyer reads own participant-safe candidates', visible_count=2, visible_count::text);
  perform pg_temp.record_arrangement_check('buyer sees safe provider and transport fields', exists(select 1 from public.get_participant_logistics_provider_candidates(booking_uuid) where id=candidate_one.id and provider_type='freight_forwarder' and transport_mode='ocean'), 'buyer safe row');
  perform pg_temp.expect_arrangement_blocked('buyer cannot obtain contact_name', format('select contact_name from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('buyer cannot obtain contact_email', format('select contact_email from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('buyer cannot obtain contact_phone', format('select contact_phone from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('buyer cannot obtain internal notes', format('select notes from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('buyer cannot obtain internal event metadata', format('select metadata from public.get_participant_logistics_arrangement_events(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('buyer direct candidate table select denied', 'select * from public.logistics_provider_candidates');
  perform pg_temp.expect_arrangement_blocked('buyer direct selection table select denied', 'select * from public.logistics_provider_selections');
  perform pg_temp.expect_arrangement_blocked('buyer direct event table select denied', 'select * from public.logistics_arrangement_events');

  perform pg_temp.set_arrangement_actor(manufacturer_owner_uuid);
  select count(*) into visible_count from public.get_participant_logistics_provider_candidates(booking_uuid);
  perform pg_temp.record_arrangement_check('assigned manufacturer reads participant-safe candidates', visible_count=2, visible_count::text);
  perform pg_temp.expect_arrangement_blocked('manufacturer cannot obtain contact_name', format('select contact_name from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('manufacturer cannot obtain contact_email', format('select contact_email from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('manufacturer cannot obtain contact_phone', format('select contact_phone from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('manufacturer cannot obtain internal notes', format('select notes from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));
  perform pg_temp.expect_arrangement_blocked('manufacturer direct candidate table select denied', 'select * from public.logistics_provider_candidates');

  perform pg_temp.set_arrangement_actor(other_manufacturer_owner_uuid);
  select count(*) into visible_count from public.get_participant_logistics_provider_candidates(booking_uuid);
  perform pg_temp.record_arrangement_check('other manufacturer cannot obtain participant-safe rows', visible_count=0, visible_count::text);

  reset role;
  set local role anon;
  perform pg_temp.expect_arrangement_blocked('anonymous cannot obtain participant-safe rows', format('select * from public.get_participant_logistics_provider_candidates(%L::uuid)', booking_uuid));

  perform pg_temp.set_arrangement_actor(admin_uuid);
  perform pg_temp.record_arrangement_check(
    'admin approved surface retrieves internal candidate fields',
    exists(select 1 from public.admin_list_logistics_provider_candidates(booking_uuid) where id=candidate_one.id and contact_name='Private Contact' and contact_email='private@example.test' and contact_phone='+1-555-0100' and notes='Admin-only ocean notes'),
    'admin full row'
  );
  perform pg_temp.record_arrangement_check(
    'admin approved surface retrieves internal event metadata',
    exists(select 1 from public.admin_list_logistics_arrangement_events(booking_uuid) where event_type='candidate_created' and metadata ? 'candidate_status'),
    'admin full event'
  );
  perform pg_temp.expect_arrangement_blocked('admin direct candidate table select denied', 'select * from public.logistics_provider_candidates');
exception when others then
  reset role;
  raise;
end;
$$;

select
  count(*) as check_count,
  count(*) filter (where passed) as passed_count
from logistics_arrangement_results;

do $$
declare failed_count integer; total_count integer; failed_checks text;
begin
  select count(*), count(*) filter (where not passed) into total_count, failed_count from logistics_arrangement_results;
  if failed_count > 0 then
    select string_agg(check_name || ' [' || detail || ']', '; ' order by check_name) into failed_checks from logistics_arrangement_results where not passed;
    raise exception 'Logistics arrangement workspace verification failed: %/% checks failed: %', failed_count, total_count, failed_checks;
  end if;
  raise notice 'Logistics arrangement workspace verification passed: %/% checks', total_count, total_count;
end;
$$;

rollback;
