# PH-007B Manufacturer PO Confirmation Verification Template

## Migration

- Migration file: `supabase/migrations/0015_manufacturer_po_confirmation.sql`
- Remote migration status during PR review: `0001` through `0014`
- Migration `0015` must remain local-only until approved and merged.
- Migrations `0001` through `0014` must remain unchanged.

## Rollback SQL Verification

Run:

```bash
npx.cmd supabase db query --linked --file supabase/tests/purchase_order_confirmation_security.sql
```

Expected: every returned row has `passed = true`.

Current expected count: 48 checks.

Coverage:

- assigned Manufacturer opens submitted PO
- other Manufacturer denied
- Buyer open denied
- Admin impersonation denied
- Anonymous denied
- submitted -> manufacturer_review
- duplicate open per round deduped
- confirm assigned PO
- reject assigned PO
- request revision assigned PO
- reject reason required
- revision reason required
- other Manufacturer decision denied
- Buyer decision denied
- Admin decision denied
- Anonymous decision denied
- actor/manufacturer/round database-derived
- duplicate/concurrent same-round decision denied
- confirmed PO immutable
- rejected PO immutable
- revision-requested PO commercial fields immutable
- Buyer limited revision update allowed
- Buyer commercial/snapshot/item mutation denied
- other Buyer revision update denied
- Manufacturer revision update denied
- Admin revision update denied
- Buyer resubmit allowed
- resubmit increments review round
- `submitted_at` preserved
- `last_submitted_at` updated
- resubmit returns submitted
- `po_resubmitted` trusted event
- new round can receive a new decision
- previous decisions preserved
- trusted confirm and revision events
- direct event forgery denied
- direct decision forgery denied
- decision rows immutable and undeletable
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

- Open for Review visibility
- decision controls only in `manufacturer_review`
- confirm dialog content
- reject reason validation
- revision reason validation
- decision labels
- Buyer revision form visibility
- Buyer resubmit confirmation
- confirmed/rejected read-only mapping
- review round rendering
- decision history ordering
- Admin timeline mapping
- no contract/payment controls

## Secret Scan

Run a repository scan excluding generated/vendor files. Expected matches should be limited to safe identifiers or documentation placeholders. No passwords, service-role keys, access tokens, refresh tokens, or full signed URLs should be present.

## Deferred Scope

Do not verify or implement:

- contracts
- payments
- invoices
- shipping
- customs
- production milestones
- notifications
- PDF export
- electronic signatures
- deployment
