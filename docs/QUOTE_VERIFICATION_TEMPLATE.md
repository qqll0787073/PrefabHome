# PH-006B Quote Builder Verification Template

Use this template before applying migration `0012_quote_builder.sql` remotely.

## Migration Status

- Branch:
- Commit:
- Linked Supabase project ref:
- Confirm remote migrations remain `0001` through `0011`:
- Confirm `0012_quote_builder.sql` is local-only:
- Confirm migrations `0001` through `0011` are unchanged:

## Rollback-Only SQL Verification

Run the quote security checks in a rollback-only transaction against a disposable database or a linked database session where `0012_quote_builder.sql` is included in the same transaction and rolled back.

Verification file:

```bash
npx.cmd supabase db query --linked --file supabase/tests/quote_security.sql
```

Expected checks:

- Manufacturer own quote read
- Other Manufacturer read denied
- Buyer own submitted quote read
- Buyer draft quote hidden
- Other Buyer read denied
- Anonymous denied
- Admin read all quotes
- Ownership fields database-derived
- Version database-derived
- Amount database-derived
- Subtotal database-derived
- Submitted quote immutable
- Submitted quote items immutable
- Draft edit allowed
- Other Manufacturer draft edit denied
- Direct `quote_created` event denied
- Trusted submission creates `quote_created`
- Trusted submission moves RFQ `manufacturer_review -> quoted`
- Empty quote submission denied
- Invalid currency denied
- Invalid Incoterm denied
- Invalid quantity denied
- Revision creates version + 1
- Revision copies line items
- Revision submission succeeds while RFQ is quoted
- Previous quote is superseded on revision submission
- RFQ remains quoted after revision submission
- New trusted `quote_created` event is created for the revision
- Only one submitted/current quote remains per RFQ
- Duplicate revision submit is denied
- Other Manufacturer quote submission is denied
- Empty revision submission is denied
- Direct subtotal helper invocation is denied
- Direct trusted/internal helper invocation is denied
- Normal item trigger recalculation still works
- Duplicate submit blocked

## Manufacturer Smoke

- Sign in as approved Manufacturer.
- Open RFQ Inbox.
- Open a submitted or manufacturer-review RFQ.
- Create quote draft.
- Save quote metadata.
- Add product line item.
- Add freight or other line item.
- Confirm subtotal display.
- Submit quote.
- Confirm quote becomes read-only.
- Confirm RFQ moves to `quoted`.
- Confirm timeline shows trusted quote-created event.
- Create revision from submitted quote.
- Confirm new draft version copies line items.

## Buyer Smoke

- Sign in as Buyer who owns the RFQ.
- Open My RFQs.
- Confirm Quote Received indicator.
- Open RFQ conversation.
- Confirm submitted quote version is visible.
- Confirm line items, subtotal, Incoterm, lead times, validity, note, and submission time are visible.
- Confirm draft quote versions are not visible.
- Confirm no accept, reject, revision-request, payment, purchase order, invoice, or shipping controls are visible.

## Admin Smoke

- Sign in as Admin.
- Open RFQ Management.
- Select RFQ with submitted quote.
- Confirm all quote versions and line items are readable.
- Confirm Admin UI is read-only for quotes in PH-006B.
- Confirm no lifecycle mutation controls are visible.

## Frontend Validation

Run:

```bash
npm ci
npm run build
npm run test
```

Expected:

- TypeScript build passes.
- Unit tests pass.
- Quote helper tests cover validation, subtotal display, status labels, version ordering, visibility mapping, draft flow helpers, submitted rendering helpers, and revision mapping.

## Secret Scan

Run a repository secret scan before pushing.

Confirm:

- no service-role key appears in frontend code
- no passwords, access tokens, refresh tokens, or signed URL query tokens are committed
- `.env.local` and `.env.smoke.local` remain ignored

## Deployment Boundary

Confirm:

- no production deployment occurred
- no merge occurred
- PH-006C was not started
