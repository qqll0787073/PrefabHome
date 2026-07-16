# PH-008D Signature Delivery Foundation Verification Template

## Scope

Verify PH-008D Signature Delivery Foundation only. Do not apply migration `0019` remotely until the PR is approved and merged. Do not deploy, merge, or begin PH-009 work.

Excluded from PH-008D:

- Real electronic signatures
- Signature images
- PDF generation
- DocuSign or Adobe Sign
- Signing links
- Email invitations
- Provider webhooks
- Sent, viewed, signed, declined, or completed states
- Contract execution
- Legal effectiveness
- Payments
- Invoices
- Shipping
- Customs
- Notifications
- Milestones
- Workflow automation

## Migration Status

- Local migration: `0019_signature_delivery_foundation.sql`
- Expected remote migrations during PR review: `0001` through `0018`
- Expected local-only migration during PR review: `0019`
- Migrations `0001` through `0018` must be unchanged.

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase\tests\signature_delivery_foundation_security.sql
```

Expected:

- Rollback-only
- All checks pass
- No production data is modified

Checks should cover:

- Buyer can create a delivery request from own `ready_to_send` Signature Package.
- Non-ready Signature Package is denied.
- Other Buyer, Manufacturer, Admin, and Anonymous creation denied.
- Duplicate request denied.
- Delivery number is database-generated as `SDL-YYYY-NNNNNN`.
- Provider key is `unconfigured`.
- Package, recipient, and request-payload snapshots are database-derived.
- Recipients are derived from PH-008C participants.
- Exactly Buyer signer and Manufacturer signer are created.
- Fixed signing order is preserved.
- Recipient `delivery_status` remains `pending`.
- Queue allowed only from `delivery_draft`.
- Queue sets database-generated `queued_at`.
- Queue does not set sent/viewed/signed/completed state.
- Queue event is trusted and database-generated.
- Cancel allowed from `delivery_draft` and `queued`.
- Cancellation requires a reason.
- Cancel sets database-generated `cancelled_at`.
- Cancelled request is terminal.
- Direct request, recipient, and event insert/update/delete are denied.
- Events are immutable and undeletable.
- Impersonation and provider-secret metadata keys are stripped.
- Buyer, assigned Manufacturer, and Admin read access works.
- Other Manufacturer and Anonymous reads are denied.
- Policy helper does not bypass table policies.

## Frontend Verification

Buyer Portal:

- Prepare Signature Delivery appears only for `ready_to_send` packages without a request.
- Draft delivery shows Provider: Not configured.
- Recipients and fixed signing order are visible.
- Queue Internally is available only for draft requests.
- Queue confirmation says no provider is contacted, no email is sent, no signing link is created, and the Contract is not signed.
- Queued UI states Queued internally and Not sent to a signature provider.
- Cancel Request requires a reason.
- Cancelled state is read-only.

Manufacturer Portal:

- Assigned delivery requests are visible.
- Recipients and signing order are visible.
- No queue, cancel, send, sign, provider, PDF, or email controls are exposed.
- Copy states no signature invitation has been sent.

Admin Portal:

- All delivery requests, recipients, snapshots, and events are visible.
- No mutation controls are exposed.

## Queued Semantics

Explicitly confirm:

- queued != sent
- queued != delivered
- queued != signed
- queued != completed
- queued != executed
- queued != effective

## Validation Commands

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
npx.cmd supabase db query --linked --file supabase\tests\signature_delivery_foundation_security.sql
```

Run a secret scan and confirm no credentials, tokens, service-role keys, signing-provider secrets, webhook secrets, signing links, or generated signature assets were committed.

## Final Confirmation

- Migration `0019` remains local-only.
- Remote migrations remain `0001` through `0018`.
- Migrations `0001` through `0018` are unchanged.
- No deployment occurred.
- No merge occurred.
- No real provider integration occurred.
- No external network calls were added.
- No PH-009 work occurred.
