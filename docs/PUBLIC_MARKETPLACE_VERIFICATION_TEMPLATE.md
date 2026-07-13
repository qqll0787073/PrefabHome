# Public Marketplace Verification Template

Use this template after PR approval and before applying migration `0010` remotely.

## Migration Status

- Migration: `supabase/migrations/0010_public_product_marketplace.sql`
- Remote application status: not applied before approval
- Migrations `0001` through `0009`: unchanged

## Rollback SQL Verification

Command pattern:

```bash
npx.cmd supabase db query --linked --file <rollback-combined-0010-and-public-marketplace-test.sql>
```

Required result:

- `supabase/tests/public_marketplace_security.sql`: all checks pass
- test leaves no rows behind because it runs inside `begin` / `rollback`

Current check coverage:

1. anonymous can read published marketplace product
2. buyer can read published marketplace product
3. anonymous cannot read draft product
4. anonymous cannot read submitted product
5. anonymous cannot read rejected product
6. anonymous cannot read archived product
7. marketplace projection excludes product notes
8. marketplace projection excludes review fields
9. marketplace projection excludes manufacturer owner_id
10. marketplace projection excludes private manufacturer contact data
11. only approved manufacturer public data appears
12. unpublished product images are excluded
13. private images are excluded
14. product documents are excluded
15. primary public published image can appear
16. product with no image remains readable
17. duplicate or malformed media does not expose private content
18. search/filter query still returns only published rows
19. count/pagination does not leak unpublished row counts
20. direct private-table permissions remain unchanged

## Frontend Validation

Run:

```bash
npm ci
npm run build
npm run test
```

Expected:

- build passes
- marketplace helper tests pass
- existing auth, manufacturer, product, and media tests continue passing

## UI Smoke

Anonymous:

- listing loads
- only published products are visible
- signed public image loads when available
- missing-image fallback appears when no public image exists
- product detail opens at `/products/<slug>`
- filters work
- sorting works
- pagination works
- no private data appears

Buyer:

- same public content is available after sign-in
- no extra private product fields appear
- no private documents appear

Manufacturer/Admin regression:

- portals still load
- manufacturer product list still loads
- product media manager still loads
- admin review pages still load

## Secret And Safety Checks

Confirm:

- no service-role key added
- no signed URL query tokens printed or documented
- `.env.smoke.local` remains ignored
- no production data deleted
- no permanent demo data inserted
- no production deployment occurred
- PH-006 was not started
