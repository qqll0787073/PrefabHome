# Sprint 3A.1 Database Recovery Plan

## Executive Summary

Sprint 3A UAT found that the staging RFQ and Quote schema exists but its 12 user-defined triggers are disabled. The trigger definitions and their target functions remain present. The disabled state removes field immutability, lifecycle enforcement, snapshot creation, sender derivation, subtotal recalculation, trusted event creation, and database timestamp behavior from otherwise permitted writes.

The audit also found four design defects that are independent of trigger state:

1. The RFQ SELECT policy and `can_access_rfq()` expose assigned Buyer drafts to the Manufacturer.
2. `submit_rfq_quote()` supersedes only `submitted` quotes, not the `revision_requested` source of a new revision.
3. Internal helpers retain excessive browser-role EXECUTE grants.
4. The retained `record_rfq_event(...)` function is currently exposed as a generic authenticated opened-event interface and accepts caller-controlled metadata. It must remain, but only as a trusted internal authority boundary.

Staging contained zero RFQs, Quotes, Messages, or dependent RFQ events at the audit timestamp. Recovery can therefore be prospective: no historical event or snapshot backfill is currently required, and no actor or timestamp should be fabricated.

Migration 0025 is NOT AUTHORIZED and was NOT created.

Production Deployment Authorization is NOT GRANTED.

Production Supabase was not accessed.

## Authorization Boundaries

- Authorized: local source inspection and read-only staging catalog/count queries.
- Not authorized: DDL, grant changes, trigger changes, migration creation/application, deployment, production access, merge, tag, or release.
- Staging project inspected: `bvzbkjpbnczquecwqvlm`.
- Remote and local migration history: exactly `0001` through `0024`.
- All findings below are a design for a future, separately approved forward migration.

## Baseline

| Check | Result |
| --- | --- |
| Branch | `production-sprint-3a` |
| Starting HEAD | `5557677812a54ca4c0f64cc903c959a7740fd071` |
| Worktree before audit | Clean |
| Local migrations | 24 files, `0001` through `0024` |
| Migration diff from `auth-profiles` | None |
| Staging migrations | `0001` through `0024` |
| RFQ/Quote table owners | `postgres` |
| RLS | Enabled on all six inspected tables; FORCE RLS disabled |

## Canonical Trigger Inventory

Migration-created triggers are enabled by default (`tgenabled = O`). All actual staging values are `D`. Trigger definitions and function dependencies are intact.

| Object type | Schema.object | Migration source | Expected definition | Function security | Expected owner | Search path | Direct browser grants expected | Expected state | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trigger | `public.rfqs.set_rfqs_updated_at` | Trigger `0011`; function `0011` | BEFORE UPDATE, row-level | Invoker | `postgres` | `public` | None | Enabled | `set_rfq_updated_at()` |
| Trigger | `public.rfqs.protect_rfq_write` | Trigger `0011`; final function `0013` | BEFORE INSERT OR UPDATE, row-level | Definer | `postgres` | `public` | None | Enabled | role helpers, snapshot helper, trusted-write flags |
| Trigger | `public.rfqs.record_rfq_lifecycle_event` | `0011` | AFTER INSERT OR UPDATE, row-level | Definer | `postgres` | `public` | None | Enabled | trusted event helper |
| Trigger | `public.rfq_messages.protect_rfq_message_insert` | `0011` | BEFORE INSERT, row-level | Definer | `postgres` | `public` | None | Enabled | RFQ access and role helpers |
| Trigger | `public.rfq_messages.record_rfq_message_event` | `0011` | AFTER INSERT, row-level | Definer | `postgres` | `public` | None | Enabled | trusted event helper |
| Trigger | `public.rfq_events.protect_rfq_event_insert` | Trigger `0011`; final function `0013` | BEFORE INSERT, row-level | Definer | `postgres` | `public` | None | Enabled | access helper and trusted-write flags |
| Trigger | `public.rfq_quotes.set_rfq_quote_updated_at` | `0012` | BEFORE UPDATE, row-level | Invoker | `postgres` | Caller path; no privileged access | None | Enabled | None beyond row |
| Trigger | `public.rfq_quotes.protect_rfq_quote_write` | Trigger `0012`; final function `0013` | BEFORE UPDATE, row-level | Definer | `postgres` | `public` | None | Enabled | quote trusted-write flags and ownership helper |
| Trigger | `public.rfq_quote_items.set_rfq_quote_item_updated_at` | `0012` | BEFORE UPDATE, row-level | Invoker | `postgres` | Caller path; no privileged access | None | Enabled | None beyond row |
| Trigger | `public.rfq_quote_items.protect_rfq_quote_item_write` | `0012` | BEFORE INSERT OR UPDATE OR DELETE, row-level | Definer | `postgres` | `public` | None | Enabled | draft ownership and quote trusted-write helper |
| Trigger | `public.rfq_quote_items.after_rfq_quote_item_change` | `0012` | AFTER INSERT OR UPDATE OR DELETE, row-level | Definer | `postgres` | `public` | None | Enabled | subtotal recalculation helper |
| Trigger | `public.rfq_quote_decisions.protect_rfq_quote_decision_write` | `0013` | BEFORE INSERT OR UPDATE OR DELETE, row-level | Definer | `postgres` | `public` | None | Enabled | trusted decision flag, RFQ/Quote ownership |

### Trigger Classification

| Trigger | Classification | Simply enabling sufficient? | Existing-data/backfill effect | Duplicate-event risk |
| --- | --- | --- | --- | --- |
| `set_rfqs_updated_at` | Safe to re-enable prospectively | Yes, after preflight | Triggers are not retroactive; no rows exist | None |
| `protect_rfq_write` | Requires function/policy repair before enabling | No; Admin must become read-only and lifecycle RPC authority must be settled | No rows exist | None |
| `record_rfq_lifecycle_event` | Safe after protection/event helpers | Not before the protection trigger | No backfill required | Low prospectively; add event idempotency tests |
| `protect_rfq_message_insert` | Requires function repair before enabling | No; it should derive both sender fields | No rows exist | None |
| `record_rfq_message_event` | Safe after message protection repair | No; dependency ordering matters | No backfill required | Low; event should be tied uniquely to Message ID |
| `protect_rfq_event_insert` | Requires grant/RPC cleanup before enabling | No; harden retained event authority first | No rows exist | Current generic entry point permits duplicates |
| `set_rfq_quote_updated_at` | Safe to re-enable prospectively | Yes, after preflight | No rows exist | None |
| `protect_rfq_quote_write` | Safe after revision RPC repair | Not as the first recovery action | No rows exist | None |
| `set_rfq_quote_item_updated_at` | Safe to re-enable prospectively | Yes, after preflight | No rows exist | None |
| `protect_rfq_quote_item_write` | Safe to re-enable prospectively | Yes, after grant preflight | No rows exist | None |
| `after_rfq_quote_item_change` | Safe to re-enable prospectively | Yes, after subtotal helper grant check | No rows exist | None |
| `protect_rfq_quote_decision_write` | Safe to re-enable prospectively | Yes, after trusted-helper preflight | No rows exist | None |

No trigger is obsolete. None requires data cleanup on current staging. A follow-up read-only catalog audit found 29 disabled and 19 enabled user triggers across `public`, spanning RFQ/Quote and several other lifecycle domains. Current tracked files, Git history, deleted staging workflows, test infrastructure, and local tooling contain no trigger-disable, replication-role, restore, or remote-reset operation. The mixed state is therefore **unknown**, not attributable to a repository-controlled script. Manual SQL, an interrupted external restore/import, and other external staging operations remain possible hypotheses only; there is no evidence identifying an actor or a specific operation.

## Canonical Function and RPC Inventory

All inspected functions are owned by `postgres`. Every SECURITY DEFINER function has `search_path = public`; no SECURITY DEFINER function was found without a fixed configuration.

| Schema.object | Final migration | Expected purpose | Security/search path | Expected browser EXECUTE | Main dependencies |
| --- | --- | --- | --- | --- | --- |
| `public.can_access_rfq(uuid)` | `0011` | Participant/Admin RLS predicate | Definer / `public` | Authenticated policy use only | `rfqs`, role helpers |
| `public.is_valid_rfq_transition(text,text)` | `0013` | Transition matrix | Invoker / immutable | None | None |
| `public.build_rfq_product_snapshot(uuid,uuid)` | `0011` | Trigger-only immutable Product snapshot | Definer / `public` | None | `products`, `manufacturers` |
| `public.set_rfq_updated_at()` | `0011` | Trigger-only timestamp | Invoker / `public` | None | `rfqs` trigger |
| `public.protect_rfq_write()` | `0013` | Trigger-only ownership, field, and lifecycle guard | Definer / `public` | None | access/role/trusted helpers |
| `public.protect_rfq_message_insert()` | `0011` | Trigger-only sender authority | Definer / `public` | None | `rfqs`, role helpers |
| `public.record_rfq_lifecycle_event()` | `0011` | Trigger-only lifecycle event writer | Definer / `public` | None | trusted event helper |
| `public.record_rfq_message_event()` | `0011` | Trigger-only reply event writer | Definer / `public` | None | trusted event helper |
| `public.insert_trusted_rfq_event(uuid,text,uuid,jsonb)` | `0013` | Internal event insert | Definer / `public` | None | `rfq_events` |
| `public.protect_rfq_event_insert()` | `0013` | Trigger-only event authorization | Definer / `public` | None | RFQ access and trusted flags |
| `public.record_rfq_event(uuid,text,jsonb)` | `0011` | Retained trusted event dispatcher; current signature is compatibility-only | Definer / `public` | None; internal database callers only | private insert helper, event/source validation |
| `public.record_rfq_opened(uuid)` | `0013` | Manufacturer-only opened RPC | Definer / `public` | Authenticated | RFQ and event row locks |
| `public.record_rfq_quote_opened(uuid)` | `0013` | Buyer Quote-version opened RPC | Definer / `public` | Authenticated | RFQ, Quote, trusted opened flag |
| `public.is_trusted_quote_write()` | `0012` | Internal transaction-local flag | Invoker / stable | None | `set_config` convention |
| `public.is_trusted_rfq_opened_write()` | `0013` | Internal transaction-local flag | Invoker / stable | None | `set_config` convention |
| `public.is_trusted_quote_decision_write()` | `0013` | Internal transaction-local flag | Invoker / stable | None | `set_config` convention |
| `public.can_access_rfq_quote(uuid)` | `0012` | Quote RLS predicate | Definer / `public` | Internal/policy use | RFQ and Quote ownership |
| `public.can_manage_rfq_quote_draft(uuid)` | `0012` | Manufacturer draft predicate | Definer / `public` | Internal/policy use | Quote ownership |
| `public.set_rfq_quote_updated_at()` | `0012` | Trigger-only Quote timestamp | Invoker | None | Quote trigger |
| `public.set_rfq_quote_item_updated_at()` | `0012` | Trigger-only item timestamp | Invoker | None | item trigger |
| `public.recalculate_rfq_quote_subtotal(uuid)` | `0012` | Internal subtotal writer | Definer / `public` | None | Quote/items, trusted flag |
| `public.protect_rfq_quote_write()` | `0013` | Trigger-only Quote immutability | Definer / `public` | None | trusted flags and ownership |
| `public.protect_rfq_quote_item_write()` | `0012` | Trigger-only item authority/amount derivation | Definer / `public` | None | draft ownership |
| `public.after_rfq_quote_item_change()` | `0012` | Trigger-only subtotal recalculation | Definer / `public` | None | subtotal helper |
| `public.create_rfq_quote_draft(uuid)` | `0013` | Manufacturer initial Quote RPC | Definer / `public` | Authenticated | locked RFQ, trusted quote flag |
| `public.submit_rfq_quote(uuid)` | `0013` | Manufacturer submit/revision RPC | Definer / `public` | Authenticated | locked RFQ/Quote, event helper |
| `public.create_rfq_quote_revision(uuid)` | `0013` | Manufacturer revision draft RPC | Definer / `public` | Authenticated | locked source/RFQ, version indexes |
| `public.delete_rfq_quote_draft(uuid)` | `0012` | Manufacturer draft deletion RPC | Definer / `public` | Authenticated | draft ownership |
| `public.decide_rfq_quote(uuid,text,text)` | `0013` | Internal Buyer decision helper | Definer / `public` | None | decision/event trusted flag |
| `public.accept_rfq_quote(uuid,text)` | `0013` | Buyer accept RPC | Definer / `public` | Authenticated | decision helper |
| `public.reject_rfq_quote(uuid,text)` | `0013` | Buyer reject RPC | Definer / `public` | Authenticated | decision helper |
| `public.request_rfq_quote_revision(uuid,text)` | `0013` | Buyer revision-request RPC | Definer / `public` | Authenticated | decision helper |

## RLS and Table Grant Inventory

| Table | Authenticated table privileges observed | RLS policy intent | Recovery posture |
| --- | --- | --- | --- |
| `rfqs` | Full DML plus ancillary privileges | Buyer own, assigned Manufacturer, Admin; narrow update policies | Move mutation to trusted RPCs; Admin SELECT only; Manufacturer cannot SELECT draft |
| `rfq_messages` | Full DML plus ancillary privileges | Participants select/insert; Admin delete | SELECT plus trusted post RPC only; immutable history |
| `rfq_events` | SELECT/DELETE plus ancillary privileges | Participants select; Admin delete | SELECT only; no direct insert/update/delete |
| `rfq_quotes` | Full DML plus ancillary privileges | Participant select; Manufacturer draft update/delete | SELECT plus approved Quote RPCs; review whether draft editing remains direct |
| `rfq_quote_items` | Full DML plus ancillary privileges | Participant select; Manufacturer draft-item DML | Keep only required draft item DML or move behind RPCs |
| `rfq_quote_decisions` | SELECT plus ancillary privileges | Participant/Admin read only | SELECT only; trusted decision RPCs |

The platform-level ancillary grants (`REFERENCES`, `TRIGGER`, `TRUNCATE`) are unnecessary for browser roles and should be explicitly revoked in the forward migration. Service-role privileges are not a browser authority and remain restricted to controlled backend/operations use.

## Expected Versus Actual Matrix

| Object/category | Expected | Actual staging | Difference | Impact |
| --- | --- | --- | --- | --- |
| 12 RFQ/Quote triggers | `tgenabled = O` | All `D` | Operational schema drift | Removes final database enforcement and derived behavior |
| Trigger definitions/functions | Match final `0011`-`0013` intent | Present; definitions and dependencies match | No body drift found | Functions can be repaired/re-enabled in place by a future migration |
| Function owner/search path | Intentional owner; fixed path for definers | Owner `postgres`; every definer uses `public` | No drift | Search-path injection mitigated |
| RFQ Manufacturer visibility | Manufacturer only after submission | Manufacturer predicate ignores RFQ status | Design defect in migration and staging | Buyer draft confidentiality failure |
| Admin lifecycle authority | Read-only UI; decisions use Buyer RPCs | Admin UPDATE policy plus disabled trigger | Policy/trigger combination permits direct transition | Audit and lifecycle authority bypass |
| Message sender authority | Database-controlled role; caller ID checked | Trigger disabled; both sender columns NOT NULL | Normal role-free insert cannot succeed | Conversation blocked; unsafe workaround would enable impersonation |
| Quote revision | Prior current version superseded atomically | Only prior `submitted` row is superseded | `revision_requested` source remains currentish | Ambiguous Quote history |
| Internal function grants | Trigger/internal helpers not callable by browsers | Four known helpers plus additional pure/timestamp helpers have broad grants | Grant hardening gap | Unnecessary RPC surface |
| Retained event authority | Trusted lifecycle RPCs/triggers only | `record_rfq_event` is directly executable by authenticated users | Authority bypass | Caller can create opened events and arbitrary safe metadata without a corresponding trusted action |

## Root Cause Per Blocker

### Admin Direct Lifecycle Update

`authenticated` has UPDATE on `rfqs`. The permissive `rfqs_update_draft_buyer_or_admin` policy allows Admins to update every RFQ and accepts every resulting row. The final `protect_rfq_write()` function would reject Admin transitions to `accepted`, `declined`, or `revision_requested`, while `is_valid_rfq_transition()` rejects other illegal edges. Because the trigger is disabled, neither check executes. Disabled trigger state is the immediate cause; the broad Admin RLS policy is the underlying least-privilege defect.

### Message Insert Failure

`sender_profile_id` and `sender_role` are NOT NULL. The browser correctly omits `sender_role` but currently supplies `sender_profile_id`. The disabled BEFORE INSERT trigger cannot derive `sender_role`, so the row fails its NOT NULL constraint. The forward design should let the client omit both fields and use one trusted Message RPC or repaired trigger to derive `auth.uid()` and the participant role.

### Manufacturer Draft Exposure

Both `rfqs_select_participant_or_admin` and `can_access_rfq()` treat ownership of the assigned Manufacturer as sufficient, regardless of RFQ status. This is a committed policy design defect, not trigger drift. Messages and events rely on the same helper, so changing only the RFQ SELECT policy would not fully close the existence boundary.

### Revision Superseding

Buyer revision decisions set the source Quote to `revision_requested`. `create_rfq_quote_revision()` creates a new draft, but `submit_rfq_quote()` updates prior rows only where `status = 'submitted'`. It therefore cannot supersede its `revision_requested` source. The unique index prevents two `submitted` rows but does not define the source relationship.

### Event Authority

The trigger and trusted event helper were designed to generate lifecycle events, but all event triggers are disabled. Separately, `record_rfq_event(...)` remains executable by authenticated users and accepts caller metadata for `buyer_opened` or `manufacturer_opened`. The function must be retained, hardened, and removed from generic browser execution. Narrow authenticated RPCs such as `record_rfq_opened(uuid)` and `record_rfq_quote_opened(uuid)` remain the user-facing actions; those RPCs and trusted trigger functions call the retained dispatcher internally.

The retained dispatcher remains owned by `postgres`, remains `SECURITY DEFINER`, and keeps `search_path = public`. It accepts only database-derived actor identity, a validated source entity, an allowlisted event type, and event-specific metadata assembled by its trusted caller. A private `_record_rfq_event(...)` insert primitive may be introduced to isolate constraint-aware insertion; neither function is executable by `PUBLIC`, `anon`, or `authenticated`. `service_role` receives no direct grant unless a separately reviewed operational requirement establishes an audited use case.

## Proposed Least-Privilege Authority Model

### Buyer

- Read own RFQs in every status.
- Create, update, submit, cancel, and delete own drafts only through narrow trusted RPCs.
- Open a current submitted Quote only through `record_rfq_quote_opened(quote_uuid)`.
- Accept, reject, or request revision only through the existing decision RPCs.
- Post Messages through `post_rfq_message(rfq_uuid, message, attachment_path)`; identity and role are derived.
- Never insert Events or Decisions directly.

### Manufacturer

- Cannot discover RFQs in `draft`, including direct UUID, Message, Event, or Quote-related lookups.
- Read assigned RFQs from `submitted` onward.
- Enter `manufacturer_review` through a narrow trusted RPC/open action.
- Create/edit Quote drafts under existing ownership rules; submit only through Quote RPCs.
- Post Messages through the same derived-identity RPC.
- Never mutate Buyer request fields or insert Events directly.

### Admin

- SELECT-only inspection of RFQs, Messages, Events, Quotes, items, and decisions.
- No direct lifecycle update/delete, Message posting, Event deletion, or participant impersonation.
- Any future operator/system expiration action must be a separately reviewed RPC, not broad table UPDATE.

### Trusted Mutation Rules

- Lock the affected RFQ and Quote rows before lifecycle checks.
- Use state-conditional `UPDATE ... WHERE status = expected RETURNING` and require exactly one row.
- Derive actor IDs and roles from `auth.uid()` and database ownership.
- Create the audit event in the same transaction as the status change.
- Keep terminal rows immutable.
- Revoke direct authenticated RFQ mutation after frontend services move to RPCs.

## Manufacturer Draft Privacy Repair

The safest minimal repair is to replace the RFQ SELECT policy **and** replace `can_access_rfq()` with the same role/status-aware predicate:

- Buyer: `buyer_id = auth.uid()` in every status.
- Manufacturer: `owns_manufacturer(manufacturer_id) AND status <> 'draft'`.
- Admin: `is_admin()` for read-only inspection.

Replacing the existing permissive policy is clearer than adding a restrictive policy and avoids accidentally restricting Buyer drafts. Related Message/Event policies can continue using the repaired helper. Direct UUID lookup then obeys the same RLS predicate. A participant-safe view/RPC is not necessary for the current RFQ columns, but may be preferred later if field-level privacy expands.

## Message Authority Design

Preferred design:

1. Add trusted `post_rfq_message(rfq_uuid, message_text, attachment_path)`.
2. Revoke direct INSERT/UPDATE/DELETE on `rfq_messages` from authenticated.
3. Validate authentication, RFQ visibility, participant status, nonblank bounded text, and unchanged attachment policy.
4. Derive `sender_profile_id := auth.uid()` and `sender_role` from the RFQ Buyer/Manufacturer relationship.
5. Keep Admin read-only and reject Admin posting.
6. Insert the Message and its Manufacturer reply Event in one transaction.
7. Return the inserted Message.

The repaired BEFORE INSERT trigger should still overwrite both sender fields as defense in depth. The browser should omit both `sender_profile_id` and `sender_role`.

## Quote Revision Design

Add an immutable nullable `supersedes_quote_id` self-reference to make revision lineage explicit. `create_rfq_quote_revision(source_quote_id)` sets it after locking the source and RFQ. Submission then:

1. Locks the draft, RFQ, and source Quote in deterministic order.
2. Verifies authenticated ownership and `draft`/`revision_requested` states.
3. Requires at least one line item.
4. Recalculates subtotal.
5. State-conditionally updates the source from `revision_requested` to `superseded`.
6. State-conditionally updates the draft from `draft` to `submitted`.
7. Keeps the RFQ transition `revision_requested -> quoted`.
8. Inserts exactly one trusted `quote_created` event with Quote ID/version.
9. Relies on the existing partial unique index for one `submitted` Quote per RFQ and adds uniqueness for revision lineage/event identity if approved.
10. Rejects repeated submission because the target is no longer `draft`.

The entire operation must be one transaction. No client-side superseding is acceptable.

## Function Grant Hardening

### Four Previously Identified Functions

| Function | Current direct grantees | Intended use | Direct invocation risk | Recommendation |
| --- | --- | --- | --- | --- |
| `build_rfq_product_snapshot(uuid,uuid)` | PUBLIC, anon, authenticated, service_role | Trigger/internal | SECURITY DEFINER data lookup outside the write path | Revoke PUBLIC/anon/authenticated |
| `protect_rfq_message_insert()` | PUBLIC, anon, authenticated, service_role | Trigger-only | Trigger function is not a valid public RPC, but grant expands surface | Revoke PUBLIC/anon/authenticated |
| `record_rfq_lifecycle_event()` | PUBLIC, anon, authenticated, service_role | Trigger-only | Audit helper should never be caller-selected | Revoke PUBLIC/anon/authenticated |
| `record_rfq_message_event()` | PUBLIC, anon, authenticated, service_role | Trigger-only | Audit helper should never be caller-selected | Revoke PUBLIC/anon/authenticated |

All four are owned by `postgres` and use `search_path = public`. SECURITY DEFINER remains appropriate only where RLS-safe internal access is required.

### Additional Hardening

- Retain `record_rfq_event(...)`, revoke generic `PUBLIC`/`anon`/`authenticated` execution, and route only trusted RPC/trigger paths through it.
- Introduce an ungranted `_record_rfq_event(...)` primitive only if needed to keep source validation, metadata construction, and idempotent insertion separate.
- Revoke PUBLIC/anon/authenticated EXECUTE on trigger-only timestamp and transition helpers where policy evaluation does not require direct execution.
- Keep authenticated EXECUTE only on the explicit participant RPC allowlist.
- Keep policy helpers executable only by roles whose policies call them; do not rely on PUBLIC defaults.
- Explicitly revoke browser `TRIGGER`, `TRUNCATE`, and `REFERENCES` table privileges.

## Existing-Data Impact

Read-only staging counts:

| Category | Count | Recommendation |
| --- | ---: | --- |
| RFQs | 0 | No cleanup/backfill |
| RFQs with empty snapshot | 0 | No backfill |
| RFQs without any Event | 0 | No backfill |
| RFQs missing status-corresponding Event | 0 | No backfill |
| Messages | 0 | Rejected attempts are not recoverable from table data |
| Invalid stored sender roles | 0 | No cleanup |
| Manufacturer Messages without reply Event | 0 | No backfill |
| Quotes | 0 | No cleanup |
| Quote subtotal mismatches | 0 | No recalculation |
| RFQs with multiple submitted Quotes | 0 | No cleanup |
| `revision_requested` Quotes with a later non-draft version | 0 | No cleanup |
| RFQs with multiple non-superseded business-current versions | 0 | No cleanup |

Rejected Message attempts and the time at which triggers were disabled are not represented in table history. They cannot be reconstructed. If future environments contain affected rows, use deterministic snapshots/subtotals only where source data proves the result; never fabricate historical events, actors, or timestamps.

## Forward Migration Ordering

1. Assert environment authorization outside SQL and deny production.
2. Assert migration baseline and exact staging object fingerprints.
3. Assert current data-impact counts and stop on unexpected rows.
4. Harden the retained event dispatcher, remove generic browser execution, and revoke excessive helper grants.
5. Repair SECURITY DEFINER functions and confirm fixed `search_path`/owner.
6. Replace `can_access_rfq()` and the RFQ SELECT policy.
7. Remove Admin mutation/delete policies and narrow table grants.
8. Add trusted Buyer/Manufacturer RFQ mutation RPCs and update services before revoking direct RFQ DML.
9. Add the trusted Message RPC and server-derived sender behavior.
10. Add explicit Quote revision lineage and repair atomic submission/superseding.
11. Re-enable protection/timestamp triggers first, in dependency order.
12. Re-enable derived event/subtotal triggers only after protection checks pass.
13. Assert all 12 trigger states, grants, policies, owners, and function fingerprints.
14. Run rollback-only SQL authorization/concurrency tests.
15. Apply only after separate approval, then run authenticated staging UAT and exact-ID cleanup.
16. Make an explicit backfill decision. Current staging result is **no backfill**.

Re-enabling triggers first is unsafe because it would preserve the current generic event surface, broad Admin policy, sender payload mismatch, and revision defect.

## Post-Migration Verification Matrix

| Test | Expected result |
| --- | --- |
| Buyer create/save/edit/submit Draft | Same RFQ UUID; one row |
| Manufacturer direct query for Buyer Draft | Zero rows, including UUID lookup |
| Manufacturer query after submit | Assigned RFQ visible |
| Buyer and Manufacturer conversation | Message and trusted event committed atomically |
| Spoof `sender_profile_id` | Ignored/rejected; database uses `auth.uid()` |
| Spoof `sender_role` | Ignored/rejected; database derives role |
| Admin post Message | Denied under read-only model |
| RFQ create | Non-empty Product snapshot |
| Buyer submit/cancel | Legal transitions only; exactly one trusted event |
| Manufacturer review | Owning Manufacturer only; Buyer fields immutable |
| Admin direct status UPDATE | Denied by RLS/grant and trigger defense |
| Invalid/terminal transition | Denied with no event |
| Generic direct Event insert/RPC | Denied |
| Revision submission | Source becomes `superseded`; new version becomes sole `submitted` |
| Duplicate revision submit | Clear conflict; no duplicate event |
| Concurrent revision submits | Exactly one succeeds |
| Other Buyer/Manufacturer | Zero private rows and denied mutations |
| Anonymous | No RFQ/Quote/Message/Event access |
| Cleanup | Exact fixture IDs and Auth users leave zero residue |
| Network safety | Approved staging only; zero production contact |

## Rollback and Containment

- Before commit: any assertion or security test failure aborts the migration transaction.
- After commit but before UAT completion: revoke participant mutation RPC EXECUTE first to contain writes, then use a reviewed forward corrective migration. Do not use migration repair or edit applied migrations.
- Do not restore broad Admin mutation policies or generic authenticated event execution as rollback shortcuts.
- Trigger state rollback is not a data rollback. If disabling is ever required for containment, first revoke browser write surfaces and record operator approval.
- With current zero-row staging state, no historical data restoration is needed.

## Sprint 3A.2 Owner Decisions

1. RFQ mutation is RPC-only; direct browser RFQ writes are removed.
2. Admin is strictly read-only for Messages and participant RFQ lifecycle actions.
3. `record_rfq_event(...)` is retained and hardened; generic browser execution is removed.
4. Quote revision history uses immutable `supersedes_quote_id` lineage.
5. Event uniqueness is source-aware: Message and Quote events key by their source rows, lifecycle generations use database-generated event keys, and terminal RFQ outcomes use a partial uniqueness constraint.

The disabling operation remains unknown after repository, history, tooling, and read-only staging investigation. Ancillary privilege cleanup outside RFQ/Quote and recovery of the additional disabled lifecycle-domain triggers require separate scope decisions. No design decision authorizes changing staging before Migration 0025 review and explicit execution approval.
