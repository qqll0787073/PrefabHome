# Beta QA Checklist

Complete this checklist at the exact release candidate SHA. Mark an item passed only with observed evidence.

## Automated Gate

- [ ] Working tree is clean before verification.
- [ ] `npm ci` succeeds from the lockfile.
- [ ] `npm run verify:beta` succeeds.
- [ ] Frontend tests pass with the expected count or newer.
- [ ] Infrastructure tests pass with the expected count or newer.
- [ ] Production build succeeds.
- [ ] Dependency audit and tracked-secret scan pass.
- [ ] Required Beta documentation exists and local links resolve.
- [ ] Migrations are exactly `0001` through `0024`; no prior migration changed.

## Security And Configuration

- [ ] Production uses the intended Supabase URL and publishable key.
- [ ] No service-role key, password, token, or database URL is in frontend/build output.
- [ ] Marketplace demo mode is disabled.
- [ ] Buyer/Manufacturer self-registration cannot create Admin.
- [ ] Session restores after refresh; logout clears the session.
- [ ] Anonymous and cross-role private reads are denied.
- [ ] Private Storage buckets and signed URL behavior are verified.
- [ ] Participant Logistics reads omit all internal fields.
- [ ] Staging safety guard rejects the production ref.

## Buyer Browser

- [ ] Sign in; role resolves to Buyer.
- [ ] Browse/search/filter/sort/paginate Products and open details/images.
- [ ] Create/submit an RFQ; message; inspect snapshot/timeline.
- [ ] Review Quote versions; accept, reject, and request-revision paths are verified with separate fixtures.
- [ ] Create/save/submit/cancel Purchase Orders where permitted.
- [ ] Review Contract, Invoice/payment, Shipping, and Logistics workspaces.
- [ ] No draft/internal/cross-owner data appears.

## Manufacturer Browser

- [ ] Sign in; role resolves to Manufacturer.
- [ ] Save/submit onboarding and verify locked states.
- [ ] Approved Manufacturer creates Product/media and submits for review.
- [ ] RFQ Inbox, messages, Quote draft/items/submission/revision work.
- [ ] Purchase Order and Contract decisions respect lifecycle controls.
- [ ] Invoice draft/issue and external payment recording validate fields/dates.
- [ ] Shipping Readiness and Logistics Booking Request draft/submit/withdraw work.
- [ ] Participant-safe Logistics details contain no Admin/internal fields.

## Admin Browser

- [ ] Sign in; database profile role is Admin.
- [ ] Manufacturer and Product review lifecycle actions work.
- [ ] Transaction details, snapshots, events, and histories load read-only where designed.
- [ ] Signature preparation/delivery records clearly state no external delivery.
- [ ] Invoice/payment and Shipping queues load.
- [ ] Logistics Admin candidate create/update/withdraw/select/replace/cancel/readiness flow works.
- [ ] Users workspace accurately states its limitation.

## UX, Accessibility, And Safety

- [ ] Desktop and 390 px layouts have no overlap or clipped controls.
- [ ] Keyboard navigation, dialogs, Escape, focus restoration, and labels work.
- [ ] Loading, empty, stale, error, and retry states are understandable.
- [ ] Browser console errors: `0` for all roles.
- [ ] Unsafe logs: `0`; no credentials, tokens, or full signed URLs.
- [ ] External-provider preparation states do not claim an action occurred.

## Operations

- [ ] Hosting SPA fallback, HTTPS, caching, and security headers are verified.
- [ ] Monitoring and incident owner are assigned.
- [ ] Backup/restore capability and restore drill are approved.
- [ ] Staging fixture residue audit returns zero.
- [ ] Release signoff is complete; deployment has separate approval.
