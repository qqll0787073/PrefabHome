# PH-008A Contract Verification Template

## Scope

Verify PH-008A Contract Foundation only. Do not apply migration 0016 remotely until the PR is approved and merged. Do not deploy or begin PH-008B work.

Excluded from PH-008A:

- Electronic signatures
- PDF generation
- DocuSign or Adobe Sign
- Payments
- Invoices
- Shipping
- Customs
- Production milestones
- Notifications
- Workflow automation

## Migration Status

- Local migration: `0016_contract_foundation.sql`
- Expected remote migrations during PR review: `0001` through `0015`
- Expected local-only migration during PR review: `0016`

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase\tests\contract_security.sql
```

Expected:

- Rollback-only
- All checks pass
- No production data is modified

Checks should cover:

- Buyer can create a draft contract from a confirmed PO.
- Non-confirmed PO contract creation is denied.
- Duplicate contract creation for the same PO is denied.
- Contract number format is `CON-YYYY-NNNNNN`.
- Buyer, Manufacturer, Quote, PO, Product, and line-item snapshots are captured.
- Contract snapshots remain unchanged after source data changes.
- Buyer can update draft contract fields.
- Buyer can mark draft contract ready.
- Ready contracts are immutable.
- Manufacturer cannot update contracts.
- Assigned Manufacturer can read contracts.
- Other Manufacturer cannot read contracts.
- Other Buyer cannot read contracts.
- Admin can read contracts.
- Admin cannot mark contracts ready.
- Anonymous user cannot read contracts.
- Direct contract table writes are denied.
- Direct contract event forgery is denied.
- Trusted contract update event is created.

## Frontend Verification

Buyer Portal:

- Confirmed PO without an existing contract shows Create Contract.
- Contract draft can be opened.
- Draft title, governing law, and terms can be edited.
- Draft can be marked ready.
- Ready contract renders read-only.

Manufacturer Portal:

- Assigned contracts are visible.
- Contract events are visible.
- No mutation controls are exposed.

Admin Portal:

- All contracts are visible.
- Events and snapshot identifiers are visible.
- No mutation controls are exposed.

## Validation Commands

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
npx.cmd supabase db query --linked --file supabase\tests\contract_security.sql
```

Run a secret scan and confirm no credentials, tokens, service-role keys, or signed URLs were committed.

## Final Confirmation

- Migration `0016` remains local-only.
- Remote migrations remain `0001` through `0015`.
- Migrations `0001` through `0015` are unchanged.
- No deployment occurred.
- No merge occurred.
- No PH-008B work occurred.
