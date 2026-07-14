# PH-006A RFQ Verification

Date: 2026-07-14

Branch: `auth-profiles`

PR: `#7`

Merge commit: `2057e99`

Migration: `supabase/migrations/0011_rfq_foundation.sql`

Deployment status: not deployed.

PH-006B status: not started.

## Migration

Applied migration `0011_rfq_foundation.sql` through the linked Supabase CLI:

```powershell
npx.cmd supabase db push --yes
```

Result: migration applied successfully.

Remote migration list confirmed `0001` through `0011` are applied.

No manual production data edits were performed.

## Rollback SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/rfq_security.sql
```

Result: passed `47/47`.

Verified:

- Buyer can read own RFQs and cannot read another buyer's RFQs.
- Manufacturer can read assigned RFQs and cannot read another manufacturer's RFQs.
- Anonymous users cannot read RFQs, RFQ messages, or RFQ events.
- Buyer can create, update, submit, cancel, and delete only permitted RFQ states.
- Manufacturer can perform `submitted -> manufacturer_review`.
- Other manufacturer cannot update assigned RFQs.
- Manufacturer cannot edit quantity, destination, or buyer message.
- Manufacturer cannot perform `submitted -> quoted`.
- Admin illegal lifecycle transitions remain blocked.
- Product snapshot is created and immutable.
- Message `sender_role` is database-derived.
- Direct RFQ event insert is denied.
- Cross-role RFQ event forgery is blocked.
- `quote_created` remains deferred until PH-006B.
- Timeline events are chronological by `created_at ASC`.

## Buyer Smoke

Credentials source: `.env.smoke.local`.

Result: passed.

Verified:

- Buyer login passed.
- Buyer profile role is `buyer`.
- Marketplace product is visible.
- Product detail data is readable.
- Buyer can create a draft RFQ.
- Draft RFQ receives a product snapshot.
- Buyer can delete a draft RFQ.
- Buyer can create another draft RFQ.
- Buyer can submit the RFQ.
- Submitted RFQ appears in `My RFQs`.
- `draft_created` and `submitted` timeline events are created.
- Buyer message insertion works.
- Buyer message row derives `sender_role = buyer`.

## Manufacturer Smoke

Credentials source: `.env.smoke.local`.

Result: passed.

Verified:

- Manufacturer login passed.
- Manufacturer profile role is `manufacturer`.
- Approved manufacturer-owned published product prerequisite exists.
- Submitted RFQ is visible in the manufacturer inbox.
- Manufacturer can open/read the RFQ.
- Manufacturer can transition `submitted -> manufacturer_review`.
- Manufacturer reply message insertion works.
- `manufacturer_replied` event is created by the trusted message trigger.
- Buyer RFQ fields remain immutable to the manufacturer.

## Admin Smoke

Result: blocked.

Reason: `.env.smoke.local` does not include admin smoke credential variables. The available local smoke variables are buyer and manufacturer credentials only.

Follow-up on 2026-07-14: local variable-name check still found only:

- `PREFAB_SMOKE_EMAIL`
- `PREFAB_SMOKE_PASSWORD`
- `PREFAB_BUYER_SMOKE_EMAIL`
- `PREFAB_BUYER_SMOKE_PASSWORD`

The requested admin variables were not present:

- `PREFAB_ADMIN_SMOKE_EMAIL`
- `PREFAB_ADMIN_SMOKE_PASSWORD`

Database-level admin behavior was still covered by the rollback SQL verification:

- Admin can read RFQs in the SQL verification.
- Admin illegal lifecycle transitions are blocked.
- Event forgery paths are blocked.

Admin UI smoke should be completed when local admin smoke credentials are provided, for example through ignored local-only variables such as `PREFAB_ADMIN_SMOKE_EMAIL` and `PREFAB_ADMIN_SMOKE_PASSWORD`.

## Timeline Verification

Passed.

Verified through SQL and authenticated smoke:

- RFQ insert creates `draft_created`.
- RFQ submit creates `submitted`.
- Manufacturer review transition creates a trusted manufacturer event.
- Manufacturer reply creates `manufacturer_replied`.
- Event actor identity is database-derived.
- Impersonation metadata is stripped from trusted event inserts.

## Snapshot Verification

Passed.

Verified:

- RFQ insert creates non-empty `product_snapshot`.
- Submitted RFQ retains the snapshot.
- SQL verification proves product changes do not mutate existing RFQ snapshots.
- SQL verification proves direct snapshot updates are blocked.

## Transition Verification

Passed.

Verified:

- `draft -> submitted`
- `submitted -> cancelled`
- `submitted -> manufacturer_review`
- Invalid `draft -> accepted`
- Invalid `submitted -> accepted`
- Invalid manufacturer `submitted -> quoted`
- Invalid admin transition paths

## Browser Console Verification

Result: blocked.

Follow-up on 2026-07-14: attempted to connect to the in-app browser for a real browser smoke. Browser control timed out during setup and again during reset, so Buyer, Manufacturer, and Admin browser interaction checks could not be completed in this pass.

Browser results:

- Buyer browser result: blocked by browser-control timeout.
- Manufacturer browser result: blocked by browser-control timeout.
- Admin browser result: blocked by browser-control timeout and missing admin smoke credentials.
- Console error count: not measured because the browser session could not be controlled.
- Unsafe logging result: not measured in browser; API smoke and command output did not print credentials, access tokens, refresh tokens, or signed URLs.

## Validation

Commands:

```powershell
npm ci
npm run build
npm run test
```

Results:

- `npm ci`: passed, `0` vulnerabilities.
- `npm run build`: passed.
- `npm run test`: passed, `52/52`.

Secret scan:

- No credential values found.
- Matches were safe code identifiers or documentation placeholders such as `signed_url`, `SUPABASE_SERVICE_ROLE_KEY`, and smoke variable names.

## Final Safety Checks

- No deployment occurred.
- PH-006B was not started.
- No service-role key was used in frontend code.
- `.env.smoke.local` remains ignored by Git.
