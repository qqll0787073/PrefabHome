# PH-009A Invoice Foundation Verification

Date: 2026-07-16

Branch: `auth-profiles`

Linked Supabase project ref: `eoyfrjbjglfudfuwxdf`

PR #16 merge commit: `144b8dc810e41832bd0c9d2cce1e5377e80ace96`

Implementation commit: `2458fab6c099ae79995eaac8bf1d8e3c7ec65201`

Billing-address fix commit: `ac9616d542685afdd77a00027f954e4ed3b68980`

## Migration

Command:

```powershell
npx.cmd supabase db push --yes
```

Result: `0020_invoice_foundation.sql` applied successfully through the linked Supabase CLI flow.

Remote migration range: `0001` through `0020`.

Migration `0020` was applied once. Migrations `0001` through `0019` were unchanged locally. No manual database edits were performed.

## Rollback SQL

Command:

```powershell
npx.cmd supabase db query --linked --file supabase/tests/invoice_foundation_security.sql
```

Result: `51/51` checks passed.

Coverage confirmed eligibility, source derivation, line-item derivation, database-generated invoice numbers, database-calculated amounts, billing-address completeness, strict issue-time validation, issue/cancel lifecycle, event generation, immutability, RLS, anonymous denial, and absence of payment/sent/paid states.

Note: the first SQL attempt failed before executing checks because the Supabase CLI could not connect its temporary role. The same command was rerun unchanged and passed `51/51`; no migration semantic changes or test harness changes were made.

## Authenticated API Smoke

Temporary ignored scripts used normal Supabase Auth with local-only credentials from `.env.smoke.local`. No passwords, sessions, access tokens, refresh tokens, service-role keys, provider secrets, payment secrets, webhook secrets, or signed URLs were printed.

Result: `57/57` checks passed.

Verified:

- Manufacturer sign-in and `role=manufacturer`
- Buyer sign-in and `role=buyer`
- Admin sign-in and `role=admin`
- eligible confirmed PO, accepted Contract, and ready-to-send Signature Package discovery
- Manufacturer invoice creation from eligible PO
- `INV-YYYY-NNNNNN` invoice number
- database-derived PO, Contract, Buyer, Manufacturer, currency, subtotal, snapshots, and line items
- initial tax/shipping/discount = `0`
- total starts equal to subtotal
- `payment_recorded=false`
- partial address draft save
- malformed address denial
- complete address save and normalization
- trimmed strings, uppercase `country_code`, blank `address_line2` omitted, unsupported keys dropped
- database recalculated total
- client total-forgery table update denied
- incomplete address issue denied
- complete invoice issue
- `issued_at` database-generated
- source PO unchanged after issue
- second issue denied
- exactly one `invoice_issued` event
- draft cancel, issued cancel, blank reason denial, overlong reason denial, repeated cancel denial
- Buyer read-only invoice, line item, and event access
- Buyer create/update/cancel denial
- Admin read-only access
- Admin mutation denial
- Anonymous read/RPC denial

Other Manufacturer credentials were not available in local smoke credentials; other-Manufacturer isolation is covered by rollback SQL.

## Real Concurrency Smoke

Two independent authenticated Manufacturer Supabase clients were used.

Result: `3/3` concurrency scenarios passed.

- Issue versus Issue: exactly one issue succeeded, final status `issued`, exactly one `invoice_issued` event.
- Cancel versus Cancel: exactly one cancel succeeded, final status `cancelled`, exactly one `invoice_cancelled` event.
- Issue versus Cancel: serialized to a valid lifecycle state, no impossible state, no duplicate lifecycle events, and timestamps were consistent with the successful transition order.

## Event Integrity

Verified event sequences:

- draft update then issue: `invoice_created`, `invoice_updated`, `invoice_issued`
- draft cancel: `invoice_created`, `invoice_cancelled`
- issued then cancel: `invoice_created`, `invoice_updated`, `invoice_issued`, `invoice_cancelled`

Confirmed actor identity is database-derived, invoice/PO/Contract numbers are database-derived, `payment_recorded=false`, `issued_means_sent=false`, unsafe impersonation/payment/provider-secret metadata is stripped, events are chronological, and exactly one lifecycle event is produced per successful transition.

## Browser Smoke

Local Vite server command:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 3000
```

Attempted browser commands:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new --disable-gpu --dump-dom http://127.0.0.1:3000/
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless --disable-gpu --no-sandbox --dump-dom http://127.0.0.1:3000/
```

Result: browser smoke blocked. Chrome exited successfully but returned an empty DOM for both attempts, matching the known local Chrome limitation in this environment. No Playwright, Puppeteer, Selenium, or other browser package was installed.

Browser smoke count: `0` executable role flows.

Console error count: unavailable due browser execution blocker.

Unsafe log count: unavailable due browser execution blocker.

Local port `3000` was cleared after stopping the Vite server.

## UI Semantics

Confirmed Invoice UI and helper text include the allowed PH-009A states and notices:

- Draft
- Issued
- Cancelled
- No payment has been recorded
- Tax is manually entered for invoice preparation only
- No automatic tax determination is performed

No positive payment/provider claims or controls were added. The invoice UI does not expose Pay Now, payment links, card/ACH/wire controls, refund controls, invoice email delivery, PDF generation, shipping, customs, fulfillment, or accounting integration controls.

`Due date` appears only as an invoice preparation date field, not as a lifecycle/payment status.

## Billing Address

PH-009A billing-address schema:

- `address_line1` required at issue
- `city` required at issue
- `state_region` required at issue
- `postal_code` required at issue
- `country_code` required at issue
- `address_line2` optional

Draft updates allow null or partial addresses but reject malformed supported fields. Issue-time validation requires a complete meaningful address. Required values must be strings, trimmed, non-empty, within length limits, and `country_code` must normalize to exactly two uppercase letters.

Normalization verified:

- trims supported string fields
- uppercases `country_code`
- omits blank `address_line2`
- drops unsupported keys

## Build, Tests, Secret Scan

Commands:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
```

Results:

- `npm.cmd ci`: passed, `0` vulnerabilities
- `npm.cmd run build`: passed
- Vite large-bundle warning remains
- `npm.cmd run test`: passed, `129/129`

Secret scan result: no matches. Excluded `node_modules`, `dist`, `.git`, env files, temp files, and ignored smoke artifacts.

## Final Status

Tracked working tree before documentation: clean.

Unrelated untracked files before documentation: none.

No production deployment occurred.

`auth-profiles` was not merged into `main`.

PH-009B was not started.

No payment gateway, automatic tax, invoice email/PDF, shipping, customs, fulfillment, refunds, credit memos, accounting integrations, or paid/overdue/refunded states were added.
