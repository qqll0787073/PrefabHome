# Sprint 3A.2 Database Recovery Authorization Review

## Executive Conclusion

The RFQ/Quote recovery design is ready for owner and database-review approval, but execution is not ready. Staging has all 12 RFQ/Quote user triggers disabled, and a broader read-only catalog check found 29 disabled user triggers out of 48 in `public`. The trigger definitions and functions remain present, migration history remains `0001` through `0024`, and the RFQ/Quote data-impact counts were zero when inspected.

No tracked or historical repository mechanism was found that disables triggers. The exact disabling operation and actor are therefore unknown. Recovery must fail closed on exact object fingerprints, move RFQ mutation behind narrow trusted RPCs, retain and harden `record_rfq_event()`, establish source-aware event idempotency, repair revision lineage, and enable only the reviewed RFQ/Quote triggers in a separately authorized forward migration.

**Go/no-go:** GO for design review; **NO-GO for migration execution** until Migration 0025 is explicitly authorized, every precondition is recaptured, and the wider disabled-trigger estate has a release-level disposition.

Migration 0025 is NOT AUTHORIZED and was NOT created.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

PR #29 must remain Draft.

## Authorization And Baseline

| Item | Result |
| --- | --- |
| Repository branch | `production-sprint-3a` |
| Starting HEAD | `bf5e66dc32a18d31a95ff8c812b4cd04d12863c2` |
| Approved read-only project | Staging `bvzbkjpbnczquecwqvlm` |
| Production access | Prohibited; no production connection made |
| Local migrations | Exactly `0001`-`0024`; unchanged |
| Staging migrations | Exactly `0001`-`0024` |
| Schema writes | None |
| New migration | None |

## Confirmed Owner Decisions

1. RFQ mutations use narrow trusted RPCs, not generic browser table writes.
2. Admin Message access is read-only.
3. `record_rfq_event()` is retained.
4. The retained function is hardened and is not a generic authenticated event-injection interface.
5. Future Quote revisions use `supersedes_quote_id`.
6. Lifecycle-event uniqueness is scoped by source entity or generated event key.

## Trigger-Disablement Investigation

### Evidence Reviewed

| Evidence source | Result |
| --- | --- |
| Current tracked scripts and `package.json` | No trigger disable, replication mode, restore, or remote reset command |
| Supabase migrations and SQL tests | Ordinary schema/test SQL; no `DISABLE TRIGGER`, `session_replication_role`, or restore operation |
| Test setup/teardown and staging bootstrap | Dry-run/rollback and exact-ID cleanup design; remote reset explicitly prohibited |
| Current GitHub Actions | Build/test/audit only; no Supabase schema operation |
| Deleted PH-010C workflows in Git history | Isolated migration list, dry run, approved `db push`, rollback smoke, and read-only residue audit; no trigger disable/restore/reset/repair command |
| Git history text search | No historical `DISABLE TRIGGER`, `session_replication_role`, `pg_restore`, or trigger-suspension implementation |
| Local ignored review tooling | Read-only catalog queries; no trigger-disable operation |
| Staging trigger state | 48 `public` user triggers: 29 disabled, 19 enabled |
| Staging event triggers | Six platform event triggers enabled; no evidence of an audit/history trigger for prior ALTER operations |

### Scope Pattern

Disabled triggers span RFQ/Quote, Purchase Order, Contract, Signature Package, Invoice, Shipping Readiness, and Logistics Booking Request objects. Triggers remain enabled for other domains, including Product, Manufacturer, Payment Recording, Signature Delivery, and Logistics Arrangement objects. The mixed state is neither RFQ-only nor globally disabled.

`session_replication_role = replica` would suppress ordinary trigger execution only for that session; it does not persist `tgenabled = D`. Persistent `D` states require trigger-level DDL such as `ALTER TABLE ... DISABLE TRIGGER`, whether issued manually or by a restore/import tool. No evidence identifies which external mechanism, if any, performed that DDL.

### Cause Classification

| Candidate | Classification | Confidence and reason |
| --- | --- | --- |
| Repository-controlled script | No supporting evidence | High confidence after current-tree and Git-history search |
| Test fixture tooling | No supporting evidence | High confidence for tracked tooling; ignored external tools cannot be proven absent historically |
| Manual SQL operation | Possible | Technically consistent with persistent `D`; no actor or command evidence |
| Interrupted restore/import | Possible | Some restore modes can disable triggers; mixed state could reflect a partial operation, but no restore logs or commands were found |
| Staging setup drift | Confirmed state, not a causal mechanism | Catalog differs from migration-created enabled state |
| Specific external operation/actor | **Unknown** | No database DDL audit trail or external operational log was available |

**Root-cause conclusion:** unknown. It is confirmed that staging drift exists and highly likely that the persistent state was produced outside the tracked repository paths reviewed. It is not responsible to name a person, workflow, restore, or manual command without supporting logs.

## Retained `record_rfq_event()` Authority

### Interface Design

- Keep the `public.record_rfq_event` name and the legacy signature for compatibility discovery.
- Make the legacy `(uuid, text, jsonb)` signature fail closed and remove EXECUTE from `PUBLIC`, `anon`, `authenticated`, and, by default, `service_role`.
- Add a source-aware internal overload used only from owner-executed trusted functions.
- Add an ungranted `_record_rfq_event(...)` primitive only to isolate constraint-aware insertion and exact-retry handling.
- Keep both functions owned by `postgres`, `SECURITY DEFINER`, with `search_path = public`.
- Never expose either event-writing function as a generic PostgREST RPC.

PostgreSQL privilege behavior justifies the split: a trusted outer `SECURITY DEFINER` function executes as its owner and can call an ungranted inner function, while the original authenticated session cannot call that inner function directly. The outer function still sees `auth.uid()`, allowing participant identity to be derived rather than passed.

### Intended Callers

| Caller | Event use |
| --- | --- |
| Buyer RFQ create/submit/cancel RPCs | `draft_created`, `submitted`, `cancelled` |
| Manufacturer review/open RPC | `manufacturer_opened` and the matching trusted state transition |
| Message insert trigger reached through `post_rfq_message` | `manufacturer_replied`, keyed by Message ID |
| Quote submit/revision RPC | `quote_created`, keyed by Quote ID/version |
| Buyer Quote-open RPC | `buyer_opened`, keyed by Quote ID |
| Buyer decision RPCs | `quote_accepted`, `quote_rejected`, `quote_revision_requested`, keyed by Decision ID |
| RFQ lifecycle trigger or dedicated lifecycle RPC | `accepted`, `declined`, `expired` only for the matching state change |
| Browser, Admin UI, generic authenticated client | No direct event execution |
| `service_role` | No grant by default; a future audited operational RPC must be separately approved |

Trigger functions should call the retained source-aware dispatcher, not `_record_rfq_event()` directly. This keeps one event vocabulary, source matrix, actor derivation rule, and metadata allowlist. `_record_rfq_event()` remains a small insert/idempotency primitive.

### Validation Rules

- **Actor ID:** always `auth.uid()` for participant actions; never accepted as a parameter. A system actor is nullable and available only through a dedicated, audited system action.
- **Actor role:** derive from `profiles.role` and verify the RFQ relationship. Persist a derived role snapshot (`buyer`, `manufacturer`, `admin`, or `system`); Admin cannot impersonate a participant.
- **RFQ access:** lock and load the RFQ; require Buyer ownership or assigned Manufacturer ownership for the exact action. Generic `can_access_rfq()` alone is insufficient for mutation authority.
- **Current state:** validate the event against the old/new state and source row. Event insertion must occur in the same transaction after a state-conditional update succeeds.
- **Metadata:** construct from database rows. Allow only event-specific keys such as Quote ID/version, Decision ID, Message ID, prior/new status, and submission generation. Remove or reject all unknown keys.
- **Snapshots:** create the immutable Product/Manufacturer snapshot inside the RFQ create RPC. Event state/source snapshots are generated from locked database rows; callers cannot provide snapshots or timestamps.
- **Timestamps:** use database `now()`/defaults only.
- **Invalid events:** reject unknown vocabulary, mismatched source type, stale status, wrong participant, Admin impersonation, caller actor fields, and arbitrary metadata.
- **Atomicity:** lifecycle update, snapshot, decision/message/quote write, and event write commit or roll back together.

### Allowed Vocabulary

`draft_created`, `submitted`, `manufacturer_opened`, `manufacturer_replied`, `quote_created`, `buyer_opened`, `quote_accepted`, `quote_rejected`, `quote_revision_requested`, `accepted`, `declined`, `cancelled`, and `expired` remain the explicit vocabulary. Each event is legal only through its named trusted action and source/state matrix. Any other string is prohibited until a reviewed migration expands the constraint and dispatcher together.

## Event Uniqueness And Idempotency

A blanket unique constraint on `(rfq_id, event_type)` is rejected because Quote and Message events legitimately repeat by source/version.

| Event/invariant | Event key or constraint | Allowed repetition | Conflict and retry behavior | Compatibility |
| --- | --- | --- | --- | --- |
| `draft_created` once per RFQ | `rfq:<rfq_id>:draft_created` | None | Exact retry returns existing row; conflicting payload raises | Existing zero-row baseline permits immediate validation; otherwise backfill required |
| RFQ `submitted` per generation | `rfq:<rfq_id>:submitted:<generation>` | Only a future explicitly modeled resubmission generation | Exact retry idempotent; same key/different source fails | Add generation only if RFQ resubmission becomes legal |
| `manufacturer_opened` | `rfq:<rfq_id>:manufacturer_opened:<phase_key>` | Once per reviewed lifecycle phase | Same phase idempotent; a new database-derived phase can repeat | Initial phase may be `initial`; revision phase should reference Quote/Decision source |
| `manufacturer_replied` | Source tuple `message/<message_id>` | Many per RFQ, once per Message | Duplicate source is idempotent only if identical | Source ID can be populated from immutable Message row |
| `quote_created` | Source tuple `quote/<quote_id>` plus version metadata | Once per Quote version | Duplicate Quote submit denied/idempotent only for exact completed retry | Existing Quote IDs provide stable source |
| `buyer_opened` | Source tuple `quote/<quote_id>` | Once per Quote version | Repeated open returns existing event | Matches existing Quote-specific opened intent |
| Quote decision events | Source tuple `quote_decision/<decision_id>` | Once per Decision/Quote version | Exact retry returns decision/event; conflicting decision rejected | One-decision-per-Quote constraint already helps |
| RFQ terminal outcome | Partial unique RFQ constraint for `accepted`, `declined`, `cancelled`, `expired` | Exactly one terminal outcome | Any second terminal event is a lifecycle conflict | Audit existing terminal rows before validation |
| Message event globally | No global event-type uniqueness | Unlimited across RFQs | Unique only by Message source ID | Avoids blocking valid conversations |

Recommended schema additions are `source_type`, `source_id`, `event_key`, and derived `actor_role`, plus:

1. Unique `(rfq_id, event_key)` where the key is non-null.
2. Unique `(event_type, source_type, source_id)` where source values are non-null.
3. Partial unique `(rfq_id)` for terminal RFQ event types.

An exact retry may return the existing event only after comparing event type, actor, source, and normalized metadata. A reused key with different content raises `RFQ event idempotency conflict.` Constraints remain the final authority under concurrency.

## `supersedes_quote_id` Design

### Column And Integrity

- Nullable UUID self-reference from `rfq_quotes.supersedes_quote_id` to `rfq_quotes.id`.
- `ON DELETE RESTRICT`; Quote history is immutable and must not be detached with `SET NULL`.
- Check `supersedes_quote_id <> id`.
- Protection trigger validates source and revision have the same `rfq_id`.
- Recursive ancestor check rejects cycles.
- Lineage is immutable after insert.
- Unique partial index on `supersedes_quote_id` prevents two revisions from claiming one source under the current linear-history model.
- Existing one-current-submitted partial index remains authoritative per RFQ.
- The source must be the current `revision_requested` Quote when a revision draft is created/submitted.
- Quote RLS governs visibility of both source and revision; no lineage lookup broadens participant access.

Events carry the new Quote ID and version as source, plus `supersedes_quote_id` as database-derived metadata. Buyer/Admin Quote history displays the chain; Manufacturer sees only the RFQ it owns. Commercial snapshots remain immutable on the Quote/line items, not copied from caller metadata.

### Atomic Revision Submission

1. Lock RFQ.
2. Lock source Quote.
3. Lock draft revision.
4. Validate authenticated Manufacturer ownership.
5. Validate source belongs to the RFQ and is `revision_requested`.
6. Validate revision belongs to the same RFQ, is `draft`, contains items, and names the source.
7. State-conditionally update source to `superseded` with `RETURNING`.
8. State-conditionally update revision to `submitted` with database timestamp.
9. Preserve immutable `supersedes_quote_id`.
10. State-conditionally update RFQ `revision_requested -> quoted`.
11. Record source-aware `quote_created` in the same transaction.
12. Commit; any missing `RETURNING` row or uniqueness conflict rolls back everything.

## Final Authority Matrix

Legend: **RLS read** means direct SELECT constrained by RLS; **RPC** means no direct table mutation grant; **internal** means owner-executed database code only.

| Object/action | anon | Buyer | Assigned Manufacturer | Unrelated Manufacturer | Admin | Trusted RPC | Trigger function | Service/backend |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RFQ SELECT | None | RLS read own | RLS read assigned, non-draft | None | RLS read all | Internal row lock as action requires | Internal row access | No browser grant; audited operations only |
| RFQ INSERT | None | RPC `create_rfq_draft` | None | None | None | Internal insert, actor/snapshot derived | Protection only | No default direct action |
| RFQ UPDATE | None | RPC update/submit/cancel | RPC begin review/open only | None | None | Exact transition with lock/RETURNING | Defense and derived timestamps/events | Dedicated future ops RPC only |
| RFQ DELETE | None | RPC delete own draft | None | None | None | Exact own-draft delete | Defense | No default direct action |
| Message SELECT | None | RLS read own RFQ | RLS read assigned non-draft RFQ | None | RLS read all | May read for action validation | Internal source read | Audited read only if separately required |
| Message INSERT | None | RPC `post_rfq_message` | Same RPC | None | None | Derives sender ID/role; inserts | Validates and records source event | No default direct action |
| Event SELECT | None | RLS read own RFQ | RLS read assigned non-draft RFQ | None | RLS read all | May return created event | Internal | Audited read only if separately required |
| Event INSERT | None | None | None | None | None | Calls retained dispatcher internally | Calls retained dispatcher internally | No direct grant by default |
| Quote SELECT | None | RLS read non-draft Quotes on own RFQ | RLS read assigned Quotes | None | RLS read all | Internal row lock as required | Internal source read | Audited operations only |
| Quote draft mutation | None | None | RLS/direct draft DML initially; protection trigger required | None | None | Existing draft RPCs for create/delete; future full RPC conversion optional | Derives/guards amounts and subtotal | No default direct action |
| Quote submission | None | None | RPC `submit_rfq_quote` | None | None | Locks, validates, supersedes, submits, records event | Defense/derived behavior | No default direct action |
| Quote decision | None | RPC accept/reject/request revision | None | None | None | Locks, validates ownership/state, records decision/event | Defense | No default direct action |
| `record_rfq_event` EXECUTE | None | None | None | None | None | Internal owner call only | Internal owner call only | None unless separately approved and audited |

Admin remains SELECT-only for RFQs, Messages, Events, Quotes, items, and decisions. Admin cannot post Messages, transition participant state, forge Events, or impersonate a Buyer/Manufacturer.

## Proposed Migration 0025 Scope

### Required Release Blockers

1. Exact preflight fingerprints for affected triggers, functions, policies, grants, owners, search paths, constraints, indexes, and current data-impact counts.
2. Revoke browser execution from trigger/internal helpers and retained event functions.
3. Retain and harden `record_rfq_event`; add source-aware internal authority and event metadata allowlists.
4. Add event source/role/idempotency columns and scoped uniqueness constraints after compatibility audit.
5. Replace direct authenticated RFQ mutation with narrow Buyer and Manufacturer RPCs.
6. Remove Admin RFQ/Message/Event mutation policies and grants; preserve SELECT only.
7. Fix Manufacturer draft visibility in both RFQ SELECT RLS and `can_access_rfq()`.
8. Add `post_rfq_message` with server-derived sender ID and role; revoke direct Message mutation.
9. Add `supersedes_quote_id`, lineage validation, indexes, and atomic revision submission repair.
10. Replace lifecycle/message/Quote action functions to call the retained source-aware event dispatcher.
11. Enable the nine RFQ/Quote protection/timestamp triggers first, then the three derived/event triggers; attach and enable the new lineage trigger.
12. Assert postconditions, run rollback-only security/concurrency tests, then run authorized staging UAT.

### Optional Hardening

- Move all Quote draft metadata/item mutation behind RPCs; current RLS plus enabled protection triggers can remain an interim design.
- Move policy helper functions to a private schema if PostgREST/policy compatibility is validated.
- Add a dedicated audited system-expiration RPC instead of granting service-role event access.
- Add DDL monitoring or scheduled catalog drift detection for unexpected disabled triggers.

### Deferred Sprint 3B Functionality

- New negotiation states, notifications, attachments, quote comparison enhancements, operator lifecycle actions, or workflow automation.
- Broad event vocabulary expansion.
- Non-RFQ lifecycle feature work.

### Explicit Exclusions

- No production configuration or deployment.
- No data fabrication or historical event timestamps.
- No direct Admin mutation authority.
- No generic authenticated `record_rfq_event` access.
- No trigger recovery outside the specifically audited RFQ/Quote set in this migration.

The additional 17 disabled non-RFQ/Quote triggers discovered by the scope audit require separate object-by-object authorization and recovery. They are excluded from Migration 0025 but remain a production-release risk.

## Execution Prerequisites

1. Explicit written authorization to create and apply Migration 0025.
2. Fresh staging migration list and a dry run showing only the reviewed migration pending.
3. Fresh read-only trigger/function/policy/grant fingerprints matching the signed review package.
4. Fresh data-impact audit; if RFQ data is no longer empty, approve a deterministic backfill/validation plan.
5. Database backup/restore evidence and a rehearsed containment procedure.
6. Frontend branch updated to use every new RPC before direct grants are revoked.
7. Rollback-only SQL tests for roles, status edges, message identity, events, retries, concurrency, and revision chains.
8. Production denylist and staging safety guard pass.
9. Two-person review of SECURITY DEFINER owner, fixed search path, grants, and every state-conditional update.

## Rollback And Containment

- **Before commit:** all DDL and validation should execute in one transaction where PostgreSQL permits. Any failed fingerprint, validation, or postcondition rolls back.
- **After commit, before traffic:** if UAT fails, revoke new user-action RPCs and disable the feature entry points. Prefer a forward corrective migration.
- **After traffic:** do not delete events, null revision lineage, fabricate history, or disable protection triggers as a shortcut. Preserve evidence and apply a reviewed forward repair.
- **Event containment:** revoke the narrow outer RPC involved; `_record_rfq_event` and retained dispatcher remain ungranted.
- **Data containment:** state-conditional updates and constraints should make partial lifecycle writes impossible; investigate any violation before retry.
- **Wider trigger drift:** do not bulk-enable unrelated triggers. Audit each domain and its existing data first.

## Post-Migration UAT

- Buyer creates one draft, edits the same UUID, submits it, and receives exactly one lifecycle event per source key.
- Assigned Manufacturer cannot discover the draft, then can read the submitted RFQ and enter review through its RPC.
- Unrelated Manufacturer receives zero rows by list and direct UUID.
- Buyer and Manufacturer post Messages; sender ID/role are database-derived; Admin cannot post.
- Message retry does not duplicate its event; a second Message creates a distinct event.
- Manufacturer submits Quote v1; Buyer opens and decides; Manufacturer creates/submits v2; v1 becomes `superseded`, v2 is sole current submitted Quote.
- Repeated Quote open/submit/decision calls are idempotent or fail with a clear lifecycle conflict and no duplicate event.
- Admin can read all RFQ/Quote/Message/Event history and cannot mutate or call participant action RPCs.
- Direct RFQ/Message/Event mutation and generic event RPC calls fail for authenticated roles.
- Concurrent submit/cancel, review, Quote revision, and decision calls serialize correctly.
- Snapshot, subtotal, timestamps, source IDs, actor role, and event ordering are database-derived.

## Unresolved Risks

1. The trigger-disablement actor and operation are unknown because no historical DDL audit evidence was available.
2. Seventeen disabled non-RFQ/Quote triggers remain outside the proposed scope and may affect later lifecycle domains.
3. Event/source columns require a new compatibility audit if staging gains RFQ history before execution.
4. The exact RFQ RPC JSON payload schemas and frontend cutover sequence require implementation review.
5. The source-aware `record_rfq_event` body must be completed and tested; the SQL review document intentionally contains a fail-closed skeleton, not executable migration code.
6. Any operational need for `service_role` event creation remains unapproved.

## Final Recommendation

Approve the authority model and event/revision design for implementation review, but do not authorize migration execution yet. The release remains **NO-GO** until the required blockers, exact fingerprints, data-impact review, rollback tests, and wider disabled-trigger disposition are complete.

Migration 0025 is NOT AUTHORIZED and was NOT created.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

PR #29 must remain Draft.
