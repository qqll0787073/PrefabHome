# PH-008B Contract Participant Review Verification

Date: 2026-07-15

Branch: `auth-profiles`

Linked Supabase project ref: `eoyrfrjbjglfudfuwxdf`

PR #13 merge commit: `a393746e5b9d0963e4993f2d6ee1f77bc4aad186`

Included implementation commit: `41ae1c6d7d72ed0d1b940603ae69e9817d53775b`

## Migration Status

Command:

```powershell
npx.cmd supabase db push --yes
```

Result:

- `0017_contract_participant_review.sql` applied successfully through the linked Supabase CLI flow.
- Remote migrations show `0001` through `0017`.
- `0017` is applied exactly once.
- No manual database edits were performed.
- Migrations `0001` through `0016` remain unchanged.

## Rollback-Only SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase\tests\contract_participant_review_security.sql
```

Result: `45/45` checks passed.

Coverage confirmed:

- Assigned Manufacturer opens a ready Contract.
- `ready` transitions to `participant_review`.
- Duplicate opened event per actor and round is deduped.
- Other Manufacturer, Buyer, Admin, and Anonymous open attempts are denied.
- Assigned Manufacturer can accept, reject, and request revision.
- Reject and revision-request reasons are required.
- Optional acceptance note is accepted and bounded by reason length.
- Other Manufacturer, Buyer, Admin, and Anonymous decision attempts are denied.
- Actor, Manufacturer, review round, and timestamp are database-derived.
- One decision per Contract round is enforced.
- Concurrent or same-round duplicate decisions are blocked.
- Decision rows are immutable and undeletable.
- Accepted and rejected Contracts are immutable.
- Revision-requested commercial data is immutable.
- Buyer limited revision update is allowed.
- Other Buyer, Manufacturer, and Admin revision attempts are denied.
- Buyer resubmit is allowed after a revision request.
- Revision-request decision is required before resubmit.
- Resubmit increments `review_round`.
- `first_ready_at` is preserved.
- `last_ready_at` advances.
- `ready_at` remains consistent with `last_ready_at`.
- Resubmit returns status to `ready`.
- Trusted resubmit event is generated.
- Prior-round decisions remain preserved.
- New round permits a new decision.
- Trusted opened, accepted, rejected, revision-requested, and resubmitted events are generated.
- Direct event insert, update, and delete are denied.
- Event metadata impersonation keys are stripped.
- Buyer read isolation, assigned Manufacturer read, other Manufacturer denial, Admin read, and Anonymous denial are enforced.

Test-harness-only adjustment:

- After `0017` was applied remotely, the rollback harness initially collided with the existing `contracts_review_lifecycle_check` constraint while replaying the migration setup inside a transaction.
- The harness now drops that constraint with `drop constraint if exists` before recreating it in the rollback transaction.
- Migration `0017` and production schema semantics were not changed.

## Authenticated API Smoke

Credentials source: ignored local `.env.smoke.local`.

Result: `108/108` checks passed.

Verified through normal Supabase Auth clients:

- Buyer sign-in and role check.
- Manufacturer sign-in, approved Manufacturer lookup, and assigned product lookup.
- Admin sign-in and role check.
- Isolated RFQ, Quote, accepted Quote, Purchase Order, confirmed Purchase Order, and Contract records were created through normal application RPC/table flows.
- Buyer created a Contract draft, populated title, governing law, and terms, and marked it ready.
- First ready state had `review_round = 1`.
- `first_ready_at`, `last_ready_at`, and `ready_at` were set consistently.
- Buyer could not call Manufacturer open or decision RPCs.
- Assigned Manufacturer read the ready Contract, opened it, and repeated open was deduped in the same round.
- Manufacturer requested revision with a required reason.
- Revision decision stored database-derived actor, manufacturer, round, and timestamp values.
- Buyer read the revision reason.
- Buyer updated only title, governing law, and terms.
- Contract number, PO ID, PO number, Buyer ID, Manufacturer ID, currency, subtotal, and all snapshots remained unchanged.
- Buyer resubmitted the Contract.
- Resubmit returned status to `ready`, incremented `review_round` to `2`, preserved `first_ready_at`, advanced `last_ready_at`, and kept `ready_at = last_ready_at`.
- Prior-round revision decision remained readable.
- `contract_resubmitted` event existed.
- Round 2 Manufacturer open generated a new opened event.
- Manufacturer accepted with an optional note.
- Accepted Contract had `accepted_at` set and `rejected_at` null.
- Round 2 accepted decision existed.
- Accepted event existed.
- Round 1 revision decision remained unchanged.
- Accepted Contract could not be modified or decided again.
- Separate reject flow verified empty rejection reason denial, rejection with reason, `rejected_at` set, `accepted_at` null, rejected event, and rejected Contract immutability.
- Direct event insert, update, and delete were denied.
- Decision update and delete were denied.
- Duplicate same-round decision was denied.
- Admin could read Contracts, decisions, events, review rounds, actors, reasons, timestamps, and snapshots.
- Admin Manufacturer RPCs and Buyer revision/resubmit RPCs were denied.
- Anonymous Contract, decision, event, and RPC access was denied.
- Chronological event sequence was verified for the multi-round flow:
  `contract_created`, `contract_updated`, `contract_ready`, `contract_participant_opened`, `contract_revision_requested`, `contract_updated`, `contract_resubmitted`, `contract_participant_opened`, `contract_accepted`.

No passwords, access tokens, refresh tokens, sessions, service-role keys, or full signed URLs were printed.

## Browser Smoke

Local Vite URL: `http://127.0.0.1:3000/`

Browser: local Chrome through CDP. No Playwright or Puppeteer was added.

Result: `68/68` checks passed.

Buyer browser verification:

- Buyer signed in through the UI.
- Contracts page loaded.
- Review Round 1 rendered.
- First ready timestamp rendered.
- Duplicate Last ready timestamp was hidden in round 1.
- Revision Requested state rendered with Manufacturer reason.
- Revision editor exposed title, governing law, and contract terms.
- Save Revision worked.
- Resubmit confirmation included Contract number, next review round, PO pricing unchanged, line items unchanged, ownership unchanged, and snapshots unchanged.
- Resubmit worked.
- Review Round 2 rendered.
- First-ready time remained visible and Last-ready time appeared after resubmission.
- Accepted Contract rendered as Accepted by Manufacturer.
- Ready for future signature workflow text rendered.
- Rejected Contract rendered.
- Accepted/rejected Contracts were read-only.
- No positive signature, execution, legal-binding, payment, invoice, or shipment claims were detected in Buyer contract content.

Manufacturer browser verification:

- Manufacturer signed in through the UI.
- Contract Inbox loaded.
- Ready Contract showed Open for Review.
- Opening enabled participant review controls.
- Accept Contract, Request Revision, and Reject Contract controls appeared only in participant review.
- Accept confirmation explicitly stated that acceptance does not sign the Contract, does not make it executed, and does not make it legally effective.
- Accept decision was recorded.
- After decision, no Buyer revision controls were exposed.
- Accepted/rejected Contract rows did not expose a decision editor.

Admin browser verification:

- Admin signed in through the UI.
- Contract Management loaded.
- Review round values rendered.
- Decision rows rendered in order by round and timestamp.
- Reasons and timestamps rendered.
- First-ready and lifecycle timestamps rendered.
- Accepted and rejected timestamps rendered where applicable.
- Event timeline rows rendered through event labels.
- Snapshot/source identifiers rendered.
- No Contract mutation controls were exposed in Admin Contract Management.

Browser console verification:

- Console errors: `0`
- Unhandled promise rejections: `0`
- Unsafe logs: `0`
- No credentials, access tokens, refresh tokens, or full signed URLs were logged.

Notes:

- The in-app browser connector timed out during setup, so browser verification was completed with local Chrome/CDP against the local Vite server.
- A local Chrome profile was moved outside the repository after Vite attempted to watch Chrome cache files in an earlier temp profile location.
- Request-revision required-reason behavior and immutable-snapshot confirmation are fully covered by SQL, API, and unit tests; the final browser pass focused on stable visible controls, successful accept flow, rendering, and console safety.

## Review-Round And Timestamp Integrity

Explicitly verified:

- First ready: `review_round = 1`, `first_ready_at = last_ready_at = ready_at`.
- Revision request: `review_round` unchanged and ready timestamps unchanged.
- Resubmit: `review_round` increments exactly by `1`, `first_ready_at` is preserved, `last_ready_at` advances, and `ready_at = last_ready_at`.
- Accept: `accepted_at` set and `rejected_at` null.
- Reject: `rejected_at` set and `accepted_at` null.
- Accepted and rejected lifecycle timestamp fields cannot be forged directly.
- Lifecycle timestamps are database-generated and not accepted from client input.

## Event And Decision Integrity

Verified:

- Opened event dedupes only within the same actor and review round.
- New review round permits a new opened event.
- Event actor is database-derived.
- `review_round` in event metadata is database-derived.
- `decision_id` in event metadata is database-derived.
- Impersonation metadata keys are stripped.
- Direct event insert, update, and delete are denied.
- Decision actor, manufacturer, review round, and timestamp are database-derived.
- One decision per round is enforced.
- Decision rows are immutable and undeletable.
- Prior-round history is preserved after resubmission.

## Build And Test

Commands:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
```

Results:

- `npm.cmd ci`: passed with `0` vulnerabilities.
- `npm.cmd run build`: passed.
- Existing Vite chunk-size warning remains.
- `npm.cmd run test`: passed, `100/100`.

Transient validation note:

- The first `npm.cmd ci` attempt failed with `EPERM` while unlinking `node_modules\@esbuild\win32-x64\esbuild.exe` because the local Vite dev server was still running.
- After stopping the local Vite process, `npm.cmd ci` passed.

## Secret Scan

Command:

```powershell
rg -n --hidden -S "(service_role|supabase_service|SECRET|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|api[_-]?key|anon[_-]?key|access_token|refresh_token|password\s*[:=]|PREFAB_.*PASSWORD|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})" -g "!node_modules" -g "!dist" -g "!.git" -g "!.env*" -g "!.tmp-*"
```

Result: no matches.

## Final Confirmation

- No deployment occurred.
- No merge to `main` occurred.
- PH-008C was not started.
- No electronic signatures, PDF generation, DocuSign, Adobe Sign, payments, invoices, shipping, customs, notifications, production milestones, workflow automation, legal-effectiveness logic, amendments, or change orders were implemented.
