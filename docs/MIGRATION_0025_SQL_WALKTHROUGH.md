# Migration 0025 SQL Walkthrough

## Review Boundary

This is a statement-by-statement review map for `0025_restore_rfq_quote_authority.sql` as corrected during Sprint 3A.4. Line numbers refer to the reviewed migration after the corrections in this review.

Migration 0025 was reviewed but NOT applied.

Migration 0025 has NOT been applied to Staging.

Migration 0025 has NOT been applied to Production.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

The 17 disabled non-RFQ triggers remain untouched.

PR #29 must remain Draft.

## Ordered SQL Block Map

| Lines | Class | Purpose | Reads | Writes | Dependencies and expected input | Result | Failure and containment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | Transaction | Begin one atomic migration transaction. | None | Transaction state | PostgreSQL transaction support | All following work is atomic through line 2674. | Any uncaught exception aborts; no partial migration should persist. |
| 7-555 | Preflight | Fail closed on schema, data, policy, trigger, function, privilege, index, and lifecycle drift. | PostgreSQL catalogs and all six RFQ/Quote tables | None | Migrations 0011-0013 contract, PostgreSQL-owned tables/functions, RLS enabled, exact supported vocabularies | Execution reaches DDL only on the reviewed baseline. | Raises a scoped preflight exception; transaction remains aborted. No audit history is fabricated. |
| 34-120 | Preflight: columns | Verify every material existing column, exact formatted type/typmod, and nullability. | `pg_class`, `pg_namespace`, `pg_attribute` | None | Six expected tables | Same-name tables with missing or type-drifted columns are rejected. | Fail closed before DDL. |
| 122-155 | Preflight: new columns/RLS | Require 0025 columns to be absent; require RLS enabled, FORCE RLS disabled, owner `postgres`, and no browser-role schema creation. | Catalogs and schema privileges | None | Clean pre-0025 state | Prevents partial migration replay and unsafe table/schema authority. | Fail closed. |
| 157-270 | Preflight: functions | Require exact function signatures, reject new-name collisions and incompatible RPC overloads, and fingerprint critical legacy semantics. | `pg_proc`, `pg_namespace` | None | Reviewed 0011-0013 functions | Prevents accidental replacement of incompatible overloads or a semantically drifted quote/event core. | Fail closed. `CREATE OR REPLACE` is never reached on mismatch. |
| 272-301 | Preflight: triggers | Match exactly 12 trigger names to table, function schema/name, timing/events (`tgtype`), zero arguments, no `WHEN`, trigger return type, and enabled/disabled state. | Trigger catalogs | None | The 12 in-scope triggers may be `O` or `D` | Same-name wrong trigger definitions are rejected. | Fail closed; 17 non-RFQ triggers are not queried by name or changed. |
| 304-388 | Preflight: policies | Bind each baseline policy to table, command, permissive mode, sole authenticated role, and required semantic tokens. | Policy catalogs | None | Reviewed pre-0025 RLS state | Rejects wrong-table, wrong-command, wrong-role, or materially drifted same-name policies. | Fail closed. Expressions are recreated later, so this is drift detection rather than authorization at rest. |
| 390-445 | Preflight: vocab/indexes | Extract exact RFQ/Quote/event vocabularies and verify both current-Quote partial unique indexes. | Constraints and index catalogs | None | Exact 0013 status/event vocabulary and 0012 indexes | No invented/omitted lifecycle values; one draft and one submitted Quote per RFQ remain enforced. | Fail closed. |
| 447-502 | Preflight: data | Reject duplicate current/draft Quotes, duplicate terminal events, Quote participant mismatch, Quotes under Buyer drafts, and decision linkage mismatch. | RFQs, Quotes, Events, Decisions | None | Existing rows satisfy upcoming invariants | Existing bad rows require explicit operator remediation; the migration does not rewrite them. | Fail closed without data mutation. |
| 504-553 | Preflight: ownership | Require reviewed functions to be owned by `postgres`. | Function/role catalogs | None | Trusted ownership unchanged | Prevents replacement under an unexpected owner. | Fail closed. |
| 556-565 | Schema/constraints | Add immutable Quote lineage: nullable UUID, self-reference check, composite unique target, same-RFQ FK with `ON DELETE RESTRICT`. | `rfq_quotes` | `rfq_quotes` schema | Existing rows receive `NULL`; preflight found no 0025 column | Old rows remain compatible; new lineage cannot cross RFQs or delete its source. | DDL error rolls back. |
| 566-572 | Indexes | Index lineage lookup and allow at most one direct child per source Quote. | `rfq_quotes` | Two indexes | Lineage column exists | Fast traversal and one-revision-per-source invariant. | Duplicate non-null source links would fail, but none exist because the column is new. |
| 574-598 | Event provenance | Add nullable provenance columns plus actor/source/format and all-null-or-all-complete constraints. | `rfq_events` | `rfq_events` schema | Existing events require migration-safe NULL provenance | Legacy rows remain valid; new trusted events cannot carry partial provenance. | Constraint failure rolls back. |
| 600-610 | Event uniqueness | Add unique event key, source event, and terminal RFQ indexes. | `rfq_events` | Three partial unique indexes | Preflight rejects duplicate terminal history; new provenance is NULL on old rows | New retries and source events deduplicate without rewriting history. | Conflict aborts the current transaction unless handled by dispatcher. |
| 612-689 | Context/value helpers | Read transaction-local trusted contexts and validate normalized RFQ fields. | Session GUCs, date | Functions | Exact signatures are free/reviewed | Shared trusted-write gates and validation. | Exceptions abort caller transaction. Helpers are revoked later. |
| 691-751 | Access helpers | Define Buyer/Manufacturer/Admin RFQ and Quote visibility; exclude Buyer drafts from Manufacturer and Quote-item management. | RFQs, Quotes, profile/ownership helpers | Functions | RLS helper dependencies exist | Boolean RLS predicates with parent-aware draft isolation. | No row means false. Authenticated execution only after grants. |
| 753-870 | RFQ write trigger | Normalize values and authorize only context-specific, role-owned lifecycle changes while freezing participant/snapshot and Buyer fields. | `auth.uid`, profiles, OLD/NEW | NEW row or exception | Trigger shape exists and is later enabled | Direct updates and forged contexts exposed through normal table paths fail. | Trigger exception rolls back the statement/transaction. |
| 872-1147 | Event dispatcher | Derive actor/role/source/key/metadata/snapshot, validate current state, insert idempotently, and reject identity/source conflicts. | RFQ, Message, Quote, Decision, auth/profile state | `rfq_events` | Exact event vocabulary; event trigger; trusted context | One authoritative event per defined key/source. | Late failure rolls back lifecycle caller. Existing first event remains authoritative on an identity-equivalent retry. |
| 1149-1163 | Legacy event helper | Replace old generic helper with an always-failing compatibility stub. | None | Function | Legacy signature must exist | Existing internal references fail closed instead of accepting caller actor/event input. | Always raises. No external EXECUTE. |
| 1164-1270 | Event/Message triggers | Permit only trusted event inserts; derive lifecycle and Manufacturer Message events; derive Message sender identity/role. | RFQ, auth/profile state, OLD/NEW | NEW Message/Event; event via dispatcher | Dispatcher and context helpers exist | Browser-supplied sender identity is overwritten; direct Message/Event writes are denied by grants later. | Any trigger/event error rolls back Message or lifecycle mutation. |
| 1272-1510 | Buyer RFQ RPCs | Create, update, submit, cancel, and delete Buyer-owned RFQs with locks, snapshots, state-conditional writes, and trusted events. | Products, Manufacturers, RFQs, auth/profile | RFQs, Events | Snapshot builder and triggers exist | Stable RFQ UUID through draft submission; no browser table mutation. | Authorization/state conflict raises and rolls back. |
| 1514-1579 | Message/open RPCs | Send participant Message with derived identity; Manufacturer-only legacy RFQ open and transition. | RFQ, auth/profile | Messages, RFQ, Events | Message/event triggers and RFQ context | Atomic Message plus Manufacturer reply event; no Manufacturer access to Buyer drafts. | Failure rolls back all writes. |
| 1581-1670 | Quote trigger/lineage validator | Freeze protected Quote fields, restrict trusted status changes, and recursively reject self/cross/cyclic lineage. | Quotes, OLD/NEW | NEW Quote or exception | Quote schema/lineage column exists | Direct lifecycle mutation is rejected; trusted lineage terminates using a visited path/cycle flag. | Raises on mismatch/cycle; transaction rolls back. |
| 1672-1818 | Quote draft/revision RPCs | Lock RFQ/source, create database-derived version/lineage, copy items, and return a draft. | RFQ, Quote, Items, auth/profile | RFQ, Quote, Items | Parent RFQ is non-draft and role is assigned Manufacturer | One draft per RFQ; one child per source; revision source remains historical until submit. | Unique/state/authorization conflicts roll back. |
| 1820-1865 | Quote draft deletion RPC | Lock parent then draft; require non-draft parent and assigned Manufacturer; state-conditionally delete. | RFQ, Quote | Quote and cascading Items | Parent and Quote match | Cannot mutate a hidden Quote under Buyer draft. | Missing/conflict raises; no partial delete. |
| 1867-1972 | Quote submission RPC | Lock RFQ, draft, then source; validate one line item; recalculate; supersede source if revision; submit draft; mark RFQ quoted; emit event. | RFQ, Quote, Items, auth/profile | Quote(s), RFQ, Event | Initial path is `manufacturer_review`; revision path is `revision_requested` with source lineage | Exactly one current submitted Quote and one source-bound `quote_created` event. | Conditional update or event failure rolls back every state change. |
| 1974-2027 | Buyer Quote-open RPC | Lock RFQ then current submitted Quote, move quoted RFQ to buyer review once, and emit Quote-version-aware event. | RFQ, Quote, auth/profile | RFQ, Event | Buyer owns RFQ; exactly one current submitted Quote | Repeat opens deduplicate per Quote/actor without RFQ-level bypass. | Unauthorized/stale calls raise. |
| 2029-2132 | Buyer decision helper | Lock RFQ then Quote; create decision; update Quote and RFQ; create decision and terminal events. | RFQ, Quote, Decision, auth/profile | Decision, Quote, RFQ, Events | Current submitted Quote in quoted/buyer-review RFQ | Atomic accept/reject/revision-request with immutable history. | Any conflict/event error rolls back all changes. Internal only. |
| 2134-2174 | Decision wrappers | Expose three narrow Buyer RPCs without caller-controlled decision vocabulary. | Decision helper | Through helper | Internal helper exists | Authenticated Buyer calls only named action. | Helper exceptions propagate. |
| 2176-2288 | RLS policies | Replace broad mutation policies with select policies and narrow Manufacturer draft/item policies. | Access helpers, auth/profile, RFQ/Quote state | Policies | Helpers exist before policy creation | Buyer/Manufacturer/Admin reads are scoped; Admin/RFQ/Message/Event/Decision mutation has no policy path. | Policy DDL failure rolls back old-policy drops. |
| 2290-2302 | Table privileges | Revoke all browser grants, then grant only required authenticated reads and Manufacturer draft Quote/item writes. | Role catalogs | ACLs | Roles/tables exist | RLS plus grants are both required; anon has none. | Failure rolls back ACL changes. |
| 2304-2392 | Function ownership/search path | Set exact signatures to owner `postgres` and fixed `public, pg_temp` search path. | Functions/roles | Function metadata | Exact signatures preflighted | Definer functions resolve reviewed schema first and cannot be hijacked via caller path. | Missing/ambiguous signature fails transaction. |
| 2394-2458 | Function ACLs | Revoke exact internal/helper/RPC signatures from PUBLIC, anon, authenticated, service role; regrant only intended authenticated helpers/RPCs. | Functions/roles | Function ACLs | Exact signatures | No stale broad execute on reviewed signatures; dispatcher/internal helpers are not PostgREST-callable. | ACL failure rolls back. |
| 2460-2471 | Trigger enablement | Explicitly enable only the 12 approved RFQ/Quote triggers. | Trigger catalog | Trigger enabled state | Exact fingerprints preflighted | All scoped triggers become origin-enabled. | No `ALL`, `USER`, disable, or replication-role operation exists. |
| 2473-2665 | Postflight | Verify 12 trigger states, RLS/owner, anon/table ACLs, direct mutation denial, internal/RPC EXECUTE matrix, and fixed search paths. | Catalogs/ACLs | None | All preceding DDL succeeded | Commit is permitted only when authority matches review. | Any mismatch aborts and rolls back the entire migration. |
| 2667-2672 | Comments | Document lineage, internal dispatcher, and derived Message identity. | Schema objects | Comments | Objects exist | Catalog documentation. | Comment failure rolls back. |
| 2674 | Transaction | Commit. | Transaction state | Durable migration | All postflight checks passed | Migration becomes durable only here. | Before this point, abort/rollback contains all changes. |

## Dependency And Syntax Review

- Columns precede every function, constraint, index, and policy that references them.
- Access/trigger functions precede replacement policies and explicit trigger enablement.
- Exact signatures are used for every `ALTER FUNCTION`, `GRANT`, and `REVOKE`; overload drift is rejected for browser RPC names.
- `CREATE OR REPLACE` does not change any existing return type. New functions have unoccupied names/signatures by preflight.
- Trigger functions use only columns present in migrations 0011-0013 or added before their definitions.
- Partial-index predicates use actual statuses: `draft`, `submitted`, `revision_requested`, and terminal RFQ event values.
- SECURITY DEFINER functions end with `search_path = public, pg_temp`, and referenced application objects are schema-qualified.
- No `DROP ... CASCADE`, data backfill, history fabrication, `session_replication_role`, broad trigger enablement, or remote command exists.

## Preflight Classification

| Assertion group | Classification after review | Reason |
| --- | --- | --- |
| Required tables | Sufficient | Exact schema-qualified relations are required. |
| Columns/types/nullability | Sufficient after correction | Expanded from partial name checks to every material column with typmods/nullability. |
| New-column absence | Sufficient | Detects partial/replayed 0025 state. |
| Table owner/RLS/schema CREATE | Sufficient after correction | Rejects RLS-off, FORCE-RLS, wrong owner, and browser object creation. |
| Function signatures/ownership | Sufficient after correction | Exact signatures plus incompatible RPC overload rejection. PostgreSQL itself rejects return-type replacement drift. |
| Trigger state/shape | Sufficient after correction | Allows valid `O` or incident `D`, but verifies table/function/timing/events/args/WHEN/return type. |
| Policy baseline | Partially sufficient but safe | Table/command/role and required semantic tokens are checked; PostgreSQL normalization prevents a portable exact-text hash. Policies are unconditionally recreated before commit. |
| Status/event constraints | Sufficient after correction | Exact extracted vocabularies must match. |
| Existing partial indexes | Sufficient after correction | Table, uniqueness, key, and exact predicate are required. |
| Existing data conflicts | Sufficient for new DDL | Detects duplicate current/draft/terminal rows and participant linkage drift; new provenance columns start NULL. |
| Historical event backfill | Unnecessary and unsafe | No reliable source exists; migration intentionally preserves legacy NULL provenance. |

## Rollback And Containment

Before commit, any exception rolls back all migration changes. After a successful future apply, there is no automatic down migration: containment requires stopping RFQ/Quote writes and shipping a reviewed forward migration or restoring a verified backup. Disabling triggers or revoking RPCs is not performed automatically and would require separate authorization. Historical events and Quote lineage must never be fabricated during rollback.
