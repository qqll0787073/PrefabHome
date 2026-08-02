# Migration 0025 Staging Execution Runbook

## Status And Scope

This is a future procedure only. It must not be executed without separate,
explicit authorization naming the Staging project, migration checksum, execution
window, and operator. It applies only to
`0025_restore_rfq_quote_authority.sql`. It does not authorize Production, the 17
non-RFQ triggers, deployment, merge, tag, or release work.

Disposable local database execution was authorized.

Migration 0025 was executed only on disposable local databases.

Migration 0025 has NOT been applied to Staging.

Migration 0025 has NOT been applied to Production.

No Staging Supabase access occurred.

No Production Supabase access occurred.

Production Deployment Authorization is NOT GRANTED.

The 17 disabled non-RFQ triggers remain out of scope.

PR #29 must remain Draft.

## Required Authorization

Before any Staging connection, record:

- authorizing owner and timestamp
- exact Staging project reference and independently verified URL/reference match
- explicit Production denylisted project reference
- migration filename and approved SHA-256 checksum
- approved start/end time and expected traffic level
- designated operator and observer
- backup/checkpoint owner
- stop authority and escalation contacts

Never place credentials or tokens in this runbook, shell history, comments,
screenshots, or captured logs.

## Pre-Execution Checkpoint

1. Confirm the repository branch and approved commit are clean and synchronized.
2. Verify migrations 0001-0024 against the approved baseline byte-for-byte.
3. Verify 0025 is the only pending migration and its checksum equals the reviewed
   value in the authorization.
4. Confirm no 0026 exists.
5. Run the Staging safety guard before every CLI or SQL entry point.
6. Confirm the target is Staging and Production is rejected.
7. Create the approved Supabase backup/checkpoint or verify point-in-time recovery
   coverage. Record only its identifier, timestamp, and status.
8. Select a zero- or low-traffic window. Pause UAT writes to RFQs, Messages,
   Quotes, Quote Items, and Quote Decisions.
9. Record active session and transaction counts for those objects.

## Snapshot Current State

Capture sanitized, read-only evidence immediately before execution:

- remote migration versions and migration-history count for 0025
- owners, RLS/FORCE RLS, columns, defaults, nullability, constraints, foreign keys,
  checks, and indexes for the six RFQ/Quote tables
- all RFQ/Quote policies and role grants
- relevant function signatures, owners, languages, volatility, security mode,
  search path, and EXECUTE grants
- all user trigger names, definitions, functions, and enabled states
- a separate snapshot of the 17 out-of-scope disabled non-RFQ triggers
- preflight row counts and invalid-state probes
- lifecycle and event-vocabulary constraints

Stop if this differs from migration preflight or approved review evidence. Do not
edit Staging merely to make preflight pass.

## Containment Criteria

Proceed only when all are true:

- migration history is exactly 0001-0024
- pending list is exactly 0025
- no incompatible RPC overload exists
- RFQ/Quote owner, RLS, policy, grant, index, constraint, function, and trigger
  definitions match preflight
- invalid lineage/event-provenance counts are zero
- the 17 non-RFQ trigger states match the snapshot and remain out of scope
- backup/checkpoint is verified
- the approved traffic window is active

Stop immediately on target mismatch, checksum mismatch, drift, unexpected pending
migration, lock timeout, deadlock, preflight/postflight failure, or any statement
affecting an out-of-scope trigger.

## Transaction Execution Method

Use the separately approved isolated Supabase CLI/workspace or approved direct
database transaction. Verify target identity and pending list immediately before
execution. Apply exactly the reviewed 0025 file once.

Prohibited actions:

- migration repair
- database or schema reset
- database pull used as write/reconciliation
- applying any migration other than 0025
- editing migration history manually
- enabling or disabling the 17 non-RFQ triggers
- any Production command

Capture sanitized start/end timestamps, command exit status, SQLSTATE on failure,
and notices. Never capture connection strings, keys, tokens, passwords, JWTs, or
full request URLs.

## Immediate Postflight

Before resuming traffic, verify:

1. Migration history is exactly 0001-0025 and the 0025 count is one.
2. No migration beyond 0025 exists.
3. The six RFQ/Quote tables retain expected owner and RLS state.
4. Lineage, foreign keys, checks, partial indexes, provenance columns, and event
   uniqueness match reviewed definitions.
5. Exactly the approved 12 RFQ/Quote triggers are enabled and resolve correctly.
6. The 17 non-RFQ triggers are byte/state-identical to the pre-execution snapshot.
7. Internal functions remain unexecutable by PUBLIC, `anon`, `authenticated`, and
   explicit `service_role` grants.
8. Participant RPCs remain authenticated-only and reject Admin mutation.
9. The 54 rollback-only assertions execute and pass without residue.

## Authenticated Smoke Tests

Use approved non-Production Staging identities and exact-ID cleanup:

- Buyer creates, edits, submits, cancels, and deletes eligible RFQ drafts; UUID and
  one-record invariants hold.
- Assigned Manufacturer cannot see Buyer draft, then sees submitted RFQ.
- Buyer B and unrelated Manufacturer see no participant data.
- Participant Messages derive sender identity and role; direct writes fail.
- Manufacturer creates Quote draft, edits items, observes subtotal, and submits.
- Retried submission returns the authoritative Quote with no duplicate event.
- Buyer requests revision; Manufacturer creates/submits one revision; source is
  superseded and history remains visible.
- Buyer opens and decides the current Quote; source-aware events are correct.
- Admin reads but cannot mutate or impersonate participant operations.
- Anonymous access is denied.
- A controlled two-session same-Quote submission confirms idempotency.

Record SQLSTATE/PostgREST status, private fixture IDs, event counts, and final
state. Do not place real Staging identifiers in public logs.

## Cleanup And Evidence

Delete only rows and auth users in the private exact-ID fixture manifest, in reverse
dependency order. Verify zero residue across RFQ/Quote tables, upstream Product,
Manufacturer, Profile/Auth records, and any downstream fixture objects. Do not
delete migration history or permanent schema objects.

Retain sanitized evidence:

- authorization and backup/checkpoint record
- before/after migration inventory
- trigger, policy, grant, and function snapshots
- migration checksum and transaction result
- 54-assertion, authenticated smoke, and concurrency results
- exact-ID cleanup summary with zero counts
- confirmation Production was denied and untouched

## Rollback Limitations

Migration 0025 is forward-only after commit. Transaction rollback is automatic
only before successful commit. Backup or point-in-time restore is the recovery
mechanism for a committed migration; manual reverse SQL, migration-history edits,
and migration repair are not approved rollback methods.

If postflight fails after commit, contain writes, preserve evidence, notify the
owner and database operator, and decide between reviewed forward fix and checkpoint
restore. Do not improvise migration 0026 or modify 0001-0025 during containment.

## Escalation Criteria

Escalate and stop for:

- target ambiguity or Production reference detection
- checksum or migration-list mismatch
- preflight/postflight assertion failure
- unexpected owner, RLS, policy, grant, overload, or trigger drift
- any change to an out-of-scope trigger
- lock wait beyond the approved window or any deadlock
- duplicate Quote, current-version, terminal-event, or lineage anomaly
- participant isolation failure
- failed exact-ID cleanup
- missing or unverified backup/checkpoint

Completion of this runbook does not authorize deployment, PR readiness, merge,
tag, release, or Production access.
