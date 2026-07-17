# PH-010A Shipping Readiness Verification Template

## Migration Status

- Branch:
- Migration file: `supabase/migrations/0022_shipping_readiness_foundation.sql`
- Remote migrations before test: `0001` through `0021`
- Confirmed `0022` local-only:
- Confirmed migrations `0001` through `0021` unchanged:

## SQL Verification

Command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/shipping_readiness_foundation_security.sql
```

Expected result:

- Rollback-only verification.
- All checks pass.
- No production data remains changed.

Record:

- SQL checks passed:
- SQL checks failed:
- Notes:

## Coverage Checklist

- Eligible confirmed PO with accepted Contract and issued Invoice can create one draft.
- Duplicate shipping readiness record is blocked.
- Draft permits partial origin/destination addresses.
- Address normalization trims fields, uppercases country code, and drops unsupported keys.
- Ready requires complete addresses, cargo description, package count, weight, volume, and future/current planning dates.
- Past dates and requested-before-estimated dates are denied by database current date logic.
- Draft can transition to `ready_for_logistics`.
- Draft or ready record can transition to `cancelled`.
- Repeated ready/cancel lifecycle calls are denied.
- Ready and cancelled records are immutable.
- Buyer can read own records but cannot mutate.
- Assigned Manufacturer can manage only own records.
- Other Manufacturer cannot read or mutate.
- Admin can read all but cannot mutate.
- Anonymous users cannot read.
- Events are trusted and immutable.
- Event metadata strips credentials, token-like fields, actor impersonation fields, and logistics provider fields.
- No booking, tracking, carrier, label, BOL, customs, tariff, insurance, or delivered lifecycle states are introduced.

## Frontend Validation

Commands:

```bash
npm.cmd ci
npm.cmd run build
npm.cmd run test
```

Record:

- Build result:
- Test count:
- Test result:
- Notes:

## Secret Scan

Command:

```bash
rg -n --hidden -S "(service_role|supabase_service|SECRET|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|api[_-]?key|anon[_-]?key|access_token|refresh_token|password\\s*[:=]|PREFAB_.*PASSWORD|eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}|provider_token|provider_secret|webhook_secret|carrier_credentials|carrier_token|tracking_token|customs_credentials)" -g "!node_modules/**" -g "!dist/**" -g "!.git/**" -g "!.env*" -g "!.tmp-*" -g "!*.tmp*"
```

Record:

- Secret scan result:
- False positives:

## Deployment Boundary

- No production deployment:
- No merge to `auth-profiles`:
- No PH-010B work:
- No logistics provider API, carrier booking, tracking, BOL, label, customs, tariff, insurance, or payment work:
