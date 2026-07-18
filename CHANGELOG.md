# Changelog

All notable release changes are documented here. This project follows a simple Beta release history until a formal versioning policy is adopted.

## [Unreleased]

- Added Beta v1 release documentation and a deterministic local release-readiness command.

## [Beta v1.0.0] - 2026-07-18

### Added

- Buyer, Manufacturer, and Admin role workspaces with Supabase Auth and database-enforced authorization.
- Manufacturer onboarding and Admin approval.
- Product lifecycle, private product media, and public marketplace projection.
- RFQs, messaging, versioned Quotes, Buyer decisions, and trusted timeline events.
- Purchase Orders, Manufacturer confirmation, Contracts, participant review, signature preparation, and delivery-request preparation.
- Invoices, external payment recording, Shipping Readiness, Logistics Booking Requests, and internal Logistics Arrangement planning.
- Staging safety guard, fixture cleanup tooling, rollback SQL suites, and role-based smoke-test evidence.
- Role-aware, lazy-loaded workspaces with URL-restored Logistics selection, responsive navigation, accessible labelled dialogs, focus management, and keyboard interaction.
- Participant Logistics planning with independent provider-role and transport-mode fields, safe participant projections, and Admin-only internal read/mutation surfaces.

### Security

- Added Row Level Security, trusted lifecycle RPCs, immutable snapshots, private media buckets, signed media URLs, role-escalation protection, and participant-safe Logistics read RPCs.

### Known Limitations

- External signatures, PDF generation, email delivery, payment gateways, tax automation, carrier APIs, shipment tracking, customs automation, notifications, and AI recommendations are not connected.
- Admin user search/management, centralized monitoring, automated backups, and a production deployment pipeline are not implemented in this repository.
- Staging verification passed the integrated role handoff with `173/173` frontend tests, `23/23` infrastructure tests, zero console errors, and zero fixture residue at the merged baseline.
- This release entry records Beta readiness only; no production deployment is included.
