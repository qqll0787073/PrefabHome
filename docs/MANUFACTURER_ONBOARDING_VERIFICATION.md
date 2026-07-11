# Manufacturer Onboarding Verification

Branch: `auth-profiles`

Verification date: 2026-07-11

Linked Supabase project ref: `eoyrfrjbjglfudfuwxdf`

## Migration Application

Applied through the normal linked Supabase CLI migration flow:

```bash
npx.cmd supabase db push --yes
```

Migration applied:

- `0006_manufacturer_onboarding.sql`

Result:

- Connected to the linked remote database.
- Applied `0006_manufacturer_onboarding.sql`.
- Completed with `Finished supabase db push.`
- No data deletion commands were run.

Supabase emitted expected notices that the new triggers did not previously exist and were skipped during drop-before-create setup.

## Security Verification

Executed rollback-only verification against the linked Supabase project:

```bash
npx.cmd supabase db query --linked --file supabase/tests/manufacturer_onboarding_security.sql
```

The script ends with `rollback`, so verification users, applications, products, and mutations are not persisted.

| Check | Result | Detail |
| --- | --- | --- |
| admin can edit approved and suspended applications | Passed | approved city: Admin Approved Edit, suspended city: Admin Suspended Edit |
| admin can review all applications | Passed | visible applications before review: 1 |
| anonymous user cannot access private applications | Passed | blocked by permissions/RLS |
| approved manufacturer cannot edit its application | Passed | blocked while approved |
| approved manufacturer status is enforced before product creation | Passed | blocked before approval: true, product after approval created |
| duplicate manufacturer application is blocked by unique constraint | Passed | duplicate blocked |
| existing draft can be submitted | Passed | submitted_at populated |
| incomplete draft can be saved | Passed | status: draft |
| insert policy does not recurse | Passed | no recursive NOT EXISTS found |
| manufacturer can access only own application | Passed | other manufacturer visible applications: 0 |
| manufacturer cannot edit submitted application | Passed | blocked while submitted |
| manufacturer cannot edit under_review application | Passed | blocked while under_review |
| manufacturer cannot self-approve | Passed | blocked by trigger/RLS |
| manufacturer cannot set review_notes on insert | Passed | blocked by trigger/RLS |
| rejected application can be resubmitted | Passed | submitted_at populated on resubmission |
| suspended manufacturer cannot edit its application | Passed | blocked while suspended |

All 16 security checks passed.

## Build And Unit Tests

```bash
npm ci
npm run build
npm run test
```

Results:

- `npm ci` passed; 81 packages installed and 0 vulnerabilities found.
- `npm run build` passed; TypeScript build and Vite production build completed.
- `npm run test` passed; 11 tests across 2 suites passed.

## Notes

- `auth-profiles` includes merge commit `488610a` from PR #2.
- Migration `0006_manufacturer_onboarding.sql` is present in `supabase/migrations`.
- No merge to `main` was performed.
- No production deployment was performed.
- Product upload and new business features were not started.
