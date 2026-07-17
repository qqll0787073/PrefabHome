# PH-010B.1 Logistics Booking Live Smoke Verification

Date: July 17, 2026

Branch: `test-infrastructure-staging-foundation`

Base branch: `auth-profiles`

Project: PH-010B.1 Logistics Booking Live Smoke and True-Concurrency Verification

PR foundation: `#19`

Foundation merge commit: `791584eb56ab21b29addba4a4c63fe1d87ab14f0`

Foundation verification commit: `a7c38a42b1e7755c94d28c1fa4a89847ec5a3a7c`

## Environment Safety Assessment

Configured environment type: `staging`

Staging Supabase project ref: `bvzbkjpbnczquecwqvlm`

Production ref denylist: `eoyrfrjbjglfudfuwxdf`

Safety decision: safe for staging dry-run, migration apply, and temporary fixture smoke.

Confirmed before remote writes:

- `.env.staging.local` is ignored by Git through `.gitignore:10:*.local`
- `PREFAB_STAGING_PROJECT_REF` equals `bvzbkjpbnczquecwqvlm`
- staging URL project ref matches `bvzbkjpbnczquecwqvlm`
- production ref `eoyrfrjbjglfudfuwxdf` remains denylisted
- normal repository `supabase/.temp/project-ref` remained production and was not used for staging writes
- all staging Supabase CLI calls used an isolated temporary `--workdir`
- secret values printed: `0`

## Migration Bootstrap

Isolated staging migration list before apply: local `0001` through `0023`; remote initially empty.

Dry run before apply:

```powershell
npx.cmd supabase db push --dry-run --workdir <isolated-staging-workspace>
```

Result: exactly migrations `0001` through `0023` pending.

Apply:

```powershell
npx.cmd supabase db push --yes --workdir <isolated-staging-workspace>
```

Result: migrations `0001` through `0023` applied to staging.

Post-apply remote migration list: `0001` through `0023`.

Post-apply dry run: remote database is up to date.

## Harness

Added reusable repository-safe smoke harness files:

- `scripts/smoke/logistics-booking-fixture.mjs`
- `scripts/smoke/logistics-booking-live-smoke.mjs`

The harness:

- Reads ignored local env files without printing values.
- Reports only environment variable names and project refs.
- Generates a unique fixture prefix.
- Documents reverse dependency cleanup order.
- Refuses to create records in a linked project unless an explicit local opt-in is set and cleanup proof is completed.

No credentials, tokens, private keys, service-role keys, or fixture dumps are stored in the repository.

## Fixture Setup

Fixture prefix: `lbr_live_1784322087578_59cb921b`

Temporary staging fixtures were created for:

- Buyer, Manufacturer, Other Manufacturer, and Admin Auth users
- approved Manufacturer applications
- Products
- RFQs
- accepted Quote/Decision chain
- confirmed Purchase Orders
- accepted Contracts
- Signature Packages
- issued Invoices
- ready Shipping Readiness records
- Logistics Booking Requests and events

## Authenticated API Smoke

Authenticated assertion count: `34/34`.

Manufacturer result: passed.

Buyer result: passed.

Admin result: passed.

Other Manufacturer isolation result: passed.

Anonymous denial result: passed.

Verified:

- Manufacturer can sign in through normal Supabase Auth.
- Buyer can sign in through normal Supabase Auth.
- Admin can sign in through normal Supabase Auth.
- Other Manufacturer can sign in through normal Supabase Auth.
- Manufacturer can read eligible ready-for-logistics Shipping Readiness.
- Manufacturer can create a booking draft from an eligible source.
- Booking derives immutable source references and cargo fields.
- Manufacturer can update allowed draft fields.
- Source cargo is not overwritten by draft edits.
- Manufacturer can submit to `submitted_for_arrangement`.
- Exactly one submitted event is created.
- Other Manufacturer cannot read or submit another Manufacturer's booking request.
- Buyer can read their own booking request and events.
- Buyer cannot create, update, submit, withdraw, or directly update booking requests.
- Admin can read but cannot create through the Manufacturer RPC or directly update booking requests.
- Anonymous cannot read or invoke booking RPCs.
- Draft withdraw succeeds and is terminal.
- Submitted withdraw succeeds.

## True Concurrency

Submit / Submit: passed; exactly one request succeeded, exactly one request was rejected, and exactly one submitted event was created.

Withdraw / Withdraw: passed; exactly one request succeeded, exactly one request was rejected, and exactly one withdrawn event was created.

Submit / Withdraw: passed; race serialized to legal final state `withdrawn`, with one withdrawn event and zero submitted events in the observed run.

Actual concurrency method: concurrent authenticated Supabase RPC promises against staging.

Existing rollback SQL also provides same-transaction state-conflict coverage.

## Browser Smoke

Browser result: not completed in this environment.

Exact blocker: no Playwright/Puppeteer harness exists in this branch, and prior local Chrome headless/browser-control attempts for role-flow smoke are documented as unreliable in this environment.

No browser automation packages were installed.

## Regression Validation

`npm.cmd ci`: passed, `0` vulnerabilities.

`npm.cmd run test`: passed, `153/153`.

`npm.cmd run build`: passed.

Rollback SQL against staging:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/logistics_booking_request_foundation_security.sql
```

Result: passed, `70/70`.

Secret scan: passed, no matches.

Staging remote migration state: `0001` through `0023`.

No migration `0024` was created.

## Cleanup

Cleanup counts after exact-ID cleanup and residue audit:

- Fixture Auth users: `0`
- Fixture manufacturers: `0`
- Fixture products: `0`
- Fixture Booking Requests: `0`

Exact-ID cleanup reported:

- Logistics booking requests: `0`
- Shipping Readiness records: `0`
- Auth users: `0`

Prefix residue audit for `lbr_live_%` returned zero Auth users, manufacturers, products, and booking requests.

## Boundary Statements

`submitted_for_arrangement != carrier selected`

`submitted_for_arrangement != freight forwarder selected`

`submitted_for_arrangement != cargo space reserved`

`submitted_for_arrangement != equipment reserved`

`submitted_for_arrangement != pickup scheduled`

`submitted_for_arrangement != booking confirmed`

`submitted_for_arrangement != dispatched`

`submitted_for_arrangement != in transit`

`submitted_for_arrangement != customs cleared`

`submitted_for_arrangement != delivered`

## Final Confirmation

No deployment occurred.

No merge to `main` occurred.

PH-010C was not started.

No carrier, freight-forwarder, ocean booking, air cargo, trucking, rail, customs, tracking, mapping, payment, email, or document-signing provider was integrated.

## Remaining Limitation

Browser role smoke remains unavailable in this environment until a reliable approved browser harness exists. Authenticated API lifecycle, authorization, cleanup, and true-concurrency verification passed against staging.
