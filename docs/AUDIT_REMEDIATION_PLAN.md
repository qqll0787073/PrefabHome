# Audit Remediation Plan

## Completed In `repository-audit`

1. Block self-service admin registration.
   - Added `src/lib/authRoles.ts`.
   - Updated `src/lib/auth.ts` to sanitize registration role metadata.
   - Added `supabase/migrations/0004_security_hardening.sql`.

2. Prevent profile privilege escalation.
   - Added database trigger `prevent_profile_privilege_escalation`.
   - Non-admin users cannot change their own `role` or `status`.

3. Add automated tests for the security fix.
   - Added `src/lib/authRoles.test.ts`.
   - Added `npm run test`.

## Phase 1: Required Before More Business Features

1. Apply and verify migration `0004_security_hardening.sql` after PR review.
2. Add RLS tests for:
   - Buyer can access only own buyer rows, saved products, quote requests, messages, and documents.
   - Manufacturer can access only owned manufacturer/product/outreach data.
   - Admin can moderate all required records.
   - Anonymous users cannot read private marketplace data.
3. Generate Supabase database types from the live schema and wire `createClient<Database>()`.
4. Add production env guard so production builds/deployments cannot silently run in demo mode.
5. Add ESLint and accessibility linting.

## Phase 2: Architecture Cleanup

1. Split `src/App.tsx` into:
   - `src/pages`
   - `src/components`
   - `src/features/auth`
   - `src/features/listings`
   - `src/features/portals`
   - `src/lib`
2. Add a router and protected route layouts.
3. Introduce data-service modules for Supabase reads/writes.
4. Replace static product/quote/message data incrementally.

## Phase 3: Supabase Data Workflows

1. Implement buyer profile and manufacturer profile creation flows.
2. Implement listings read path from Supabase.
3. Implement quote request creation with RLS-backed ownership.
4. Implement messages with participant-only access.
5. Implement saved products.
6. Add import document storage buckets and signed URL access.

## Phase 4: Deployment Hardening

1. Add Cloudflare deployment documentation.
2. Add SPA fallback configuration.
3. Add security headers and Content Security Policy.
4. Add error monitoring.
5. Add dependency monitoring.
6. Add backup and key-rotation runbooks.

## Deferred Medium/Low Items

Per audit instructions, medium- and low-priority improvements were documented but not implemented in this branch.
