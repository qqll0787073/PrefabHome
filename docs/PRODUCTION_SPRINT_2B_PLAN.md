# Production Sprint 2B Plan

## Objective

Add a production-quality, provider-neutral public website foundation to PrefabHome with useful static metadata, original installability assets, safe public routes, and browser-verifiable accessibility without deploying or changing application authorization.

## Baseline

- Integration branch: `auth-profiles`
- Starting SHA: `38c8c1ccac86efa187ec12166cc18e2f5c2fcde0`
- Working branch: `production-sprint-2b`
- Database baseline: migrations `0001` through `0024`

## Scope

- Add static and route-aware title, description, canonical, Open Graph, and social-card metadata.
- Validate a browser-safe `VITE_PUBLIC_SITE_URL` without treating it as authorization input.
- Add original favicon, app-icon, social-preview, manifest, robots, and sitemap assets.
- Add unauthenticated Home, About, Contact, Version, and Not Found pages.
- Preserve the query-driven marketplace and role-authorized portals under `/marketplace`.
- Add accessible loading and navigation behavior, mobile layout constraints, documentation, and policy tests.

## Explicit Non-Goals

- Hosting-provider selection, connection, deployment, domain setup, TLS issuance, release, or tag creation
- Production or staging Supabase access, migration changes, migration application, or migration `0025`
- Privacy Policy, Terms, cookie consent, analytics, tracking, legal advice, or compliance claims
- Service workers, offline support, push notifications, background sync, or install prompts
- Payment, email, e-signature, freight, customs, or AI integrations
- Changes to RLS, RPCs, Auth authority, Storage policy, portal permissions, or business workflows

## Deliverables

1. Static metadata and validated public-site URL handling
2. Original repository-owned icon and social-preview inventory
3. A valid web app manifest, robots policy, and public-only sitemap
4. Public path routes with desktop/mobile navigation and safe Not Found behavior
5. Accessible loading behavior and route metadata updates
6. Automated SEO, PWA, indexing, security, migration, and artifact tests
7. `docs/SEO_PWA_AND_PUBLIC_PAGES.md` and README updates

## Security Boundaries

- Public metadata contains no user, session, portal, request, signed URL, or credential data.
- `VITE_PUBLIC_SITE_URL` is public build configuration and never grants access.
- Portal authorization remains database-profile, RLS, and trusted-RPC controlled.
- Robots and sitemap rules reduce indexing exposure but are not access controls.
- Public routes do not initialize or require Supabase Auth; entering the marketplace keeps existing Auth behavior.
- Production readiness rejects credentialed, queried, fragmented, non-HTTPS, or unapproved browser configuration.

## Accessibility Requirements

- Every public page has semantic header, navigation, main, and footer landmarks and one page-level `h1`.
- Navigation and actions work with keyboard input and retain visible focus indicators.
- Images have meaningful alternative text or are explicitly decorative.
- Route loading uses a polite live region and finite explanatory copy.
- Color, spacing, and text remain readable without relying on motion or color alone.

## Mobile Requirements

- Public pages must fit 320px, 375px, and 390px viewports without page-level horizontal overflow.
- Navigation wraps or scrolls predictably without obscuring controls.
- Tap targets remain at least 40px high and long text wraps safely.
- Public visual assets use responsive dimensions and do not force a fixed viewport width.

## Test Strategy

- Unit-test public URL validation, route parsing, metadata definitions, and safe release labels.
- Render public pages to static markup to test landmarks, headings, navigation, fallbacks, and sensitive-data exclusions.
- Audit committed manifest, icon, robots, sitemap, index metadata, CI, source-map, and migration policies.
- Build and run the production artifact verifier to confirm the new public assets are accepted.
- Perform local browser width, navigation, console, and overflow checks without external analytics or production services.

## Rollback Approach

Rollback is an ordinary source rollback of this additive frontend commit set. It removes public routes/assets and restores the previous static shell without changing database state. Any future deployed rollback must use the immutable-artifact process in `docs/PRODUCTION_RELEASE_CHECKLIST.md`; it must not rebuild or alter migration history.

## Definition Of Done

- All public metadata, route, PWA, indexing, accessibility, and safety tests pass.
- The full Beta, production artifact, and production readiness gates pass at the final SHA.
- Migrations remain exactly `0001` through `0024` and unchanged.
- No secrets, generated release outputs, analytics, service worker, provider configuration, production access, or deployment is introduced.
- The branch is pushed and a draft PR targets `auth-profiles`.

**Production Deployment Authorization is NOT GRANTED.**
