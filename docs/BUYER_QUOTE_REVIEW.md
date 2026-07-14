# PH-006C Buyer Quote Review

PH-006C adds secure Buyer decisions for the current submitted RFQ Quote. Purchase Orders, payment, contracts, invoices, shipping, and notifications remain deferred.

## Decision Lifecycle

Buyers may decide only on the current submitted Quote for their own RFQ.

- Accept Quote: Quote `submitted` -> `accepted`; RFQ `quoted` or `buyer_review` -> `accepted`
- Reject Quote: Quote `submitted` -> `rejected`; RFQ `quoted` or `buyer_review` -> `declined`
- Request Revision: Quote `submitted` -> `revision_requested`; RFQ `quoted` or `buyer_review` -> `revision_requested`

Decision rows are immutable and append-only. Each Quote can have at most one decision.

## Decision History Model

`public.rfq_quote_decisions` stores:

- `rfq_id`
- `quote_id`
- database-derived `buyer_id`
- `decision`
- optional `reason`
- database-managed `created_at`

The table is read-only to clients. Buyers can read decisions for their own RFQs, assigned Manufacturers can read decisions for their RFQs, and Admins can read all decisions.

## Trusted RPC Model

The only public authenticated decision RPCs are:

- `accept_rfq_quote(quote_uuid, reason_text default null)`
- `reject_rfq_quote(quote_uuid, reason_text default null)`
- `request_rfq_quote_revision(quote_uuid, reason_text)`

All decision RPCs are `SECURITY DEFINER`, use a fixed `search_path`, derive actor fields from `auth.uid()`, lock the Quote and RFQ, update statuses atomically, and create trusted RFQ events.

Internal helpers, triggers, and trusted write helpers are not executable by `PUBLIC`, `anon`, or ordinary `authenticated` clients.

## Revision Request Integration

Manufacturers can create a revision draft only after the Buyer requests a revision:

- source Quote status must be `revision_requested`
- RFQ status must be `revision_requested`
- revision draft copies Quote metadata and line items
- submitting the revision moves RFQ `revision_requested` -> `quoted`
- previous decision history remains attached to the prior Quote

Voluntary revisions from the current submitted Quote are intentionally blocked in PH-006C.

## Event Ownership

Trusted decision events are:

- `quote_accepted`
- `quote_rejected`
- `quote_revision_requested`

Only the buyer decision RPCs may generate these events. Actor identity is database-derived from `auth.uid()`, and impersonation metadata keys are stripped by the trusted event helper.

## Buyer Opened Flow

When a Buyer opens the current submitted Quote, `record_rfq_quote_opened(quote_uuid)` derives the RFQ, Buyer, Quote ID, and version in the database. It may move RFQ `quoted` -> `buyer_review` and records `buyer_opened` with safe metadata:

- `quote_id`
- `version`

Buyer opened events are deduplicated per actor and Quote ID, not permanently per RFQ. A revision Quote therefore gets its own `buyer_opened` audit event after it is submitted and the RFQ returns to `quoted`.

The older RFQ-level opened flow is Manufacturer-only:

- `record_rfq_opened(rfq_uuid)` creates and deduplicates `manufacturer_opened`
- it does not move RFQ status
- it rejects Buyer callers and tells them to use `record_rfq_quote_opened(quote_uuid)`
- it rejects Admin impersonation
- it never creates `buyer_opened`

Buyer quote-opened auditing must use `record_rfq_quote_opened(quote_uuid)`.

## RLS

`rfq_quote_decisions` permits only participant/Admin reads. Direct insert, update, and delete are not granted to clients and are also protected by trigger-level checks.

Quote and RFQ status changes for buyer decisions are allowed only through trusted RPCs. Direct client table writes cannot accept, reject, or request revision.

## UI

Buyer RFQ detail shows actions only for the current submitted Quote:

- Accept Quote
- Reject Quote
- Request Revision

After a decision, the latest decided Quote result is rendered read-only with:

- decision label
- Quote version
- reason, when present
- decision timestamp

If a newer current submitted Quote exists, old decisions do not hide the new decision actions. Old Quote versions, draft Quotes, superseded Quotes, and already-decided Quotes expose no decision actions.

Manufacturer and Admin views show decision history read-only. Manufacturers see `Create Revision` only when the Buyer requested a revision.
