# Staging Schema Drift Audit

## Scope

This was a read-only catalog audit of staging project `bvzbkjpbnczquecwqvlm` against committed migrations `0001` through `0024`. The production project was denylisted and not contacted. No schema or data modification command was used for this audit.

The isolated Supabase CLI workspace reported remote migrations `0001` through `0024`. Catalog inspection covered the RFQ/Quote tables, columns, constraints, triggers, functions, policies, table grants, function grants, RLS state, and migration history.

## Summary

| Severity | Finding | Release impact |
| --- | --- | --- |
| Critical | All 12 RFQ/Quote triggers are disabled in staging. | Lifecycle protection, snapshots, trusted event generation, sender derivation, subtotal recalculation, and updated timestamps are not authoritative. |
| High | Assigned Manufacturers can directly select Buyer draft RFQs. | Private, unsubmitted Buyer intent is exposed to the assigned Manufacturer. |
| High | Revision submission does not supersede a prior `revision_requested` quote. | Quote history can retain multiple business-current states and misrepresent the superseding chain. |
| High | Four internal/trigger-oriented functions retain broad execute grants. | Defense in depth is weaker than documented, including a callable SECURITY DEFINER snapshot helper. |

## Trigger Drift

Every trigger below is declared normally in committed migrations and is expected to have `tgenabled = O`. Staging reports `tgenabled = D` for each one.

| Object | Expected from migrations | Actual staging | Difference and impact | Recommended forward fix | Future migration required |
| --- | --- | --- | --- | --- | --- |
| `rfqs.protect_rfq_write` | Enabled before insert/update trigger | Disabled | Ownership, immutable fields, legal transitions, timestamps, and snapshot protections can be bypassed where RLS permits a row write. | Re-enable only after investigating why it was disabled; rerun the complete RFQ security suite. | Yes |
| `rfqs.record_rfq_lifecycle_event` | Enabled after insert/update trigger | Disabled | Draft/submitted/cancelled/manufacturer-review events are incomplete. | Re-enable and verify exactly-once trusted events. | Yes |
| `rfqs.set_rfqs_updated_at` | Enabled timestamp trigger | Disabled | `updated_at` is not consistently database managed. | Re-enable with the RFQ trigger set. | Yes |
| `rfq_messages.protect_rfq_message_insert` | Enabled before insert trigger | Disabled | `sender_profile_id` and `sender_role` are not derived; legitimate inserts fail unless the browser forges protected data. | Re-enable; keep client payload role-free. | Yes |
| `rfq_messages.record_rfq_message_event` | Enabled after insert trigger | Disabled | Manufacturer reply audit events are absent. | Re-enable and verify trusted actor/event derivation. | Yes |
| `rfq_events.protect_rfq_event_insert` | Enabled before insert trigger | Disabled | Direct event insertion protection is absent where grants/policies allow access. | Re-enable and retest direct event forgery denial. | Yes |
| `rfq_quotes.protect_rfq_quote_write` | Enabled before insert/update/delete trigger | Disabled | Quote lifecycle and immutable-field protection can be bypassed by otherwise permitted writes. | Re-enable and rerun quote/revision authorization tests. | Yes |
| `rfq_quotes.set_rfq_quote_updated_at` | Enabled timestamp trigger | Disabled | Quote update timestamps are not consistently database managed. | Re-enable with quote protections. | Yes |
| `rfq_quote_items.protect_rfq_quote_item_write` | Enabled before write trigger | Disabled | Draft ownership and amount derivation protections are absent at trigger level. | Re-enable before relying on direct draft-item writes. | Yes |
| `rfq_quote_items.after_rfq_quote_item_change` | Enabled after mutation trigger | Disabled | Persisted quote subtotal does not recalculate after item changes. | Re-enable and verify insert/update/delete recalculation. | Yes |
| `rfq_quote_items.set_rfq_quote_item_updated_at` | Enabled timestamp trigger | Disabled | Item timestamps are not consistently database managed. | Re-enable with item protections. | Yes |
| `rfq_quote_decisions.protect_rfq_quote_decision_write` | Enabled before write trigger | Disabled | Trusted decision-row write boundary is absent at trigger level. | Re-enable and rerun decision forgery/immutability tests. | Yes |

Observed functional consequences in UAT were empty RFQ Product snapshots, blocked role-free conversation inserts, incomplete lifecycle/message timelines, stale persisted subtotal between item mutation and trusted submission, and reachable direct lifecycle mutations.

## Authorization and Data-Model Findings

| Object | Expected definition | Actual staging | Difference | Security/business impact | Recommended forward fix | Future migration required |
| --- | --- | --- | --- | --- | --- | --- |
| `rfqs_select_participant_or_admin` | Committed policy allows Buyer owner, owning Manufacturer, or Admin | Definition matches migration | Design gap, not migration drift: no `status <> 'draft'` condition for Manufacturer | Assigned Manufacturer can retrieve unsubmitted Buyer drafts by direct API query. Frontend filtering is not authorization. | Replace with role-specific SELECT policies or a status-aware predicate that preserves Buyer/Admin access and excludes Manufacturer draft access. | Yes |
| `submit_rfq_quote(uuid)` | Committed RPC supersedes a previous quote only when its status is `submitted` | Definition matches migration | Design gap: after Buyer requests revision, prior status is `revision_requested`, so revision submission does not supersede it | History/current-version semantics are inconsistent. | Atomically supersede the prior decided revision source when submitting the new version, with row locking and regression tests. | Yes |
| `build_rfq_product_snapshot` grants | Internal SECURITY DEFINER helper should not be a public browser RPC | `PUBLIC`, `anon`, and `authenticated` have EXECUTE | Broad direct-call surface | Authenticated/anonymous callers can invoke a privileged helper outside its intended trigger path. | Revoke from `PUBLIC`, `anon`, and `authenticated`; leave only required trusted execution. | Yes |
| `protect_rfq_message_insert` grants | Trigger-only helper | `PUBLIC`, `anon`, and `authenticated` have EXECUTE | Broad grant, although trigger return semantics limit ordinary direct utility | Weakens defense in depth and contradicts internal-helper classification. | Revoke direct execute from browser roles. | Yes |
| `record_rfq_lifecycle_event` grants | Trigger-only trusted event generator | `PUBLIC`, `anon`, and `authenticated` have EXECUTE | Broad grant | Increases audit-surface risk and obscures the trusted event boundary. | Revoke direct execute from browser roles. | Yes |
| `record_rfq_message_event` grants | Trigger-only trusted event generator | `PUBLIC`, `anon`, and `authenticated` have EXECUTE | Broad grant | Increases audit-surface risk and obscures the trusted event boundary. | Revoke direct execute from browser roles. | Yes |

## Expected Objects That Match

- `rfqs`, `rfq_messages`, `rfq_events`, `rfq_quotes`, `rfq_quote_items`, and `rfq_quote_decisions` all exist with RLS enabled.
- The inspected constraints, function bodies, policies, and table/function signatures match the committed migration lineage unless called out above.
- Key SECURITY DEFINER functions use a fixed `search_path = public`.
- Intended authenticated RPCs for quote draft creation, submission, revision, deletion, RFQ opening, quote opening, and Buyer decisions remain available.
- Internal quote subtotal and trusted decision helpers that migrations explicitly revoke are not granted to browser roles.
- An unrelated Manufacturer received zero RFQs in authenticated staging verification.
- Anonymous RFQ/Quote access remains denied by the inspected RLS/grant model.

## Direct Permission Risk

Authenticated table grants include broad DML privileges and depend on RLS plus enabled triggers for the final authority boundary. That design can be valid only when the trigger protections are present and tested. With the trigger set disabled, RLS alone does not enforce all field immutability and legal lifecycle transitions, and the permissive Admin policies permit writes the current Admin UI does not expose.

Recommended remediation is a reviewed forward migration that re-enables and, where appropriate, re-creates the expected triggers; narrows internal function grants; separates Manufacturer draft visibility at the policy layer; and fixes revision superseding atomically. It must be validated against a disposable or rollback-only database before staging application. Existing migrations `0001` through `0024` must remain immutable.

## Verification and Safety

- Remote migration history inspected: exactly `0001` through `0024`.
- Schema audit operations: read-only catalog queries.
- Staging schema changes made by this audit: none.
- Production access: none.
- Migration `0025`: not created.
- Existing migrations changed: none.
- Deployment, merge, tag, and release: none.
