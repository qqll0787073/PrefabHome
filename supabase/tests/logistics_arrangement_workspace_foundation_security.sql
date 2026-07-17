-- PH-010C rollback-only authority verification.
-- Run only after 0024 exists in the target transaction/database. No rows persist.
begin;

create temp table logistics_arrangement_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create or replace function pg_temp.record_arrangement_check(check_name text, passed boolean, detail text default '')
returns void language plpgsql as $$
begin
  insert into logistics_arrangement_results values (check_name, passed, coalesce(detail, ''));
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
      'authenticated read only on ' || relation_name,
      has_table_privilege('authenticated', 'public.' || relation_name, 'select')
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
    'candidate read policy delegates participant ownership',
    exists (select 1 from pg_policies where schemaname='public' and tablename='logistics_provider_candidates' and roles @> array['authenticated']::name[] and qual like '%can_access_logistics_booking_request%'),
    'candidate RLS'
  );
  perform pg_temp.record_arrangement_check(
    'selection read policy delegates participant ownership',
    exists (select 1 from pg_policies where schemaname='public' and tablename='logistics_provider_selections' and roles @> array['authenticated']::name[] and qual like '%can_access_logistics_booking_request%'),
    'selection RLS'
  );
  perform pg_temp.record_arrangement_check(
    'event read policy delegates participant ownership',
    exists (select 1 from pg_policies where schemaname='public' and tablename='logistics_arrangement_events' and roles @> array['authenticated']::name[] and qual like '%can_access_logistics_booking_request%'),
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

select check_name, passed, detail from logistics_arrangement_results order by check_name;

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
