# PH-010C Logistics Arrangement Workspace Verification

## Phase B Status

- Branch: `ph010c-logistics-workspace-foundation`
- Migration: `0024_logistics_arrangement_workspace_foundation.sql`
- Staging application time: `2026-07-18T01:28:22Z`
- Migration state: applied once to staging; not applied to production
- Staging project ref: `bvzbkjpbnczquecwqvlm`
- Production denylisted ref: `eoyrfrjbjglfudfuwxdf`
- Protected baseline: migrations `0001` through `0023` unchanged

## Pre-Work Audit

The source branch contained the PH-010B logistics booking request domain with immutable source snapshots, participant read policies, trusted Manufacturer lifecycle RPCs, and status values `booking_draft`, `submitted_for_arrangement`, and `withdrawn`. No provider candidate, selection, or arrangement-event table existed. Admin logistics access was read-only.

The staging safety guard accepted only the staging ref and matching staging URL. A production-ref probe was denied before any remote write. Local secret files are ignored and no secret value was printed.

## Database Verification

Rollback test: `supabase/tests/logistics_arrangement_workspace_foundation_security.sql`

The corrected test validates table presence, RLS, anonymous denial, denial of direct authenticated base-table reads, Admin-only base policies, lifecycle constraints, cross-request selection protection, one-current-selection uniqueness, trusted-write triggers, authenticated-only RPC grants, internal helper grant revocation, row-lock/state-condition authority, readiness completeness, and event vocabulary boundaries.

Participant exposure checks cover all three safe read RPCs. They prove that the owning Buyer and Manufacturer can read approved planning fields, another Manufacturer receives no rows, Anonymous is denied, and participant result schemas omit provider contacts, internal notes, event metadata, and actor identity. Admin checks prove that the separate Admin read RPCs retain authorized access to internal contact, note, and event metadata fields.

Provider modeling checks validate `provider_type` and `transport_mode` independently. A `freight_forwarder` with `ocean` mode and a `carrier` with `trucking` mode are accepted; an unsupported transport mode is rejected without creating a candidate.

The pre-correction Phase A rollback execution passed `60/60` checks. After the participant-data and transport-mode corrections, the Phase A suite passed `105/105` checks in an isolated staging transaction. The Phase B suite adds live candidate update, initial selection, replacement, cancellation, reselection, readiness, cross-request denial, current-selection uniqueness, participant history, and event-vocabulary assertions. It passed `123/123` checks against the applied staging schema and rolled back every fixture write.

A post-rollback read-only query confirmed:

- remote migration count: `23`
- first/last remote migration: `0001` / `0023`
- remote `0024` count: `0`
- candidate, selection, and arrangement-event tables: absent
- participant-safe candidate, selection, and event RPCs: absent
- Admin candidate, selection, and event read RPCs: absent
- rollback fixture users, Manufacturers, and Products: `0`

The fixture used existing trusted lifecycle paths through Product, RFQ, Quote, Purchase Order, Contract, Invoice, Shipping Readiness, and Logistics Booking Request records. All fixture writes and all `0024` schema objects were transaction-scoped. The post-rollback audit found no persistent schema object or fixture residue.

Windows CLI verification remained unsuitable for this repository's four-digit migration history. The permanent apply therefore used an isolated Ubuntu 24.04 GitHub Actions workspace with Supabase CLI `2.109.1`. The linked Linux preflight confirmed remote migrations exactly `0001-0023` and the sole pending file exactly `0024_logistics_arrangement_workspace_foundation.sql` before running `supabase db push --linked --yes`.

## Staging Application

The staging safety guard verified the approved project ref and denied `eoyrfrjbjglfudfuwxdf` before linking. Only the isolated workspace was linked, and only migrations `0001-0024` were copied into it. No repair, reset, pull, schema reset, production credential, or production command was used.

The apply log recorded `Applying migration 0024_logistics_arrangement_workspace_foundation.sql` at `2026-07-18T01:28:22Z`, followed by `Finished supabase db push`. Supabase CLI then returned a nonzero status from an unrelated pg-delta migration-catalog cache warning. No second apply was attempted. A separate read-only post-apply run confirmed:

- remote migration history: exactly `0001-0024`
- pending migrations: none
- migration-history rows for `0024`: `1`
- migrations beyond `0024`: `0`
- required tables present: `3/3`
- participant-safe read RPCs present: `3/3`
- Admin full-read RPCs present: `3/3`
- Admin mutation RPCs present: `6/6`

The successful post-apply verification is GitHub Actions run `29625525012`. Its rollback-scoped staging smoke passed `123/123` assertions.

## Live Smoke Results

The transaction-scoped fixture created a legitimate chain through Manufacturer, Product, RFQ, Quote, Purchase Order, Contract, Invoice, Shipping Readiness, and Logistics Booking Request. Admin then created `freight_forwarder + ocean` and `carrier + trucking` candidates, updated a candidate, selected it, replaced it, cancelled the current selection, selected a complete candidate again, and marked the request `ready_for_external_booking`.

The smoke verified that an unsupported candidate transport mode and cross-request selection are rejected. The partial unique index and runtime selection counts retained exactly one current selection after initial selection, replacement, and final selection. Events remained within the approved internal planning vocabulary and included trusted update, selection-change, cancellation, and readiness records.

The owning Buyer and Manufacturer received only participant-safe rows. An unrelated Manufacturer received zero rows and Anonymous calls were denied. Participant candidate results excluded `contact_name`, `contact_email`, `contact_phone`, `quote_reference`, `notes`, and `version`; participant event results excluded `actor_profile_id` and `metadata`. Admin full-read RPCs retained the internal contact, quote-reference, notes, version, actor, and metadata fields.

The fixture transaction ended with `ROLLBACK`. A separate post-rollback audit returned fixture residue `0`. It covered Auth users, profiles, Manufacturers, Products, RFQs, Quotes, Purchase Orders, Contracts, Invoices, Shipping Readiness, Logistics Booking Requests, provider candidates, selections, and arrangement events through the fixture identity prefix, relational chain, and internal contact markers. Permanent migration objects were retained.

## Frontend Verification

The Admin workspace uses authority-checked Admin RPCs for full reads and the six trusted Admin RPCs for mutations. Buyer and Manufacturer arrangement views use only fixed-column, ownership-checked participant RPCs and never query internal arrangement tables directly. Demo mode returns empty arrangement collections and does not synthesize provider or booking data.

Validation results:

- `npm ci`: passed; `0` dependency vulnerabilities reported
- frontend tests: `161/161` passed
- staging/infrastructure tests: `23/23` passed
- production build: passed (`170` modules transformed)
- build advisory: the existing main JavaScript chunk remains above Vite's 500 kB advisory threshold
- secret scan: passed with `0` secret-pattern matches
- tracked environment files: `.env.example` and `.env.staging.example` only; local credential files remain ignored

## Staging Harness

`scripts/smoke/logistics-arrangement-live-smoke.mjs` remains plan-only and never applies migrations or emits credentials. Phase B used the rollback-scoped SQL fixture instead, so no long-lived fixture manifest or cleanup delete was required.

The branch-only Linux dry-run and one-time staging apply workflows were removed after successful verification because their pre-apply assumptions no longer apply and they have no ongoing operational purpose.

## Safety Confirmation

- Migration `0024` was applied exactly once to staging.
- Staging remote migrations are exactly `0001` through `0024`.
- Migration-history count for `0024` is exactly `1`.
- No migration beyond `0024` exists and no migration remains pending.
- The expanded rollback smoke passed `123/123`; the residue audit returned `0`.
- No production data or configuration was modified.
- No provider integration, carrier API, freight-forwarder API, tracking, customs, payment, or booking automation was added.
- No deployment or merge occurred.
- PH-010D was not started.
