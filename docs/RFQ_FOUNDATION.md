# PH-006A RFQ Foundation

PH-006A adds the Request For Quotation foundation for Buyer, Manufacturer, and Admin workflows.

## Scope

Included:

- Buyer RFQ draft creation from public marketplace product detail.
- Buyer RFQ submission.
- Buyer `My RFQs` dashboard.
- Manufacturer `RFQ Inbox` for submitted RFQs.
- Buyer and Manufacturer message thread foundation.
- Admin read-only RFQ management.
- Additive Supabase schema, RLS policies, and rollback-only SQL verification.

Deferred:

- Quote Builder.
- Payments.
- Purchase orders.
- Shipping.
- Escrow.
- Stripe, PayPal, and invoices.
- Favorites and compare.
- Email and notifications.
- Attachments.

## Database Model

`public.rfqs` stores the RFQ header:

- Buyer profile.
- Manufacturer application.
- Product.
- Lifecycle status.
- Quantity, currency, destination, target delivery date, and buyer message.

`public.rfq_messages` stores participant conversation messages.

`public.rfq_events` stores audit/timeline events only.

## Lifecycle

PH-006A supports these statuses:

- `draft`
- `submitted`
- `manufacturer_review`
- `quoted`
- `buyer_review`
- `accepted`
- `declined`
- `expired`
- `cancelled`

Buyer-facing transitions in PH-006A:

- `draft -> draft`
- `draft -> submitted`
- `draft -> cancelled`

Manufacturers can read assigned submitted RFQs and post messages. Quote creation and quote-state transitions are deferred to PH-006B.

Admins have full database access under RLS, but the PH-006A UI is read-only.

## Security Model

Buyer:

- Can create RFQs only for their own profile.
- Can read their own RFQs.
- Can update only draft RFQs.
- Cannot modify submitted RFQs.
- Can read/post messages only on RFQs they can access.

Manufacturer:

- Can read only RFQs assigned to manufacturers they own.
- Cannot modify Buyer RFQ fields.
- Can read/post messages only on assigned RFQs.
- Cannot create quotes in PH-006A.

Admin:

- Full database access through `public.is_admin()`.
- Read-only UI in PH-006A.

Anonymous:

- No direct RFQ, RFQ message, or RFQ event access.

## Application Flow

Marketplace product detail now has a `Request Quote` button. Buyer users can open the RFQ dialog, enter quantity, currency, destination country, destination port, target delivery date, and message, then save a draft or submit.

Buyer Portal shows `My RFQs` with status filters and a conversation thread.

Manufacturer Portal shows `RFQ Inbox` with submitted RFQs, Buyer name, product, quantity, country, submitted date, and message replies.

Admin Portal shows read-only RFQ management.

## Service Layer

RFQ data access lives in `src/lib/rfq.ts`.

Core methods:

- `createDraftRFQ()`
- `submitRFQ()`
- `fetchBuyerRFQs()`
- `fetchManufacturerRFQs()`
- `fetchRFQ()`
- `postRFQMessage()`
- `fetchRFQMessages()`
- `cancelDraftRFQ()`

UI components do not query Supabase directly for RFQ data.

## Verification

Rollback-only SQL verification lives in:

- `supabase/tests/rfq_security.sql`

Frontend helper tests live in:

- `src/lib/rfq.test.ts`
