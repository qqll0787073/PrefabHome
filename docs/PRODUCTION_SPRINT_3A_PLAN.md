# Production Sprint 3A Plan

## Objective

Production Sprint 3A strengthens the existing RFQ and quote experience without changing the database. It uses only the Supabase tables, RLS policies, triggers, and authenticated RPCs already approved in migrations `0011`, `0012`, and `0013`.

Starting SHA: `714f91fe68df1fb81a60327b3cb636c0b9137f92`

Production Deployment Authorization is NOT GRANTED.

Database Migration Authorization for migration 0025 is NOT GRANTED.

## Audited Baseline

| Workflow operation | Existing support | Authorized caller and enforcement | Gap |
| --- | --- | --- | --- |
| Create RFQ draft | `rfqs` insert plus snapshot trigger | Buyer; RLS and `protect_rfq_write()` derive/validate ownership and snapshot data | No trusted create RPC; authenticated profile ID is still required by the insert shape |
| Edit draft RFQ | `rfqs` update | Owning Buyer; RLS and trigger allow only `draft` fields | Existing UI does not expose a standalone draft editor |
| Submit RFQ | `draft -> submitted` table update | Owning Buyer; RLS, trigger, and trusted event trigger | Supported |
| Cancel RFQ | `draft/submitted -> cancelled` | Owning Buyer; RLS and trigger | Supported; cancellation has no dedicated timestamp column |
| Delete RFQ draft | `rfqs` delete | Owning Buyer; RLS permits only draft deletion | Supported |
| Manufacturer review | `submitted -> manufacturer_review` | Assigned Manufacturer; narrow RLS and trigger | Supported through quote draft creation/open behavior |
| Create/edit quote draft | Quote RPC and draft table/item writes | Assigned Manufacturer; RPC ownership checks, RLS, triggers | Supported |
| Submit quote or revision | `submit_rfq_quote` | Assigned Manufacturer; row locks, state checks, trusted event | Supported |
| Buyer opens quote | `record_rfq_quote_opened` | Owning Buyer; quote-specific trusted RPC | Supported |
| Buyer decision | accept/reject/revision RPCs | Owning Buyer; row locks, state checks, trusted decisions/events | Supported |
| Quote withdrawal | Persisted status exists | No approved participant RPC | Deferred pending migration authorization |
| Time-based expiry | Persisted statuses exist | No approved client/system expiry operation | Deferred; browser time must not mutate status |
| Conversation | `rfq_messages` | Participants; RLS and trusted reply events | Supported; attachment upload is not approved |
| Timeline/history | `rfq_events`, quote versions, decisions | Participants/Admin through RLS | Supported; events are database generated |
| Admin inspection | Read policies | Admin through `is_admin()` and RLS | Read-only UI is appropriate |
| Cross-manufacturer comparison | Not supported | RFQ is assigned to one `manufacturer_id` | Requires a future data model and policy design |

## Scope

- Centralize typed role-aware RFQ and quote state helpers.
- Keep display labels separate from persisted values.
- Improve validation using the existing columns and database constraints.
- Provide route-safe RFQ selection within the existing query-string portal routing.
- Improve Buyer RFQ detail, history, cancellation, and quote-version comparison.
- Improve Manufacturer inbox filtering, assigned detail, and quote history presentation.
- Keep Admin inspection read-only.
- Add accessible, repository-owned confirmation UI for destructive RFQ/quote draft actions.
- Add deterministic state, boundary, validation, routing, and comparison tests.

## Non-goals

- Migration `0025` or changes to migrations `0001` through `0024`.
- Cross-manufacturer bidding or competing-quote visibility.
- Quote withdrawal, scheduled expiry, RFQ archival, or manufacturer decline.
- RFQ attachments, warranty fields, explicit shipping-scope fields, budget ranges, or requested room/dimension fields.
- Orders, contracts, invoices, payments, email, signatures, freight execution, customs, analytics, tracking, monitoring, or AI integrations.
- Production, staging, preview, or Supabase deployment.

## Role Boundaries

- **Buyer:** own RFQs only; non-draft quotes for those RFQs only; trusted decision RPCs only.
- **Manufacturer:** assigned RFQs only; own organization's quote drafts/history only; no competing quote surface and no private Buyer account data.
- **Admin:** RLS-authorized read inspection only in Sprint 3A; no new mutation controls.
- **Anonymous:** no RFQ, message, event, quote, item, or decision access.

Client helpers improve affordances but do not authorize a request. RLS, database triggers, and RPC checks remain authoritative.

## State Rules

RFQ persisted states are `draft`, `submitted`, `manufacturer_review`, `quoted`, `buyer_review`, `revision_requested`, `accepted`, `declined`, `expired`, and `cancelled`.

Quote persisted states are `draft`, `submitted`, `superseded`, `accepted`, `rejected`, `revision_requested`, `expired`, and `withdrawn`.

Terminal RFQs are `accepted`, `declined`, `expired`, and `cancelled`. Terminal quote versions are `superseded`, `accepted`, `rejected`, `expired`, and `withdrawn`; `revision_requested` is immutable and may be the source of a trusted revision.

## Data Integrity

- Product and manufacturer details use the immutable database snapshot created with the RFQ.
- Authenticated ownership is validated by RLS/trigger logic; UI IDs never grant authority.
- Quote versions, current-submitted uniqueness, subtotal, decisions, and event actor identity remain database managed.
- Services reject malformed or demo identifiers before live calls and sanitize backend failures.
- Non-idempotent actions use busy-state controls and refresh authoritative records after success.
- Currency values are compared only within their stated currencies; no exchange-rate conversion or ranking is performed.

## Accessibility And Mobile

- Meaningful workspace headings, associated field errors, status announcements, visible focus, and keyboard-operable filters/actions.
- Focus-contained dialogs with focus restoration and Escape behavior.
- A semantic comparison table with caption and responsive overflow/stacking support.
- Text and controls reflow at mobile widths and zoom proxies without page-level horizontal overflow.
- Status meaning is conveyed in text, not color alone; reduced-motion and forced-color behavior are preserved.

## Test Strategy

- Unit tests for every actual transition, role action, terminal state, validation boundary, service guard, and comparison warning.
- Routing tests for record selection, invalid values, role/workspace changes, and unrelated query leakage.
- Existing SQL/RLS tests remain unchanged and provide server authorization coverage.
- Browser checks cover supported Buyer, Manufacturer, and Admin paths at the required viewports, navigation history, focus, overflow, console safety, and unavailable states. No live backend result will be claimed without authorization.
- Release gates cover tests, build, dependency audit, Beta verification, artifact/bundle quality, legal structure, tracked-secret scanning, and the intentionally blocked legal-publication gate.

## Rollback Strategy

Sprint 3A has no migration. Reverting its source and documentation commits restores the prior UI; persisted RFQ and quote data is untouched. No rollback SQL or remote action is required.

## Definition Of Done

- Supported operations use existing approved data surfaces only.
- Domain helpers and UI match database status values and role authority.
- Buyer comparison is participant-safe and makes its single-manufacturer/version scope explicit.
- Unsupported operations are unavailable and documented, not simulated.
- Tests, build, audit, Beta, artifact, bundle, quality, and legal-structure gates pass.
- Legal publication remains intentionally blocked.
- Migrations `0001` through `0024` are unchanged; migration `0025` does not exist.
- No secrets, deployment, merge, tag, release, or remote Supabase access occurs.

