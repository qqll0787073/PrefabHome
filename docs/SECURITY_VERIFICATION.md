# Security Verification

Branch: `auth-profiles`

Verification date: 2026-07-10

Supabase project ref: `eoyrfrjbjglfudfuwxdf`

## Migration Application

Applied through the normal Supabase CLI migration flow:

- `0004_security_hardening.sql`
- `0005_authenticated_api_grants.sql`

`0005_authenticated_api_grants.sql` was added during verification because the rollback-only e2e checks showed that the `authenticated` role did not have base table privileges for `public.profiles`. RLS policies still remain the authorization boundary.

No destructive migrations were run.

## Verification Method

Security checks were executed with:

```bash
npx.cmd supabase db query --linked --file supabase/tests/security_verification.sql
```

The script runs inside a transaction and ends with `rollback`, so test users and test profile mutations are not persisted.

## Results

| Check | Result | Detail |
| --- | --- | --- |
| signup as buyer creates role=buyer | Passed | actual role: buyer |
| signup as manufacturer creates role=manufacturer | Passed | actual role: manufacturer |
| signup metadata role=admin does not create an admin | Passed | actual role: buyer |
| buyer cannot update own role | Passed | blocked by trigger/RLS |
| manufacturer cannot update own status | Passed | blocked by trigger/RLS |
| normal profile fields can still be updated | Passed | full_name after update: Audit Buyer Updated |
| legitimate admin update remains possible | Passed | role/status after admin update: manufacturer/suspended |

## Local Commands

```bash
npm ci
npm run build
npm run test
```

All commands passed.

`npm run lint --if-present` was not required in this step and no lint script is currently configured.

## Notes

- `.env.local` remains ignored and was not committed.
- No service-role key was added to the frontend or repository.
- No production data was modified or deleted by the verification script.
