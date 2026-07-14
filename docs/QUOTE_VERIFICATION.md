# PH-006B Quote Builder Verification

Date: 2026-07-14

Branch: `auth-profiles`

PR: #8

Merge commit: `2b4cd2eb4bf586b570c52cab2dd3ec85cf48509a`

## Migration

Migration `supabase/migrations/0012_quote_builder.sql` was applied through the normal linked Supabase CLI flow:

```bash
npx.cmd supabase db push --yes
```

Result: passed. The remote migration list contains `0001` through `0012`.

No manual database edits were made. Authenticated smoke data was created only through normal Supabase Auth clients and application RPC/table flows.

## Remote Migration List

- `0001`
- `0002`
- `0003`
- `0004`
- `0005`
- `0006`
- `0007`
- `0008`
- `0009`
- `0010`
- `0011`
- `0012`

Migrations `0001` through `0011` were confirmed unchanged.

## Rollback SQL Verification

Command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/quote_security.sql
```

Result: passed, `38/38`.

Confirmed:

- Manufacturer ownership isolation
- Buyer draft hiding
- Admin read access
- Anonymous denial
- database-derived `manufacturer_id`
- database-derived `created_by`
- database-derived `version`
- database-derived item `amount`
- database-derived `subtotal`
- submitted quote immutability
- submitted item immutability
- initial quote submission
- revision quote submission
- previous submitted quote becomes `superseded`
- RFQ remains `quoted` for revision submission
- only one current submitted quote per RFQ
- `quote_created` is trusted and database-generated
- direct internal helper calls are denied
- duplicate submission is denied

## Authenticated Smoke

Credentials were read only from ignored local environment files. No passwords, access tokens, refresh tokens, or credentials were printed or committed. No service-role key was used.

### Manufacturer

Result: passed through normal Supabase Auth and application data paths.

Verified:

- Manufacturer login succeeded
- `public.profiles.role` is `manufacturer`
- RFQ Inbox data loaded for an eligible submitted RFQ
- Create Quote worked
- draft version was database-derived
- quote metadata saved
- product line item added
- freight line item added
- line item amount was database-derived
- subtotal was database-derived
- initial Quote submitted
- Quote became submitted/read-only at database level
- RFQ moved to `quoted`
- trusted `quote_created` event was created
- revision created
- revision version incremented
- revision copied metadata and line items
- revision draft metadata and line items could be edited
- revision submitted
- previous submitted Quote became `superseded`
- revision became the only current submitted Quote
- RFQ remained `quoted`
- duplicate submission was rejected
- Manufacturer isolation query did not expose another Manufacturer Quote

### Buyer

Result: passed through normal Supabase Auth and application data paths.

Verified:

- Buyer login succeeded
- `public.profiles.role` is `buyer`
- Buyer-owned RFQ quote history loaded
- submitted Quote was visible
- superseded historical Quote was visible
- draft revision was hidden before submission
- line items were visible
- subtotal was visible
- Incoterm was visible
- production and shipping lead times were visible
- valid-until date was visible
- Manufacturer note was visible
- submitted time was visible
- Quote versions were ordered newest first
- Buyer quote update was rejected/no-op by RLS
- Buyer quote item update was rejected/no-op by RLS
- PH-006C actions remain deferred

### Admin

Result: passed through normal Supabase Auth and application data paths.

Verified:

- Admin login succeeded
- `public.profiles.role` is `admin`
- RFQ Management data loaded
- Quote versions were readable
- Quote line items were readable
- Buyer and Manufacturer references were readable
- submitted and superseded statuses were visible
- Admin Quote mutation was rejected/no-op by RLS
- direct arbitrary `quote_created` event insert was rejected
- invalid RFQ lifecycle transition was rejected

## Revision Smoke

Result: passed.

Verified:

- initial Quote submitted from `manufacturer_review`
- RFQ moved to `quoted`
- revision draft created from submitted Quote
- revision version was database-derived as the next version
- revision copied line items
- Buyer could not see the draft revision
- revision submitted while RFQ was already `quoted`
- previous Quote became `superseded`
- revision became the only current submitted Quote
- RFQ remained `quoted`
- duplicate revision submission was rejected

## Browser Smoke

Result: blocked by local browser automation tooling.

The local Vite app started successfully. A second verification attempt used local Chrome through Chrome DevTools Protocol without adding Playwright or Puppeteer. Chrome launched and the Manufacturer account signed in successfully, but the automation could not activate the RFQ list action (`Open RFQ` / `Quote`) to select an RFQ and load the Quote Builder panel. The same action was attempted with Chrome mouse events, keyboard activation, and a narrow rendered-button handler fallback; none produced the selected RFQ UI state in the automated session.

Because the RFQ could not be selected in the automated local Chrome session, the full Manufacturer, Buyer, Admin, and console browser smoke remains unresolved.

- Manufacturer browser result: blocked after successful sign-in; RFQ list action could not be activated by automation
- Buyer browser result: not run after Manufacturer browser blocker
- Admin browser result: not run after Manufacturer browser blocker
- Browser console error count: blocked
- Unsafe log count: blocked
- Access token logging: blocked
- Refresh token logging: blocked
- Password logging: blocked
- Full signed URL logging: blocked

## Build And Tests

`npm ci`: passed, 0 vulnerabilities.

`npm run build`: passed. Vite emitted the existing non-blocking `>500 kB` chunk-size warning.

`npm run test`: passed, `58/58`.

## Secret Scan

Result: passed.

The scan found no credential values. Matches were existing documentation placeholders or safe environment variable names such as `SUPABASE_SERVICE_ROLE_KEY`, `signed_url`, and smoke variable names.

No service-role key was found in frontend code.

`.env.local` and `.env.smoke.local` remain ignored by Git.

## Deployment And Scope

Deployment status: no production deployment occurred.

Main merge status: no merge to `main` occurred.

PH-006C status: not started.

## Unresolved Items

- Complete the real browser smoke once browser control can activate RFQ list actions reliably in local Chrome.
- Complete browser console safety checks for Manufacturer, Buyer, and Admin after the browser smoke can run.
