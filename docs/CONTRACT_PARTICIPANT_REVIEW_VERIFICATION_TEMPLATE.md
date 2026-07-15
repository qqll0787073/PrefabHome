# PH-008B Contract Participant Review Verification Template

## Scope

Verify PH-008B Contract Participant Review only. Do not apply migration `0017` remotely until the PR is approved and merged. Do not deploy, merge, or begin PH-008C work.

Excluded from PH-008B:

- Electronic signatures
- PDF generation
- DocuSign or Adobe Sign
- Payments
- Invoices
- Shipping
- Customs
- Production milestones
- Notifications
- Workflow automation
- Legal effectiveness
- Contract amendments

## Migration Status

- Local migration: `0017_contract_participant_review.sql`
- Expected remote migrations during PR review: `0001` through `0016`
- Expected local-only migration during PR review: `0017`
- Migrations `0001` through `0016` must be unchanged.

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase\tests\contract_participant_review_security.sql
```

Expected:

- Rollback-only
- All checks pass
- No production data is modified

Checks should cover:

- Assigned Manufacturer can open a ready contract.
- Opening moves `ready` to `participant_review`.
- Repeated open in the same round is deduplicated.
- Buyer, Admin, Anonymous, and other Manufacturers cannot open.
- Assigned Manufacturer can accept from `participant_review`.
- Assigned Manufacturer can reject from `participant_review`.
- Assigned Manufacturer can request revision from `participant_review`.
- Reject and revision request require a reason.
- Decisions are one per contract review round.
- Decision actor, manufacturer, round, and timestamp are database-derived.
- Direct contract event forgery is denied.
- Direct decision inserts, updates, and deletes are denied.
- Buyer can update revision text only after `revision_requested`.
- Buyer can resubmit a requested revision.
- Resubmission increments `review_round`.
- `first_ready_at` is preserved and `last_ready_at` is updated.
- Previous decisions remain visible after resubmission.
- New review round permits a new Manufacturer decision.
- Accepted and rejected contracts are immutable.
- Anonymous users cannot read contracts or decisions.

## Frontend Verification

Buyer Portal:

- Contract summary shows first ready, last ready when applicable, and review round.
- Requested revision displays the Manufacturer reason.
- Buyer can edit title, governing law, and terms only during `revision_requested`.
- Buyer can resubmit a revised contract.
- Accepted and rejected contracts render read-only.

Manufacturer Portal:

- Assigned ready contracts are visible.
- Open for Review moves the contract into participant review.
- Accept Contract, Reject Contract, and Request Revision are available only in participant review.
- Reject and Request Revision require a reason.
- Decision history remains visible after a decision.
- Acceptance copy states that PH-008B acceptance is not signing or legal execution.

Admin Portal:

- All contracts, events, decisions, and snapshots are visible.
- No mutation controls are exposed.

## Validation Commands

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
npx.cmd supabase db query --linked --file supabase\tests\contract_participant_review_security.sql
```

Run a secret scan and confirm no credentials, tokens, service-role keys, or signed URLs were committed.

## Final Confirmation

- Migration `0017` remains local-only.
- Remote migrations remain `0001` through `0016`.
- Migrations `0001` through `0016` are unchanged.
- No deployment occurred.
- No merge occurred.
- No PH-008C work occurred.
