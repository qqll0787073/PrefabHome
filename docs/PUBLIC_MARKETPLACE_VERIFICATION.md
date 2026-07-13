# PH-005 Public Marketplace Verification

Date: 2026-07-13

Branch: `auth-profiles`

PR #6 merge commit: `0391ac433def15848441dab8fe652622ebe3c4cc`

Linked Supabase project ref: `eoyrfrjbjglfudfuwxdf`

Production deployment status: not deployed.

PH-006 status: not started.

## Branch and Migration Baseline

- `auth-profiles` was synchronized with `origin/auth-profiles`.
- Local HEAD includes merge commit `0391ac433def15848441dab8fe652622ebe3c4cc`.
- Migration `supabase/migrations/0010_public_product_marketplace.sql` exists locally.
- Migrations `0001` through `0009` were not edited during this verification pass.
- `.env.smoke.local` remains ignored by Git via `*.local`.

## Pre-Application Validation

- `npm ci`: passed with 0 reported vulnerabilities.
- `npm run build`: passed.
- `npm run test`: passed, 43/43 tests.
- Secret scan: no credential values found. Matches were code identifiers or documentation placeholders such as `signed_url` and `SUPABASE_SERVICE_ROLE_KEY`.
- Rollback-only marketplace SQL was not runnable against the linked remote before applying `0010` because the remote migration list showed `0010` pending and `public.marketplace_products` did not yet exist. The full rollback-only SQL verification was run immediately after applying the migration.

## Migration Application

Command:

```powershell
npx.cmd supabase db push --yes
```

Result:

- Applied `0010_public_product_marketplace.sql`.
- CLI notice: existing `marketplace_products` view did not exist and was skipped during `drop view if exists`.
- Migration push completed successfully.

Remote migration status after application:

- `0001`: applied
- `0002`: applied
- `0003`: applied
- `0004`: applied
- `0005`: applied
- `0006`: applied
- `0007`: applied
- `0008`: applied
- `0009`: applied
- `0010`: applied

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/public_marketplace_security.sql
```

Result: 27/27 checks passed.

Confirmed:

- `marketplace_products` is readable by anonymous and authenticated sessions.
- Only published products are returned.
- Unapproved manufacturer products are excluded.
- Draft, submitted, rejected, and archived products are excluded.
- Manufacturer public projection includes display name and country only.
- Manufacturer province, city, website, owner ID, email, and phone are absent from the public projection.
- Product notes and review workflow fields are absent.
- Private onboarding location data cannot be selected through the public marketplace view.
- Primary media is limited to public product images.
- Documents are excluded.
- Private images are excluded.
- `published_product_media` behavior remains constrained to public published images.
- Direct anonymous private-table access remains blocked for `products` and `product_media`.
- Temporary SQL data was rollback-only.

## Published Test Product

Product used:

- Name: `PH-004 Storage Smoke Test`
- Product ID: `8c507281-dcdf-4b4e-9778-90f8d9bee835`
- Manufacturer ID: `6989d2c9-1e0c-463f-a390-d430dfea6ca4`

Preparation:

- The approved manufacturer account from `.env.smoke.local` signed in through normal Supabase Auth.
- A small PNG image was uploaded to the private `product-images` bucket using the authenticated application-style flow.
- A matching `product_media` row was created with `visibility='public'`.
- `set_primary_product_media(product_id, media_id)` succeeded.
- The product was submitted by the manufacturer.
- Because no local Admin credential was available, final `submitted -> published` was performed through an authenticated admin database context so the product lifecycle trigger still enforced the legal transition.

Verification:

- Product status is `published`.
- `published_at` is populated.
- Manufacturer `application_status` is `approved`.
- The public image is `visibility='public'`.
- No product documents were attached.
- No private images appeared in the public marketplace.

## Anonymous Marketplace Smoke

Environment:

- Local app: `http://127.0.0.1:5173/`
- `VITE_ENABLE_MARKETPLACE_DEMO=false`
- Demo mode was not used.

Results:

- Marketplace listing loaded from `public.marketplace_products`.
- Published test product appeared.
- Draft, submitted, rejected, and archived products did not appear through the public projection.
- Manufacturer display name appeared.
- Manufacturer country appeared.
- Manufacturer province, city, website, owner ID, email, and phone did not appear.
- Primary public image signed URL was created.
- Signed image bytes loaded successfully.
- No private image appeared.
- No product document appeared.
- Product detail opened through `/products/8c507281-dcdf-4b4e-9778-90f8d9bee835`.
- Back navigation returned to the marketplace.
- Search found the published product.
- Category filtering worked.
- Numeric filtering worked using minimum floor area.
- Sorting control worked.
- Pagination is correctly disabled for the current one-product result set.
- Missing-image fallback could not be exercised because no published product without an image exists in the linked project.
- Browser console contained 0 errors and no credential, token, or full signed URL logging.

## Buyer Marketplace Smoke

Status: blocked by missing Buyer credentials.

The only credential pair available in `.env.smoke.local` signs in successfully through normal Supabase Auth but has role `manufacturer`, not `buyer`. The authenticated marketplace query with that normal session could see the published product and did not expose private product or manufacturer fields, but it does not qualify as the requested Buyer smoke test.

To complete the Buyer-specific browser smoke, provide a normal Buyer account through local-only ignored environment variables. Do not use Admin or Manufacturer credentials for that check.

## Manufacturer and Admin Regression

Manufacturer service-level regression using the local manufacturer smoke account:

- Sign-in passed.
- Approved manufacturer lookup passed.
- Own product list loaded.
- Product editor record loaded.
- Product media manager data loaded.
- Existing PH-004 upload behavior was reverified during the product preparation step.

Admin service-level regression using authenticated admin database context:

- Manufacturer review data is readable.
- Product review data is readable.
- Published product remains manageable.

No unrelated product or media changes were made.

## Final Validation

Final rerun results:

- `npm ci`: passed with 0 reported vulnerabilities.
- `npm run build`: passed.
- `npm run test`: passed, 43/43 tests.
- Secret scan: no credential values found. Matches were code identifiers or documentation placeholders such as `signed_url` and `SUPABASE_SERVICE_ROLE_KEY`.
- `git status --short`: only `docs/PUBLIC_MARKETPLACE_VERIFICATION.md` is modified for commit.
- `.env.smoke.local`: ignored by Git via `.gitignore:9:*.local`.

Safety confirmations:

- No password, access token, refresh token, anon key, or signed URL query token is recorded in this document.
- No production deployment occurred.
- No merge to `main` occurred.
- PH-006 was not started.
