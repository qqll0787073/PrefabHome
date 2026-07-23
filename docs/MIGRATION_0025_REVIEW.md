# Migration 0025 Review

## Authorization

Migration 0025 creation was authorized for code review only.

Migration 0025 has NOT been applied to Staging.

Migration 0025 has NOT been applied to Production.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

PR #29 must remain Draft.

## Scope

`0025_restore_rfq_quote_authority.sql` is one forward-only transactional migration. It restores and hardens only the RFQ/Quote authority surface defined by migrations `0011` through `0013`. Migrations `0001` through `0024` remain byte-for-byte unchanged. The 17 disabled non-RFQ triggers listed in [Staging Trigger Governance Incident](STAGING_TRIGGER_GOVERNANCE_INCIDENT.md) are not modified.

The migration starts with fail-closed fingerprints for tables, columns/types, function signatures and ownership, function semantics, policies, status constraints, indexes, trigger identity, overload count, and conflicting current data. It ends with postconditions for trigger state, table grants, and internal function grants.

## Data Model

### Quote Lineage

`rfq_quotes.supersedes_quote_id uuid` records the immutable source of a revision. A composite foreign key `(rfq_id, supersedes_quote_id) -> rfq_quotes(rfq_id, id)` enforces same-RFQ lineage with `ON DELETE RESTRICT`. A check rejects self-reference, a recursive validator rejects cycles, and a partial unique index permits at most one direct revision per source. The existing partial unique index continues to permit only one `status = 'submitted'` Quote per RFQ.

No historical lineage is fabricated. Existing Quotes receive `NULL`; lineage begins only with revisions created by the new trusted RPC implementation.

### Event Provenance

`rfq_events` adds nullable migration-safe columns `actor_role`, `source_type`, `source_id`, and `event_key`. New trusted writes always populate all four. Source types are limited to `rfq`, `quote`, `quote_decision`, and `message`.

Uniqueness is source-aware:

- `(rfq_id, event_key)` is unique when a key exists.
- `(event_type, source_type, source_id)` is unique when a source exists.
- one terminal `accepted`, `declined`, `cancelled`, or `expired` event is permitted per RFQ.
- distinct Message rows and Quote versions produce distinct events.
- exact retries resolve to the existing event; mismatched retries fail.

## Functions

### Public Authenticated RPCs

- `create_rfq_draft(uuid,numeric,text,text,text,text,date,text)`
- `update_rfq_draft(uuid,numeric,text,text,text,text,date,text)`
- `submit_rfq(uuid,numeric,text,text,text,text,date,text)`
- `cancel_rfq(uuid)`
- `delete_rfq_draft(uuid)`
- `send_rfq_message(uuid,text,text)`
- `record_rfq_opened(uuid)`
- `create_rfq_quote_draft(uuid)`
- `create_rfq_quote_revision(uuid)`
- `submit_rfq_quote(uuid)`
- `delete_rfq_quote_draft(uuid)`
- `record_rfq_quote_opened(uuid)`
- `accept_rfq_quote(uuid,text)`
- `reject_rfq_quote(uuid,text)`
- `request_rfq_quote_revision(uuid,text)`

Each mutation checks `auth.uid()`, the database profile role, participant ownership, and the current locked lifecycle state. Admin callers fail role/ownership checks. Browser callers do not supply Buyer IDs, sender IDs, sender roles, event actors, event roles, lifecycle timestamps, Quote versions, or snapshots.

### Internal Functions

The migration creates or replaces:

- `rfq_write_context()`
- `is_trusted_rfq_message_write()`
- `is_trusted_rfq_event_write()`
- `assert_rfq_values(numeric,text,text,text,text,date,text)`
- `can_access_rfq(uuid)`
- `can_access_rfq_quote(uuid)`
- `protect_rfq_write()`
- `record_rfq_event(uuid,text,jsonb)`
- `insert_trusted_rfq_event(uuid,text,uuid,jsonb)` as a fail-closed legacy stub
- `protect_rfq_event_insert()`
- `record_rfq_lifecycle_event()`
- `record_rfq_message_event()`
- `protect_rfq_message_insert()`
- `protect_rfq_quote_write()`
- `assert_rfq_quote_lineage(uuid,uuid,uuid)`
- `decide_rfq_quote(uuid,text,text)`

`record_rfq_event` is retained as an internal `SECURITY DEFINER` dispatcher owned by `postgres`, with `search_path = public`. It derives the actor and role, validates current state and source IDs, allowlists metadata per event, creates a server snapshot and timestamp, and applies source-aware idempotency. `PUBLIC`, `anon`, `authenticated`, and `service_role` have no direct execute grant. Trigger invocation does not require an end-user execute grant.

## Atomic Quote Revision

Revision creation writes `supersedes_quote_id` and copies source items while the RFQ/source are locked. Submission locks the RFQ first, then the draft revision and source Quote. It verifies the assigned Manufacturer, same RFQ and Manufacturer, acyclic lineage, `draft` replacement status, `revision_requested` source/RFQ status, and at least one line item. In one transaction it recalculates subtotal, conditionally changes the source to `superseded`, conditionally changes the draft to `submitted`, changes the RFQ to `quoted`, and emits one source-bound `quote_created` event. Any conflict rolls back all changes.

## RLS And Grants

### Before

Authenticated users had direct RFQ insert/update/delete, Message insert/delete, Event delete, and decision-adjacent table grants governed by broad policies. Manufacturer visibility helpers included Buyer drafts. Internal helper grants were inconsistent.

### After

- `rfqs`, `rfq_messages`, `rfq_events`, and `rfq_quote_decisions` grant authenticated users `SELECT` only.
- RFQ and Message mutations require narrow RPCs; direct Event/Decision mutation is unavailable.
- `rfq_quotes` retains select and Manufacturer-owned draft update/delete only.
- `rfq_quote_items` retains select and Manufacturer-owned draft item editing only.
- Buyer sees owned RFQs including drafts.
- assigned Manufacturer visibility starts at non-draft RFQ status; unrelated Manufacturers see no row.
- Admin select policies remain, but mutation policies and callable Admin mutation paths do not.
- Anonymous users retain no table or RPC access.
- policy helper RPCs expose only boolean authorization checks.
- trigger/internal helpers have explicit `postgres` ownership and no browser or service-role execute grant.

## Message Authority

`send_rfq_message` accepts only RFQ ID, message text, and optional attachment path. The insertion trigger derives `sender_profile_id` and `sender_role`. Buyer ownership or assigned Manufacturer ownership is required, Manufacturers cannot message on Buyer drafts, Admin is read-only, empty/overlong content is rejected, and the Manufacturer reply event is created by the trusted after-insert trigger in the same transaction.

## Trigger State

The migration explicitly enables the 12 reviewed triggers listed in [Staging Trigger Governance Incident](STAGING_TRIGGER_GOVERNANCE_INCIDENT.md). It does not use `ENABLE TRIGGER ALL`, `ENABLE TRIGGER USER`, or any operation on the 17 out-of-scope triggers. Postflight requires all 12 to be ordinary origin-enabled triggers.

## Verification Matrix

| Area | Review evidence |
| --- | --- |
| Migration inventory | exactly `0001`-`0025`; only `0025` new |
| Baseline integrity | each `0001`-`0024` file compared to `auth-profiles` |
| Static migration authority | infrastructure assertions cover pre/postflight, trigger allowlist, lineage, locking, grants, RLS, RPCs, events, and frontend calls |
| Rollback SQL | `supabase/tests/rfq_authority_recovery_security.sql`, 40 catalog/authority assertions, rollback-only |
| Frontend | RFQ services use trusted RPCs; existing saved-draft no-duplicate and Manufacturer draft boundary tests retained |
| Disposable database | not executed in this task because local Docker/PostgreSQL was unavailable |
| Remote database | not executed; migration application is not authorized |

Local review results on 2026-07-22:

- frontend tests: `234/234`
- infrastructure/static tests: `83/83`
- rollback SQL definition: `40` assertions, not executed because no disposable PostgreSQL was available
- TypeScript and production build: passed
- deterministic quality gate: passed
- production artifact verification: passed, zero source maps
- dependency audit: zero vulnerabilities
- tracked secret scan: zero findings

The rollback SQL is intended to run only after migrations `0001` through `0025` are applied to an isolated disposable database. It must never be pointed at Staging or Production in this review phase.

## Future Staging Runbook

This runbook requires separate written authorization:

1. Freeze RFQ/Quote application writes and take a verified backup.
2. Run the staging safety guard and deny the Production project reference.
3. Confirm remote migration history is exactly `0001` through `0024`.
4. Confirm the sole pending migration is `0025_restore_rfq_quote_authority.sql`.
5. Run the migration and rollback security suite first in an isolated clone or transaction-capable disposable database.
6. Review preflight output and stop on any fingerprint or data conflict.
7. Apply exactly migration 0025 through the normal reviewed CLI flow.
8. Verify migration history, all 12 trigger states/functions, grants, policies, and no change to the 17 out-of-scope trigger states.
9. Run authenticated Buyer, Manufacturer, and Admin UAT plus concurrency tests.
10. Clean exact-ID fixtures, confirm zero residue, then re-enable application writes only after approval.

No staging step is authorized by this document itself.

## Containment And Rollback Limits

Migration execution is transactional: a preflight, DDL, or postflight failure rolls back the migration. There is no destructive automatic down migration. After a successful apply, containment should stop application writes, revoke only affected public RPC execution, restore reviewed function/policy definitions through an approved forward fix, and disable only a specifically malfunctioning scoped trigger if separately authorized. Restore from backup is the last resort.

Because existing audit rows cannot be reconstructed reliably, no rollback or remediation may fabricate historical events, snapshots, actors, or Quote lineage.

## Approval Checklist

- [ ] Database owner approves migration SQL and data assumptions.
- [ ] Security reviewer approves RLS, grants, function ownership, and event provenance.
- [ ] Disposable clean-chain and behavioral tests pass.
- [ ] Staging execution is separately authorized.
- [ ] Backup and containment operators are assigned.
- [ ] The 17 out-of-scope triggers remain a separate incident.
- [ ] Production execution and deployment remain separately authorized.
