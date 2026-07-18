# Buyer User Guide

## Access

Register as `Buyer` or sign in with an invited Buyer account. If email confirmation is enabled in Supabase, confirm the email before signing in. The portal role comes from the database profile, not the role selected on the login screen.

## Browse Products

Use Browse to search, filter, sort, paginate, and open published Product details. Only approved public Product and Manufacturer fields are shown. Public images are served through short-lived signed URLs; private images and documents are never part of the public result.

If Supabase is unavailable, the marketplace shows an unavailable state. Static inventory appears only when the local-development flag `VITE_ENABLE_MARKETPLACE_DEMO=true` is explicitly enabled and is visibly identified as demo data.

## Request And Review A Quote

1. Open a Product and choose `Request Quote`.
2. Save an incomplete RFQ as a draft or complete the required fields and submit it.
3. Use `My RFQs` to view snapshots, timeline events, and messages.
4. When a Quote arrives, review every version, line item, subtotal, currency, Incoterm, lead time, validity date, and note.
5. Accept, reject, or request revision of the current submitted Quote. Decisions are read-only after submission.

Draft Manufacturer Quotes are not visible to Buyers. Opening each Quote version creates a trusted, version-specific audit event.

## Purchase Orders And Contracts

- Create one Purchase Order from an accepted Quote.
- Save a draft, submit it, or cancel the draft. Submitted/cancelled records are read-only.
- Respond to permitted Manufacturer revision requests and review lifecycle timestamps.
- Review the Contract generated from a confirmed Purchase Order. Accept, reject, or request revision only when the current lifecycle permits it.

Snapshots and line-item copies preserve the commercial basis of each downstream record.

## Invoices, Shipping, And Logistics

- View issued Invoices and externally recorded payment history. The app does not collect payment.
- View Shipping Readiness details prepared by the Manufacturer.
- View owned Logistics Booking Requests and participant-safe provider options, selection, estimated dates/cost, planning status, and timeline.

Provider contacts, internal quote references, Admin notes, actor IDs, and event metadata are not exposed to Buyer sessions. `Ready for external booking` is not a carrier booking confirmation.

## Troubleshooting

- Refresh after a lifecycle conflict; another participant may have changed the record.
- If an image expires, reopen/refresh the Product to obtain a new signed URL.
- If no Product appears, clear filters and confirm the marketplace is connected to Supabase.
- Report the visible record number, timestamp, action, and error message. Never send passwords, tokens, or full signed URLs.
