# PH-006C Buyer Quote Review Verification Template

## Migration

- Migration file: `supabase/migrations/0013_buyer_quote_review.sql`
- Remote migration status before merge: `0001` through `0012` only
- Migration application during PR review: local or rollback-only verification only

## SQL Verification

Run rollback-only verification:

```bash
npx.cmd supabase db query --linked --file supabase/tests/quote_decision_security.sql
```

Expected result: every row returns `passed = true`. Current expected count: 49 checks.

Required checks include:

- Buyer accepts own current submitted Quote
- Buyer rejects own current submitted Quote
- Buyer requests revision on own current submitted Quote
- Other Buyer denied
- Manufacturer decision denied
- Admin direct decision denied
- Anonymous denied
- draft Quote decision denied
- superseded Quote decision denied
- duplicate decision denied
- buyer_id and rfq_id database-derived
- reason trimming and length enforcement
- revision request reason required
- accepted, rejected, and revision-requested Quotes immutable
- RFQ accepted, declined, and revision-requested transitions
- trusted quote decision events
- direct event forgery denied
- decision rows immutable and undeletable
- Buyer read isolation
- Manufacturer assigned read
- other Manufacturer denied
- Admin read
- revision draft allowed only after revision request
- voluntary revision from current submitted Quote denied
- revision submission moves RFQ `revision_requested` -> `quoted`
- previous decision history preserved
- only one current submitted Quote
- first open of Quote v1 creates `buyer_opened`
- repeated open of Quote v1 does not duplicate
- revision Quote v2 submission returns RFQ to `quoted`
- first open of Quote v2 creates another `buyer_opened`
- repeated open of Quote v2 does not duplicate
- opened events contain the correct `quote_id` and `version`
- each `quoted` -> `buyer_review` transition has a corresponding audit event
- other Buyer, Manufacturer-as-Buyer, Admin impersonation, and Anonymous quote-opened calls are denied

## Frontend Verification

Run:

```bash
npm.cmd run build
npm.cmd run test
```

Expected:

- Buyer decision button visibility is covered by helper tests
- accepted/rejected/revision-requested labels render from shared helpers
- accepted remains visible after the submitted Quote disappears
- rejected remains visible after the submitted Quote disappears
- revision requested and reason remain visible after the submitted Quote disappears
- latest Quote decision wins over older decision history
- old decisions do not hide actions for a newer current submitted Quote
- revision reason is required
- reason length is enforced
- confirmation content includes Quote version, currency, and subtotal
- only the current submitted Quote exposes decision actions
- old version actions are hidden
- Manufacturer Create Revision visibility requires Buyer revision request
- Admin negotiation history mapping is read-only
- decision ordering is chronological

## Secret Scan

Run a repository scan excluding generated/vendor files. Expected matches should be limited to documentation placeholders or safe environment variable names. No passwords, tokens, service-role keys, or full signed URLs should be present.

## Deferred Scope

Do not verify or implement:

- Purchase Orders
- payment
- contracts
- invoices
- shipping
- notifications
- PH-006C deployment
