# PH-007B Manufacturer PO Confirmation

## Scope

PH-007B adds manufacturer review for submitted Purchase Orders.

Deferred:

- contracts
- payments
- invoices
- shipping
- customs
- production milestones
- notifications
- PDF export
- electronic signatures

## Lifecycle

Purchase Order statuses:

- `draft`: Buyer-created from an accepted Quote.
- `submitted`: Buyer submitted the PO for manufacturer review.
- `manufacturer_review`: assigned Manufacturer opened the PO.
- `revision_requested`: assigned Manufacturer requested non-commercial Buyer edits.
- `confirmed`: assigned Manufacturer confirmed the PO.
- `rejected`: assigned Manufacturer rejected the PO.
- `cancelled`: Buyer cancelled a draft PO.

Confirmed, rejected, and cancelled rows are terminal in PH-007B.

## Review Rounds

`review_round` starts at `0`.

First submit:

- `review_round = 1`
- `submitted_at` is set once
- `last_submitted_at = submitted_at`

Revision request:

- `review_round` does not change

Resubmit after revision request:

- `review_round` increments
- `submitted_at` remains the original first-submission timestamp
- `last_submitted_at` updates

## Manufacturer Decisions

Decision table: `public.purchase_order_decisions`

Decision values:

- `confirmed`
- `rejected`
- `revision_requested`

Decision rows are immutable and undeletable. The database derives:

- manufacturer
- actor profile
- review round
- timestamp

Only one decision is allowed per PO review round.

## Trusted RPCs

Manufacturer:

- `record_purchase_order_opened(po_uuid uuid)`
- `confirm_purchase_order(po_uuid uuid, reason_text text default null)`
- `reject_purchase_order(po_uuid uuid, reason_text text)`
- `request_purchase_order_revision(po_uuid uuid, reason_text text)`

Buyer:

- `update_purchase_order_revision(po_uuid uuid, buyer_reference_text text, buyer_note_text text, requested_delivery_date_value date)`
- `resubmit_purchase_order(po_uuid uuid)`

Existing PH-007A RPCs remain:

- `create_purchase_order_from_quote(quote_uuid uuid)`
- `update_purchase_order_draft(po_uuid uuid, buyer_reference_text text, buyer_note_text text, requested_delivery_date_value date)`
- `submit_purchase_order(po_uuid uuid)`
- `cancel_purchase_order_draft(po_uuid uuid)`

## Buyer Revision Scope

When a PO is `revision_requested`, the Buyer may update only:

- Buyer reference
- Buyer note
- requested delivery date

Commercial terms, snapshots, PO number, ownership, decisions, events, and line items remain database-protected.

## Event Model

New trusted events:

- `po_manufacturer_opened`
- `po_confirmed`
- `po_rejected`
- `po_revision_requested`
- `po_resubmitted`

Event metadata safely includes:

- `review_round`
- `decision_id`, when applicable
- `po_number`

Impersonation keys are stripped by the trusted event helper.

## RLS

Buyer:

- read own PO decisions and events
- update revision fields and resubmit only through trusted RPCs

Manufacturer:

- read assigned PO decisions and events
- open, confirm, reject, or request revision only through trusted RPCs

Admin:

- read all POs, decisions, items, snapshots, and events
- no mutation or impersonation path

Anonymous:

- no access

Direct client insert, update, and delete grants are not provided for decisions or events.
