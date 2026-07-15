# PH-007B Manufacturer PO Confirmation Verification

Date: July 14, 2026

Branch: `auth-profiles`

Linked Supabase project ref: `eoyfrjbjglfudfuwxdf`

PR #11 merge commit: `65a6fbd71b0354843cb807dd959a13c886332a8b`

Included implementation commit: `21a5e7027d19879bbf0e4f18377a347090d7cddb`

## Migration

Migration applied through the linked Supabase CLI flow:

```bash
npx.cmd supabase db push --yes
```

Result:

- `0015_manufacturer_po_confirmation.sql` applied successfully.
- Remote migrations list confirmed `0001` through `0015`.
- Migration `0015` appears exactly once in the remote migration list.
- No manual database edits were performed outside the migration.
- Migrations `0001` through `0014` were confirmed unchanged.

## SQL Verification

Rollback-only command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/purchase_order_confirmation_security.sql
```

Result: `48/48` checks passed.

Coverage confirmed:

- assigned Manufacturer open
- other Manufacturer denied
- Buyer/Admin/Anonymous open denied
- `submitted` to `manufacturer_review`
- opened event deduped per round
- confirm, reject, and revision request
- reason validation
- one decision per review round
- concurrent/same-round decision protection
- immutable decisions
- immutable confirmed/rejected PO
- Buyer limited revision update
- Buyer resubmit
- `review_round` increment
- `submitted_at` preservation
- `last_submitted_at` update
- previous round decisions preserved
- Buyer/Manufacturer/Admin read boundaries
- Anonymous denied

Note: after migration `0015` was applied, the rollback-only SQL harness needed one idempotency support fix to drop `purchase_orders_review_round_check` before replaying the local verification DDL inside the rollback transaction. This did not change production schema or migration behavior.

## Authenticated Smoke

Credentials were read only from ignored local files. No passwords, access tokens, refresh tokens, session objects, service-role keys, or full signed URLs were printed.

Result: `50/50` checks passed.

Buyer:

- signed in through normal Supabase Auth
- created accepted-Quote-backed PO draft
- submitted PO
- confirmed `review_round = 1`
- confirmed `submitted_at` is set
- confirmed `last_submitted_at = submitted_at` on first submission
- viewed Manufacturer revision reason
- edited Buyer reference, Buyer note, and requested delivery date
- verified commercial terms and items remained unchanged
- resubmitted PO
- confirmed `review_round = 2`
- confirmed `submitted_at` remained unchanged
- confirmed `last_submitted_at` advanced
- confirmed `po_resubmitted` event exists
- confirmed prior revision decision remains readable

Manufacturer:

- signed in through normal Supabase Auth
- viewed assigned submitted PO
- opened PO for review
- verified `submitted` to `manufacturer_review`
- reopened same PO and verified no duplicate opened event for the same actor and round
- requested revision with reason
- opened round 2 after Buyer resubmission
- verified a new opened event was allowed for round 2
- confirmed PO
- verified reject flow using a separate PO
- verified direct commercial mutation path was blocked

Admin:

- signed in through normal Supabase Auth
- read PH-007B POs
- read decision history
- read review rounds
- read actors and reasons
- read event timeline
- verified Manufacturer decision RPCs were denied
- verified Buyer resubmit impersonation was denied

Anonymous:

- verified no PO decision access
- verified no PO event access

Smoke records were isolated with PH-007B smoke labels. Terminal PO lifecycle records are immutable by design, so they were retained as audit artifacts rather than manually deleted.

## Browser Smoke

Local Vite URL: `http://127.0.0.1:3000/`

Result: `26/26` checks passed.

Buyer UI:

- signed in
- opened Purchase Orders
- verified submitted PO displays first Submitted timestamp
- verified first-round duplicate Last submitted is hidden
- verified revision-requested PO displays Manufacturer reason
- verified only non-commercial revision fields are editable
- verified Save Revision works
- verified Resubmit confirmation includes PO number, next review round, and unchanged commercial terms
- verified after resubmit, Submitted remains first timestamp and Last submitted shows latest timestamp
- verified terminal PO views are read-only

Manufacturer UI:

- signed in
- verified submitted PO shows Open for Review
- opened PO for review
- verified decision controls appear only during `manufacturer_review`
- verified Confirm action works
- verified Reject requires a reason before transition
- verified Reject with reason works
- verified revision confirmation text states commercial terms remain immutable
- verified terminal PO has no decision controls

Admin UI:

- signed in
- verified Purchase Order Management loads
- verified review round display
- verified decision history and reasons display
- verified first Submitted and Last submitted display where applicable
- verified Confirmed or Rejected timestamps display
- verified event timeline display
- verified no mutation controls are exposed

Browser console:

- console errors: `0`
- unhandled promise rejections: `0`
- unsafe log matches: `0`
- no credentials logged
- no access or refresh tokens logged
- no full signed URLs logged

## Review-Round And Timestamp Verification

- Round 1 submission sets `submitted_at` and `last_submitted_at`.
- First-round UI shows Submitted from `submitted_at`.
- First-round UI hides duplicate Last submitted when `last_submitted_at = submitted_at`.
- Resubmission increments `review_round`.
- Resubmission preserves `submitted_at`.
- Resubmission advances `last_submitted_at`.
- Multi-round UI shows both Submitted and Last submitted.

## Decision And Event Verification

- Manufacturer decisions are immutable.
- Only one decision is allowed per PO review round.
- Prior round decisions remain readable after resubmission.
- `po_manufacturer_opened` dedupes per actor and review round.
- New review rounds allow a new Manufacturer opened event.
- `po_resubmitted`, `po_confirmed`, `po_rejected`, and `po_revision_requested` events are trusted and database-generated.

## Authorization Verification

Buyer revision scope:

- Buyer can update only Buyer reference, Buyer note, and requested delivery date during `revision_requested`.
- Buyer cannot mutate commercial terms, line items, snapshots, decisions, or events.

Manufacturer authorization:

- assigned Manufacturer can open, confirm, reject, or request revision through trusted RPCs.
- Manufacturer direct table mutation of commercial PO data is blocked.
- other-Manufacturer denial is covered by the rollback-only SQL verification.

Admin read-only:

- Admin can read POs, items, snapshots, decisions, and events.
- Admin cannot call Manufacturer decision RPCs.
- Admin cannot impersonate Buyer resubmission.
- Admin UI exposes no PO mutation controls.

Anonymous:

- Anonymous cannot read PO decisions or events.

## Build And Test

```bash
npm.cmd ci
npm.cmd run build
npm.cmd run test
```

Results:

- `npm.cmd ci`: passed with `0` vulnerabilities.
- `npm.cmd run build`: passed.
- Existing Vite warning remains: one generated chunk is larger than 500 kB after minification.
- `npm.cmd run test`: passed, `90/90`.

## Secret Scan

Repository secret scan excluded generated/vendor files.

Result:

- no credential values found
- safe matches were limited to existing code identifiers and documentation placeholders such as `signed_url` and `SUPABASE_SERVICE_ROLE_KEY`

## Final Confirmations

- No production deployment occurred.
- `auth-profiles` was not merged into `main`.
- No contract, payment, invoice, shipping, customs, notification, PDF export, or electronic-signature work was started.
- Local port `3000` was cleared after browser smoke.
