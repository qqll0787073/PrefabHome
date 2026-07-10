# Production Readiness Audit

Source branch audited: `auth-profiles`

Audit branch: `repository-audit`

Audit date: 2026-07-10

## Executive Summary

The repository is an early production scaffold, not yet production-ready. The Vite/React/TypeScript build is functional, Supabase foundations exist, and authentication has an initial demo/Supabase dual path. The highest-risk issues are in role assignment and profile mutation, because the current schema and client flow can trust user-controlled role metadata too much.

This branch implements only safe Critical/High fixes:

- Adds explicit auth role sanitization in frontend auth code.
- Adds automated tests for role safety.
- Adds migration `0004_security_hardening.sql` to prevent self-service admin registration and profile privilege escalation.

No production data was modified and no destructive migrations were run during this audit branch.

## Critical Findings

### C-01: User-controlled metadata can create admin profiles

- Affected files/migrations: `supabase/migrations/0003_auth_profile_trigger.sql`, `src/lib/auth.ts`
- Explanation: The auth trigger accepted `role` from `auth.users.raw_user_meta_data` and allowed `admin`. A malicious client can call Supabase Auth directly with `{ role: "admin" }`, bypassing the UI role selector.
- Business/security impact: Complete privilege escalation. A public self-registering user could become an admin if the profile trigger writes that role.
- Recommended fix: Only allow self-registration as `buyer` or `manufacturer`; admin must be assigned through a trusted operator/database workflow.
- Status: Fixed in this branch via `supabase/migrations/0004_security_hardening.sql` and `src/lib/authRoles.ts`.

### C-02: Users can update their own profile role/status under existing RLS

- Affected files/migrations: `supabase/migrations/0002_foundation_rls_policies.sql:61`
- Explanation: `profiles_update_own_or_admin` allows users to update their own `profiles` row and does not prevent changes to `role` or `status`.
- Business/security impact: A buyer/manufacturer could promote themselves to admin or reactivate a suspended account if the client or API request sends those fields.
- Recommended fix: Add a database-level guard that blocks non-admin users from changing `role` or `status`.
- Status: Fixed in this branch via `supabase/migrations/0004_security_hardening.sql`.

## High Findings

### H-01: No automated tests existed for auth role safety

- Affected files/migrations: `package.json`, `src/lib/auth.ts`
- Explanation: The repo had no `test` script and no auth tests, leaving role escalation regressions undetected.
- Business/security impact: Future auth changes could reintroduce admin self-registration or unsafe role handling without CI failures.
- Recommended fix: Add focused unit tests for role validation and sanitization.
- Status: Fixed in this branch via `src/lib/authRoles.test.ts` and `npm run test`.

### H-02: Handwritten Supabase database types are not wired into the active client

- Affected files/migrations: `src/lib/supabase.types.ts`, `src/lib/supabase.ts`
- Explanation: The client uses untyped `SupabaseClient`, while `supabase.types.ts` is handwritten and not generated from the live database.
- Business/security impact: Data-access mistakes can compile, and schema drift will not be caught at build time.
- Recommended fix: Generate types from Supabase (`supabase gen types typescript`) after migrations stabilize, then wire `createClient<Database>()`.
- Status: Not fixed; requires generated types from the canonical database.

### H-03: Current portal protection is client-side only

- Affected files/migrations: `src/App.tsx:68`, `src/App.tsx:238`, `supabase/migrations/0002_foundation_rls_policies.sql`
- Explanation: The UI hides dashboards based on `auth.user.role`, but route/data authorization must be enforced through RLS and server/database rules.
- Business/security impact: Client-side checks can be bypassed. Sensitive data protection depends on RLS being correct and tested.
- Recommended fix: Treat UI role gates as UX only; add RLS tests and move real data reads/writes behind policies.
- Status: Partially mitigated by RLS drafts; not fully fixed because data-backed portals are not implemented.

## Medium Findings

### M-01: Application is still a monolithic component

- Affected files/migrations: `src/App.tsx`
- Explanation: Browse, compare, advisor, import center, auth, and portals all live in one file.
- Business/security impact: Increases regression risk and makes permission-sensitive flows harder to reason about.
- Recommended fix: Split into route/page components, auth components, portal components, and feature modules.

### M-02: No real routing or protected route layer

- Affected files/migrations: `src/App.tsx`, `vite.config.ts`
- Explanation: The app uses view state rather than URL routes.
- Business/security impact: No deep links, no route-level guards, and harder deployment configuration for protected views.
- Recommended fix: Add React Router or an equivalent router and implement route-level protected layouts.

### M-03: Demo mode can mask missing production configuration

- Affected files/migrations: `src/lib/supabase.ts`, `src/lib/auth.ts`
- Explanation: Missing Supabase env vars silently switch to demo auth.
- Business/security impact: A production deployment with missing env vars could appear functional but not persist real users.
- Recommended fix: Keep demo mode for local development, but add an explicit production guard that fails loudly when env vars are missing.

### M-04: Migrations are drafts and not idempotent for trigger recreation

- Affected files/migrations: `supabase/migrations/0001_foundation_schema.sql`, `0002_foundation_rls_policies.sql`
- Explanation: Triggers and policies are created without `drop if exists` in early migrations. This is acceptable for first application but brittle for replays.
- Business/security impact: Local reset/reapply workflows may fail after partial application.
- Recommended fix: Use consistent `drop policy if exists` / `drop trigger if exists` patterns in future migrations.

### M-05: RLS policies are untested

- Affected files/migrations: `supabase/migrations/0002_foundation_rls_policies.sql`
- Explanation: There are no database-level tests proving buyers, manufacturers, admins, and anonymous users can only access intended rows.
- Business/security impact: Incorrect RLS could leak buyer/manufacturer data or block legitimate workflows.
- Recommended fix: Add Supabase local test suite or SQL tests with seeded role-specific users.

### M-06: Product and portal data are static

- Affected files/migrations: `src/data.ts`, `src/App.tsx`
- Explanation: Listings, quote requests, and messages are static seed data.
- Business/security impact: UI does not yet validate real Supabase access patterns, loading states, empty states, or errors.
- Recommended fix: Introduce typed data services and progressively replace static data with Supabase reads.

### M-07: Missing deployment hardening

- Affected files/migrations: repository root
- Explanation: There is no documented production deploy config, security headers file, CSP, monitoring setup, or SPA fallback configuration.
- Business/security impact: Browser security and operational visibility are incomplete.
- Recommended fix: Add Cloudflare Pages/Workers deployment notes, `_headers`, SPA fallback rules, and error monitoring.

## Low Findings

### L-01: No lint script

- Affected files/migrations: `package.json`
- Explanation: `npm run lint --if-present` succeeds because no lint script exists.
- Business/security impact: Style, accessibility, and unsafe patterns are not automatically flagged.
- Recommended fix: Add ESLint with React, hooks, accessibility, and TypeScript rules.

### L-02: Accessibility is only partially addressed

- Affected files/migrations: `src/App.tsx`, `src/styles.css`
- Explanation: Basic labels exist for auth/search, but modal/details panel semantics, focus management, aria-current states, and error announcement are missing.
- Business/security impact: Reduced usability and compliance readiness.
- Recommended fix: Add semantic dialogs, focus management, and accessibility tests.

### L-03: No dependency update policy

- Affected files/migrations: `package.json`, `package-lock.json`
- Explanation: Dependencies are current enough for the scaffold, but there is no Renovate/Dependabot or audit policy.
- Business/security impact: Vulnerability management is manual.
- Recommended fix: Add Dependabot or Renovate and CI `npm audit` policy.

### L-04: Documentation is strong but not yet operational

- Affected files/migrations: `docs/*`
- Explanation: Planning docs exist, but runbooks for deployment, incident response, key rotation, and support escalation are missing.
- Business/security impact: Production operations would rely on ad hoc knowledge.
- Recommended fix: Add operational runbooks before launch.

## Command Results

- `npm ci`: Passed after stopping a local Vite dev server that locked native binaries.
- `npm run build`: Passed.
- `npm run lint --if-present`: Passed; no lint script is currently configured.
- `npm run test`: Passed, 4 tests.

## Secret Scan

No matches were found in tracked source/docs for common API key, service-role, bearer-token, or authorization-header patterns. `.env.local`, `dist/`, `node_modules/`, Supabase temp files, and TypeScript build info remain ignored.

## Deployment Readiness

Not production-ready yet. Build output is valid, but production deployment still needs:

- Required environment variable validation.
- SPA fallback configuration.
- Security headers/CSP.
- Error monitoring and logging.
- RLS test coverage.
- Generated Supabase types.
- Real data services and loading/error states.
