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

Credentials source: `.env.smoke.local`.

Result: passed.

Verified through normal Supabase Auth:

- Admin login passed.
- Admin profile role is `admin`.
- Admin RFQ Management data loads.
- Admin can read RFQs.
- Admin can read RFQ messages.
- Admin can read RFQ timeline events.
- Invalid role update is rejected.
- Direct arbitrary RFQ event insert is rejected.
- Invalid lifecycle transition is rejected.
- Admin RFQ UI is read-only in PH-006A.

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

Result: passed.

Follow-up on 2026-07-14: the in-app browser control timed out, so the real-browser smoke was completed with local Chrome against the local Vite server.

Browser results:

- Buyer browser result: passed.
  - Signed in through the UI.
  - Opened marketplace product detail.
  - Opened Request Quote dialog.
  - Created a draft RFQ.
  - Deleted the draft RFQ.
  - Created and submitted an RFQ.
  - Opened `My RFQs`.
  - Opened the RFQ conversation.
- Manufacturer browser result: passed.
  - Signed in through the UI.
  - Opened RFQ Inbox.
  - Opened submitted RFQ conversation.
  - Posted a manufacturer reply.
  - Confirmed the reply displayed in the conversation.
  - The current PH-006A UI does not expose a manufacturer status-transition control; the `submitted -> manufacturer_review` transition remains verified through SQL and authenticated API smoke.
- Admin browser result: passed.
  - Signed in through the UI.
  - Opened RFQ Management.
  - Opened RFQ detail/conversation.
  - Confirmed RFQ conversation is read-only for Admin.
  - Timeline event rows are readable through the Admin API smoke and SQL verification; PH-006A UI does not render a separate timeline panel.
- Console error count: `0`.
- Unsafe logging result: `0` unsafe console matches.
- No credentials, access tokens, refresh tokens, or full signed URLs were logged.

Note: the first Chrome run surfaced `/favicon.ico` 404 console errors. `index.html` now declares an inline empty favicon to suppress the browser's implicit favicon request, and the final browser smoke completed with `0` console errors.

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
- Browser smoke: passed with `0` console errors and `0` unsafe console matches.

Secret scan:

- No credential values found.
- Matches were safe code identifiers or documentation placeholders such as `signed_url`, `SUPABASE_SERVICE_ROLE_KEY`, and smoke variable names.

## Final Safety Checks

- No deployment occurred.
- PH-006B was not started.
- No service-role key was used in frontend code.
- `.env.smoke.local` remains ignored by Git.
