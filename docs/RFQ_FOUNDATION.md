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
- Additive Supabase schema, RLS policies, trigger protections, and rollback-only SQL verification.

Deferred:

- Quote Builder and quote line items.
- Payments, escrow, purchase orders, invoices, Stripe, and PayPal.
- Shipping workflow and customs document workflow.
- Email and notifications.
- Message attachments.
- PH-006B workflow expansion.

## Database Model

`public.rfqs` stores the RFQ header:

- Buyer profile.
- Manufacturer application.
- Product reference.
- Immutable `product_snapshot` JSONB.
- Lifecycle status.
- Quantity, currency, optional Incoterm, destination, target delivery date, and buyer message.

`product_snapshot` is created by the database on RFQ insert from public-safe product and manufacturer fields:

- Product model/name/category.
- Bedrooms, bathrooms, and floor area.
- Currency and FOB price.
- Manufacturer display name and country.

The snapshot is intentionally immutable after insert so later product catalog edits do not rewrite the historical RFQ context.

`public.rfq_messages` stores participant conversation messages. The client does not decide `sender_role`; the database derives it from the authenticated caller as `buyer`, `manufacturer`, or `admin`.

`public.rfq_events` stores audit/timeline events only. Event rows are ordered by `created_at ASC` in service queries and timeline helpers.

## Lifecycle Matrix

Allowed transitions:

| From | To |
| --- | --- |
| `draft` | `submitted`, `cancelled` |
| `submitted` | `manufacturer_review`, `cancelled`, `expired` |
| `manufacturer_review` | `quoted`, `expired` |
| `quoted` | `buyer_review`, `expired` |
| `buyer_review` | `accepted`, `declined`, `expired` |

Same-status updates are allowed only where the caller is otherwise authorized.

Terminal statuses:

- `accepted`
- `declined`
- `expired`
- `cancelled`

Invalid direct jumps such as `draft -> accepted`, `submitted -> accepted`, and `accepted -> draft` are rejected by `public.protect_rfq_write()`, including for admins.

## Draft And Cancellation Rules

- Buyers can save incomplete RFQ drafts through the UI validation path currently provided.
- Buyers can submit draft RFQs.
- Buyers can delete draft RFQs.
- Buyers can cancel submitted RFQs without editing buyer RFQ data.
- Buyers cannot edit submitted RFQ fields.
- Manufacturers cannot change buyer RFQ data.

## Field Model

Quantity:

- Stored as `numeric(12,2)`.
- Must be greater than zero.
- Fractional quantity is allowed for flexible unit/package models.

Currency:

- Stored as a three-letter uppercase ISO-style code.
- Lowercase input is normalized by the trigger.

Incoterm:

- Nullable.
- Supported values are `FOB`, `CIF`, `EXW`, `DDP`, and `DAP`.
- Empty input is normalized to `null`.

Event types:

- `draft_created`
- `submitted`
- `manufacturer_opened`
- `manufacturer_replied`
- `quote_created`
- `buyer_opened`
- `accepted`
- `declined`
- `cancelled`
- `expired`

## Dashboard Grouping

Buyer grouping:

- `draft`: `draft`
- `submitted`: `submitted`
- `manufacturer_review`: `waiting_manufacturer`
- `quoted`, `buyer_review`: `waiting_buyer`
- `accepted`, `declined`, `expired`, `cancelled`: `closed`

Manufacturer grouping:

- `submitted`: `new`
- `manufacturer_review`: `waiting_reply`
- `quoted`, `buyer_review`: `quoted`
- `accepted`, `declined`, `expired`, `cancelled`, `draft`: `closed`

The current UI preserves the existing visual style while using these helper functions in service/UI logic and tests.

## Security Model

Buyer:

- Can create RFQs only for their own profile.
- Can read their own RFQs.
- Can update only draft RFQ fields.
- Can delete only their own draft RFQs.
- Can cancel submitted RFQs without mutating RFQ details.
- Cannot modify participant, product, snapshot, message sender-role, or review-only fields.
- Can read/post messages only on RFQs they can access.

Manufacturer:

- Can read only RFQs assigned to manufacturers they own.
- Can move assigned `submitted` RFQs to `manufacturer_review`.
- Cannot modify buyer RFQ fields.
- Can read/post messages only on assigned RFQs.
- Cannot create quotes in PH-006A.

Admin:

- Can read RFQs, messages, and events through `public.is_admin()`.
- Can perform only lifecycle transitions allowed by the transition matrix.
- PH-006A Admin UI remains read-only.

Anonymous:

- No direct RFQ, RFQ message, or RFQ event access.

## Application Flow

Marketplace product detail has a `Request Quote` button. Buyer users can open the RFQ dialog, enter quantity, currency, optional Incoterm, destination country, destination port, target delivery date, and message, then save a draft or submit.

Buyer Portal shows `My RFQs` with status filters and a conversation thread.

Manufacturer Portal shows `RFQ Inbox` for newly submitted RFQs assigned to the signed-in manufacturer's approved application. Quote creation and quote status movement are deferred to PH-006B.

Admin Portal shows read-only RFQ management.

## Service Layer

RFQ data access lives in `src/lib/rfq.ts`.

Core methods:

- `createDraftRFQ()`
- `submitRFQ()`
- `fetchBuyerRFQs()`
- `fetchManufacturerRFQs()`
- `fetchAdminRFQs()`
- `fetchRFQ()`
- `postRFQMessage()`
- `fetchRFQMessages()`
- `fetchRFQEvents()`
- `cancelDraftRFQ()`
- `deleteDraftRFQ()`

UI components do not query Supabase directly for RFQ data.

## Verification

Rollback-only SQL verification lives in:

- `supabase/tests/rfq_security.sql`

Frontend helper tests live in:

- `src/lib/rfq.test.ts`

Migration `0011_rfq_foundation.sql` must remain local-only until the PR is approved.
