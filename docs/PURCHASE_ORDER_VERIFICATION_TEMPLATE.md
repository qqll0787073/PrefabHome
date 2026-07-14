# PH-007A Purchase Order Verification Template

## Migration

- Migration file: `supabase/migrations/0014_purchase_order_foundation.sql`
- Remote migration status before merge: `0001` through `0013`
- Migration must remain local-only during PR review.

## Rollback SQL Verification

Run:

```bash
npx.cmd supabase db query --linked --file supabase/tests/purchase_order_security.sql
```

Expected: every returned row has `passed = true`.

Current expected count: 37 checks.

Coverage:

- Buyer creates PO from own accepted Quote
- Other Buyer denied
- Manufacturer creation denied
- Admin creation denied
- Anonymous denied
- non-accepted Quote denied
- RFQ/Quote status mismatch denied
- missing accepted decision denied
- duplicate PO denied
- PO number database-generated
- ownership fields database-derived
- decision/RFQ references database-derived
- snapshots database-derived
- Product snapshot reused from RFQ
- Quote items copied exactly
- subtotal matches copied items
- Buyer limited draft update allowed
- Buyer commercial/snapshot mutation denied
- PO items immutable
- Other Buyer update denied
- Manufacturer update denied
- Admin mutation denied
- submit own draft allowed
- submitted PO immutable
- duplicate submit denied
- cancel own draft allowed
- submitted cancel denied
- trusted `po_created`, `po_submitted`, and `po_cancelled` events
- direct event forgery denied
- Buyer read isolation
- assigned Manufacturer read
- other Manufacturer denied
- Admin read
- Anonymous read denied

## Frontend Verification

Run:

```bash
npm.cmd run build
npm.cmd run test
```

Expected helper coverage:

- Create PO button eligibility
- accepted Quote requirement
- duplicate PO hiding
- PO status labels
- draft validation
- Buyer reference and note limits
- requested delivery date validation
- PO item ordering
- subtotal rendering
- submitted/cancelled read-only mapping
- Manufacturer read-only mapping
- Admin read-only mapping
- submission confirmation content
- no Manufacturer confirmation controls in PH-007A

## Secret Scan

Run a repository scan excluding generated/vendor files. Expected matches should be limited to safe identifiers or documentation placeholders. No passwords, service-role keys, access tokens, refresh tokens, or full signed URLs should be present.

## Deferred Scope

Do not verify or implement:

- PH-007B Manufacturer confirmation
- contracts
- payments
- invoices
- shipping
- customs
- production milestones
- notifications
- PDF export
- deployment
