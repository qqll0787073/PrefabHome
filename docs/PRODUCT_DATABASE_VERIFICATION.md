# Product Database Verification

Date: July 12, 2026

Branch: `auth-profiles`

## Linked Project

- Supabase project ref: `eoyrfrjbjglfudfuwxdf`
- Supabase project name: `PrefabHome`

## Merge Commit

PR #4 merge commit:

- `17039b7fe6f3ba84c285ea7143af23bb8798635f`
- `Merge pull request #4 from qqll0787073/product-database-foundation`

## Migration Application

Command:

```bash
npx.cmd supabase db push --yes
```

Result:

- Applied `0007_product_database_foundation.sql`
- CLI completed with `Finished supabase db push.`
- Post-application migration list shows local and remote through `0007`
- No production data was manually modified or deleted

Migration status after push:

| Migration | Remote status |
| --- | --- |
| `0001` | applied |
| `0002` | applied |
| `0003` | applied |
| `0004` | applied |
| `0005` | applied |
| `0006` | applied |
| `0007` | applied |

## Rollback-Only SQL Verification

Command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/product_database_security.sql
```

Result: 38 of 38 checks passed.

| # | Check | Result | Detail |
| --- | --- | --- | --- |
| 1 | admin can perform published -> archived | passed | `archived_at` populated |
| 2 | admin can perform rejected -> draft | passed | status became `draft` |
| 3 | admin can perform submitted -> published | passed | `published_at` populated |
| 4 | admin can perform submitted -> rejected | passed | status became `rejected` |
| 5 | admin can review all products | passed | visible products: 4 |
| 6 | admin cannot perform archived -> published | passed | blocked |
| 7 | admin cannot perform archived -> rejected | passed | blocked |
| 8 | admin cannot perform draft -> archived | passed | blocked |
| 9 | admin cannot perform draft -> published | passed | blocked |
| 10 | admin cannot perform published -> draft | passed | blocked |
| 11 | admin cannot perform rejected -> published | passed | blocked |
| 12 | admin private product query still works | passed | review notes readable by admin |
| 13 | anonymous user can read approved public fields from a published product | passed | public `model_name` visible |
| 14 | anonymous user can read published product only | passed | private: 0, published: 1 |
| 15 | anonymous user cannot select notes | passed | blocked |
| 16 | anonymous user cannot select review_notes | passed | blocked |
| 17 | anonymous user cannot select reviewed_by/reviewed_at | passed | blocked |
| 18 | approved manufacturer can create own draft | passed | product created |
| 19 | archived products are hidden from public queries | passed | public visible archived: 0 |
| 20 | buyer can read published product only | passed | private: 0, published: 1 |
| 21 | buyer public query cannot expose private fields | passed | blocked |
| 22 | duplicate SKU per manufacturer is blocked | passed | blocked |
| 23 | invalid negative price/dimensions are blocked | passed | blocked |
| 24 | invalid status transition is blocked | passed | blocked |
| 25 | manufacturer can edit own draft | passed | draft name updated |
| 26 | manufacturer can read another manufacturer published product | passed | visible published: 1 |
| 27 | manufacturer can submit own draft | passed | `submitted_at` populated |
| 28 | manufacturer cannot change manufacturer_id | passed | blocked |
| 29 | manufacturer cannot create product for another manufacturer | passed | blocked |
| 30 | manufacturer cannot edit submitted product | passed | blocked |
| 31 | manufacturer cannot read another manufacturer private draft | passed | visible private: 0 |
| 32 | manufacturer cannot self-publish | passed | blocked |
| 33 | manufacturer private product query still works | passed | visible own private products: 1 |
| 34 | published_at is set on publication | passed | `published_at` populated |
| 35 | rejected -> draft clears review workflow fields | passed | review workflow fields cleared |
| 36 | same SKU for different manufacturers is allowed | passed | product created |
| 37 | unapproved manufacturer cannot create product | passed | blocked |
| 38 | updated_at changes on valid update | passed | timestamp increased |

## Application Validation

### Dependencies

Command:

```bash
npm.cmd ci
```

Result:

- Passed
- 81 packages installed
- 0 vulnerabilities reported

### Build

Command:

```bash
npm.cmd run build
```

Result:

- Passed
- TypeScript build completed
- Vite production build completed
- Output included `dist/index.html`, CSS, and JS bundle

### Unit Tests

Command:

```bash
npm.cmd run test
```

Result:

- Passed
- 4 suites
- 19 tests
- 19 passed
- 0 failed

## Deployment

No production deployment was performed.

## Deferred Work

Not started in this verification pass:

- Storage
- image upload
- PH-004
