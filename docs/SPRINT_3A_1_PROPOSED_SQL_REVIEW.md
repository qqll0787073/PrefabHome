# Sprint 3A.1 Proposed SQL Review

## Review-Only Notice

Every SQL block in this document is proposed for review only. It is intentionally outside `supabase/migrations` and was not executed. Signatures, error text, grants, and compatibility must be finalized in a separately authorized migration review.

Migration 0025 is NOT AUTHORIZED and was NOT created.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

## 1. Fingerprint Preconditions

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Abort unless the reviewed staging baseline and exact function bodies remain present.
do $$
declare
  disabled_count integer;
  fingerprint_mismatch_count integer;
begin
  select count(*) into disabled_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and c.relname in (
      'rfqs', 'rfq_messages', 'rfq_events', 'rfq_quotes',
      'rfq_quote_items', 'rfq_quote_decisions'
    )
    and t.tgenabled = 'D';

  if disabled_count <> 12 then
    raise exception 'RFQ/Quote trigger baseline changed; stop recovery review.';
  end if;

  with expected(signature, fingerprint) as (
    values
      ('public.protect_rfq_event_insert()', 'c84bc35a398e022649bac58f6e875e56'),
      ('public.protect_rfq_message_insert()', 'e68210e94dbcac476e1cb98f9a552e61'),
      ('public.record_rfq_message_event()', '567fb8448536720826850d85c3a2c609'),
      ('public.protect_rfq_quote_decision_write()', 'bbce3b2dd6556d54f7ffbaf3859f5793'),
      ('public.after_rfq_quote_item_change()', '290d817e2e488ff153270f3bb48d908c'),
      ('public.protect_rfq_quote_item_write()', 'fb54ec25d8743115003730795fc239d2'),
      ('public.set_rfq_quote_item_updated_at()', 'a121ae98df75ae899cecd5bbe8e72628'),
      ('public.protect_rfq_quote_write()', '63598fe004b9ca842e428498de9a9fff'),
      ('public.set_rfq_quote_updated_at()', '88583d166aec2c652aafaeaa5bd85ed1'),
      ('public.protect_rfq_write()', '39a9c3a920504991477ca5506735849c'),
      ('public.record_rfq_lifecycle_event()', '9f73d3cc41e4c4ea4d52e7312b50e20f'),
      ('public.set_rfq_updated_at()', '8bb032733f9be2e4575074a6b4d55fa5'),
      ('public.can_access_rfq(uuid)', '73cd8292281f67e8f18db67e79fb0aee'),
      ('public.insert_trusted_rfq_event(uuid,text,uuid,jsonb)', 'c6c3024e5d4520120d4280d1b5dc946e'),
      ('public.record_rfq_event(uuid,text,jsonb)', 'e97f229bdd858b8e5c9a3920c5143acc'),
      ('public.submit_rfq_quote(uuid)', '09552919ceaa1a3b0712f92230f2b676')
  )
  select count(*) into fingerprint_mismatch_count
  from expected e
  where to_regprocedure(e.signature) is null
     or md5(pg_get_functiondef(to_regprocedure(e.signature))) <> e.fingerprint;

  if fingerprint_mismatch_count <> 0 then
    raise exception 'Reviewed RFQ/Quote function fingerprints changed; stop recovery review.';
  end if;
end;
$$;
```

Expected effect: fail closed if trigger state or any reviewed function body differs. The authorized migration review must also fingerprint affected policy expressions, trigger definitions, owners, security mode, search paths, and grants immediately before approval. Rollback: none; assertions do not persist changes.

Hashes are version-sensitive. A mismatch must stop the migration rather than being normalized away.

## 2. Retain and Harden Event Authority

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
revoke all on function public.record_rfq_event(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.build_rfq_product_snapshot(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.protect_rfq_message_insert()
  from public, anon, authenticated;
revoke all on function public.record_rfq_lifecycle_event()
  from public, anon, authenticated;
revoke all on function public.record_rfq_message_event()
  from public, anon, authenticated;
revoke all on function public.set_rfq_updated_at()
  from public, anon, authenticated;
revoke all on function public.is_valid_rfq_transition(text, text)
  from public, anon, authenticated;

revoke trigger, truncate, references on table
  public.rfqs,
  public.rfq_messages,
  public.rfq_events,
  public.rfq_quotes,
  public.rfq_quote_items,
  public.rfq_quote_decisions
from authenticated;
```

Expected effect: `record_rfq_event` remains present, but browser and service roles cannot use the legacy generic signature as an event-injection API. Trusted `SECURITY DEFINER` RPCs and trigger functions execute as owner and can invoke an ungranted internal function. Rollback consideration: re-grant only a named user-action RPC proven necessary; never restore generic event execution or PUBLIC defaults.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Source-aware audit columns. Existing-row backfill and NOT NULL validation must be
-- re-reviewed if staging no longer has zero RFQ events at execution time.
alter table public.rfq_events
  add column actor_role text,
  add column source_type text,
  add column source_id uuid,
  add column event_key text;

alter table public.rfq_events
  add constraint rfq_events_actor_role_check
    check (actor_role is null or actor_role in ('buyer', 'manufacturer', 'admin', 'system')),
  add constraint rfq_events_source_type_check
    check (source_type is null or source_type in ('rfq', 'quote', 'quote_decision', 'message')),
  add constraint rfq_events_event_key_nonempty_check
    check (event_key is null or length(btrim(event_key)) between 1 and 240);

create unique index rfq_events_event_key_unique
  on public.rfq_events (rfq_id, event_key)
  where event_key is not null;

create unique index rfq_events_source_event_unique
  on public.rfq_events (event_type, source_type, source_id)
  where source_type is not null and source_id is not null;

create unique index rfq_events_terminal_lifecycle_unique
  on public.rfq_events (rfq_id)
  where event_type in ('accepted', 'declined', 'cancelled', 'expired');
```

Expected effect: uniqueness follows the event source or generated idempotency key rather than a blanket `(rfq_id, event_type)` rule. Message events repeat across an RFQ but remain unique per Message ID; Quote events repeat across versions but remain unique per Quote/Decision ID; terminal RFQ outcomes conflict with any second terminal outcome. Rollback consideration: indexes can be removed in a forward containment migration, but source columns should remain once event history uses them.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- This is the authority shape, not execution-ready migration SQL. The final body
-- must contain the complete event/state/source matrix and per-event metadata builders.
create or replace function public._record_rfq_event(
  rfq_uuid uuid,
  event_name text,
  actor_uuid uuid,
  actor_role_value text,
  source_type_value text,
  source_uuid uuid,
  event_key_value text,
  trusted_metadata jsonb
)
returns public.rfq_events
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.rfq_events%rowtype;
  existing public.rfq_events%rowtype;
begin
  -- Validate the fixed event vocabulary, source type, non-null source where
  -- required, actor/role pairing, and metadata keys before this insert.
  insert into public.rfq_events (
    rfq_id, event_type, actor_profile_id, actor_role,
    source_type, source_id, event_key, metadata
  ) values (
    rfq_uuid, event_name, actor_uuid, actor_role_value,
    source_type_value, source_uuid, event_key_value, trusted_metadata
  )
  on conflict (rfq_id, event_key) where event_key is not null do nothing
  returning * into inserted;

  if found then
    return inserted;
  end if;

  select * into existing
  from public.rfq_events
  where rfq_id = rfq_uuid and event_key = event_key_value;

  if existing.event_type = event_name
     and existing.actor_profile_id is not distinct from actor_uuid
     and existing.source_type is not distinct from source_type_value
     and existing.source_id is not distinct from source_uuid
     and existing.metadata = trusted_metadata then
    return existing; -- exact retry is idempotent
  end if;

  raise exception 'RFQ event idempotency conflict.';
end;
$$;

revoke all on function public._record_rfq_event(
  uuid, text, uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated, service_role;
```

Expected effect: the private primitive owns constraint-aware insertion and exact-retry handling. It trusts only arguments assembled by the retained dispatcher, never browser payloads. Rollback consideration: revoke all user-action RPCs before changing this helper; never grant it directly.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Retain the public API name but add a source-aware internal signature.
create or replace function public.record_rfq_event(
  rfq_uuid uuid,
  event_name text,
  source_type_value text,
  source_uuid uuid
)
returns public.rfq_events
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
  actor_uuid uuid := auth.uid();
  actor_role_value text;
  safe_metadata jsonb;
  event_key_value text;
begin
  select * into rfq_record from public.rfqs where id = rfq_uuid for share;
  if not found then raise exception 'RFQ does not exist.'; end if;

  -- Final body must: derive role from profiles plus RFQ ownership; validate the
  -- current RFQ/Quote/Decision/Message state; construct event-specific metadata
  -- from database rows; build the event key; and call _record_rfq_event().
  -- It must reject Admin impersonation, caller metadata, invalid sources, and
  -- events not associated with the trusted outer lifecycle operation.
  raise exception 'Review skeleton only; complete trusted event matrix required.';
end;
$$;

-- Preserve the legacy signature for ABI discovery, but make it fail closed.
create or replace function public.record_rfq_event(
  rfq_uuid uuid,
  event_name text,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Legacy RFQ event signature is not an authenticated event interface.';
end;
$$;

revoke all on function public.record_rfq_event(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.record_rfq_event(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
```

Expected effect: the required function name is retained. Trusted owner-executed triggers/RPCs call the source-aware overload internally; no browser or service-role caller receives generic EXECUTE. The old three-argument JSON signature remains discoverable but fails closed, so external callers receive an intentional compatibility break instead of silent event injection. Rollback consideration: restore neither generic grants nor caller metadata. If a separately audited backend needs access later, expose a dedicated operational RPC with its own action vocabulary and audit trail.

## 3. Manufacturer Draft Privacy

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
create or replace function public.can_access_rfq(rfq_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rfqs r
    where r.id = rfq_uuid
      and (
        r.buyer_id = auth.uid()
        or public.is_admin()
        or (
          r.status <> 'draft'
          and public.owns_manufacturer(r.manufacturer_id)
        )
      )
  )
$$;

drop policy if exists "rfqs_select_participant_or_admin" on public.rfqs;
create policy "rfqs_select_participant_or_admin"
on public.rfqs for select to authenticated
using (
  buyer_id = auth.uid()
  or public.is_admin()
  or (status <> 'draft' and public.owns_manufacturer(manufacturer_id))
);
```

Expected effect: Buyer retains own Draft access; Manufacturer sees assigned RFQs only after submission; Admin remains read-only. Message/Event policies using `can_access_rfq()` inherit the same boundary. Rollback consideration: restore only from the reviewed prior definition, but doing so reopens the privacy defect.

## 4. Remove Admin Direct Mutation Authority

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
drop policy if exists "rfqs_update_draft_buyer_or_admin" on public.rfqs;
create policy "rfqs_update_draft_buyer"
on public.rfqs for update to authenticated
using (buyer_id = auth.uid() and status in ('draft', 'submitted'))
with check (buyer_id = auth.uid() and status in ('draft', 'submitted', 'cancelled'));

drop policy if exists "rfqs_delete_draft_buyer_or_admin" on public.rfqs;
create policy "rfqs_delete_draft_buyer"
on public.rfqs for delete to authenticated
using (buyer_id = auth.uid() and status = 'draft');

drop policy if exists "rfq_messages_admin_delete" on public.rfq_messages;
drop policy if exists "rfq_events_admin_delete" on public.rfq_events;
```

Expected effect: Admin inspection is SELECT-only. Rollback consideration: an operator mutation must be a separately reviewed RPC, not a restored blanket policy.

The final migration must add RPCs for Buyer draft create/update/submit/cancel/delete and Manufacturer review, update the frontend to use them, then revoke direct `rfqs` INSERT/UPDATE/DELETE from authenticated.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Bodies omitted here must follow one authority template: authenticate; lock the
-- RFQ; derive Buyer/Manufacturer identity; validate immutable fields and the
-- exact old/new state; perform a state-conditional write with RETURNING; call
-- retained record_rfq_event() where applicable; require one affected row.
revoke insert, update, delete on public.rfqs from authenticated;

revoke all on function public.create_rfq_draft(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.update_rfq_draft(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_rfq(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.cancel_rfq_draft(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_rfq_draft(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.begin_manufacturer_rfq_review(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.create_rfq_draft(uuid, jsonb) to authenticated;
grant execute on function public.update_rfq_draft(uuid, jsonb) to authenticated;
grant execute on function public.submit_rfq(uuid) to authenticated;
grant execute on function public.cancel_rfq_draft(uuid) to authenticated;
grant execute on function public.delete_rfq_draft(uuid) to authenticated;
grant execute on function public.begin_manufacturer_rfq_review(uuid) to authenticated;
```

Expected effect: authenticated users can request named actions, but RLS and direct grants no longer provide a generic RFQ mutation surface. Each `SECURITY DEFINER` RPC remains owned by `postgres`, has `search_path = public`, derives its actor, and performs its event write atomically. Rollback consideration: revoke a failing RPC to contain it; do not restore direct table DML.

## 5. Server-Derived Message Identity

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
create or replace function public.protect_rfq_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rfqs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into r from public.rfqs where id = new.rfq_id;
  if not found or not public.can_access_rfq(new.rfq_id) then
    raise exception 'RFQ message access denied.';
  end if;

  if public.is_admin() then
    raise exception 'Admin RFQ access is read-only.';
  elsif r.buyer_id = auth.uid() then
    new.sender_role := 'buyer';
  elsif public.owns_manufacturer(r.manufacturer_id) and r.status <> 'draft' then
    new.sender_role := 'manufacturer';
  else
    raise exception 'Only RFQ participants can post messages.';
  end if;

  new.sender_profile_id := auth.uid();
  new.message := btrim(new.message);
  new.created_at := now();
  return new;
end;
$$;
```

Expected effect: browser-supplied sender fields cannot impersonate another user or role. Rollback consideration: do not restore caller-controlled identity.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Exact return type and attachment validation remain subject to review.
create or replace function public.post_rfq_message(
  rfq_uuid uuid,
  message_text text,
  attachment_path_value text default null
)
returns public.rfq_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.rfq_messages%rowtype;
begin
  if nullif(btrim(coalesce(message_text, '')), '') is null
     or char_length(btrim(message_text)) > 4000 then
    raise exception 'Message must contain between 1 and 4000 characters.';
  end if;

  insert into public.rfq_messages (rfq_id, message, attachment_path)
  values (rfq_uuid, btrim(message_text), attachment_path_value)
  returning * into inserted;

  return inserted;
end;
$$;

revoke insert, update, delete on public.rfq_messages from authenticated;
revoke all on function public.post_rfq_message(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.post_rfq_message(uuid, text, text)
  to authenticated;
```

Expected effect: one narrow Message interface; the BEFORE/AFTER triggers derive identity and create the reply Event in the same transaction. Rollback consideration: revoke the RPC first; do not re-enable direct caller identity fields.

## 6. Explicit Revision Lineage and Atomic Superseding

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
alter table public.rfq_quotes
  add column supersedes_quote_id uuid
  references public.rfq_quotes(id) on delete restrict;

create unique index rfq_quotes_one_revision_of_source_idx
  on public.rfq_quotes (supersedes_quote_id)
  where supersedes_quote_id is not null;

alter table public.rfq_quotes
  add constraint rfq_quotes_not_self_superseding_check
  check (supersedes_quote_id is null or supersedes_quote_id <> id);
```

Expected effect: revision source is explicit and protected from self-reference. `ON DELETE RESTRICT` is intentional because immutable Quote history must not be detached or silently nulled. Existing Quote RLS naturally controls visibility of the referenced row. Rollback consideration: column removal would destroy lineage and is not recommended; use a forward correction instead.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
create or replace function public.protect_rfq_quote_revision_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_quote public.rfq_quotes%rowtype;
begin
  if tg_op = 'UPDATE'
     and old.supersedes_quote_id is distinct from new.supersedes_quote_id then
    raise exception 'Quote revision lineage is immutable.';
  end if;

  if new.supersedes_quote_id is null then return new; end if;

  select * into source_quote
  from public.rfq_quotes
  where id = new.supersedes_quote_id;

  if not found or source_quote.rfq_id <> new.rfq_id then
    raise exception 'Quote revision source must belong to the same RFQ.';
  end if;

  if exists (
    with recursive ancestors(id, supersedes_quote_id) as (
      select source_quote.id, source_quote.supersedes_quote_id
      union all
      select q.id, q.supersedes_quote_id
      from public.rfq_quotes q
      join ancestors a on q.id = a.supersedes_quote_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Quote revision lineage cannot contain a cycle.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_rfq_quote_revision_lineage()
  from public, anon, authenticated, service_role;
```

Expected effect: same-RFQ lineage, immutability, and cycle prevention are database-enforced. The separately reviewed migration must attach this protection trigger before permitting revision creation. Rollback consideration: contain by revoking revision RPC execution; do not disable the lineage trigger after revisions exist.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Core transaction shape for submit_rfq_quote; full validation remains required.
select * into quote_record
from public.rfq_quotes
where id = quote_uuid
for update;

select * into rfq_record
from public.rfqs
where id = quote_record.rfq_id
for update;

if quote_record.supersedes_quote_id is not null then
  select * into source_quote
  from public.rfq_quotes
  where id = quote_record.supersedes_quote_id
    and rfq_id = quote_record.rfq_id
  for update;

  update public.rfq_quotes
  set status = 'superseded'
  where id = source_quote.id
    and status = 'revision_requested'
  returning * into source_quote;

  if not found then
    raise exception 'Quote revision source changed; reload and retry.';
  end if;
end if;

update public.rfq_quotes
set status = 'submitted', submitted_at = now()
where id = quote_record.id and status = 'draft'
returning * into quote_record;

if not found then
  raise exception 'Only a current draft quote can be submitted.';
end if;

-- The same transaction state-conditionally updates the RFQ, then calls the
-- retained source-aware record_rfq_event() overload with source_type='quote'
-- and source_id=quote_record.id. The event key is derived from Quote ID/version.
```

Expected effect: RFQ, source Quote, and draft revision are locked in that order; ownership and statuses are validated; source superseding, new submission, RFQ transition, and the trusted `quote_created` event commit atomically. The existing partial unique index remains the final one-submitted-Quote constraint. Rollback consideration: transaction failure restores all rows; after commit use a forward corrective migration, not manual status edits.

## 7. Trigger Recovery Ordering

Before enabling triggers, replace `record_rfq_lifecycle_event()` and `record_rfq_message_event()` so they call the retained source-aware `record_rfq_event(...)` overload. Quote submission/opening/decision RPCs must do the same in the transaction that changes state. No trigger or authenticated RPC may call `_record_rfq_event(...)` directly; that primitive is reserved for the retained dispatcher.

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
-- Enable protection and timestamps before derived side effects.
alter table public.rfqs enable trigger protect_rfq_write;
alter table public.rfqs enable trigger set_rfqs_updated_at;
alter table public.rfq_messages enable trigger protect_rfq_message_insert;
alter table public.rfq_events enable trigger protect_rfq_event_insert;
alter table public.rfq_quotes enable trigger protect_rfq_quote_write;
alter table public.rfq_quotes enable trigger set_rfq_quote_updated_at;
alter table public.rfq_quotes enable trigger protect_rfq_quote_revision_lineage;
alter table public.rfq_quote_items enable trigger protect_rfq_quote_item_write;
alter table public.rfq_quote_items enable trigger set_rfq_quote_item_updated_at;
alter table public.rfq_quote_decisions enable trigger protect_rfq_quote_decision_write;

-- Enable derived writes only after authority checks pass.
alter table public.rfqs enable trigger record_rfq_lifecycle_event;
alter table public.rfq_messages enable trigger record_rfq_message_event;
alter table public.rfq_quote_items enable trigger after_rfq_quote_item_change;
```

Expected effect: the 12 recovered triggers plus the new revision-lineage trigger are enabled without processing historical rows. Rollback consideration: if post-commit containment is necessary, revoke browser mutation RPCs/grants before changing trigger state.

## 8. Postcondition Assertions

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
select c.relname as table_name,
       t.tgname as trigger_name,
       t.tgenabled,
       pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in (
    'rfqs', 'rfq_messages', 'rfq_events', 'rfq_quotes',
    'rfq_quote_items', 'rfq_quote_decisions'
  )
order by c.relname, t.tgname;

select routine_name, grantee
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in (
    'record_rfq_event', 'build_rfq_product_snapshot',
    'protect_rfq_message_insert', 'record_rfq_lifecycle_event',
    'record_rfq_message_event'
  )
order by routine_name, grantee;
```

Expected effect: review evidence must show all 12 recovered triggers and the new lineage trigger in state `O`, retained `record_rfq_event` signatures without browser grants, and no browser grants on internal helpers. Rollback: none for SELECT assertions; any mismatch aborts the enclosing migration transaction.
