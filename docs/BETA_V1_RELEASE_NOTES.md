# Beta v1.0 Release Notes

## Release Identity

- Baseline branch: `auth-profiles`
- Baseline merge commit: `87f3e097dd1172cc3653f34680f0a839e9549355`
- Database baseline: migrations `0001` through `0024`
- Intended audience: invited Beta Buyers, approved Manufacturers, and designated Admin operators

## What Is Included

The Beta provides an end-to-end, database-backed marketplace workflow:

1. Manufacturers register, submit company applications, and require Admin approval.
2. Approved Manufacturers create products, upload private media, and submit products for Admin review.
3. Buyers browse the public-safe marketplace, send RFQs, exchange messages, and review versioned Quotes.
4. Buyers accept, reject, or request revision of Quotes and create Purchase Orders from accepted Quotes.
5. Manufacturers review Purchase Orders; participants progress Contracts through review and acceptance.
6. Admin prepares signature packages and delivery requests without contacting an external signature provider.
7. Manufacturers create and issue Invoices; authorized users record external payments already received.
8. Manufacturers prepare Shipping Readiness and Logistics Booking Requests.
9. Admin evaluates provider candidates and records an internal Logistics Arrangement; participants receive a safe projection.

## Role Highlights

### Buyer

- Public product search, filters, sorting, detail, and signed public image access
- RFQ draft/submission, messages, Quote history and decisions
- Purchase Order draft, submission, revision, and status history
- Contract review, Invoice/payment visibility, Shipping and Logistics visibility

### Manufacturer

- Company onboarding and application status
- Product and private media management after approval
- RFQ inbox, messaging, Quote drafting/versioning
- Purchase Order review, Contract participation, Invoice and payment recording
- Shipping Readiness and Logistics Booking Request preparation

### Admin

- Manufacturer and product review
- Read access to transaction workspaces
- Contract signature preparation and delivery-request preparation
- Invoice/payment oversight, Shipping oversight, and Logistics candidate/selection planning

## Security Model

- Supabase Auth establishes identity; `public.profiles.role` is database-controlled.
- RLS and trusted RPCs are the authority for data access and lifecycle transitions.
- Public marketplace views expose fixed public-safe columns only.
- Product images and documents remain in private Storage buckets; authorized reads use signed URLs.
- Transaction snapshots preserve the commercial state used at each lifecycle boundary.
- Participant Logistics RPCs omit provider contacts, quote references, internal notes, actor IDs, metadata, and internal versions.
- Frontend role checks improve navigation but are not authorization controls.

## Explicit Non-Goals

The Beta does not perform:

- electronic signatures or provider signing links
- PDF generation or document rendering
- outbound email or notification delivery
- payment processing, refunds, bank reconciliation, or automatic tax
- external freight quoting, carrier booking, dispatch, tracking, or delivery confirmation
- customs filing, tariff calculation, or brokerage automation
- production milestones or factory execution
- AI-generated commercial recommendations
- enterprise reporting or full operational audit export

Labels such as `Ready for external booking` describe internal readiness only.

## Known Operational Limitations

- No production deployment workflow or hosting manifest is tracked.
- No centralized error monitoring, alerting, log aggregation, or uptime check is configured.
- Backup retention and restore drills must be configured and verified in the Supabase organization.
- Admin user search/account administration is a truthful placeholder.
- Demo marketplace inventory is opt-in local data and is not a substitute for Supabase connectivity.
- The SPA uses query-string workspace state instead of a full route framework.

## Verification Baseline

The merged Beta evidence records `173/173` frontend tests, `23/23` infrastructure tests, a passing production build, zero dependency vulnerabilities, zero tracked real-secret matches, role-based browser verification, and zero staging fixture residue. See [Beta MVP release verification](BETA_MVP_RELEASE_VERIFICATION.md).

Run `npm run verify:beta` again at the exact release candidate SHA before signoff.
