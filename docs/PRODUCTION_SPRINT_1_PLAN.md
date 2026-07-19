# Production Sprint 1 Plan

## Objective

Establish a provider-neutral runtime-safety and CI verification foundation for PrefabHome without deploying, changing database behavior, or introducing external services.

## Baseline

- Baseline tag: `beta-v1.0.0`
- Starting SHA: `2bbbc43f12855d86aac1c04d0480b61f4d7afefe`
- Working branch: `production-sprint-1`
- Database baseline: migrations `0001` through `0024`

## Scope

- Typed validation for browser-safe runtime configuration
- Local, staging, and production environment distinction
- Production rejection of marketplace demo mode
- Non-sensitive release metadata
- Accessible application error boundary and safe global error listeners
- Provider-neutral structured logger with recursive redaction
- Pull-request and branch CI verification with read-only permissions
- Focused automated tests and operational documentation

## Explicit Non-Goals

- Production or staging Supabase access
- Deployment, release publication, tag creation, or merge to `main`
- Migration creation, modification, application, repair, reset, or pull
- RLS, RPC, Auth, Storage, or business-workflow changes
- External monitoring, email, payment, e-signature, carrier, customs, tracking, or AI integrations
- Service-role credentials or privileged browser configuration

## Deliverables

1. `docs/PRODUCTION_SPRINT_1_PLAN.md`
2. `docs/OBSERVABILITY_AND_RUNTIME_SAFETY.md`
3. Typed runtime configuration module and updated public environment example
4. Redacting logger and safe global error listeners
5. Accessible top-level React error boundary
6. `.github/workflows/ci.yml`
7. Runtime, redaction, error-boundary, CI-policy, and migration-integrity tests

## Acceptance Criteria

- Valid local/staging Supabase configuration preserves connected behavior.
- Missing or invalid connected configuration produces safe messages and never initializes a client.
- Demo mode cannot become active when deployment environment is production.
- Version, commit, and environment metadata use safe local fallbacks.
- Render/lifecycle failures show an accessible fallback with Retry, Reload, and an incident reference.
- Runtime error reporting never includes stacks, credentials, signed URL query strings, full email addresses, profile/business records, or unsafe custom Error fields.
- Global listeners deduplicate repeated events and clean up correctly.
- CI has read-only permissions, no privileged secrets, no Supabase commands, and no deployment/release job.
- Existing and new tests, build, dependency audit, Beta gate, secret scan, and documentation checks pass.
- Migrations remain exactly `0001` through `0024` and byte-for-byte unchanged from the baseline tag.

## Security Boundaries

- Frontend runtime configuration is presentation/connectivity data, never authorization.
- Only a Supabase publishable/anon key may be supplied to Vite; service-role, database, and provider secrets remain forbidden.
- Supabase RLS and trusted RPCs remain authoritative.
- Logging is explicit and provider-neutral; `console` is not monkey-patched.
- Production is denylisted from all test/fixture operations and is not accessed in this sprint.

## Risks

- Vite embeds `VITE_*` values into browser assets; operators may mistakenly treat them as secret storage.
- Redaction reduces accidental exposure but cannot make arbitrary unsafe logging acceptable.
- An error boundary catches React render/lifecycle failures, not every asynchronous or browser failure.
- A CI pass does not verify live Auth, RLS, Storage, hosting headers, backup recovery, or production configuration.
- Dependency advisories and GitHub-hosted runner availability are external operational dependencies.

## Rollback Strategy

Revert the Sprint 1 commits or redeploy the known Beta tag artifact when approved. No database rollback is needed because no migration or remote schema operation is permitted. If runtime configuration rejects a previously valid environment, correct the browser-safe environment values or revert the runtime layer; never bypass it with privileged keys.

## Definition Of Done

- Deliverables are implemented and documented.
- Full local verification passes with exact counts recorded in the draft PR.
- CI workflow policy tests pass and the pushed branch CI is observable.
- Final diff contains no migration, secret, local environment, generated artifact, or unrelated business change.
- Draft PR targets `auth-profiles`, remains draft, and is not merged.
- Production and `main` remain untouched.

**Production Deployment Authorization is NOT GRANTED.**
