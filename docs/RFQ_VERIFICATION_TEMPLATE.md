# PH-006A RFQ Verification Template

Date:

Branch:

Commit:

Migration:

- `supabase/migrations/0011_rfq_foundation.sql`

Deployment status:

- Not deployed.

## Migration Review

Confirm:

- Migration `0011` is additive.
- Migrations `0001` through `0010` are unchanged.
- Tables exist:
  - `public.rfqs`
  - `public.rfq_messages`
  - `public.rfq_events`
- RLS is enabled on all new tables.
- Anonymous access is not granted.

## SQL Security Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/rfq_security.sql
```

Expected checks:

- Buyer own read.
- Buyer other read blocked.
- Manufacturer own read.
- Manufacturer other read blocked.
- Anonymous blocked.
- Draft update allowed.
- Submitted update denied.
- Message visibility.
- Event visibility.
- Admin full access.

Result:

## Frontend Verification

Run:

```powershell
npm ci
npm run build
npm run test
```

Expected:

- Build passes.
- Tests pass.
- RFQ helper tests pass.

## Buyer Smoke

Confirm:

- Buyer can open Request Quote from product detail.
- Quantity is required.
- Destination country is required.
- Message length validation works.
- Save Draft creates an RFQ.
- Submit RFQ submits an RFQ.
- Buyer `My RFQs` shows draft/submitted RFQs.
- Buyer can open conversation and post a message.

## Manufacturer Smoke

Confirm:

- Manufacturer `RFQ Inbox` loads.
- Submitted RFQs assigned to own manufacturer appear.
- Other manufacturers' RFQs do not appear.
- Manufacturer can open RFQ.
- Manufacturer can read Buyer message.
- Manufacturer can post reply.
- Quote creation is not present.

## Admin Smoke

Confirm:

- Admin RFQ Management loads.
- Admin can view all RFQs.
- Admin UI is read-only in PH-006A.

## Deferred Work

Confirm not implemented:

- Quote Builder.
- Payment.
- Purchase orders.
- Shipping.
- Escrow.
- Stripe.
- PayPal.
- Invoice.
- Favorites.
- Compare.

## Safety

Confirm:

- No service-role key in frontend code.
- No credentials committed.
- No production deployment occurred.
- No merge occurred.
