# Demo Data And Demo Runbook

## Safety Rules

- Use staging only. Never run this demo against production.
- Load credentials from ignored local environment files or a secret store; never print or commit them.
- Run `scripts/test-infrastructure/staging-safety.mjs` before any fixture write.
- Use a unique fixture prefix and record exact IDs in the ignored fixture manifest.
- Clean in reverse dependency order and delete only exact fixture IDs.
- Do not present internal preparation states as external actions.

## Why There Is No One-Command Remote Demo Seeder

The repository includes guarded staging fixture helpers and exact-ID cleanup infrastructure, but a general remote seeder would require privileged credentials and could create broad destructive behavior. Beta demo preparation therefore remains an operator-reviewed runbook. Existing smoke scripts are intended for approved staging verification and must not be repurposed for production.

The optional static marketplace demo is separate: set `VITE_ENABLE_MARKETPLACE_DEMO=true` only for local UI development. It does not create Supabase records or support the transaction chain.

## Recommended Demo Dataset

Create unique, synthetic records with no personal data:

- one Buyer Auth/profile
- one approved Manufacturer Auth/profile/application
- one unrelated Manufacturer for isolation checks
- one Admin Auth/profile
- one published Product with one public image and one private document
- one RFQ with conversation and submitted/revised Quote history
- one accepted Quote and confirmed Purchase Order
- one accepted Contract and signature preparation/delivery records
- one issued Invoice and optional recorded external payment
- one ready Shipping Readiness record
- one submitted Logistics Booking Request
- two provider candidates: freight forwarder/ocean and carrier/trucking
- one selected provider and an internal readiness state

Use obviously synthetic emails on an approved test domain and a prefix such as `beta_demo_<timestamp>_<random>`.

## Demo Preparation

1. Confirm branch/SHA and clean worktree.
2. Load the ignored staging environment locally.
3. Run the staging safety guard and confirm the staging project ref.
4. Confirm remote migrations are exactly `0001` through `0024` and no migration is pending.
5. Run `npm run verify:beta`.
6. Create the upstream business chain through normal Auth and trusted application/RPC flows wherever practical.
7. Store exact created IDs in `.tmp/staging-fixtures/<prefix>.json`.
8. Verify each role sees only its permitted data.
9. Start the app with the staging URL/publishable key and demo flag disabled.

## Suggested 15-Minute Demo

1. **Public/Buyer:** browse the Product, open signed imagery, submit an RFQ, inspect Quote history, and show the accepted decision.
2. **Manufacturer:** show onboarding approval, Product workflow, RFQ/Quote, confirmed Purchase Order, Invoice, Shipping Readiness, and submitted Logistics Booking Request.
3. **Admin:** show review queues, immutable transaction context, signature preparation limitation, provider candidates, selection, and internal readiness.
4. **Buyer again:** show only participant-safe Logistics details and explain that no carrier booking occurred.

## Cleanup

Run cleanup in reverse dependency order using exact IDs: arrangement events/selections/candidates, booking events/requests, Shipping, payment records/events, Invoices, signature records, Contracts, Purchase Orders, Quotes, RFQs/messages/events, media objects/metadata, Products, Manufacturers/profiles, then temporary Auth users.

After cleanup, query every fixture category and confirm zero residue. Remove local temporary images, manifests, browser profiles, logs, and generated output. Do not delete permanent migrations or schema objects.

## Partial Failure

Stop creating records as soon as an assertion fails. Preserve the ignored exact-ID manifest, sanitize the error, and execute cleanup in `finally`/reverse dependency order. If cleanup is incomplete, do not rerun with the same prefix or use broad name-based deletion. Report remaining table/category counts, obtain operator review, and remove only recorded exact IDs. Delete temporary Auth users last. Production remains prohibited even during recovery.

## Demo Acceptance

- All role logins succeed.
- Browser console errors and unsafe logs are zero.
- Cross-role and anonymous isolation checks pass.
- No external provider/payment/signature action is claimed.
- Cleanup residue is zero.
