# Migration 0025 Independent Review

## Executive Verdict

**B. CONDITIONAL GO — OWNER DECISIONS REQUIRED**

The corrected migration is suitable to advance to a separately authorized disposable-database execution review. It is not authorized for Staging execution by this verdict. The main SQL authority defects found in review were corrected in migration 0025 itself. A Buyer-Message audit-vocabulary decision and real PostgreSQL behavior/concurrency execution remain prerequisites before any Staging authorization.

Migration 0025 was reviewed but NOT applied.

Migration 0025 has NOT been applied to Staging.

Migration 0025 has NOT been applied to Production.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

The 17 disabled non-RFQ triggers remain untouched.

PR #29 must remain Draft.

## Review Identity

- Starting reviewed commit: `8def0dd1a70bd7568d29965f233bd79ae5a2d4b7`
- Migration: `supabase/migrations/0025_restore_rfq_quote_authority.sql`
- Checksum before review: `ba95071845caa5ccbd60cbb924a788b94f40a1cf35ff75dd66d1e21e567d1bfa`
- Checksum after review: `6634da2d32bb69ec46387181cd1032a94a803a45946352992c4c4752c8ca225a`
- Reviewed migration line count: `2674`
- Detailed ordered block map: [MIGRATION_0025_SQL_WALKTHROUGH.md](MIGRATION_0025_SQL_WALKTHROUGH.md)

## Findings

| Severity | Finding | Impact | Correction/status |
| --- | --- | --- | --- |
| Blocker | Preflight accepted RFQ/Quote tables with RLS disabled, FORCE RLS changed, or unexpected ownership. | Migration could commit into a database where participant isolation was not enforceable. | Fixed: preflight and postflight require all six tables to be PostgreSQL-owned, RLS enabled, FORCE RLS disabled. |
| High | Column preflight covered only a subset and did not bind exact typmods/nullability. | Same-name drift could make function bodies unsafe or fail after partial DDL. | Fixed: comprehensive catalog fingerprint for every material column. |
| High | Same-name triggers were not fully fingerprinted. | Wrong timing/event/function binding could be enabled by 0025. | Fixed: exact table, function schema/name, `tgtype`, zero args, no `WHEN`, trigger return type, and allowed initial state. |
| High | Baseline policy checks relied mainly on names. | Same-name wrong-table/command/role policy drift could go unnoticed. | Fixed: table/command/permissive/role binding and semantic-token fingerprints; policies are recreated in-transaction. |
| High | Status/event checks sampled tokens instead of requiring exact vocabularies. | Extra or missing lifecycle states could undermine trigger/RPC assumptions. | Fixed: exact extracted, sorted RFQ/Quote/event arrays. |
| High | Current Quote indexes were checked by name only. | A non-unique or wrong-predicate index could allow multiple current versions. | Fixed: require table, unique flag, RFQ key, and exact `draft`/`submitted` predicate. |
| High | Same-name RPC overloads could retain an insecure external grant. | PostgREST could expose an unexpected overload after migration. | Fixed: incompatible overload rejection for all participant RPC names; exact signatures in ACL DDL. |
| High | Quote Item RLS and draft deletion trusted Quote ownership/status but did not require the parent RFQ to be non-draft. | Drifted legacy data could expose a child mutation path beneath a private Buyer draft. | Fixed: parent-aware `can_manage_rfq_quote_draft`, parent lock/check in deletion, preflight data rejection, and regression assertions. |
| Medium | New event provenance had per-column checks but no all-null/all-complete coupling. | Malformed partial provenance could weaken audit interpretation. | Fixed: legacy rows must have all four NULL; new rows must have all four populated. |
| Medium | Final definer search paths were `public` only. | Temporary-object resolution was not explicitly pinned after `public`. | Fixed: every reviewed function ends with `search_path = public, pg_temp`; browser roles must not have CREATE on `public`. |
| Medium | Event retry comparison validates identity/source but does not compare the regenerated metadata snapshot byte-for-byte. | A retry preserves the first authoritative event rather than proving exact snapshot equality. | Documented. This is safe because metadata is database-derived; no caller metadata survives allowlisting. |
| Medium | Buyer Messages intentionally create no timeline event; only Manufacturer Messages produce `manufacturer_replied`. | The review requirement “one Message creates one Message event” is not met for Buyer Messages. | Owner decision required. Adding a new event type changes the approved vocabulary and is not done silently in this review. |
| Medium | Rollback SQL is catalog/definition-focused and was not run against a disposable database. | Static checks cannot prove JWT, trigger, PostgREST, or concurrent behavior. | Expanded from 40 to 54 assertions; real execution remains a pre-Staging prerequisite. |
| Low | Manufacturer open invokes the dispatcher both through the lifecycle trigger and explicitly. | Duplicate work occurs, but not a duplicate row. | No data defect: source/event-key uniqueness makes the second call idempotent. Consider simplifying in a future migration. |

No finding broadened scope to the 17 non-RFQ triggers, Sprint 3B, deployment, or remote execution.

## Corrections Made

1. Added comprehensive fail-closed schema, owner, RLS, trigger, policy, function-overload, lifecycle-vocabulary, index, and participant-linkage preflight checks.
2. Added event provenance completeness coupling.
3. Made Quote draft/item authority parent-RFQ-aware and state-conditional.
4. Locked the RFQ before Quote draft deletion and rejected Buyer-draft parents.
5. Hardened reviewed function search paths to `public, pg_temp`.
6. Completed function/table ACL postflight checks for anon, authenticated, service role, and PUBLIC.
7. Expanded rollback/static authority assertions from 40 to 54.
8. Added infrastructure regressions for these authority boundaries.

## Quote Lineage Review

`supersedes_quote_id` is a nullable `uuid`. Existing rows remain NULL. A composite FK `(rfq_id, supersedes_quote_id)` references `(rfq_id, id)`, so a source must be in the same RFQ. `ON DELETE RESTRICT` preserves history. A check rejects self-reference, a partial index supports lookup, and a partial unique index allows one direct child per source. Trusted writes freeze the column after insert.

| Graph (source -> revision) | Result | Enforcer |
| --- | --- | --- |
| A -> B | Allowed | Same-RFQ FK and lineage validator |
| A -> B -> C | Allowed | Each child has one source; recursive validator terminates |
| A -> B and A -> C | Rejected/serialized to existing B | RFQ/source locks, existing-draft return, and one-child partial unique index |
| A -> A | Rejected | Self-reference check and validator |
| A(RFQ1) -> B(RFQ2) | Rejected | Composite same-RFQ FK and validator |
| A -> B -> A | Rejected | Recursive cycle detection |
| A -> B -> C -> A | Rejected | Recursive cycle detection |

The recursive CTE tracks a UUID path and a `cyclic` flag and recurses only while `not cyclic`; it cannot recurse forever. Trusted creation locks RFQ then source. Submission locks RFQ, child, then source. The one-child and one-draft unique indexes provide a final concurrent-write backstop.

## Status Transition Matrix

### RFQ

| From | Allowed destination through reviewed flow | Authority |
| --- | --- | --- |
| `draft` | `draft`, `submitted`, `cancelled` | Buyer draft/submit/cancel RPC |
| `submitted` | `manufacturer_review`, `cancelled`, `expired` | Assigned Manufacturer open/create Quote; Buyer cancel; future trusted expiry only |
| `manufacturer_review` | `quoted`, `expired` | Assigned Manufacturer Quote submit; future trusted expiry only |
| `quoted` | `buyer_review`, `accepted`, `declined`, `revision_requested`, `expired` | Buyer Quote open/decision; future trusted expiry only |
| `buyer_review` | `accepted`, `declined`, `revision_requested`, `expired` | Buyer decision; future trusted expiry only |
| `revision_requested` | `quoted`, `expired` | Assigned Manufacturer revision submit; future trusted expiry only |
| `accepted`, `declined`, `cancelled`, `expired` | No public transition | Terminal |

The generic transition helper recognizes same-state transitions, but trusted context checks and revoked direct RFQ updates prevent arbitrary same-state edits.

### Quote

| From | Allowed destination | Meaning/currentness |
| --- | --- | --- |
| `draft` | `submitted` or delete | Not Buyer-visible; one draft per RFQ |
| `submitted` | `accepted`, `rejected`, `revision_requested` | Sole current submitted Quote per RFQ |
| `revision_requested` | `superseded` | Remains current history while Manufacturer prepares child draft; superseded atomically on child submit |
| `accepted`, `rejected`, `superseded`, `expired`, `withdrawn` | None in 0025 | Historical/terminal |

`rfq_quotes_one_current_submitted_per_rfq_idx` means “current actionable submitted version,” not every historical decision state. During revision preparation no `submitted` Quote exists: the source is `revision_requested` and the child is `draft`. Child submission atomically supersedes source and becomes the sole `submitted` Quote.

## Atomic Quote Submission And Concurrency

Submission derives `auth.uid()` and the database profile role, locks RFQ first, locks the draft, and then locks its source when present. It validates assigned Manufacturer ownership, same RFQ/Manufacturer, draft/source states, acyclic lineage, and at least one item. It recalculates subtotal, state-conditionally supersedes source, state-conditionally submits child, state-conditionally changes RFQ to `quoted`, and emits a source-bound event in one transaction.

| Scenario | Lock/outcome | Client result | Audit result |
| --- | --- | --- | --- |
| Same draft submitted twice / two tabs | RFQ then draft serialize; first commits, second sees non-draft | First succeeds; second gets lifecycle error | One `quote_created` event |
| Two revisions for one source | RFQ/source serialize; second returns same draft or hits unique invariant | One logical child | No event until submit |
| Source changes after validation | Source row lock prevents concurrent state update; conditional update is final check | Conflicting transaction waits then fails | No partial event |
| Buyer decides while revision is submitted | Both lock RFQ first | One wins; loser fails state check | Only winner’s transaction events persist |
| Retry after timeout after server commit | Row is no longer draft | Retry returns lifecycle error, not idempotent success | Event uniqueness prevents duplicate |
| Event/Message trigger fails late | PostgreSQL transaction aborts | Error | Lifecycle/Message and event all roll back |

Deadlock risk is bounded by the consistent RFQ-before-Quote lock order in public lifecycle RPCs. A future database test must still exercise real concurrent sessions.

## `record_rfq_event(uuid,text,jsonb)` Review

- Owner: `postgres`.
- Mode: `SECURITY DEFINER`.
- Final search path: `public, pg_temp`.
- External privileges: no PUBLIC, anon, authenticated, or explicit service-role EXECUTE.
- Intended callers: reviewed trigger functions and SECURITY DEFINER lifecycle RPCs executing as the common owner.
- PostgREST: not callable because exposed roles have no EXECUTE.
- Actor: `auth.uid()`; role: `current_profile_role()`; neither is accepted as an argument.
- Source: derived and loaded from RFQ/Message/Quote/Decision rows after allowlisted input IDs.
- Metadata: each event branch permits only its documented key; the function constructs safe metadata and a server snapshot.
- Timestamp: insert trigger sets `created_at = now()`.
- Idempotency: `event_key`, `(event_type, source_type, source_id)`, and terminal indexes; identity/source mismatches on an existing key raise.

Direct answers:

- anon cannot invoke it.
- authenticated cannot invoke it, including an authenticated Admin.
- service role has no explicit EXECUTE and cannot invoke it as the `service_role` database role merely because that role has `BYPASSRLS`; RLS bypass does not bypass function ACLs.
- A true superuser or function owner can bypass ordinary ACL checks. That is database-operator authority, not the Supabase service-role JWT.
- Another `postgres`-owned SECURITY DEFINER function can invoke it after external EXECUTE is revoked because its effective role is the owner.
- Public RPCs do not accept event type, actor, source role, or arbitrary metadata; a malicious browser caller cannot select those values.
- The dispatcher cannot create a reviewed event unless authoritative rows and current states match its branch rules.

## Function Authority Table

All listed functions are in schema `public`, owner `postgres`, and end with `search_path=public, pg_temp`. `N` means no direct EXECUTE for that role; `Y` means intended direct authenticated execution. Trigger invocation does not require the invoking end user to have EXECUTE on the trigger function.

| Exact signature | Mode | PUBLIC / anon / auth / service | Intended caller / PostgREST | Writes |
| --- | --- | --- | --- | --- |
| `rfq_write_context()` | Invoker | N/N/N/N | Internal trigger / no | None |
| `is_trusted_rfq_message_write()` | Invoker | N/N/N/N | Internal trigger / no | None |
| `is_trusted_rfq_event_write()` | Invoker | N/N/N/N | Internal trigger / no | None |
| `assert_rfq_values(numeric,text,text,text,text,date,text)` | Invoker | N/N/N/N | Internal RPC / no | None |
| `can_access_rfq(uuid)` | Definer | N/N/Y/N | RLS/helper / boolean RPC | None |
| `can_access_rfq_quote(uuid)` | Definer | N/N/Y/N | RLS/helper / boolean RPC | None |
| `can_manage_rfq_quote_draft(uuid)` | Definer | N/N/Y/N | RLS/helper / boolean RPC | None |
| `protect_rfq_write()` | Definer trigger | N/N/N/N | RFQ trigger / no | NEW normalization only |
| `record_rfq_event(uuid,text,jsonb)` | Definer | N/N/N/N | Trusted functions / no | Events |
| `insert_trusted_rfq_event(uuid,text,uuid,jsonb)` | Definer | N/N/N/N | Disabled legacy reference / no | Always raises |
| `protect_rfq_event_insert()` | Definer trigger | N/N/N/N | Event trigger / no | NEW timestamp |
| `record_rfq_lifecycle_event()` | Definer trigger | N/N/N/N | RFQ trigger / no | Events via dispatcher |
| `record_rfq_message_event()` | Definer trigger | N/N/N/N | Message trigger / no | Events via dispatcher |
| `protect_rfq_message_insert()` | Definer trigger | N/N/N/N | Message trigger / no | NEW identity/normalization |
| `create_rfq_draft(uuid,numeric,text,text,text,text,date,text)` | Definer | N/N/Y/N | Buyer / yes | RFQ + event |
| `update_rfq_draft(uuid,numeric,text,text,text,text,date,text)` | Definer | N/N/Y/N | Buyer / yes | RFQ |
| `submit_rfq(uuid,numeric,text,text,text,text,date,text)` | Definer | N/N/Y/N | Buyer / yes | RFQ + event |
| `cancel_rfq(uuid)` | Definer | N/N/Y/N | Buyer / yes | RFQ + event |
| `delete_rfq_draft(uuid)` | Definer | N/N/Y/N | Buyer / yes | RFQ cascade |
| `send_rfq_message(uuid,text,text)` | Definer | N/N/Y/N | Participant / yes | Message (+ Manufacturer event) |
| `record_rfq_opened(uuid)` | Definer | N/N/Y/N | Assigned Manufacturer / yes | RFQ + event |
| `protect_rfq_quote_write()` | Definer trigger | N/N/N/N | Quote trigger / no | NEW validation only |
| `assert_rfq_quote_lineage(uuid,uuid,uuid)` | Definer | N/N/N/N | Quote RPC / no | None |
| `create_rfq_quote_draft(uuid)` | Definer | N/N/Y/N | Assigned Manufacturer / yes | RFQ + Quote + event |
| `create_rfq_quote_revision(uuid)` | Definer | N/N/Y/N | Assigned Manufacturer / yes | Quote + copied items |
| `delete_rfq_quote_draft(uuid)` | Definer | N/N/Y/N | Assigned Manufacturer / yes | Quote cascade |
| `submit_rfq_quote(uuid)` | Definer | N/N/Y/N | Assigned Manufacturer / yes | Quotes + RFQ + event |
| `record_rfq_quote_opened(uuid)` | Definer | N/N/Y/N | Buyer / yes | RFQ + event |
| `decide_rfq_quote(uuid,text,text)` | Definer | N/N/N/N | Narrow wrappers / no | Decision + Quote + RFQ + events |
| `accept_rfq_quote(uuid,text)` | Definer | N/N/Y/N | Buyer / yes | Through decision helper |
| `reject_rfq_quote(uuid,text)` | Definer | N/N/Y/N | Buyer / yes | Through decision helper |
| `request_rfq_quote_revision(uuid,text)` | Definer | N/N/Y/N | Buyer / yes | Through decision helper |
| `is_trusted_quote_write()` | Invoker | N/N/N/N | Existing triggers/RPCs / no | None |
| `is_trusted_quote_decision_write()` | Invoker | N/N/N/N | Decision trigger/RPC / no | None |
| `is_trusted_rfq_opened_write()` | Invoker | N/N/N/N | Retained compatibility helper / no | None |
| `recalculate_rfq_quote_subtotal(uuid)` | Definer | N/N/N/N | Item trigger/Quote RPC / no | Quote subtotal |
| `protect_rfq_quote_item_write()` | Definer trigger | N/N/N/N | Item trigger / no | Validation only |
| `after_rfq_quote_item_change()` | Definer trigger | N/N/N/N | Item trigger / no | Quote subtotal via helper |
| `protect_rfq_quote_decision_write()` | Definer trigger | N/N/N/N | Decision trigger / no | Validation only |
| `is_valid_rfq_transition(text,text)` | Invoker | N/N/N/N | RFQ trigger / no | None |
| `build_rfq_product_snapshot(uuid,uuid)` | Definer | N/N/N/N | Buyer RFQ RPC / no | None |
| `set_rfq_updated_at()` | Invoker trigger | N/N/N/N | RFQ trigger / no | NEW timestamp |
| `set_rfq_quote_updated_at()` | Invoker trigger | N/N/N/N | Quote trigger / no | NEW normalization/timestamp |
| `set_rfq_quote_item_updated_at()` | Invoker trigger | N/N/N/N | Item trigger / no | NEW normalization/timestamp |

No reviewed function combines SECURITY DEFINER with broad PUBLIC execution. The three access predicates combine SECURITY DEFINER with narrowly intended authenticated execution and return only booleans.

## RLS And Table Authority Matrix

`RPC` means no direct table mutation grant/policy is available and the trusted RPC is the only participant path. `Backend` denotes separately protected service/database operator authority, not browser authority; migration 0025 explicitly denies service role on participant RPCs but does not attempt to remove platform backend table privileges.

| Object/action | anon | Buyer owner | Assigned Manufacturer | Unrelated Manufacturer | Admin | Backend/service |
| --- | --- | --- | --- | --- | --- | --- |
| RFQs SELECT | Deny | Own, including draft | Assigned, non-draft | Deny | All | Privileged backend policy |
| RFQs I/U/D | Deny | RPC by owned lifecycle | Deny direct; open/Quote RPC transition | Deny | Deny | Operator authority out of participant API |
| Messages SELECT | Deny | Own RFQ | Assigned non-draft RFQ | Deny | All | Privileged backend policy |
| Messages INSERT | Deny | `send_rfq_message` | `send_rfq_message`, non-draft | Deny | Deny | Operator authority out of participant API |
| Messages UPDATE/DELETE | Deny | Deny | Deny | Deny | Deny | Operator authority out of participant API |
| Events SELECT | Deny | Own RFQ | Assigned non-draft RFQ | Deny | All | Privileged backend policy |
| Events I/U/D | Deny | Deny | Deny | Deny | Deny | Trusted internal functions/operator only |
| Quotes SELECT | Deny | Own non-draft Quote | Assigned Quote under non-draft RFQ | Deny | All | Privileged backend policy |
| Quotes UPDATE/DELETE | Deny | Deny | Own draft under non-draft RFQ only | Deny | Deny | Operator authority out of participant API |
| Quotes INSERT | Deny | Deny | RPC only | Deny | Deny | Trusted internal/operator only |
| Quote Items SELECT | Deny | Items of visible Quote | Items of assigned non-draft-RFQ Quote | Deny | All | Privileged backend policy |
| Quote Items I/U/D | Deny | Deny | Own draft Quote under non-draft RFQ | Deny | Deny | Operator authority out of participant API |
| Decisions SELECT | Deny | Own | Assigned non-draft RFQ | Deny | All | Privileged backend policy |
| Decisions I/U/D | Deny | Decision RPC wrappers only | Deny | Deny | Deny | Trusted internal/operator only |

RLS helpers are SECURITY DEFINER to avoid policy recursion, return only booleans, derive identity from `auth.uid()`, and explicitly exclude Manufacturer visibility beneath Buyer drafts.

## Trigger Matrix

| Table / trigger | Timing and events | Function | Args | Before -> after | Trusted-flow interaction / risk |
| --- | --- | --- | --- | --- | --- |
| RFQs / `protect_rfq_write` | BEFORE I/U | `protect_rfq_write()` | 0 | O or D -> O | Requires trusted context; freezes participants/snapshot. |
| RFQs / `record_rfq_lifecycle_event` | AFTER I/U | `record_rfq_lifecycle_event()` | 0 | O or D -> O | Emits draft/submitted/cancel/expiry/open events. Open RPC also dispatches; uniqueness avoids duplicate row. |
| RFQs / `set_rfqs_updated_at` | BEFORE U | `set_rfq_updated_at()` | 0 | O or D -> O | Database timestamp. |
| Messages / `protect_rfq_message_insert` | BEFORE I | `protect_rfq_message_insert()` | 0 | O or D -> O | Requires Message RPC context and derives sender. |
| Messages / `record_rfq_message_event` | AFTER I | `record_rfq_message_event()` | 0 | O or D -> O | Manufacturer Message event only. |
| Events / `protect_rfq_event_insert` | BEFORE I | `protect_rfq_event_insert()` | 0 | O or D -> O | Requires dispatcher context; validates complete provenance. |
| Quotes / `protect_rfq_quote_write` | BEFORE U | `protect_rfq_quote_write()` | 0 | O or D -> O | Freezes identity/version/lineage and trusted status writes. |
| Quotes / `set_rfq_quote_updated_at` | BEFORE U | `set_rfq_quote_updated_at()` | 0 | O or D -> O | Normalization/timestamp. |
| Quote Items / `protect_rfq_quote_item_write` | BEFORE I/U/D | `protect_rfq_quote_item_write()` | 0 | O or D -> O | Enforces assigned Manufacturer and draft Quote. |
| Quote Items / `after_rfq_quote_item_change` | AFTER I/U/D | `after_rfq_quote_item_change()` | 0 | O or D -> O | Recalculates subtotal; no recursion into items. |
| Quote Items / `set_rfq_quote_item_updated_at` | BEFORE U | `set_rfq_quote_item_updated_at()` | 0 | O or D -> O | Normalization/timestamp. |
| Decisions / `protect_rfq_quote_decision_write` | BEFORE I/U/D | `protect_rfq_quote_decision_write()` | 0 | O or D -> O | Only trusted decision helper may insert; history immutable. |

Only explicit `ALTER TABLE ... ENABLE TRIGGER <name>` statements are used. There is no `ENABLE TRIGGER ALL`, `ENABLE TRIGGER USER`, `DISABLE TRIGGER`, or `session_replication_role` operation.

## Event Uniqueness Matrix

The migration retains the actual 0013 event vocabulary. Review-request labels map as follows: “message_sent” is `manufacturer_replied`; “quote_submitted” is `quote_created`; “opened” is role-specific.

| Event | Source type / ID | Key | Repetition | Terminal / retry |
| --- | --- | --- | --- | --- |
| `draft_created` | RFQ / RFQ ID | `rfq:<rfq>:draft_created` | Once per RFQ | Non-terminal; same identity/source no-op |
| `submitted` | RFQ / RFQ ID | `rfq:<rfq>:submitted` | Once per RFQ | Non-terminal; no-op retry |
| `cancelled` | RFQ / RFQ ID | `rfq:<rfq>:cancelled` | Once per RFQ | Terminal index also protects |
| `expired` | RFQ / RFQ ID | `rfq:<rfq>:expired` | Once per RFQ | Terminal; no public expiry mutation path in 0025 |
| `manufacturer_opened` | RFQ / RFQ ID | includes actor | Once for assigned actor/RFQ | Non-terminal; duplicate trigger/RPC call no-op |
| `manufacturer_replied` | Message / Message ID | `message:<id>:manufacturer_replied` | Every distinct Manufacturer Message | One per Message; Buyer Message has no event |
| `quote_created` | Quote / Quote ID | `quote:<id>:submitted` | Every submitted Quote version | One per version |
| `buyer_opened` | Quote / Quote ID | includes Buyer actor | Once per Buyer/Quote version | Revision receives separate event |
| `quote_accepted` | Decision / Decision ID | decision/event | Once per decision | Paired with terminal `accepted` |
| `quote_rejected` | Decision / Decision ID | decision/event | Once per decision | Paired with terminal `declined` |
| `quote_revision_requested` | Decision / Decision ID | decision/event | Once per decision | New revision can later create new Quote events |
| `accepted` | Decision / Decision ID | `rfq:<rfq>:accepted` | Once per RFQ | Terminal partial unique index |
| `declined` | Decision / Decision ID | `rfq:<rfq>:declined` | Once per RFQ | Terminal partial unique index |

Legacy rows retain all provenance fields NULL and therefore do not collide with source-aware partial indexes. No backfill is required or safe. New rows require all provenance fields together, preventing NULL-based partial-provenance bypass.

## Message Review

`send_rfq_message(uuid,text,text)` derives `auth.uid()` and profile role, locks/loads the RFQ, allows only its Buyer or assigned Manufacturer, rejects Manufacturer access while RFQ is draft, rejects Admin/unrelated callers, trims content, and enforces 1-4000 characters. The BEFORE trigger overwrites sender ID/role from the database context. Direct table INSERT is revoked. The AFTER trigger creates one source-bound event for a Manufacturer Message in the same transaction; an event failure rolls back the Message.

Buyer Messages are intentionally stored without a new event because the approved event constraint has no Buyer Message event type. Whether Sprint 3A recovery must add a symmetric `message_sent`/`buyer_replied` event is an Owner decision before execution.

## Frontend/RPC Compatibility

`src/lib/rfq.ts` calls exact public RPC names and named arguments. RFQ create/update/submit use the same eight-argument SQL signatures, preserving saved RFQ UUID on submit. Message calls send only RFQ ID, message, and attachment path; no actor/sender role or event write is supplied. Quote create/revision/submit/delete/open and decision wrappers use UUID/text signatures returned by 0025. No frontend direct RFQ, Message, Event, or Decision insert remains.

Existing tests cover stable saved-draft submission, no duplicate RFQ creation, Manufacturer draft filtering, subtotal calculation, metadata preservation, date-only rendering, authoritative post-submit refresh, and Admin read-only behavior. Database execution is still required to prove the SQL/frontend contract against PostgreSQL and PostgREST.

## Rollback-Only Test Assessment

The file now contains 54 assertions. They are catalog/static checks intended to run after 0001-0025 in a disposable database and always end in `ROLLBACK`.

| Coverage class | Present | Limitation |
| --- | --- | --- |
| Migrated schema/catalog | Yes | Requires a migrated disposable database to execute. |
| Grants/RLS definitions | Yes | Catalog checks do not execute policies as JWT roles. |
| Function/trigger definitions | Yes | Text/catalog checks can miss runtime PL/pgSQL branches. |
| Authenticated JWT behavior | No | Needs Buyer/Manufacturer/Admin sessions. |
| Trigger execution | No | Needs fixture lifecycle writes. |
| PostgREST exposure | No | Needs local Supabase API or equivalent. |
| Concurrency | No | Needs at least two database sessions. |

No execution success is claimed. Docker was installed but its daemon was unavailable, and `psql` was absent. No remote database was used as a substitute.

## Local Verification Results

- `npm ci`: passed; 82 packages installed/audited.
- Frontend tests: `234/234` passed.
- Infrastructure/static tests: `86/86` passed, including `11/11` migration authority tests.
- Rollback authority definition: `54` assertions; not database-executed.
- TypeScript and Vite production-shaped CI build: passed; 191 modules transformed.
- Production artifact: passed; 64 files, 817,469 bytes, 52 JavaScript files, one CSS file, zero source maps.
- Bundle budgets: passed; no duplicate hash groups or unreferenced assets.
- Legal structure and Beta documentation gates: passed.
- Dependency audit: zero vulnerabilities after a lockfile-only PostCSS remediation (`8.5.16` to `8.5.23`, with required Nano ID patch).
- Tracked secret scan: 380 tracked files, zero findings.
- Migration inventory: exactly 0001-0025; 0001-0024 unchanged; no 0026.

## PR Metadata Result

The review attempted one PR #29 description update. GitHub returned `403 Resource not accessible by integration`; no authentication change or retry was attempted. [PR_29_OWNER_UPDATE.md](PR_29_OWNER_UPDATE.md) contains the ready-to-paste replacement section. PR #29 remains Draft.

## Remaining Owner Decisions

1. Decide whether Buyer Messages require a new audited event type before 0025 execution. If yes, update the event constraint, dispatcher, trigger, uniqueness tests, and frontend timeline contract in 0025 before authorization.
2. Approve or reject the deliberate choice that a post-commit Quote-submit retry returns a lifecycle conflict rather than the already-submitted Quote.
3. Confirm service/backend direct table authority remains an operator concern outside participant PostgREST paths; participant RPC EXECUTE is explicitly denied to service role.
4. Authorize a disposable clean-chain execution only after reviewing this correction set.

## Staging Pre-Execution Prerequisites

1. Independent disposable PostgreSQL/Supabase clean-chain migration 0001-0025 succeeds.
2. All 54 rollback assertions execute and pass.
3. Authenticated Buyer, assigned Manufacturer, unrelated Manufacturer, Admin, anon, and service-role policy/ACL tests pass.
4. Two-session tests cover duplicate submit, competing revisions, Buyer decision versus revision submit, and event uniqueness.
5. PostgREST confirms only intended overloads are exposed and no internal helper can be invoked.
6. Fresh read-only Staging fingerprints confirm the preflight’s exact table/function/policy/trigger/index/data assumptions.
7. Backup, maintenance window, containment owner, and rollback/forward-fix plan are approved.
8. The Buyer-Message event decision is closed.
9. Separate written authorization names migration 0025 and the approved Staging project.

## Go/No-Go Recommendation

**B. CONDITIONAL GO — OWNER DECISIONS REQUIRED**

This means “continue independent verification,” not “execute on Staging.” Migration execution remains prohibited until the prerequisites and Owner decisions above are complete and separately authorized.
