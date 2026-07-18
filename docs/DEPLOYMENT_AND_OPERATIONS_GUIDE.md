# Deployment And Operations Guide

## Current Deployment Posture

The repository builds a static Vite SPA into `dist/`. It does not contain a verified Cloud Run, Cloudflare, Vercel, Netlify, Docker, or GitHub Actions production deployment definition. Hosting configuration, SPA fallback routing, TLS, caching, security headers, monitoring, and rollback must be supplied and reviewed by the chosen platform.

Do not infer production readiness from `npm run build` alone.

## Environment Matrix

| Environment | Purpose | Data rule |
| --- | --- | --- |
| Local | Development and unit tests | Use a disposable/local Supabase project or explicit demo UI |
| Staging | Migration, RLS, Storage, lifecycle, and browser smoke | Guarded staging ref only; exact-ID cleanup |
| Production | Invited Beta users | No fixtures, smoke writes, or unreviewed migrations |

Keep each environment's URL and key in its platform secret store. Only `VITE_SUPABASE_URL` and a publishable/anon key may enter the browser build. Service-role and database credentials are server/operator-only.

Known guarded-verification separation:

- Staging: `bvzbkjpbnczquecwqvlm`
- Production denylist: `eoyrfrjbjglfudfuwxdf`

The production ref must never be used by fixture, bootstrap, or smoke tooling. A ref is not a credential; secret values still belong only in ignored local files or a platform secret store.

Repository variable names are listed in `.env.example` and `.env.staging.example`. Staging variables include project URL/ref, publishable key, service-role key, database password, role smoke credentials, `PREFAB_TEST_ENVIRONMENT=staging`, and the explicit fixture-reset switch. Never prefix privileged values with `VITE_`.

## Local Verification Commands

```bash
npm ci
npm run test
npm run build
npm audit --audit-level=low
npm run verify:beta
```

`npm run test` executes frontend tests followed by infrastructure tests. `verify:beta` is non-destructive and does not contact Supabase. No GitHub Actions workflow currently deploys this repository.

## Release Preflight

1. Identify and record the exact candidate commit.
2. Confirm the worktree is clean and migration files match reviewed checksums.
3. Run `npm ci` and `npm run verify:beta`.
4. Complete the role/browser and accessibility items in [Beta QA checklist](BETA_QA_CHECKLIST.md).
5. Confirm the target Supabase project migration list before any approved push.
6. Run `supabase migration list --linked` and `supabase db push --dry-run` from an isolated workspace and review the exact remote/pending lists.
7. Apply only separately approved migrations to staging, verify, and clean fixtures.
8. Obtain release, security, database, and operations signoff.
9. Build with production `VITE_SUPABASE_URL`, publishable key, and demo mode disabled.
10. Deploy the immutable `dist/` artifact using the selected platform's reviewed procedure.

## Hosting Requirements

- Serve `index.html` for unknown application paths/query-state refreshes.
- Use HTTPS only.
- Do not cache `index.html` indefinitely; use content-hashed immutable caching for assets.
- Configure at minimum CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and frame restrictions after testing Supabase Auth and signed Storage URLs.
- Limit source maps according to the monitoring policy; do not publish maps containing secrets.
- Keep `VITE_ENABLE_MARKETPLACE_DEMO=false`.

## Supabase Operations

- Never edit an applied migration.
- Never use `migration repair`, remote `db reset`, or `db pull` as a release shortcut.
- Use the staging safety guard before approved staging writes.
- Treat production project references and credentials as denylisted in all fixture tooling.
- Verify Auth redirect URLs, email confirmation policy, password policy, Storage bucket privacy/limits, RLS, and RPC grants in each environment.

## Observability And Incident Response

Centralized monitoring is not implemented in this repository. Before production Beta, designate an owner and configure:

- frontend error capture with token/signed-URL scrubbing
- Supabase database/Auth/Storage alert review
- uptime checks and release health checks
- an incident channel, severity model, and rollback decision owner
- retention rules that do not collect secrets or unnecessary personal data

For an incident: stop further release activity, preserve sanitized evidence, disable affected entry points through the hosting/Supabase control plane when necessary, rotate exposed credentials, and follow [Backup, restore, and rollback](BACKUP_RESTORE_ROLLBACK_GUIDE.md).

## Post-Deploy Smoke

Verify sign-in and one read-only path for each role first. Then perform only approved, uniquely named, cleanup-safe transactions. Confirm zero console errors, no unsafe logs, private media isolation, participant-safe Logistics data, and no demo inventory. Record evidence without credentials or signed URLs.

This release-assets task does not authorize or perform a production deployment.
