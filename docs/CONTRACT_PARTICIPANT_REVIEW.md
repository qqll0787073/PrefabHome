# PH-008B Contract Participant Review

PH-008B adds participant review for ready contracts. It does not implement electronic signatures, PDF generation, DocuSign, Adobe Sign, payments, invoices, shipping, customs, production milestones, notifications, workflow automation, legal effectiveness, or contract amendments.

## Migration

Migration: `supabase/migrations/0017_contract_participant_review.sql`

PH-008B is additive over PH-008A. Migrations `0001` through `0016` must remain unchanged.

## Contract Lifecycle

Contract statuses:

- `draft`
- `ready`
- `participant_review`
- `revision_requested`
- `accepted`
- `rejected`

Lifecycle rules:

- Buyer creates and edits a draft contract from a confirmed Purchase Order.
- Buyer marks a draft ready for participant review.
- Assigned Manufacturer opens a ready contract, moving it to `participant_review`.
- Assigned Manufacturer can accept, reject, or request revision from `participant_review`.
- Buyer can revise only title, governing law, and contract terms after `revision_requested`.
- Buyer can resubmit a revised contract, returning it to `ready` and incrementing `review_round`.
- Accepted and rejected contracts are terminal for PH-008B.

Acceptance in PH-008B means application-level acceptance only. It is not an electronic signature, legal execution event, payment trigger, invoice trigger, shipment trigger, or external workflow automation.

## Timestamp Model

Database-managed timestamps:

- `ready_at`: compatibility timestamp for the latest ready/resubmitted state.
- `first_ready_at`: first time the Buyer made the contract ready.
- `last_ready_at`: latest ready or resubmission time.
- `accepted_at`: set only when the assigned Manufacturer accepts the contract.
- `rejected_at`: set only when the assigned Manufacturer rejects the contract.

The client cannot forge lifecycle timestamps. Direct writes are blocked by trigger-level protection and public lifecycle changes go through trusted RPCs.

## Decision Table

Table: `public.contract_review_decisions`

Fields:

- `contract_id`
- `review_round`
- `manufacturer_id`
- `actor_profile_id`
- `decision`
- `reason`
- `created_at`

Decision values:

- `accepted`
- `rejected`
- `revision_requested`

There can be only one decision per contract review round. Rejection and revision requests require a reason. Actor identity, manufacturer identity, review round, and decision time are derived by the database.

## Trusted RPCs

Public authenticated RPCs:

- `record_contract_opened(contract_uuid uuid)`
- `accept_contract(contract_uuid uuid, note_text text default null)`
- `reject_contract(contract_uuid uuid, reason_text text)`
- `request_contract_revision(contract_uuid uuid, reason_text text)`
- `update_contract_revision(contract_uuid uuid, contract_title_text text, governing_law_text text, contract_terms_text text)`
- `resubmit_contract(contract_uuid uuid)`

Internal-only helpers and trigger functions explicitly revoke execution from `PUBLIC`, `anon`, and `authenticated`.

## Event Model

PH-008B adds trusted events:

- `contract_participant_opened`
- `contract_revision_requested`
- `contract_resubmitted`
- `contract_accepted`
- `contract_rejected`

Lifecycle events are created by database functions. Clients cannot insert arbitrary contract events or impersonate actors through event metadata.

## RLS Summary

Anonymous users have no contract or decision access.

Buyer:

- Can read their own contracts and decisions.
- Can update revision text only through `update_contract_revision` while status is `revision_requested`.
- Can resubmit through `resubmit_contract`.
- Cannot accept, reject, request revision, or forge events.

Manufacturer:

- Can read contracts assigned to their approved manufacturer profile.
- Can open, accept, reject, or request revision only for assigned contracts in the valid state.
- Cannot edit contract text or snapshots.

Admin:

- Can read all contracts, events, and decisions.
- Cannot impersonate Buyer or Manufacturer actions in PH-008B.
- Contract UI remains read-only.

## Frontend

Buyer Portal:

- Shows contract review round and participant decisions.
- Allows revision editing only after a Manufacturer requests revision.
- Supports resubmission to the assigned Manufacturer.

Manufacturer Portal:

- Shows assigned ready contracts.
- Records open-for-review.
- Presents accept, reject, and request-revision actions for `participant_review` contracts.
- Shows clear acceptance semantics and reason validation.

Admin Portal:

- Shows all contracts, events, decisions, and snapshots.
- Remains read-only.

## Verification

Rollback-only SQL verification:

- `supabase/tests/contract_participant_review_security.sql`

Expected behavior:

- Assigned Manufacturer can open and decide contracts.
- Other Manufacturers, Buyers, Admins, and Anonymous users cannot perform participant decisions.
- Buyer revision and resubmission are restricted to valid states.
- Decisions and events are trusted, database-derived, immutable, and scoped by review round.
- Terminal accepted and rejected contracts are immutable.

