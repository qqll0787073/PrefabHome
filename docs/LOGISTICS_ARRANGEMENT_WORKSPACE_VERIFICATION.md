# PH-010C Logistics Arrangement Workspace Verification

## Phase A Status

- Branch: `ph010c-logistics-workspace-foundation`
- Migration: `0024_logistics_arrangement_workspace_foundation.sql`
- Migration state: local-only; not applied to staging or production
- Staging project ref: `bvzbkjpbnczquecwqvlm`
- Production denylisted ref: `eoyrfrjbjglfudfuwxdf`
- Protected baseline: migrations `0001` through `0023` unchanged

## Pre-Work Audit

The source branch contained the PH-010B logistics booking request domain with immutable source snapshots, participant read policies, trusted Manufacturer lifecycle RPCs, and status values `booking_draft`, `submitted_for_arrangement`, and `withdrawn`. No provider candidate, selection, or arrangement-event table existed. Admin logistics access was read-only.

The staging safety guard accepted only the staging ref and matching staging URL. A production-ref probe was denied before any remote write. Local secret files are ignored and no secret value was printed.

## Database Verification

Rollback test: `supabase/tests/logistics_arrangement_workspace_foundation_security.sql`

The test validates table presence, RLS, anonymous denial, authenticated read-only grants, participant policies, lifecycle constraints, cross-request selection protection, one-current-selection uniqueness, trusted-write triggers, authenticated-only Admin RPC grants, internal helper grant revocation, row-lock/state-condition authority, readiness completeness, and event vocabulary boundaries.

Rollback execution: passed `60/60` checks in an isolated staging transaction. The runner executed `BEGIN`, the local `0024` DDL, the security suite, and `ROLLBACK`; it did not insert a migration-history row or retain schema objects.

A post-rollback read-only query confirmed:

- remote migration count: `23`
- first/last remote migration: `0001` / `0023`
- remote `0024` count: `0`
- candidate, selection, and arrangement-event tables: absent

The isolated `db push --dry-run` command could not complete because Supabase CLI `2.109.x` fails with `LegacyMigrationsReadError` when reading this repository's four-digit migration directory on Windows. Pinned CLI `2.67.1` and `2.89.0` can read remote history but predate local four-digit migration recognition. This is a Phase B CLI compatibility item, not migration divergence: the direct remote list and post-rollback query both confirmed remote `0001–0023`, while the local guard confirmed exact local `0001–0024` and no changes to `0001–0023`.

## Frontend Verification

The Admin workspace uses only the six trusted Admin RPCs for mutations. Buyer and Manufacturer arrangement views issue read-only table queries and rely on RLS. Demo mode returns empty arrangement collections and does not synthesize provider or booking data.

Validation results:

- `npm ci`: passed; `0` dependency vulnerabilities reported
- frontend tests: `159/159` passed
- staging/infrastructure tests: `23/23` passed
- production build: passed (`170` modules transformed)
- build advisory: the existing main JavaScript chunk remains above Vite's 500 kB advisory threshold
- secret scan: passed with `0` secret-pattern matches
- tracked environment files: `.env.example` and `.env.staging.example` only; local credential files remain ignored

## Staging Harness

`scripts/smoke/logistics-arrangement-live-smoke.mjs` is plan-only. It never applies migrations or creates fixtures, emits no credentials, and exits without remote writes. Its manifest model reserves exact ID arrays and dependent-first cleanup order for Phase B.

## Safety Confirmation

- No migration was applied remotely.
- Staging remote migrations remain `0001` through `0023`.
- No production data or configuration was modified.
- No provider integration, carrier API, freight-forwarder API, tracking, customs, payment, or booking automation was added.
- No deployment or merge occurred.
- PH-010C Phase B remains deferred.
