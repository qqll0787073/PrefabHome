# PH-009B Payment Recording Foundation

PH-009B adds manual external payment records for issued invoices. It does not process money, verify bank activity, settle funds, reconcile accounting, issue refunds, create payment links, or mark invoices as paid.

## Database

Migration: `supabase/migrations/0021_payment_recording_foundation.sql`

Tables:
- `public.payment_records`: immutable source-derived payment record rows with lifecycle fields.
- `public.payment_events`: trusted audit events for payment record creation, draft updates, recording, and voiding.

Payment numbers use the database-managed format `PAY-YYYY-NNNNNN`.

Allowed statuses:
- `draft`
- `recorded`
- `voided`

Allowed methods:
- `bank_transfer`
- `wire`
- `check`
- `cash`
- `other`

## Eligibility

A Manufacturer may create a payment record only for an issued invoice assigned to their manufacturer profile. The database derives invoice, contract, purchase order, buyer, manufacturer, currency, and snapshots from the invoice.

Draft and voided payments do not count toward the invoice payment summary. Only `recorded` rows count.

## Summary

`public.get_invoice_payment_summary(invoice_uuid uuid)` returns:
- `invoice_total`
- `recorded_amount`
- `remaining_balance`
- `recorded_payment_count`

The summary is database-authoritative and calculated from issued invoice total minus recorded payment rows. It never updates invoice status to paid or partially paid.

## Trusted RPCs

- `create_payment_record(invoice_uuid, amount_value, payment_method_value)`
- `update_payment_record_draft(payment_uuid, amount_value, payment_method_value, payment_date_value, reference_number_text, notes_text)`
- `record_payment(payment_uuid)`
- `void_payment_record(payment_uuid, reason_text)`

Direct table writes are denied. Trusted RPCs set a transaction-local guard for writes and generate audit events.

## Lifecycle

`draft -> recorded`
- Locks the invoice and payment row.
- Rechecks status and balance.
- Sets `recorded_at`.
- Inserts one `payment_recorded` event.

`recorded -> voided`
- Locks the payment row.
- Rechecks status.
- Sets `voided_at` and `void_reason`.
- Inserts one `payment_record_voided` event.

Repeated or stale lifecycle calls fail without producing duplicate events.

## Security

RLS rules:
- Manufacturer can read assigned records and mutate only through trusted RPCs.
- Buyer can read own records, events, and summaries.
- Admin can read all records and events.
- Anonymous users have no access.

Audit metadata is stripped of impersonation keys, provider secrets, payment tokens, access tokens, refresh tokens, webhook secrets, card numbers, account numbers, and routing numbers.

## UI

Manufacturer UI supports:
- Create payment record for issued invoices with remaining balance.
- Edit draft fields.
- Save draft.
- Record payment.
- Void recorded entries.

Buyer and Admin UI is read-only.

Every role sees clear copy that payment records are manual external records only and do not transfer, process, verify, settle, reconcile, or mark the invoice as paid.
