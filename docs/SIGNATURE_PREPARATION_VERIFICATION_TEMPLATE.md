# PH-008C Signature Preparation Verification Template

## Scope

Verify PH-008C Signature Preparation only. Do not apply migration `0018` remotely until the PR is approved and merged. Do not deploy, merge, or begin PH-008D work.

Excluded from PH-008C:

- Electronic signatures
- Signature images
- PDF generation
- DocuSign or Adobe Sign
- Signing links
- Email invitations
- Provider webhooks
- Sent, viewed, signed, or completed states
- Legal-effectiveness logic
- Payments
- Invoices
- Shipping
- Customs
- Notifications
- Production milestones
- Workflow automation

## Migration Status

- Local migration: `0018_signature_preparation.sql`
- Expected remote migrations during PR review: `0001` through `0017`
- Expected local-only migration during PR review: `0018`
- Migrations `0001` through `0017` must be unchanged.

## SQL Verification

Command:

```powershell
npx.cmd supabase db query --linked --file supabase\tests\signature_preparation_security.sql
```

Expected:

- Rollback-only
- All checks pass
- No production data is modified

Checks should cover:

- Buyer can create one package from their own accepted contract.
- Non-accepted contracts are denied.
- Accepted contract decision is required.
- Duplicate package creation is denied.
- Manufacturer, Admin, Anonymous, and other Buyers cannot create packages.
- Package number is database-generated as `SIG-YYYY-NNNNNN`.
- Contract, Buyer, Manufacturer, decision, and signing-content snapshots are database-derived and immutable.
- Buyer signer placeholder is derived correctly.
- Manufacturer signer placeholder is derived correctly.
- Signing order is fixed as Buyer first and Manufacturer second.
- Buyer can update only the Buyer signer while the package is draft.
- Manufacturer can update only the Manufacturer signer while the package is draft.
- Other Manufacturers cannot update assigned signer data.
- Admin and Anonymous cannot update participants.
- Invalid signer email, blank name, and overlong title are denied.
- Package cannot be marked ready until both signer records are complete.
- Buyer can mark a complete draft package ready.
- Ready timestamp is database-derived.
- Ready packages are immutable.
- Manufacturer, Admin, and Anonymous cannot mark packages ready.
- Direct package, participant, and event writes are denied.
- Event updates and deletes are denied.
- Trusted events are created.
- Buyer, assigned Manufacturer, and Admin read access works.
- Other Buyer, other Manufacturer, and Anonymous reads are denied.
- The policy-only access helper is executable only to support RLS evaluation and does not bypass table policies.

## Frontend Verification

Buyer Portal:

- Eligible accepted contracts show a Prepare Signature Package action.
- Ineligible non-accepted contracts do not show the action.
- Buyer can create a package.
- Buyer can edit Buyer signer full name, email, and title while draft.
- Buyer cannot edit Manufacturer signer fields.
- Mark Ready to Send remains disabled until both signer records are complete.
- Ready package renders read-only.
- Ready copy states the package is prepared only and is not sent or signed.

Manufacturer Portal:

- Assigned packages are visible.
- Manufacturer can edit Manufacturer signer full name, email, and title while draft.
- Manufacturer cannot edit Buyer signer fields.
- Ready package renders read-only.
- No signing, sending, provider, or legal execution controls are exposed.

Admin Portal:

- All packages, participants, events, and snapshots are visible.
- No mutation controls are exposed.

## Validation Commands

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test
npx.cmd supabase db query --linked --file supabase\tests\signature_preparation_security.sql
```

Run a secret scan and confirm no credentials, tokens, service-role keys, signed URLs, signing-provider secrets, or generated signature assets were committed.

## Final Confirmation

- Migration `0018` remains local-only.
- Remote migrations remain `0001` through `0017`.
- Migrations `0001` through `0017` are unchanged.
- No deployment occurred.
- No merge occurred.
- No PH-008D work occurred.
- No excluded signature-provider or legal-effectiveness features were implemented.
