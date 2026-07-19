# Production Sprint 2 Plan

## Objective

Create a provider-neutral, reviewable hosting-security and release-operations foundation for the PrefabHome static Vite application without selecting a host or performing a production release.

## Baseline

- Integration branch: `auth-profiles`
- Starting SHA: `ee0e908b16f74a557fe7436776f4dea76972048c`
- Working branch: `production-sprint-2`
- Database baseline: migrations `0001` through `0024`

## Scope

- Specify HTTPS, TLS, caching, compression, SPA fallback, environment, Auth redirect, Storage, source-map, artifact, and rollback requirements.
- Define a security-header policy and placeholder template.
- Provide generic and illustrative hosting fallback templates without connecting a provider.
- Add deterministic local release-artifact checksums and a temporary manifest.
- Add a production-readiness environment guard and non-destructive verification command.
- Add a gated production release checklist and automated policy tests.
- Extend read-only CI coverage to pushes on `production-sprint-2`.

## Explicit Non-Goals

- Selecting, provisioning, connecting, or deploying to a hosting provider
- Accessing production or staging Supabase
- Adding, changing, applying, repairing, resetting, or pulling migrations
- Changing RLS, RPCs, Auth authority, Storage policy, or business workflows
- Creating a release, tag, production environment, custom domain, or TLS certificate
- Adding monitoring, payment, email, e-signature, freight, customs, tracking, or AI integrations
- Storing production URLs, publishable keys, service-role keys, database credentials, or provider secrets

## Deliverables

1. `docs/PRODUCTION_SPRINT_2_PLAN.md`
2. `docs/PRODUCTION_HOSTING_SPECIFICATION.md`
3. `docs/SECURITY_HEADERS_POLICY.md`
4. `docs/PRODUCTION_RELEASE_CHECKLIST.md`
5. Placeholder security-header and SPA fallback templates under `config/`
6. Local production-artifact and readiness verification scripts
7. Package commands and regression/policy tests

## Acceptance Criteria

- Production readiness requires an explicit production deployment environment, disabled demo mode, and release metadata tied to the current commit.
- Unknown browser-prefixed variables and privileged browser variable names are rejected.
- The artifact verifier confirms `dist/index.html`, referenced hashed JS/CSS, file checksums, no source maps by default, no local environment files, and no obvious secret signatures.
- The verifier writes only a deterministic manifest under the operating-system temporary directory and never uploads or contacts a service.
- Hosting examples preserve real asset responses and use `index.html` only as application-navigation fallback.
- Header guidance supports Vite assets, Supabase HTTPS/WebSocket API calls, Auth redirects, and signed private Storage URLs without `unsafe-inline`.
- CI remains read-only and contains no deployment, release, Supabase, or privileged-secret operation.
- Existing Beta gates remain intact and migrations remain byte-for-byte unchanged.

## Security Boundaries

- Vite browser variables are public build inputs, never secret storage or authorization.
- Supabase database profiles, RLS, and trusted RPCs remain authoritative.
- Only the reviewed static artifact may be considered a release candidate.
- A checksum proves file integrity, not security approval or business correctness.
- Hosting headers are not active until independently adapted, tested, and approved for a selected provider.
- Production and staging references remain absent from workflow configuration.

## Hosting Risks

- A catch-all rewrite can return HTML for missing JS/CSS and cause opaque browser failures.
- Long caching on `index.html` can pin users to stale asset references.
- Missing Auth redirect URLs can break confirmation and recovery flows.
- An overly broad CSP can leak data; an overly narrow CSP can block Supabase or signed media.
- Public source maps can expose implementation details and sensitive source context.
- Rebuilding instead of redeploying the exact artifact can invalidate review evidence.
- A frontend rollback can be incompatible with an additive database change even when both passed independently.

## Rollback Model

Keep the candidate and previous known-good artifacts immutable, each with its manifest, SHA-256 root checksum, source commit, environment review, and database compatibility statement. A rollback redeploys the previous reviewed artifact without rebuilding it. It never edits migration history or attempts an automatic database downgrade. Database incidents follow the separate backup/restore and forward-fix process.

## Definition Of Done

- All deliverables are reviewed and linked from the repository documentation.
- Local and Linux CI tests, build, audit, Beta gate, artifact gate, and production-readiness gate pass.
- The final diff contains no migrations, secrets, generated artifacts, provider connection, or unrelated feature work.
- The branch is pushed and a draft PR targets `auth-profiles`.
- No tag, release, deployment, production access, or merge occurs.

**Production Deployment Authorization is NOT GRANTED.**
