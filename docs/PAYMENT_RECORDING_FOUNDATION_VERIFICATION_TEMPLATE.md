# PH-009B Payment Recording Verification Template

## Migration

- Migration: `0021_payment_recording_foundation.sql`
- Applied remotely: No, local-only until PR approval
- Remote migration baseline before PR merge: `0001` through `0020`

## Rollback SQL

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/payment_recording_foundation_security.sql
```

Expected:
- All checks pass.
- Transaction rolls back.
- No production data is manually modified.

Coverage:
- Issued invoice eligibility.
- Manufacturer-only creation.
- Source-field derivation.
- Payment number generation.
- Amount must be positive.
- Amount cannot exceed remaining balance.
- Draft and voided rows do not count.
- Multiple recorded rows count.
- Voided rows release balance.
- Record/void lifecycle events are trusted and non-duplicated.
- Direct table writes are denied.
- Buyer/Admin read behavior.
- Anonymous denial.
- Secret/payment metadata stripping.
- No processing, paid, settlement, refund, or reconciliation states.

## UI Verification

Manufacturer:
- Issued invoices with remaining balance are listed.
- Create payment record works.
- Draft can be edited and saved.
- Record Payment freezes the row.
- Recorded row can be voided with a reason.
- Recorded/voided rows are read-only.
- Copy states that no funds are transferred, processed, verified, settled, reconciled, or used to mark the invoice as paid.

Buyer:
- Payment records are read-only.
- Summary values are visible.
- No mutation controls appear.

Admin:
- All payment records are read-only.
- Snapshot metadata is visible.
- No mutation controls appear.

## Validation

Commands:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
npx.cmd supabase db query --linked --file supabase/tests/payment_recording_foundation_security.sql
```

Secret scan:
- No service-role keys.
- No API keys.
- No credentials.
- No tokens.
- No payment provider secrets.
- No card, bank, account, or routing numbers.

## Confirmations

- Migration `0021` remains local-only.
- Remote migrations remain `0001` through `0020`.
- Migrations `0001` through `0020` are unchanged.
- No deployment occurred.
- No merge occurred.
- No PH-009C work started.
