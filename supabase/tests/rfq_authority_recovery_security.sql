begin;

-- Run only after applying migrations 0001-0025 to an isolated disposable database.
-- This script is rollback-only and intentionally contains no project-linking command.
create temporary table rfq_authority_checks (name text primary key) on commit drop;

create or replace function pg_temp.assert_rfq_authority(condition boolean, check_name text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'RFQ authority assertion failed: %', check_name;
  end if;
  insert into rfq_authority_checks values (check_name);
end;
$$;

do $test$
declare
  scoped_enabled integer;
begin
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfqs') is not null, 'rfqs exists');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_messages') is not null, 'messages exists');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_events') is not null, 'events exists');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_quotes') is not null, 'quotes exists');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_quote_items') is not null, 'quote items exists');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_quote_decisions') is not null, 'decisions exists');

  perform pg_temp.assert_rfq_authority(
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='rfq_quotes' and column_name='supersedes_quote_id' and udt_name='uuid'),
    'lineage column exists'
  );
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_quotes_supersedes_quote_idx') is not null, 'lineage index exists');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_quotes_one_revision_per_source_idx') is not null, 'one revision per source');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_quotes_one_current_submitted_per_rfq_idx') is not null, 'one current quote');
  perform pg_temp.assert_rfq_authority(
    exists (select 1 from pg_constraint where conrelid='public.rfq_quotes'::regclass and conname='rfq_quotes_supersedes_same_rfq_fk' and pg_get_constraintdef(oid) like '%ON DELETE RESTRICT%'),
    'same RFQ restricted lineage foreign key'
  );

  perform pg_temp.assert_rfq_authority(
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='rfq_events' and column_name='actor_role'),
    'event actor role exists'
  );
  perform pg_temp.assert_rfq_authority(
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='rfq_events' and column_name='source_type'),
    'event source type exists'
  );
  perform pg_temp.assert_rfq_authority(
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='rfq_events' and column_name='source_id'),
    'event source id exists'
  );
  perform pg_temp.assert_rfq_authority(
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='rfq_events' and column_name='event_key'),
    'event key exists'
  );
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_events_source_event_unique') is not null, 'source event uniqueness');
  perform pg_temp.assert_rfq_authority(to_regclass('public.rfq_events_terminal_lifecycle_unique') is not null, 'terminal event uniqueness');

  perform pg_temp.assert_rfq_authority(to_regprocedure('public.record_rfq_event(uuid,text,jsonb)') is not null, 'dispatcher retained');
  perform pg_temp.assert_rfq_authority(
    not exists (
      select 1 from information_schema.routine_privileges
      where specific_schema='public' and routine_name='record_rfq_event'
        and grantee='PUBLIC' and privilege_type='EXECUTE'
    ),
    'dispatcher denied public'
  );
  perform pg_temp.assert_rfq_authority(not has_function_privilege('anon', 'public.record_rfq_event(uuid,text,jsonb)', 'EXECUTE'), 'dispatcher denied anon');
  perform pg_temp.assert_rfq_authority(not has_function_privilege('authenticated', 'public.record_rfq_event(uuid,text,jsonb)', 'EXECUTE'), 'dispatcher denied authenticated');
  perform pg_temp.assert_rfq_authority(not has_function_privilege('service_role', 'public.record_rfq_event(uuid,text,jsonb)', 'EXECUTE'), 'dispatcher denied service role');

  perform pg_temp.assert_rfq_authority(has_function_privilege('authenticated', 'public.create_rfq_draft(uuid,numeric,text,text,text,text,date,text)', 'EXECUTE'), 'create draft RPC granted');
  perform pg_temp.assert_rfq_authority(has_function_privilege('authenticated', 'public.update_rfq_draft(uuid,numeric,text,text,text,text,date,text)', 'EXECUTE'), 'update draft RPC granted');
  perform pg_temp.assert_rfq_authority(has_function_privilege('authenticated', 'public.submit_rfq(uuid,numeric,text,text,text,text,date,text)', 'EXECUTE'), 'submit RFQ RPC granted');
  perform pg_temp.assert_rfq_authority(has_function_privilege('authenticated', 'public.cancel_rfq(uuid)', 'EXECUTE'), 'cancel RFQ RPC granted');
  perform pg_temp.assert_rfq_authority(has_function_privilege('authenticated', 'public.delete_rfq_draft(uuid)', 'EXECUTE'), 'delete draft RPC granted');
  perform pg_temp.assert_rfq_authority(has_function_privilege('authenticated', 'public.send_rfq_message(uuid,text,text)', 'EXECUTE'), 'message RPC granted');

  perform pg_temp.assert_rfq_authority(not has_table_privilege('authenticated','public.rfqs','INSERT'), 'RFQ direct insert denied');
  perform pg_temp.assert_rfq_authority(not has_table_privilege('authenticated','public.rfqs','UPDATE'), 'RFQ direct update denied');
  perform pg_temp.assert_rfq_authority(not has_table_privilege('authenticated','public.rfqs','DELETE'), 'RFQ direct delete denied');
  perform pg_temp.assert_rfq_authority(not has_table_privilege('authenticated','public.rfq_messages','INSERT'), 'message direct insert denied');
  perform pg_temp.assert_rfq_authority(not has_table_privilege('authenticated','public.rfq_events','INSERT'), 'event direct insert denied');
  perform pg_temp.assert_rfq_authority(not has_table_privilege('authenticated','public.rfq_quote_decisions','INSERT'), 'decision direct insert denied');

  perform pg_temp.assert_rfq_authority(
    exists (select 1 from pg_policies where schemaname='public' and tablename='rfqs' and policyname='rfqs_select_participant_or_admin' and qual like '%status <> ''draft''%'),
    'Manufacturer draft privacy policy'
  );
  perform pg_temp.assert_rfq_authority(
    pg_get_functiondef('public.can_access_rfq(uuid)'::regprocedure) like '%r.status <> ''draft''%',
    'Manufacturer draft privacy helper'
  );
  perform pg_temp.assert_rfq_authority(
    pg_get_functiondef('public.protect_rfq_message_insert()'::regprocedure) like '%new.sender_profile_id := auth.uid()%',
    'message identity database derived'
  );
  perform pg_temp.assert_rfq_authority(
    pg_get_functiondef('public.submit_rfq_quote(uuid)'::regprocedure) like '%source_quote.status <> ''revision_requested''%'
    and pg_get_functiondef('public.submit_rfq_quote(uuid)'::regprocedure) like '%set status = ''superseded''%',
    'revision requested source superseded'
  );

  with expected(table_name, trigger_name) as (
    values
      ('rfqs','protect_rfq_write'), ('rfqs','record_rfq_lifecycle_event'), ('rfqs','set_rfqs_updated_at'),
      ('rfq_messages','protect_rfq_message_insert'), ('rfq_messages','record_rfq_message_event'),
      ('rfq_events','protect_rfq_event_insert'),
      ('rfq_quotes','protect_rfq_quote_write'), ('rfq_quotes','set_rfq_quote_updated_at'),
      ('rfq_quote_items','protect_rfq_quote_item_write'), ('rfq_quote_items','after_rfq_quote_item_change'),
      ('rfq_quote_items','set_rfq_quote_item_updated_at'),
      ('rfq_quote_decisions','protect_rfq_quote_decision_write')
  )
  select count(*) into scoped_enabled
  from expected e
  join pg_class c on c.relname=e.table_name
  join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
  join pg_trigger t on t.tgrelid=c.oid and t.tgname=e.trigger_name and not t.tgisinternal
  where t.tgenabled='O';
  perform pg_temp.assert_rfq_authority(scoped_enabled = 12, 'all twelve scoped triggers enabled');

  perform pg_temp.assert_rfq_authority(
    (select count(*) from rfq_authority_checks) = 39,
    'expected pre-final assertion count'
  );
end;
$test$;

do $$
declare check_count integer;
begin
  select count(*) into check_count from rfq_authority_checks;
  if check_count <> 40 then
    raise exception 'Expected 40 RFQ authority checks, got %.', check_count;
  end if;
  raise notice 'RFQ authority recovery verification passed: %/% checks.', check_count, check_count;
end;
$$;

rollback;
