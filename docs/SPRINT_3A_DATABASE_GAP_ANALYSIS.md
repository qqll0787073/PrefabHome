# Sprint 3A Database Gap Analysis

## Existing Approved Surface

| Object | Purpose | Authority |
| --- | --- | --- |
| `public.rfqs` | RFQ header, assignment, snapshot, request fields, lifecycle | Buyer/assigned Manufacturer/Admin RLS plus `protect_rfq_write()` |
| `public.rfq_messages` | Participant conversation | Participant/Admin RLS plus trusted sender-role/reply behavior |
| `public.rfq_events` | Trusted lifecycle/open/reply/quote history | Read-only participant/Admin policies; trusted generators |
| `public.rfq_quotes` | Manufacturer quote versions and lifecycle | Participant/Admin RLS, draft guards, trusted RPCs |
| `public.rfq_quote_items` | Quote commercial line items and subtotal input | Draft-owner RLS and recalculation triggers |
| `public.rfq_quote_decisions` | Buyer decision history | Participant/Admin read; trusted decision RPC writes |
| `create_rfq_quote_draft` | Creates Manufacturer-owned draft for assigned RFQ | Authenticated assigned Manufacturer |
| `submit_rfq_quote` | Atomic initial/revision submission | Authenticated assigned Manufacturer |
| `create_rfq_quote_revision` | Database-versioned revision draft | Authenticated assigned Manufacturer |
| `delete_rfq_quote_draft` | Deletes own draft atomically | Authenticated assigned Manufacturer |
| `record_rfq_opened` | Manufacturer-only opened event | Authenticated assigned Manufacturer |
| `record_rfq_quote_opened` | Quote-version-aware Buyer opened event | Authenticated owning Buyer |
| Buyer decision RPCs | Accept, reject, request revision | Authenticated owning Buyer |

Function grants restrict internal helpers to trigger/security-definer execution. Browser code uses the publishable key only; RLS and RPC checks remain authoritative.

## Requirement Coverage

| Requirement | Status | Notes |
| --- | --- | --- |
| Own Buyer list/detail/draft/submit/delete/cancel | Supported | Insert/update/delete RLS and trigger-enforced lifecycle |
| Assigned Manufacturer inbox/detail | Supported | Organization ownership resolved through Manufacturer RLS |
| Quote draft, items, submit, revision, history | Supported | Trusted RPCs plus draft-only table writes |
| Buyer quote open and decisions | Supported | Quote-specific opened and decision RPCs |
| Admin inspection | Supported | Existing Admin read policies; no Sprint 3A mutation |
| Participant conversation and timeline | Supported | Existing messages/events |
| Quote-version comparison | Supported | Single RFQ/Manufacturer only; Buyer non-draft surface |
| Cross-Manufacturer quote comparison | Unsupported | Current RFQ has one `manufacturer_id` and no distribution/bid table |
| Browser-safe trusted RFQ create/duplicate | Partial | RLS validates ownership, but insert payload includes relationship IDs |
| Additional RFQ business fields | Unsupported | No columns or safe payload validation for size, rooms, region, or budgets |
| Date and location length constraints | UI validation only | Existing schema does not enforce future delivery/validity dates or bounded country/port text |
| RFQ attachments | Unsupported end to end | `attachment_path` exists on messages, but no approved RFQ upload/download surface |
| Quote warranty/shipping scope | Unsupported | No persisted fields; line items cannot safely substitute for explicit scope |
| Manufacturer decline/quote withdrawal | Unsupported action | Status vocabulary is not an executable authority boundary |
| Scheduled expiration/archive | Unsupported action | Requires trusted server scheduling/RPC and audit rules |

## 0025 Candidate Changes

The following is analysis only. A future authorized migration would need to be reviewed as one coherent security design:

1. Add a trusted `create_rfq_draft(product_uuid, safe_fields...)` RPC that derives `buyer_id` from `auth.uid()`, reads the published product/manufacturer relationship, rejects demo/unknown IDs, snapshots public-safe fields, and returns the new RFQ.
2. Add a trusted `duplicate_rfq_draft(source_rfq_uuid)` RPC that verifies source Buyer ownership and copies only approved request fields into a new draft.
3. If multi-Manufacturer bidding is desired, replace direct RFQ assignment assumptions with an invitation/recipient table and explicit per-recipient quote access. Policies must prevent manufacturers from discovering other recipients or quotes.
4. Add typed/validated columns for requested dimensions, destination region, requested bedrooms/bathrooms, budget minimum/maximum/currency, with database range and consistency constraints.
5. Add RFQ attachment metadata tied to private storage, participant-safe signed URL RPCs, content/size limits, cleanup rules, and audit behavior.
6. Add explicit quote `shipping_scope` and bounded `warranty_summary` fields if needed. Do not infer promises from free text.
7. Add narrowly scoped Manufacturer decline and quote withdrawal RPCs with row locks, legal transition checks, database timestamps, and trusted events.
8. Add a server-side expiry operation with deterministic clock semantics and a controlled scheduler/operator boundary; never browser-derived expiry.
9. Add dedicated lifecycle timestamps only where they are audit requirements and make them database-managed.
10. Add database constraints or trusted validators for RFQ destination lengths, target delivery date semantics, quote port lengths, and quote validity-date semantics. Sprint 3A client checks improve feedback but are not an authorization or database-integrity boundary.

## Security Implications

- Multi-recipient RFQs materially change participant isolation and require new RLS tests for recipient enumeration and competing quote access.
- Trusted create/duplicate RPCs remove relationship IDs from the browser authority boundary while retaining the publishable-key/RLS model.
- Attachments require database-level row visibility plus private storage policies; frontend omission is insufficient.
- Withdrawal, decline, archive, and expiry need row locking and trusted events to avoid lifecycle races and forged history.
- New business fields must be validated in the database as well as the UI; browser-only budget or scope data cannot be authoritative.

Migration 0025 is NOT AUTHORIZED and was NOT created. Migrations `0001` through `0024` remain unchanged. No staging, production, or preview environment was accessed or modified.
