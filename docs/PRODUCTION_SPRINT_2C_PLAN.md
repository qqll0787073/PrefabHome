# Production Sprint 2C Plan

## Objective

Establish measured, deterministic performance and accessibility quality gates for PrefabHome, correct high-confidence loading and interaction defects, and document remaining manual verification without deploying.

## Starting Point

- Integration branch: `auth-profiles`
- Starting SHA: `eb56cf5cef895f556400aefcf544d466a7c240e0`
- Working branch: `production-sprint-2c`
- Database baseline: migrations `0001` through `0024`

## Scope

- Measure the committed production artifact and define reviewed bundle budgets.
- Add a local-only, non-networking bundle analyzer and quality gate.
- Keep public and portal code in distinct lazy boundaries.
- Improve focus movement, skip navigation, auth-form errors, loading announcements, image hints, reduced motion, and forced-colors behavior.
- Add deterministic source tests and an optional local Chrome smoke across public and unauthenticated portal surfaces.
- Document accessibility engineering expectations and honest local QA limitations.

## Explicit Non-Goals

- Deployment, hosting connection, production or staging access, releases, tags, or merges
- Migration `0025`, schema changes, migration application, RLS/RPC/Auth/Storage changes, or authorization redesign
- Analytics, monitoring, tracking, cookie-consent, payment, email, e-signature, freight, customs, or AI integrations
- Accessibility certification, legal compliance claims, automated assistive-technology replacement, or fabricated Lighthouse scores
- Product-image replacement, signed-URL changes, or speculative manual chunking

## Performance Budgets

Budgets are stored in `config/performance-budgets.json` and enforced against `dist/`. They cover total bytes, JavaScript, CSS, initial JavaScript, largest files, file counts, source maps, duplicate hashes, and reliably detectable orphaned JS/CSS. Ceilings provide limited build variance above the measured Sprint 2B baseline while requiring the public/portal route split to remain intact.

## Accessibility Targets

WCAG 2.2 AA is an engineering objective, not a certification claim. Automated targets include semantic top-level shells, one main target, skip links, keyboard-native controls, useful labels, associated errors, visible focus, live status, reduced motion, forced colors, safe image text, and no positive tabindex.

## Mobile And Zoom Targets

- No page-level horizontal overflow at 320x568, 375x667, 390x844, 414x896, 768x1024, or 1280x800.
- Public navigation, Not Found, and unauthenticated marketplace login remain operable.
- Reflow proxies at 640 CSS pixels and 320 CSS pixels cover 200% and 400% zoom expectations on a 1280-pixel reference viewport.
- Internal horizontal scrolling is allowed for dense portal navigation when controls remain keyboard reachable.

## Automation Strategy

- Keep mandatory CI on Node 20 with read-only permissions and non-connecting placeholder configuration.
- Build once in `verify:quality`, then run tests, artifact verification, bundle budgets, secret scanning, and documentation checks.
- Keep browser smoke optional and local so Chrome version and timing do not make mandatory CI flaky.
- Use repository-owned Node scripts only; no remote analyzer or testing service is contacted.

## Manual Verification Strategy

- Run the local Chrome smoke after a production build.
- Review keyboard order, visible focus, browser Back/Forward, reduced motion, and 200%/400% reflow.
- Retain manual screen-reader, platform high-contrast, text-spacing, contrast, real-device safe-area, and production-host header checks for release QA.
- Record Lighthouse only when a reproducible local CLI is available.

## Risks

- Static source checks cannot prove every runtime accessibility state.
- The local browser smoke does not authenticate or contact Supabase and cannot cover private workflow data.
- CSS-width zoom proxies validate reflow but are not a substitute for manual browser zoom and assistive-technology checks.
- Bundle bytes vary slightly with release metadata and toolchain changes; budgets intentionally include narrow headroom.

## Rollback Plan

Rollback is a normal source revert of the Sprint 2C commits. It restores the former route loading boundary and removes quality scripts, documentation, and additive accessibility attributes. No database rollback or remote operation is involved.

## Definition Of Done

- Bundle analysis and reviewed budgets pass on the final production artifact.
- Frontend, infrastructure, Beta, artifact, quality, audit, and production-readiness gates pass.
- Local Chrome smoke passes all requested widths with zero console errors and unsafe-log matches.
- Migrations remain exactly `0001` through `0024` and unchanged.
- No secrets, generated reports, production access, release action, merge, or deployment is introduced.
- A draft PR targets `auth-profiles` and remains unmerged.

**Production Deployment Authorization is NOT GRANTED.**
