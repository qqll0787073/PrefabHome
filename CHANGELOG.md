# Changelog

All notable release changes are documented here. This project follows a simple Beta release history until a formal versioning policy is adopted.

## [Unreleased]

- Added Beta v1 release documentation and a deterministic local release-readiness command.

## [Beta v1.0] - 2026-07-18

### Added

- Buyer, Manufacturer, and Admin role workspaces with Supabase Auth and database-enforced authorization.
- Manufacturer onboarding and Admin approval.
- Product lifecycle, private product media, and public marketplace projection.
- RFQs, messaging, versioned Quotes, Buyer decisions, and trusted timeline events.
- Purchase Orders, Manufacturer confirmation, Contracts, participant review, signature preparation, and delivery-request preparation.
- Invoices, external payment recording, Shipping Readiness, Logistics Booking Requests, and internal Logistics Arrangement planning.
- Staging safety guard, fixture cleanup tooling, rollback SQL suites, and role-based smoke-test evidence.

### Security

- Added Row Level Security, trusted lifecycle RPCs, immutable snapshots, private media buckets, signed media URLs, role-escalation protection, and participant-safe Logistics read RPCs.

### Known Limitations

- External signatures, PDF generation, email delivery, payment gateways, tax automation, carrier APIs, shipment tracking, customs automation, notifications, and AI recommendations are not connected.
- Admin user search/management, centralized monitoring, automated backups, and a production deployment pipeline are not implemented in this repository.
