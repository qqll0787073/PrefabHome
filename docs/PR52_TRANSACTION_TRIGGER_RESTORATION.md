# PR #52 — reviewed transaction-trigger restoration

## Architecture decision

Selected Gate 7 outcome D: restore the individually proven canonical trusted-write guard set. All 17 are classification **A — SECURITY-CRITICAL — SHOULD BE ENABLED**. No B/C/D classification is supported by the current source, live body comparison, historical incident record or executable rehearsal. This is not an inference from trigger count: each attachment/function was checked and each guard was exercised; legitimate cross-domain RPC flows were rehearsed with the proposed restoration.

Starting head: e62f837c2ec86ae2a5172861a3fc141b81547c4a. Staging-only target: bvzbkjpbnczquecwqvlm. Starting local/remote inventory: 0001–0036, nothing pending. Production contacts: 0.

## Per-trigger inventory and disposition

Shared metadata (applies to **each row**): schema public; initial enabled state D; BEFORE INSERT OR UPDATE OR DELETE FOR EACH ROW; zero arguments and no WHEN/constraint attachment; function name equals trigger name with signature public.name(); owner postgres. Existing EXECUTE ACL: postgres and service_role only, not PUBLIC/anon/authenticated. No grant expansion is proposed. The 13 definer functions have fixed search_path=public. The four invoker functions retain canonical invoker execution and qualified public helper calls; normal callers are hardened SECURITY DEFINER RPCs. No new definer or search-path change is introduced.

For **each row**, disabling migration/actor/date is unknown; no disabling migration was found. The historical STAGING_TRIGGER_GOVERNANCE_INCIDENT already lists exactly this set as unresolved, not obsolete. Current replacement: none; RPC authorization and RLS are complementary, not replacements for the guard. Current application reliance: yes, through the corresponding domain RPCs and trusted flags. Restoration conflict: no conflict observed in rollback rehearsal of actual lifecycle calls. Disabled impact: loss of the invariant in the last column. Final live state must be verified after normal migration application.

| Trigger | Table | Created / latest | Definer | Classification | Protected invariant |
|---|---|---|---|---|---|
| protect_contract_event_write | contract_events | 0016 (body updated 0017) | yes; public path | A | Trusted insertion, immutable history, stripped identity metadata |
| protect_contract_review_decision_write | contract_review_decisions | 0017 | yes; public path | A | Trusted decisions, immutable review history |
| protect_contract_write | contracts | 0016 (body updated 0017) | yes; public path | A | Trusted lifecycle writes; no deletes; active Buyer via 0035 |
| protect_invoice_event_write | invoice_events | 0020 | yes; public path | A | Trusted insertion, immutable history, sanitized metadata |
| protect_invoice_line_item_write | invoice_line_items | 0020 | yes; public path | A | Trusted creation; immutable commercial line items |
| protect_invoice_write | invoices | 0020 | yes; public path | A | Trusted lifecycle writes; no deletion |
| protect_logistics_booking_request_event_write | logistics_booking_request_events | 0023 | no; inherited path | A | Trusted insertion; immutable event history |
| protect_logistics_booking_request_write | logistics_booking_requests | 0023 | no; inherited path | A | Trusted request lifecycle; no deletion |
| protect_purchase_order_decision_write | purchase_order_decisions | 0015 | yes; public path | A | Trusted Manufacturer decision; derived actor/company/review round; immutable history |
| protect_purchase_order_event_write | purchase_order_events | 0014 | yes; public path | A | Trusted events; strips caller identity metadata |
| protect_purchase_order_item_write | purchase_order_items | 0014 | yes; public path | A | Trusted copied commercial items only |
| protect_purchase_order_write | purchase_orders | 0014 (body updated 0015; helper 0035) | yes; public path | A | Trusted lifecycle writes; no deletes; active Buyer via 0035 |
| protect_shipping_readiness_event_write | shipping_readiness_events | 0022 | no; inherited path | A | Trusted insertion; immutable event history |
| protect_shipping_readiness_write | shipping_readiness_records | 0022 | no; inherited path | A | Trusted readiness lifecycle; no deletion |
| protect_signature_package_event_write | signature_package_events | 0018 | yes; public path | A | Trusted insertion; immutable history; strips identity metadata |
| protect_signature_package_write | signature_packages | 0018 | yes; public path | A | Trusted lifecycle; no deletes; active Buyer via 0035 |
| protect_signature_participant_write | signature_participants | 0018 | yes; public path | A | Trusted signer updates; no deletes; active Buyer via 0035 |

Exact original catalog definitions, owner, ACL and paths are preserved in audit/sprint-5c2/trigger-inventory-before.json.

## Root cause and PO architecture

protect_purchase_order_write was created by 0014 on public.purchase_orders, replaced by 0015, and calls is_trusted_purchase_order_write, hardened by 0035. Its body matches current canonical source. Repository history and prior incident documents do not establish who/when/how disabled it. Migration 0025 deliberately repaired only RFQ/Quote triggers and left these 17 for separate authorization. This explains why it was not previously restored, not why it was disabled. No intentional architectural supersession was found.

The creation RPC (0030) requires auth.uid(), active Buyer profile, own RFQ, accepted and unexpired Quote, approved Manufacturer, own accepted decision and consistent item subtotal; it derives identity and commercial snapshots, serializes via row locks and returns the existing PO on retry. Buyer update/submit/cancel/revision RPCs enforce identity, ownership, lifecycle and narrow inputs, then use the trusted-write context. The trigger invokes 0035's active-Buyer check. Manufacturer decision/open RPCs use owns_manufacturer (active approved owner), constrained lifecycle and trusted decision context. Admin is read-only for participant PO actions; no legitimate Admin bypass is required. Browser direct DML is revoked and RLS limits reads. This is the intended complementary RPC + grant/RLS + trigger model.

Rollback-only pre-repair reproduction confirmed a suspended authenticated Buyer updated buyer_reference and buyer_note on its own draft PO, then submitted it. Actual lifecycle became submitted. Direct authenticated UPDATE grant was false: the proven bypass is through trusted SECURITY DEFINER RPCs, not a browser raw-table write. Neither reproduction was committed.

## Migration 0037

0037_restore_transaction_write_protection.sql contains only transactional preflight, 17 explicit ENABLE TRIGGER statements and postflight. Preflight checks table/trigger/function attachment, row/timing/events, no WHEN/constraint, body fingerprints independently matched against latest canonical SQL, owner, definer/path and denied browser execute grants. It accepts enabled canonical objects on clean installs as well as disabled audited objects. Any mismatch aborts before restoration. Lock and statement timeouts bound execution.

No historical migration changes; no RPC replacement; no data rewrite; no broad enable-all; no grants added; no history repair/reset/seed. Data-impact audit found zero rows in all 17 affected tables and no authenticated INSERT/UPDATE/DELETE privileges. Rollback rehearsals leave the initial trigger state unchanged.

## Regression and recovery

transaction_trigger_restoration_security.sql uses fresh transaction-only fixture UUIDs/emails and real RFQ/Quote/PO RPCs, not trigger-suppressed fixture creation. Coverage includes accepted Quote→PO/idempotency; active/pending/suspended/unrelated Buyer; Admin and Manufacturer boundaries; direct owner/company/subtotal/status forgery; Manufacturer revision/confirmation; Contract/Signature suspended Buyer guards; full Invoice/Shipping/Logistics flow; exact exception checks for untrusted inserts on all 17 real tables; rejected updates on each fixture domain. Every mutation and temporary helper rolls back.

0033–0036 must be revalidated, never reapplied. Apply only after the exact dry run selects 0037 alone. After commit, do not disable guards as a rollback shortcut: stop affected writes and use a separately reviewed forward correction if postflight fails. No historical data deletion or fabrication is permitted.

The disabling origin remains unknown even after protection is restored; no claim is made about a historical actor. Ongoing governance/DDL audit monitoring is a separate operational follow-up, not part of this migration.

## Staging application and postflight

Normal migration application selected only 0037 and succeeded. Local and remote inventories are now 0001–0037; subsequent dry run reports up to date, with no seeds or roles. All 17 catalog states are O (enabled), and every captured function body, attachment, owner, definer setting, search_path and ACL remains unchanged. Disabled public user-trigger count is now zero.

The new live lifecycle/17-guard suite passed. The previously failing suspended-Buyer suite now passes. Manufacturer Product numeric validation, Manufacturer company-profile security and Admin authority rollback suites also passed. The Admin suite uses existing-data baseline counts in memory, preserving its aggregate assertions. All 17 affected transaction tables remain at their pre-test zero-row baseline, and no synthetic auth users remain.

Local verification: 402 source tests and 158 infrastructure tests passed; build, quality, artifact, legal and docs gates passed. An initial stale migration-count assertion was updated to the new exact inventory and the entire suite rerun successfully. No browser source or performance budget was changed. Final commit, audit, CI and merge disposition are reported in the Owner handoff; old CI is not valid evidence for the new head.
