# PrefabHome Marketplace

PrefabHome is a role-based marketplace Beta for Buyers, Manufacturers, and Admin operators. The implemented transaction chain covers product discovery through internal logistics planning:

`Product -> RFQ -> Quote -> Purchase Order -> Contract -> Invoice -> Shipping Readiness -> Logistics Booking Request -> Logistics Arrangement`

Current status: **PrefabHome Beta v1.0.0 release candidate assets; not production deployed by this task.**

Supported roles are Buyer, Manufacturer, and Admin. Buyer and Manufacturer registration is self-service; Admin authority is operator-controlled.

## Local Development

Requirements: Node.js 20 or newer, npm, and a Supabase project with migrations `0001` through `0024` applied.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the ignored `.env.local` file. Never put credentials or a service-role key in a `VITE_` variable. `VITE_ENABLE_MARKETPLACE_DEMO=true` is local-development-only and must remain disabled in deployed environments.

Set `VITE_PUBLIC_SITE_URL` to the local public origin, normally `http://localhost:5173`. It controls canonical and sitemap output only and never grants portal access.

Public informational pages are available at `/`, `/about`, `/contact`, and `/version`. The marketplace and existing query-driven portal workspaces remain under `/marketplace`.

## Verification

```bash
npm run verify:beta
```

Production-candidate artifact checks are local and non-deploying. They require explicit
production environment metadata; see the release checklist before running them.

```bash
npm run verify:production-artifact
npm run verify:production-readiness
npm run verify:quality
npm run quality:bundle
```

This runs the repository's frontend and infrastructure tests, production build, dependency audit, tracked-secret scan, and required-document audit. It performs no remote Supabase operation.

`npm run verify:quality` is a deterministic, non-networking build/test/artifact/bundle/documentation gate. `npm run quality:bundle` reports and enforces the reviewed artifact budgets. After building locally, `npm run quality:browser` can run the optional Chrome/Edge viewport, focus, reflow, reduced-motion, and console smoke; it is intentionally excluded from mandatory CI.

Accessibility engineering targets and remaining manual assistive-technology checks are documented in [ACCESSIBILITY_GUIDE.md](docs/ACCESSIBILITY_GUIDE.md). Current targets are Lighthouse Performance 90+, Accessibility 95+, Best Practices 95+, and SEO 95+, but no score is claimed when Lighthouse is unavailable.

## Beta Documentation

- [Beta v1 release notes](docs/BETA_V1_RELEASE_NOTES.md)
- [Quick start guide](docs/QUICK_START_GUIDE.md)
- [Buyer guide](docs/BUYER_USER_GUIDE.md)
- [Manufacturer guide](docs/MANUFACTURER_USER_GUIDE.md)
- [Admin guide](docs/ADMIN_USER_GUIDE.md)
- [API and RPC reference](docs/API_AND_RPC_REFERENCE.md)
- [Deployment and operations](docs/DEPLOYMENT_AND_OPERATIONS_GUIDE.md)
- [Backup, restore, and rollback](docs/BACKUP_RESTORE_ROLLBACK_GUIDE.md)
- [Beta QA checklist](docs/BETA_QA_CHECKLIST.md)
- [Demo data and runbook](docs/DEMO_DATA_AND_DEMO_RUNBOOK.md)
- [Release signoff](docs/BETA_RELEASE_SIGNOFF.md)
- [Verified Beta evidence](docs/BETA_MVP_RELEASE_VERIFICATION.md)
- [Production Sprint 1 plan](docs/PRODUCTION_SPRINT_1_PLAN.md)
- [Observability and runtime safety](docs/OBSERVABILITY_AND_RUNTIME_SAFETY.md)
- [Production Sprint 2 plan](docs/PRODUCTION_SPRINT_2_PLAN.md)
- [Production hosting specification](docs/PRODUCTION_HOSTING_SPECIFICATION.md)
- [Security headers policy](docs/SECURITY_HEADERS_POLICY.md)
- [Production release checklist](docs/PRODUCTION_RELEASE_CHECKLIST.md)
- [Production Sprint 2B plan](docs/PRODUCTION_SPRINT_2B_PLAN.md)
- [SEO, PWA, and public pages](docs/SEO_PWA_AND_PUBLIC_PAGES.md)
- [Production Sprint 2C plan](docs/PRODUCTION_SPRINT_2C_PLAN.md)
- [Performance baseline and budgets](docs/PERFORMANCE_BASELINE_AND_BUDGETS.md)
- [Accessibility guide](docs/ACCESSIBILITY_GUIDE.md)
- [Lighthouse and manual QA baseline](docs/LIGHTHOUSE_AND_MANUAL_QA_BASELINE.md)

## Release Boundary

The Beta does not provide payment processing, electronic signatures, generated PDFs, outbound email, carrier booking, shipment tracking, customs filing, production milestones, or production AI recommendations. Signature delivery, payment recording, and logistics arrangement are internal preparation/recording workflows only. See the release notes for the complete boundary.

Production is not a test target. Use the repository staging safety guard and an isolated Supabase CLI workspace for approved staging operations.

Passing local performance or accessibility quality gates is not Production Deployment Authorization.

## Contribution And Branching

Create focused feature branches from the current integration branch, keep applied migrations immutable, add rollback SQL and frontend tests with behavioral changes, and open review PRs back to the integration branch. Do not target `main`, apply remote migrations, or deploy without explicit approval for that operation and environment.
