# PH-009B Payment Recording Foundation Verification

Date: July 16, 2026

Branch: `auth-profiles`

Linked Supabase project ref: `eoyfrjbjglfudfuwxdf`

PR #17 merge commit: `c1a950108319ed46a1d5df5d542121c3aab1d474`

Implementation commit: `8f3934a0a396738ba71e047664ef99b9a32015c0`

Future-date fix commit: `497af31165c3f2d59c4c1af9f3dc64c53d65cec7`

## Migration

Applied with:

```powershell
npx.cmd supabase db push --yes
```

Result:
- `0021_payment_recording_foundation.sql` applied successfully.
- Remote migrations list shows `0001` through `0021`.
- Migration `0021` is present remotely exactly once.
- Migrations `0001` through `0020` were unchanged.
- No manual database edits were performed.

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/payment_recording_foundation_security.sql
```

Result: `48/48` rollback-only checks passed.

Coverage confirmed:
- Assigned Manufacturer can create from issued Invoice.
- Buyer, Admin, Anonymous, and other Manufacturer mutation paths are denied.
- `PAY-YYYY-NNNNNN` numbers are database-generated.
- Invoice, Contract, PO, Buyer, Manufacturer, currency, and snapshots are database-derived.
- Source Invoice remains `issued`; no paid or partially-paid Invoice state is introduced.
- Amount must be positive and cannot exceed remaining balance.
- Draft payments do not count, recorded payments count, voided payments do not count.
- Multiple payments are allowed within balance.
- Recorded amount, remaining balance, and count are database-calculated.
- Future payment dates are denied in draft update and record flow.
- `assert_payment_record_values` is `STABLE`, not `IMMUTABLE`, because it depends on database `current_date`.
- Direct table writes and event mutations are denied.
- Event metadata strips impersonation, provider, payment, bank, and credential keys.

## Authenticated API Smoke

Credentials were read only from ignored local `.env.smoke.local`. No passwords, sessions, access tokens, refresh tokens, service-role keys, signed URLs, bank/payment credentials, or provider secrets were printed.

Result: `55/55` checks passed.

Manufacturer:
- Signed in through normal Supabase Auth and confirmed role `manufacturer`.
- Located or created an issued Invoice fixture.
- Created a draft Payment Record.
- Verified `PAY-YYYY-NNNNNN` number format.
- Verified source-derived Invoice, Contract, PO, Buyer, Manufacturer, and currency.
- Verified snapshots and conservative payment snapshot flags.
- Verified draft record did not affect summary.
- Verified null draft date, historical date, and database current date behavior.
- Verified future date, invalid method, zero/negative amount, over-balance amount, and source/currency forgery were denied.
- Recorded a valid draft and confirmed database-generated `recorded_at`.
- Confirmed Invoice stayed `issued`.
- Confirmed second record attempt on same Payment was denied.
- Voided a recorded Payment and confirmed database-generated `voided_at`, normalized reason, terminal behavior, and restored remaining balance.

Buyer:
- Signed in through normal Supabase Auth and confirmed role `buyer`.
- Read own payment records/events/summary where applicable.
- Create, update, record, and void RPCs were denied.

Admin:
- Signed in through normal Supabase Auth and confirmed role `admin`.
- Read payment records.
- Mutation RPCs were denied.

Anonymous:
- Direct payment record read was denied.
- Create RPC invocation was denied.

Other Buyer / Other Manufacturer:
- Dedicated credentials were not available.
- Rollback SQL covered other Manufacturer read/mutation denial and unrelated data isolation.

## Concurrency Smoke

Independent authenticated Supabase clients were used. No service-role credentials were used.

Record versus Record on same Payment:
- One call succeeded.
- One call rejected.
- Exactly one `payment_recorded` event existed.

Record versus Record on separate drafts for same Invoice:
- Amounts together exceeded remaining balance.
- Only a valid subset succeeded.
- Final recorded amount did not exceed Invoice total.
- No duplicate lifecycle events were observed for successful transitions.

Void versus Void:
- One call succeeded.
- One call rejected.
- Exactly one `payment_record_voided` event existed.

Record versus Void:
- Near-simultaneous calls serialized to a valid lifecycle.
- Final status was valid.
- No impossible state or duplicate lifecycle event was observed.
- Summary stayed consistent with final status.

## Event Integrity

Verified event sequences:
- Draft update then record: `payment_record_created`, `payment_record_updated`, `payment_recorded`.
- Recorded then void: `payment_record_created`, `payment_record_updated`, `payment_recorded`, `payment_record_voided`.

Confirmed:
- Actor identity is database-derived.
- Payment, Invoice, Contract, and PO numbers are database-derived.
- `recorded_means_processed = false`.
- `funds_transferred = false`.
- `bank_verified = false`.
- `settled = false`.
- `reconciled = false`.
- `invoice_paid = false`.
- Impersonation/provider/payment/bank secret metadata keys are absent.
- Events are chronological.
- Exactly one event is produced for each successful lifecycle transition.

## Browser Smoke

Attempted using local Vite and installed Chrome headless with Chrome DevTools Protocol. No Playwright, Puppeteer, Selenium, or other browser package was installed.

Commands attempted:
- `npm.cmd run dev -- --host 127.0.0.1 --port 3000`
- Chrome headless with `--remote-debugging-port=9224`
- Temporary CDP scripts using Node's built-in WebSocket support

Initial browser load:
- App loaded successfully.
- Console errors: `0`.
- Unsafe log matches: `0`.
- A generic forbidden-word scan initially flagged marketplace copy containing "authorized short-lived product image access"; this was not a payment authorization claim.

Role browser smoke:
- Blocked before login interactions completed.
- Exact blocker: CDP role script reached an empty DOM after navigation and could not find auth inputs.
- Earlier retry blocker: repo-local Chrome profile caused Vite watcher `EBUSY`; this was cleared by removing the temporary profile and rerunning with a temp-directory profile.
- Browser role smoke count: initial app load and console checks completed; Buyer/Manufacturer/Admin role UI interaction checks remain unverified in browser.
- No browser dependency was added.
- Local ports `3000` and `9224` were cleared.

## UI Semantics

Confirmed by source review, unit tests, API smoke, and initial browser text scan:
- Uses `Draft`, `Recorded`, and `Voided`.
- Uses external payment record semantics.
- Shows recorded amount and remaining balance as summary values.
- States that no funds are transferred, processed, verified, settled, reconciled, or used to mark the Invoice as paid.

Forbidden positive payment-provider claims were not added:
- No Pay Now.
- No checkout.
- No payment link.
- No payment successful.
- No funds received.
- No bank verified.
- No settled/reconciled/refunded/captured payment control.

## Build, Tests, And Secret Scan

Commands run:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
```

Results:
- `npm.cmd ci`: passed, `0` vulnerabilities.
- `npm.cmd run build`: passed. Existing Vite chunk-size warning remains.
- `npm.cmd run test`: passed, `138/138`.

Secret scan:
- No credential values found.
- No Supabase service-role values.
- No access/refresh tokens.
- No payment API keys.
- No bank credentials.
- No card/account/routing numbers.
- No webhook secrets.
- No private keys.
- No passwords.
- No signed URLs.

Safe text references to denied/stripped field names exist in tests and documentation only.

## Final Status

- Tracked working tree before documentation: clean.
- Remaining untracked files before documentation: none.
- Local ports cleared: `3000` and `9224`.
- No deployment occurred.
- `auth-profiles` was not merged into `main`.
- PH-009C was not started.
- No Stripe, PayPal, ACH, card processing, bank APIs, checkout, payment links, refunds, chargebacks, credit memos, settlement, reconciliation, payment verification, proof uploads, accounting integrations, invoice email/PDF, automatic tax, shipping, or customs work was performed.
- No external payment calls were made.
