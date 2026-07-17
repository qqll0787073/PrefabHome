# Test Infrastructure Staging Foundation Verification

Date: July 17, 2026

Branch: `test-infrastructure-staging-foundation`

Production ref denylisted: `eoyrfrjbjglfudfuwxdf`

Staging project ref: `bvzbkjpbnczquecwqvlm`

Normal repository-linked Supabase ref remained: `eoyrfrjbjglfudfuwxdf`

## Safety Guard Results

Implemented `scripts/test-infrastructure/staging-safety.mjs`.

The guard:

- Requires `PREFAB_TEST_ENVIRONMENT=staging`.
- Requires `PREFAB_STAGING_PROJECT_REF`.
- Rejects production ref `eoyrfrjbjglfudfuwxdf`.
- Requires `PREFAB_ALLOW_FIXTURE_RESET=true`.
- Verifies the Supabase URL project ref matches `PREFAB_STAGING_PROJECT_REF`.
- Rejects localhost for staging mode.
- Prints only environment type, project ref, variable names present/missing, and safety decision.

Default behavior without staging environment variables: fails before network writes.

Production-ref behavior: fails before network writes.

Staging guard result after local `.env.staging.local` was populated:

- `.env.staging.local` ignored by Git: passed via `.gitignore:10:*.local`
- staging ref exactly `bvzbkjpbnczquecwqvlm`: passed
- production ref denylist `eoyrfrjbjglfudfuwxdf`: passed
- staging URL project ref matches staging ref: passed
- required staging variables present by name: passed
- secret values printed: `0`

The normal repository `supabase/.temp/project-ref` was rechecked and remained `eoyrfrjbjglfudfuwxdf`; all staging Supabase CLI commands used an isolated temporary `--workdir`.

## Unit Tests

Unit test files:

- `scripts/test-infrastructure/staging-safety.test.mjs`
- `scripts/test-infrastructure/fixture-manifest.test.mjs`
- `scripts/test-infrastructure/cleanup-staging-fixture.test.mjs`
- `scripts/test-infrastructure/bootstrap-staging.test.mjs`

Coverage:

- missing project ref
- production ref rejected
- staging ref accepted
- URL/ref mismatch rejected
- missing allow-reset rejected
- secret values not included in output
- local environment not confused with staging
- fixture manifest creation and ignored-path design
- cleanup planning and production denylist
- dry-run bootstrap planning

Unit test count: `20/20`.

## Validation Results

`npm.cmd ci`: passed, `0` vulnerabilities.

`npm.cmd run test`: passed, frontend `153/153` plus staging infrastructure unit tests `20/20`.

`npm.cmd run build`: passed.

Rollback SQL:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/logistics_booking_request_foundation_security.sql
```

Result: passed, `70/70`.

Isolated staging migration list before apply: local `0001` through `0023`; remote initially empty.

Isolated staging dry run before apply:

```powershell
npx.cmd supabase db push --dry-run --workdir <isolated-staging-workspace>
```

Result: exactly migrations `0001` through `0023` pending.

Migration application:

```powershell
npx.cmd supabase db push --yes --workdir <isolated-staging-workspace>
```

Result: applied migrations `0001` through `0023` to staging.

Isolated staging migration list after apply: remote migrations `0001` through `0023`.

Post-apply dry run: `Remote database is up to date.`

Production migration state: no production CLI command was run; normal repo link remained production but was not used for staging writes.

Remote writes performed: staging migrations and temporary staging fixture smoke only.

Fixture rows created: temporary staging-only logistics booking smoke fixtures.

Fixture cleanup: exact-ID cleanup passed, followed by prefix residue audit showing:

- Auth users: `0`
- Manufacturers: `0`
- Products: `0`
- Logistics booking requests: `0`

Secrets found: `0`.

Port `3000`: clear.

## Designs Added

Environment contract:

- `.env.staging.example`
- real `.env.staging.local` remains ignored

Isolated CLI workspace design:

- temporary workspace copies only Supabase config and migrations
- staging project ref is passed explicitly
- no reliance on production `supabase/.temp/project-ref`

Fixture manifest design:

- exact UUID tracking
- ignored `.tmp/staging-fixtures/<fixture-prefix>.json`

Cleanup design:

- reverse dependency order
- exact IDs only
- Auth users last
- idempotent planning
- no production cleanup RPCs

## Final Confirmation

No deployment occurred.

No merge to `main` occurred.

PH-010C was not started.

The staging Supabase project was linked only through an isolated temporary CLI workspace and received migrations `0001` through `0023`.

The production Supabase project was not modified.

No migration `0024` was created.

Browser role smoke was not completed in this environment because there is no Playwright/Puppeteer harness and prior local Chrome headless/browser-control attempts for role flows are documented as unreliable. The authenticated API lifecycle and true-concurrency smoke completed against staging.
