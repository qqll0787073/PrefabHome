# RFQ And Quote Workflow Guide

## Persisted States

RFQ display labels map directly from these persisted values:

| Value | Display | Meaning |
| --- | --- | --- |
| `draft` | Draft | Buyer-owned editable request |
| `submitted` | Submitted | Sent to the assigned Manufacturer |
| `manufacturer_review` | Manufacturer review | Assigned Manufacturer engaged |
| `quoted` | Quoted | Current submitted quote awaits opening |
| `buyer_review` | Buyer review | Buyer opened the current quote |
| `revision_requested` | Revision requested | Buyer requested another quote version |
| `accepted` | Accepted | Buyer accepted the quote; terminal RFQ |
| `declined` | Declined | Buyer rejected the quote; terminal RFQ |
| `expired` | Expired | Server-managed terminal state; no browser expiry operation |
| `cancelled` | Cancelled | Buyer-cancelled terminal RFQ |

Quote values are `draft`, `submitted`, `superseded`, `accepted`, `rejected`, `revision_requested`, `expired`, and `withdrawn`. Only `draft` is generally editable. A `revision_requested` quote can seed a new draft through the trusted revision RPC. `withdrawn` is display-only because no approved participant withdrawal RPC exists.

## Buyer Workflow

1. A signed-in Buyer opens a published marketplace product and creates a draft RFQ.
2. The database validates Buyer identity, selected product/manufacturer relationship, and creates an immutable public-safe product snapshot.
3. The Buyer submits the draft. The database records the lifecycle event.
4. The Buyer can read only their own RFQs, conversation, trusted timeline, and non-draft quote versions.
5. The Buyer opens the current submitted quote through the quote-specific opened RPC and may accept, reject, or request a revision through trusted decision RPCs.
6. Draft and submitted RFQs may be cancelled where database policy permits. Terminal RFQs are read-only.

RFQ duplication is not exposed in Sprint 3A. Although a new insert could copy supported fields, the current create surface requires browser-provided relationship identifiers and no trusted duplication RPC guarantees source ownership plus a new server-derived relationship.

## Manufacturer Workflow

1. The inbox reads only RFQs assigned by RLS to Manufacturer applications owned by the signed-in profile.
2. Creating a quote draft uses `create_rfq_quote_draft`; the database derives the Manufacturer and may transition `submitted -> manufacturer_review`.
3. The Manufacturer edits only a draft quote and its draft line items.
4. Submission uses `submit_rfq_quote`, which locks and validates the RFQ/quote, calculates lifecycle changes, and records a trusted event.
5. After a Buyer revision request, `create_rfq_quote_revision` creates a database-versioned draft; submission supersedes the previous current quote atomically.
6. Submitted/history versions are read-only. No decline/dismiss or quote-withdraw action is shown because no approved RPC exists.

Manufacturer reads do not include competing Manufacturer quotes. The current schema assigns one Manufacturer to each RFQ.

## Admin Inspection

Admins read RFQs, participant-safe relationships, messages, events, quote versions/items, and decisions under existing `is_admin()` policies. Sprint 3A adds no Admin lifecycle mutation. Tokens, storage paths, and secrets are never rendered.

## Supported Fields And Validation

The current RFQ stores product/manufacturer references, immutable product snapshot, quantity, currency, Incoterm, destination country/port, target delivery date, and Buyer message.

- Quantity: finite and at least `1`.
- Currency: exactly three ASCII letters, normalized uppercase.
- Incoterm: blank or `FOB`, `CIF`, `EXW`, `DDP`, `DAP`.
- Destination country: trimmed, required, maximum 120 characters.
- Destination port: optional, maximum 160 characters.
- Target delivery: optional valid ISO date that is not in the past when submitted.
- Buyer message: plain text, maximum 2,000 characters.

The quantity, currency, Incoterm, and Buyer-message limits have database constraints. Destination length and future target-date checks are Sprint 3A client validation only; database enforcement is a documented migration gap.

Quote drafts support currency, Incoterm, origin/destination ports, production/shipping lead days, validity date, Manufacturer note, and line items. Submission requires at least one line item and a future validity date when one is supplied. Amounts cannot be negative, item quantities must be positive, and text fields have bounded lengths. No tax, customs, permit, code-compliance, payment, or delivery guarantee is inferred from a line item label.

The current database does not enforce future quote validity or port-length limits. The UI rejects them for feedback, but an authorized future migration is required for database-level integrity.

## Comparison

Buyer comparison shows non-draft versions for one owned RFQ: version, status, subtotal and currency, Incoterm, lead times, validity, commercial note, and line-item summary. It does not expose drafts or another RFQ.

The view compares negotiated versions from the same assigned Manufacturer, not competing manufacturers. It displays warnings when currencies, Incoterms, or freight line-item scope differ. It performs no currency conversion, hidden score, ranking, recommendation, acceptance, order, contract, invoice, or payment action.

Warranty and explicit shipping-inclusion fields do not exist. A freight line item is shown as quoted scope, but absence of one is not treated as a delivery promise.

## Activity And History

RFQ events are generated by trusted database triggers/RPCs. Messages are stored participant records with trusted reply events. Quote versions and Buyer decisions preserve the supported negotiation history. The UI does not synthesize missing events or call client-created history authoritative.

Cancellation has no dedicated timestamp column; the trusted cancellation event is the authoritative available time. Quote withdrawal and scheduled expiration are not available browser actions.

## Demo And Live Separation

RFQ and quote demo mode is read-only/empty. It never writes fixtures to Supabase. Live service methods require configured Supabase and valid non-demo identifiers. Marketplace demo data remains opt-in and must remain disabled in production-shaped builds.

## Deferred Operations

Deferred pending migration authorization:

- True multi-Manufacturer RFQ distribution and competing-quote comparison.
- Server-derived RFQ creation/duplication RPC that accepts only a published product and safe field payload.
- Requested dimensions, region, bedroom/bathroom requests, budget range, and explicit budget currency.
- RFQ attachment storage linkage and participant-safe download authorization.
- Quote warranty summary and explicit shipping included/excluded/unspecified field.
- Manufacturer RFQ decline/dismiss, quote withdrawal, scheduled expiration, RFQ archive, and dedicated cancellation/withdrawal timestamps.
- Any payment, order, contract, email, e-signature, freight, customs, analytics, tracking, monitoring, or AI integration.

Migration 0025 is NOT AUTHORIZED and was NOT created. No production deployment was performed.
