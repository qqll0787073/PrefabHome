# PH-009A Invoice Foundation

PH-009A adds invoice preparation for confirmed Purchase Orders that already have an accepted Contract and a ready-to-send Signature Package.

## Scope Boundaries

An issued invoice is frozen content only.

- issued != sent
- issued != received
- issued != due
- issued != paid
- issued != settled

PH-009A does not implement payment processing, payment links, invoice email delivery, PDF generation, refunds, credit memos, accounting integrations, automatic tax calculation, shipping, customs, or fulfillment.

## Tables

- `public.invoices`: immutable source snapshots, billing fields, manually entered tax/shipping/discount fields, database-calculated totals, lifecycle timestamps, and source references.
- `public.invoice_line_items`: database-derived immutable copy of confirmed Purchase Order items.
- `public.invoice_events`: trusted append-only invoice audit events.

Invoice numbers are database-generated as `INV-YYYY-NNNNNN`.

## Eligibility

`create_invoice_from_purchase_order(po_uuid)` requires:

- authenticated Manufacturer caller
- caller owns the assigned Manufacturer profile
- Purchase Order status is `confirmed`
- accepted Contract exists for the Purchase Order
- ready-to-send Signature Package exists for the Contract
- no existing Invoice exists for the Purchase Order
- Purchase Order line items reconcile to the PO subtotal

## Amounts

Subtotal is copied from the confirmed Purchase Order. The Manufacturer may prepare draft values for:

- tax amount
- shipping amount
- discount amount

The database calculates:

`subtotal + tax_amount + shipping_amount - discount_amount = total_amount`

All amounts must be non-negative, and discount cannot exceed subtotal plus tax plus shipping. Tax is manually entered for preparation only; there is no automatic tax determination.

## Trusted RPCs

- `create_invoice_from_purchase_order`
- `update_invoice_draft`
- `issue_invoice`
- `cancel_invoice`

Direct table mutations are blocked by triggers and grants. Issue and cancel lock the invoice row and use state-conditional updates to prevent duplicate lifecycle events under concurrent calls.

## Lifecycle

- `draft`: editable by assigned Manufacturer through `update_invoice_draft`; no `issued_at` or `cancelled_at`
- `issued`: frozen invoice contents; `issued_at` is database-generated; not sent and not paid
- `cancelled`: terminal; `cancelled_at` and reason are database-managed

## RLS

- Manufacturer: read assigned invoices, line items, and events; mutate only through trusted RPCs
- Buyer: read own invoices, line items, and events
- Admin: read all only
- Anonymous: no access

## UI

- Manufacturer Invoice Management: create from eligible PO, edit draft billing/amount prep fields, issue, cancel
- Buyer Invoices: read-only, shows no-payment notice
- Admin Invoice Management: read-only, shows snapshots and events

No Pay Now, payment link, paid/overdue/refund, invoice-sent, shipping, customs, or provider controls are exposed.
