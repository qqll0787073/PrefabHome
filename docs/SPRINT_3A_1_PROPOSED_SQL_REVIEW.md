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
-- Abort unless the reviewed staging baseline is still present.
do $$
declare
  disabled_count integer;
  unexpected_count integer;
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

  select count(*) into unexpected_count
  from public.rfqs;
  if unexpected_count <> 0 then
    raise exception 'RFQ data-impact baseline changed; require a new data review.';
  end if;
end;
$$;
```

Expected effect: fail closed if trigger or data state differs. Rollback: none; assertions do not persist changes.

Function fingerprints should be asserted with reviewed `md5(pg_get_functiondef(oid))` values captured in the signed review record. Hashes are version-sensitive, so a mismatch must stop the migration rather than being normalized away.

## 2. Retire Generic Event Creation and Harden Grants

**PROPOSED - DO NOT EXECUTE**

```sql
-- PROPOSED - DO NOT EXECUTE
revoke all on function public.record_rfq_event(uuid, text, jsonb)
  from public, anon, authenticated;

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

Expected effect: browser roles retain only reviewed interfaces. Rollback consideration: re-grant only a named RPC proven necessary; never restore PUBLIC defaults.

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

The final migration should preferably add RPCs for Buyer draft create/update/submit/cancel/delete and Manufacturer review, update the frontend to use them, then revoke direct `rfqs` INSERT/UPDATE/DELETE from authenticated.

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
```

Expected effect: revision source is explicit and immutable. Rollback consideration: column removal would destroy lineage and is not recommended; use a forward correction instead.

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
```

Expected effect: source superseding and new submission are state-conditional and atomic. The existing partial unique index remains the final one-submitted-Quote constraint. Rollback consideration: transaction failure restores both rows; after commit use a forward corrective migration, not manual status edits.

## 7. Trigger Recovery Ordering

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
alter table public.rfq_quote_items enable trigger protect_rfq_quote_item_write;
alter table public.rfq_quote_items enable trigger set_rfq_quote_item_updated_at;
alter table public.rfq_quote_decisions enable trigger protect_rfq_quote_decision_write;

-- Enable derived writes only after authority checks pass.
alter table public.rfqs enable trigger record_rfq_lifecycle_event;
alter table public.rfq_messages enable trigger record_rfq_message_event;
alter table public.rfq_quote_items enable trigger after_rfq_quote_item_change;
```

Expected effect: all 12 triggers become enabled without processing historical rows. Rollback consideration: if post-commit containment is necessary, revoke browser mutation RPCs/grants before changing trigger state.

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

Expected effect: review evidence must show 12 `O` trigger states and no browser grants on internal helpers. Rollback: none for SELECT assertions; any mismatch aborts the enclosing migration transaction.
