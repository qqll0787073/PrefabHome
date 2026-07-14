# PH-007A Purchase Order Foundation

## Lifecycle

Purchase Orders use a narrow lifecycle:

- `draft`: Buyer-created from an accepted Quote. Buyer may update only reference, note, and requested delivery date.
- `submitted`: Buyer-submitted and read-only.
- `cancelled`: Buyer-cancelled draft retained for audit.

Submitted and cancelled rows are immutable in PH-007A.

## Accepted Quote Authority

Purchase Orders can be created only through `create_purchase_order_from_quote(quote_uuid)`.

The database verifies:

- caller is the RFQ Buyer
- Quote status is `accepted`
- RFQ status is `accepted`
- accepted decision exists for that exact Quote
- no PO already exists for that Quote

The client cannot supply participant IDs, status, pricing, snapshots, PO number, items, or events.

## PO Number Generation

PO numbers are generated in the database with `public.purchase_order_number_seq`.

Format:

```text
PO-YYYY-NNNNNN
```

The implementation does not use `max(po_number) + 1`.

## Snapshot Model

`purchase_orders` stores immutable snapshots:

- `quote_snapshot`: accepted Quote version and commercial terms
- `buyer_snapshot`: business-relevant Buyer profile fields
- `manufacturer_snapshot`: business-relevant Manufacturer display fields
- `product_snapshot`: copied from the RFQ product snapshot, not current live product data

No authentication secrets, tokens, private metadata, or service-role data are included.

## Immutable Line Items

`purchase_order_items` are copied from accepted Quote items at creation time.

Ordinary client insert, update, and delete paths are denied. Items remain immutable through PH-007A.

## Trusted RPC Model

Authenticated public RPCs:

- `create_purchase_order_from_quote(quote_uuid uuid)`
- `update_purchase_order_draft(po_uuid uuid, buyer_reference_text text, buyer_note_text text, requested_delivery_date_value date)`
- `submit_purchase_order(po_uuid uuid)`
- `cancel_purchase_order_draft(po_uuid uuid)`

Internal helpers and trigger functions have EXECUTE revoked from `public`, `anon`, and `authenticated`.

## RLS

Buyer:

- read own POs, items, and events
- lifecycle writes only through trusted RPCs

Manufacturer:

- read assigned Manufacturer POs, items, and events
- no mutations in PH-007A

Admin:

- read all POs, items, and events
- ordinary table paths remain read-only

Anonymous:

- no access

## Deferred PH-007B

The following are intentionally deferred:

- Manufacturer PO confirmation
- contracts
- payments
- invoices
- shipping
- customs
- production milestones
- notifications
- PDF export
