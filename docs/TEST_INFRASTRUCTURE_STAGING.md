# Supabase Staging Test Infrastructure

This document defines the reusable staging foundation for destructive or fixture-heavy verification such as PH-010B live logistics booking smoke, true concurrency checks, and browser role smoke.

## Purpose

Staging exists to run tests that require disposable records, privileged fixture setup, exact cleanup, and repeatable rollback or reset behavior without touching production business data.

## Production Separation

Production project ref denylist:

- `eoyrfrjbjglfudfuwxdf`

Staging scripts must reject this ref before any network write.

Staging commands must receive the staging project ref explicitly through `PREFAB_STAGING_PROJECT_REF`. Scripts must not rely on a mutable production `supabase/.temp/project-ref` for staging operations.

## Required Secrets

Use these names only. Do not store real values in repository files, workflow YAML, docs, logs, screenshots, or fixture manifests.

- `PREFAB_STAGING_PROJECT_REF`
- `PREFAB_STAGING_SUPABASE_URL`
- `PREFAB_STAGING_SUPABASE_PUBLISHABLE_KEY`
- `PREFAB_STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `PREFAB_STAGING_DATABASE_PASSWORD`

Smoke user credentials use:

- `PREFAB_STAGING_BUYER_EMAIL`
- `PREFAB_STAGING_BUYER_PASSWORD`
- `PREFAB_STAGING_MANUFACTURER_EMAIL`
- `PREFAB_STAGING_MANUFACTURER_PASSWORD`
- `PREFAB_STAGING_OTHER_MANUFACTURER_EMAIL`
- `PREFAB_STAGING_OTHER_MANUFACTURER_PASSWORD`
- `PREFAB_STAGING_ADMIN_EMAIL`
- `PREFAB_STAGING_ADMIN_PASSWORD`

## Safety Guard

`scripts/test-infrastructure/staging-safety.mjs` requires:

- `PREFAB_TEST_ENVIRONMENT=staging`
- `PREFAB_ALLOW_FIXTURE_RESET=true`
- `PREFAB_STAGING_PROJECT_REF`
- Supabase URL project ref matching `PREFAB_STAGING_PROJECT_REF`
- Non-production project ref

The guard prints only environment type, project ref, present/missing variable names, and safety decision. It never prints secret values.

## Migration Bootstrap

`scripts/test-infrastructure/bootstrap-staging.mjs` is dry-run plan only in this foundation.

It verifies:

- local migrations are exactly `0001` through `0024`; protected baseline migrations `0001` through `0023` remain unchanged
- migration `0024` is the only new local migration
- protected migrations match `auth-profiles`
- staging safety guard passes

The isolated CLI workspace design initializes a temporary Supabase project, copies only `supabase/migrations`, links that workspace to the explicit staging ref, lists migrations, and performs `supabase db push --dry-run`.

Actual migration application is disabled in this task even if `PREFAB_STAGING_APPLY_MIGRATIONS=true` is set. Future application requires a user-provided staging ref and separate approval.

Forbidden commands for this foundation:

- `supabase migration repair`
- `supabase db reset` against a remote project
- `supabase db pull`
- migration squash

## Fixture Lifecycle

Fixture records must use a unique prefix such as:

`lbr_live_<timestamp>_<random>`

The fixture manifest is written only to ignored local paths:

`.tmp/staging-fixtures/<fixture-prefix>.json`

The manifest tracks exact IDs for:

- Auth users
- Profiles
- Manufacturers
- Products
- RFQs
- Quotes
- Purchase Orders
- Contracts
- Invoices
- Shipping Readiness records
- Logistics Booking Requests
- Events

Cleanup must use exact IDs first, not broad name matching.

## Cleanup Guarantee

Preferred reset methods:

1. Delete fixture rows by exact UUIDs and dependency map.
2. Reset or recreate the disposable staging project when exact cleanup is insufficient.
3. Use narrowly scoped cleanup SQL in staging only.

Do not create broad production cleanup RPCs.

`scripts/test-infrastructure/cleanup-staging-fixture.mjs` currently implements cleanup planning only. It requires staging safety, verifies the manifest project ref, rejects production, and prints table counts without exposing IDs.

## Concurrency Testing

True concurrency tests must use separate authenticated requests and concurrent promises. Sequential state-conflict simulations may supplement but must not be described as true concurrency.

Required logistics booking race checks:

- Submit / Submit
- Withdraw / Withdraw
- Submit / Withdraw

Each run must verify final state, timestamp integrity, and lifecycle event counts.

## Browser Smoke Strategy

Browser smoke should run only after fixture setup succeeds in staging/local/disposable infrastructure. Do not install Playwright, Puppeteer, Selenium, browser extensions, or new browser automation dependencies solely for this phase.

Browser verification must ensure the UI does not positively claim:

- Carrier selected
- Freight forwarder selected
- Cargo space reserved
- Equipment reserved
- Pickup scheduled
- Booking confirmed
- Dispatched
- In transit
- Customs cleared
- Delivered

## Failure Handling

All fixture creation scripts must use `try`/`finally` cleanup. A failed assertion must still attempt cleanup and then report remaining exact IDs by table.

## Manual Approval

No workflow or script in this foundation applies migrations or performs remote fixture writes by default. Staging migration application and live fixture creation require explicit user approval after a staging project ref is supplied.

## Future GitHub Actions

A future workflow may run staging bootstrap, fixture smoke, cleanup, and browser checks after manual approval. This task does not add an active workflow using service-role credentials.

Workflow logs must never print secret values.
