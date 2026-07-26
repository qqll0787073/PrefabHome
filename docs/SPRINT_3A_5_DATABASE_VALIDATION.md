# Sprint 3A.5 Disposable Database Validation

## Verdict

**B. CONDITIONAL GO — STAGING PREREQUISITES REMAIN**

Migration 0025 completed clean-chain, rollback, RLS, lifecycle, concurrency,
PostgREST, performance, restart, and repeatability validation on disposable local
databases. This verdict does not authorize Staging execution. A separately
authorized Staging checkpoint, drift recheck, execution window, and postflight are
still required. The 17 disabled non-RFQ triggers remain out of scope.

## Mandatory Execution Statements

Disposable local database execution was authorized.

Migration 0025 was executed only on disposable local databases.

Migration 0025 has NOT been applied to Staging.

Migration 0025 has NOT been applied to Production.

No Staging Supabase access occurred.

No Production Supabase access occurred.

Production Deployment Authorization is NOT GRANTED.

The 17 disabled non-RFQ triggers remain out of scope.

PR #29 must remain Draft.

## Environment And Isolation

Validation ran on July 26, 2026 in a temp-only native Windows PostgreSQL stack:

| Component | Version or state |
| --- | --- |
| Node.js | 24.17.0 |
| npm | 11.13.0 |
| PostgreSQL | 18.4, embedded native Windows x64 binary |
| PostgREST | 14.12, official Windows x64 release |
| Database listener | `127.0.0.1:55441` only |
| PostgREST listener | `127.0.0.1:55442` only, stopped after validation |
| Docker CLI | 29.5.3 |
| Docker Compose | 5.1.4 |
| Docker Desktop | Unavailable: local engine could not start |
| WSL | Unavailable and could not be enabled without host administrator elevation |
| `psql` | Not installed; migration execution used PostgreSQL protocol through `pg` 8.16.3 |
| Supabase CLI | Not used; the installed binary could not write telemetry config in the sandbox |

Before database execution, repository linkage and environment variables were
audited. The persistent repository link was not changed or used. Inherited
Supabase access and service-role variables were removed from child-process
environments. Every harness parses its endpoint and rejects non-loopback hosts
before connecting. No Supabase CLI link, status, project-list, push, reset, repair,
pull, or migration command ran. No remote database hostname was used.

The compatibility bootstrap models only the Supabase-managed surfaces required by
migrations 0001-0025: Supabase roles, `auth.users`, modern and legacy PostgREST JWT
claim settings for `auth.uid()` and `auth.role()`, Storage tables with RLS, and the
migration-history table. Participant evidence used real `authenticated`/`anon`
roles and JWT claim settings. PostgreSQL superuser access was used only for local
fixture setup, inventory, and failure-containment tests.

## Migration Integrity

- Migration inventory: exactly `0001` through `0025`.
- Migrations `0001` through `0024`: byte-for-byte equal to `auth-profiles`.
- Migration `0025_restore_rfq_quote_authority.sql`: the sole new migration.
- Migration `0026`: absent.
- Checksum before Sprint 3A.5: `6634da2d32bb69ec46387181cd1032a94a803a45946352992c4c4752c8ca225a`.
- Final checksum: `db870d008fd18c7e528d65def3c038d717e2d79f1f41f9a71eb295cd4fb73695`.

The checksum changed for two execution-demonstrated corrections. PostgreSQL
rejected four unparenthesized PL/pgSQL `CASE` comparisons with SQLSTATE `42601`,
so they were parenthesized and made null-safe. `submit_rfq_quote(uuid)` also gained
the required owner-bound idempotent retry path.

## Clean-Chain Execution

Two brand-new databases completed the final chain in repository order. The first
was followed by the complete authority, concurrency, API, and performance suite.
The second was created after a database process restart and followed by the
committed 54-assertion rollback suite.

Representative second-chain timings:

| Migration | ms | Result | Migration | ms | Result |
| --- | ---: | --- | --- | ---: | --- |
| 0001 | 96.12 | Passed | 0014 | 38.16 | Passed |
| 0002 | 9.24 | Passed | 0015 | 17.77 | Passed |
| 0003 | 4.28 | Passed | 0016 | 32.21 | Passed |
| 0004 | 1.49 | Passed | 0017 | 16.75 | Passed |
| 0005 | 1.22 | Passed | 0018 | 30.41 | Passed |
| 0006 | 15.15 | Passed | 0019 | 33.82 | Passed |
| 0007 | 19.20 | Passed | 0020 | 50.08 | Passed |
| 0008 | 26.94 | Passed | 0021 | 30.31 | Passed |
| 0009 | 3.39 | Passed | 0022 | 36.75 | Passed |
| 0010 | 15.91 | Passed | 0023 | 30.30 | Passed |
| 0011 | 34.04 | Passed | 0024 | 30.16 | Passed |
| 0012 | 34.10 | Passed | 0025 | 90.18 | Passed |
| 0013 | 17.53 | Passed | | | |

No missing dependency, ownership error, policy error, grant error, function-
signature error, or postflight failure remained.

## Failure Atomicity

A separate database received migrations 0001-0024. An in-memory copy of 0025 was
modified to call a nonexistent function immediately before `COMMIT`; the committed
file was never changed. The expected SQLSTATE was `42883`.

The pre/post schema, policy, grant, function, and trigger fingerprint remained
`df6b241719a16afc758b6f1c2c0eae03`; the lineage column was absent; no 0025 object
or provenance change remained; and the committed checksum was unchanged. The
atomicity database was then dropped.

## Schema Inventory

`rfqs`, `rfq_messages`, `rfq_events`, `rfq_quotes`, `rfq_quote_items`, and
`rfq_quote_decisions` are owned by `postgres`, have RLS enabled, and do not use
FORCE RLS, matching migration preflight requirements.

Specific lineage and provenance checks passed:

- `rfq_quotes.supersedes_quote_id` is nullable UUID lineage.
- `(rfq_id, supersedes_quote_id)` references `(rfq_id, id)` with `ON DELETE RESTRICT`.
- Self-reference, cross-RFQ lineage, a two-node cycle, referenced-source deletion,
  and submitted-lineage mutation were rejected by executable tests.
- Partial indexes enforce one revision per source and one current submitted Quote.
- Event actor role, source type, source ID, and event key are present.
- Source-event and terminal-lifecycle uniqueness indexes are present.
- Provenance is legacy-null or complete; newly trusted events are complete.

## Function And Grant Inventory

The inspected RFQ/Quote surface contains 44 reviewed function signatures. All
reviewed SECURITY DEFINER functions are owned by `postgres` and use
`search_path=public, pg_temp`.

Authenticated read helpers are `can_access_rfq`, `can_access_rfq_quote`, and
`can_manage_rfq_quote_draft`. Authenticated participant RPCs are:

- RFQ: `create_rfq_draft`, `update_rfq_draft`, `submit_rfq`, `cancel_rfq`,
  `delete_rfq_draft`
- Messages/opening: `send_rfq_message`, `record_rfq_opened`,
  `record_rfq_quote_opened`
- Quotes: `create_rfq_quote_draft`, `create_rfq_quote_revision`,
  `delete_rfq_quote_draft`, `submit_rfq_quote`
- Decisions: `accept_rfq_quote`, `reject_rfq_quote`,
  `request_rfq_quote_revision`

Internal-only functions include write-context helpers, validators, trigger
functions, event dispatch/insertion, lineage/decision dispatchers, subtotal
recalculation, snapshots, and timestamp helpers. They have no PUBLIC, `anon`,
`authenticated`, or explicit `service_role` EXECUTE. Participant RPCs have no
`anon` or explicit `service_role` EXECUTE. No insecure overload remained.

## Authority Matrix

| Caller | Verified result |
| --- | --- |
| Buyer A | Reads own RFQ; writes only through narrow RPCs; cannot spoof identity or create Events directly |
| Buyer B | Reads neither Buyer A draft nor submitted RFQ and cannot act on Buyer A data |
| Manufacturer A | Cannot read/message a Buyer draft; gains access after submission; manages only own Quotes/Messages |
| Manufacturer B | Reads no Manufacturer A RFQ/Quote and cannot send, submit, or retry against them |
| Admin A | Reads domain data; direct mutation is denied or matches no policy; participant RPCs reject Admin |
| Anonymous | Cannot read private tables and cannot invoke protected RPCs |
| Service role | Grant inventory only; no explicit participant/internal RPC grants and not used as RLS evidence |

Actual database privileges, RLS, and trusted RPC checks produced the denials;
frontend filtering was not treated as authorization evidence.

## RFQ And Message Lifecycle

- Draft creation derived Buyer, Product snapshot, timestamps, and one event.
- Draft update retained the UUID; submitting retained exactly one RFQ row.
- Manufacturer visibility began only after submission.
- Eligible draft deletion and draft/submitted cancellation passed.
- Repeated cancellation and invalid direct/draft operations failed.
- Four alternating participant Messages retained database-derived sender ID, role,
  and timestamp; unrelated Manufacturer, Admin, direct insert, and draft-state
  Manufacturer send failed.
- Per the owner decision, the current vocabulary remains: Buyer Messages do not
  create a new timeline event type; each Manufacturer Message creates exactly one
  source-aware `manufacturer_replied` event. Broader Buyer Message event vocabulary
  is deferred to Sprint 3B.

## Quote, Revision, And Retry

- Initial Quote draft creation was idempotent.
- Quote items drove authoritative subtotal recalculation (`250.00` in the focused test).
- Empty submission failed without an event.
- Initial submission produced one current Quote and one `quote_created` event.
- Buyer access began for the submitted Quote; unrelated Manufacturer access stayed empty.
- Two simultaneous revision creators returned one database-derived version-2 draft.
- Revision submission atomically superseded the source, submitted the revision,
  returned the RFQ to `quoted`, and emitted one event for the new version.
- Historical source Quotes remained readable and immutable.

For timeout recovery, `submit_rfq_quote(uuid)` locks RFQ and Quote, verifies current
Manufacturer ownership, and returns a non-draft Quote only when it has a database
submission timestamp and a trusted `quote_created` event whose RFQ, actor, source
type, and source ID match. The retry performs no write. Initial, revision, and
post-decision retries returned the authoritative Quote without duplicates. Foreign,
unsubmitted, and unverifiable Quotes stayed rejected.

## Two-Session Concurrency

| Race | Outcomes | Duration | Invariant |
| --- | --- | ---: | --- |
| Same Quote submitted twice | fulfilled / fulfilled | 109.97 ms | One Quote and one event |
| Two creators supersede one source | fulfilled / fulfilled | lifecycle run | One revision UUID |
| Buyer decision vs revision submit | fulfilled / rejected | 87.52 ms | One winner; at most one current Quote |
| Two Manufacturer Messages | fulfilled / fulfilled | lifecycle run | Two Messages and two source events |
| Cancellation vs Quote draft | fulfilled / rejected | 74.74 ms | Valid serialized lifecycle state |
| Cancellation vs Quote submission | rejected / fulfilled | 52.89 ms | Cancellation denied after review; RFQ quoted |

No deadlock, duplicate terminal event, double current Quote, or lineage corruption
occurred. Losing operations returned controlled errors.

## Trigger Result

Exactly these 12 triggers were enabled and resolved:

- `rfqs`: `protect_rfq_write`, `record_rfq_lifecycle_event`, `set_rfqs_updated_at`
- `rfq_messages`: `protect_rfq_message_insert`, `record_rfq_message_event`
- `rfq_events`: `protect_rfq_event_insert`
- `rfq_quotes`: `protect_rfq_quote_write`, `set_rfq_quote_updated_at`
- `rfq_quote_items`: `protect_rfq_quote_item_write`,
  `after_rfq_quote_item_change`, `set_rfq_quote_item_updated_at`
- `rfq_quote_decisions`: `protect_rfq_quote_decision_write`

Migration 0025 contains no operation targeting the 17 non-RFQ triggers. A clean
database does not reproduce their Staging-disabled state; static scope and atomicity
tests confirm 0025 changes only the approved RFQ/Quote trigger set.

## SQL, API, And Performance Results

- Committed rollback assertions: **54 passed, 0 failed, 0 skipped**.
- Core database integration: **107 passed**.
- Failure atomicity: **7 passed**.
- PostgREST/API: **19 passed**.
- Total executable database/API assertions: **187 passed**.

PostgREST confirmed actual argument names and object-shaped composite returns.
Buyer draft visibility, Manufacturer draft denial, participant execution, Admin
mutation denial, anonymous denial, sender derivation, Quote submission, retry, and
unrelated Manufacturer denial passed through local HTTP.

Trusted paths generated 100 RFQs, 1,000 Messages, 100 initial Quotes, and 50
revisions in 1,628.33 ms. Representative PostgreSQL execution times were 0.166 ms
for RFQ list, 0.029 ms for RFQ detail, 0.039 ms for Message timeline, and 0.029 ms
for Quote history. Detail and history used index scans. No superlinear event growth,
lineage blowup, severe lock contention, or obviously missing expected index appeared.

## Restart And Repeatability

After stopping and restarting PostgreSQL, the first final database retained all 25
migration records, 104 focused/performance RFQs, callable RPCs, roles, grants, and
schema. The 54/54 suite passed again. A second clean database then completed
0001-0025 independently.

## Defects And Corrections

| Severity | Finding | Correction |
| --- | --- | --- |
| Blocker | 0025 failed parsing at four inline `CASE` comparisons (`42601`) | Parenthesized them and used null-safe comparison; clean chains pass |
| Blocker | Retry after committed Quote submission threw because status was not `draft` | Added provenance- and ownership-bound idempotent return; SQL, API, and race tests pass |
| Harness | Inventory glob selected an unrelated PO function | Restricted inventory to 44 migration-reviewed functions |
| Harness | PostgreSQL 18 `inet::text` includes a mask | Used `host(inet_server_addr())` for loopback proof |

No unresolved local execution defect remains. Separately authorized Staging
checkpoint, drift inspection, and postflight are still prerequisites.

## Automated Verification And Secrets

- `npm ci`: passed; 95 packages installed from lockfile.
- Frontend tests: **234/234 passed**.
- Infrastructure/static tests: **92/92 passed**.
- Production build: passed; 191 modules transformed.
- Dependency audit at low severity: passed; zero vulnerabilities.
- Deterministic quality gate: passed.
- Production artifact: passed; 64 files, 817,469 bytes, 52 JavaScript files,
  one CSS file, zero source maps.
- Artifact SHA-256: `7295c537ede4988f2fdde9879a25ce0a20d08106119cfba7bbf99b8b968ebb48`.
- Tracked-secret scan: passed; 383 tracked files and zero findings.
- Beta documentation audit: passed; 13 required files and 25 migrations.

No local credential, JWT, database directory, dump, log, or binary is tracked. The
disposable JWT existed only in process memory. PostgREST was stopped after testing.

## Final Recommendation

Migration 0025 is executable and locally validated. It may proceed only to a new,
explicit owner decision about Staging migration authorization after review of the
runbook preconditions. This evidence is not authorization.
