# PH-009A Invoice Foundation Verification Template

## Migration Status

- Branch:
- Migration file: `supabase/migrations/0020_invoice_foundation.sql`
- Remote migrations before merge/application:
- Confirm `0020` remains local-only:
- Confirm migrations `0001`-`0019` unchanged:

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/invoice_foundation_security.sql
```

Expected: all rollback-only checks pass and transaction rolls back.

Coverage:

- eligibility
- authorization
- invoice number generation
- source derivation
- line-item derivation
- amount formulas
- billing-address schema and issue-time completeness
- billing/date/amount validations
- issue/cancel lifecycle
- state-conditional concurrency protection
- immutability
- trusted events
- RLS
- no payment states

## Authenticated Smoke

Manufacturer:

- login:
- confirmed PO visible:
- accepted Contract linked:
- ready-to-send Signature Package linked:
- create Invoice:
- save draft:
- issue Invoice:
- cancel draft/issued Invoice:
- no payment/provider controls:

Buyer:

- login:
- read own Invoices:
- read line items/events:
- no mutation controls:
- no payment controls:

Admin:

- login:
- read all Invoices:
- read snapshots/events:
- no mutation controls:

## Browser Smoke

- Manufacturer Invoice Management:
- Buyer Invoice list:
- Admin Invoice Management:
- Browser console errors:
- Unsafe log matches:

## Validation

- `npm.cmd ci`:
- `npm.cmd run build`:
- `npm.cmd run test`:
- secret scan:
- working tree clean:
- no deployment:
- no merge:
- no PH-009B:

## Semantics Confirmation

- issued != sent:
- issued != received:
- issued != due:
- issued != paid:
- issued != settled:
- no payment gateway:
- no automatic tax:
- no invoice email/PDF:
- no shipping/customs work:
