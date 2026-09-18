-- Restore the 17 individually audited canonical trusted-write protections.
-- No data rewrite, function replacement, privilege expansion, or history repair.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare expected record; actual record;
begin
  for expected in select * from (values
    ('contract_events', 'protect_contract_event_write', 'c846fce84b030b6cfec66b680f58cda1', true),
    ('contract_review_decisions', 'protect_contract_review_decision_write', '8e57382079bca3110c9867d381f177f5', true),
    ('contracts', 'protect_contract_write', 'fe04a91664b72d49ac0d9b7d0db921c7', true),
    ('invoice_events', 'protect_invoice_event_write', 'b0c804e111cbc0e8d23d7a316df55a3a', true),
    ('invoice_line_items', 'protect_invoice_line_item_write', '18c7a8888798bcbcbf7a56a43a0ef279', true),
    ('invoices', 'protect_invoice_write', 'b4f4302865115a31ebf38eb083a3ff23', true),
    ('logistics_booking_request_events', 'protect_logistics_booking_request_event_write', 'd4ff5d756587bd80e2d684bc326f09b5', false),
    ('logistics_booking_requests', 'protect_logistics_booking_request_write', 'b2890e0469ef5ebbfe25088aa59a423b', false),
    ('purchase_order_decisions', 'protect_purchase_order_decision_write', '3df189c86c9549bba012fac37039e2ff', true),
    ('purchase_order_events', 'protect_purchase_order_event_write', 'a164f6195a767924a2989f67cf43ff97', true),
    ('purchase_order_items', 'protect_purchase_order_item_write', '6c27d6bc3f6f7c1688eaa6d40891887c', true),
    ('purchase_orders', 'protect_purchase_order_write', 'af6ab45a97a8ebf6cd49d05115b8dcf0', true),
    ('shipping_readiness_events', 'protect_shipping_readiness_event_write', '61c9a13433eeb570f665d9b6314f3283', false),
    ('shipping_readiness_records', 'protect_shipping_readiness_write', 'a8d92eb39b3d78bcdf45674ac11b9b2f', false),
    ('signature_package_events', 'protect_signature_package_event_write', '971b68bb22365dc8bf1900daa44bf3bb', true),
    ('signature_packages', 'protect_signature_package_write', '661edbfe26d367075c9bd63a25615671', true),
    ('signature_participants', 'protect_signature_participant_write', 'cccd2c552a34b50bd4014cdebb8427af', true)
  ) as reviewed(table_name, trigger_name, body_hash, security_definer) loop
    select t.*, p.prosrc, p.prosecdef, p.proowner, p.proconfig, p.oid as function_oid
      into actual
      from pg_trigger t join pg_proc p on p.oid=t.tgfoid
      where t.tgrelid=to_regclass('public.'||expected.table_name)
        and t.tgname=expected.trigger_name;
    if not found then raise exception 'Missing reviewed trigger: %', expected.trigger_name; end if;
    if actual.tgisinternal or actual.tgtype <> 31 or actual.tgnargs <> 0
      or actual.tgqual is not null or actual.tgconstraint <> 0
      or actual.tgfoid <> to_regprocedure('public.'||expected.trigger_name||'()')
      or actual.tgenabled not in ('D','O')
      or pg_get_userbyid(actual.proowner) <> 'postgres'
      or actual.prosecdef is distinct from expected.security_definer
      or (expected.security_definer and actual.proconfig is distinct from array['search_path=public'])
      or (not expected.security_definer and actual.proconfig is not null)
      or md5(btrim(replace(actual.prosrc,chr(13),''), E' \t\n\r')) <> expected.body_hash
      or has_function_privilege('anon', actual.function_oid, 'EXECUTE')
      or has_function_privilege('authenticated', actual.function_oid, 'EXECUTE') then
      raise exception 'Unexpected trigger/function security fingerprint: %', expected.trigger_name;
    end if;
  end loop;
end $$;

alter table public.contract_events enable trigger protect_contract_event_write;
alter table public.contract_review_decisions enable trigger protect_contract_review_decision_write;
alter table public.contracts enable trigger protect_contract_write;
alter table public.invoice_events enable trigger protect_invoice_event_write;
alter table public.invoice_line_items enable trigger protect_invoice_line_item_write;
alter table public.invoices enable trigger protect_invoice_write;
alter table public.logistics_booking_request_events enable trigger protect_logistics_booking_request_event_write;
alter table public.logistics_booking_requests enable trigger protect_logistics_booking_request_write;
alter table public.purchase_order_decisions enable trigger protect_purchase_order_decision_write;
alter table public.purchase_order_events enable trigger protect_purchase_order_event_write;
alter table public.purchase_order_items enable trigger protect_purchase_order_item_write;
alter table public.purchase_orders enable trigger protect_purchase_order_write;
alter table public.shipping_readiness_events enable trigger protect_shipping_readiness_event_write;
alter table public.shipping_readiness_records enable trigger protect_shipping_readiness_write;
alter table public.signature_package_events enable trigger protect_signature_package_event_write;
alter table public.signature_packages enable trigger protect_signature_package_write;
alter table public.signature_participants enable trigger protect_signature_participant_write;

do $$
declare expected record;
begin
  for expected in select * from (values
    ('contract_events', 'protect_contract_event_write'),
    ('contract_review_decisions', 'protect_contract_review_decision_write'),
    ('contracts', 'protect_contract_write'),
    ('invoice_events', 'protect_invoice_event_write'),
    ('invoice_line_items', 'protect_invoice_line_item_write'),
    ('invoices', 'protect_invoice_write'),
    ('logistics_booking_request_events', 'protect_logistics_booking_request_event_write'),
    ('logistics_booking_requests', 'protect_logistics_booking_request_write'),
    ('purchase_order_decisions', 'protect_purchase_order_decision_write'),
    ('purchase_order_events', 'protect_purchase_order_event_write'),
    ('purchase_order_items', 'protect_purchase_order_item_write'),
    ('purchase_orders', 'protect_purchase_order_write'),
    ('shipping_readiness_events', 'protect_shipping_readiness_event_write'),
    ('shipping_readiness_records', 'protect_shipping_readiness_write'),
    ('signature_package_events', 'protect_signature_package_event_write'),
    ('signature_packages', 'protect_signature_package_write'),
    ('signature_participants', 'protect_signature_participant_write')
  ) as reviewed(table_name, trigger_name) loop
    if not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||expected.table_name)
      and tgname=expected.trigger_name and tgenabled='O') then
      raise exception 'Trigger restoration postcondition failed: %', expected.trigger_name;
    end if;
  end loop;
end $$;
commit;
