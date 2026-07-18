# PrefabHome Beta MVP Release Verification

## Release Scope

Branch: `ph010d-logistics-integration`

Base integration branch: `auth-profiles`

Verified planning baseline: `43d8ab85ed6f44dbd62d779aa811a4864559d0ac`

This sprint integrates the implemented transaction chain into focused role workspaces:

`RFQ -> Quote -> Purchase Order -> Contract -> Invoice -> Shipping Readiness -> Logistics Booking Request -> Logistics Arrangement`

No database migration was added or changed. Migrations remain exactly `0001` through `0024`, and the Beta reuses the authority-checked RPC and RLS surfaces already defined by migrations `0023` and `0024`.

## Portal Experience

### Buyer

The Buyer portal provides focused Dashboard, RFQ, Quote, Purchase Order, Contract, Invoice, Shipping, and Logistics workspaces. The Logistics workspace includes request filtering, request-focused detail, participant-safe provider options, selected-provider status, planning estimates, safe timeline entries, loading and retry states, stale-state handling, and truthful empty/demo states.

Participant reads use only the ownership-checked participant RPCs. Buyer rendering does not receive provider contacts, quote references, internal notes, actor IDs, event metadata, or record versions.

### Manufacturer

The Manufacturer portal provides focused Dashboard, Company, Product, RFQ, Quote, Purchase Order, Contract, Invoice, Shipping Readiness, and Logistics workspaces. A successful Shipping Readiness action can continue directly to Logistics. Manufacturers can create, edit, save, submit, and withdraw permitted booking requests and can inspect participant-safe provider and timeline information after Admin planning actions.

Database ownership checks remain authoritative; the UI does not substitute client filtering for RLS or RPC authorization.

### Admin

The Admin portal provides focused operational workspaces for Manufacturers, Products, RFQs/Quotes, Purchase Orders, Contracts, Invoices/Payments, Shipping, and Logistics. The Users workspace is a truthful Beta placeholder because a dedicated production user-search service is not yet implemented.

Admin Logistics includes an active request queue, status counts, search, filters, deterministic ordering, selected request detail, internal provider fields, candidate creation and editing, withdrawal, selection/replacement, cancellation, readiness, and internal timeline metadata. Lifecycle mutations use accessible confirmation dialogs and existing trusted RPCs.

## Navigation And State

- Portal workspace navigation is role-aware and marks the current item with `aria-current`.
- Workspace and selected Logistics request state are represented in URL query parameters.
- Refresh and browser back/forward restore supported state.
- Invalid or unauthorized workspace/request identifiers are reconciled to an allowed state.
- Workspace modules load lazily; selected request details load only when selected.
- Manufacturer Shipping Readiness includes a contextual handoff to Logistics.
- Neutral labels distinguish internal planning from external fulfillment: `Provider options available`, `Provider selected`, and `Ready for external booking`.

## Data Coordination

The Logistics components keep queue and selected-detail state feature-scoped. They distinguish initial loading, background refresh, detail loading, stale data, action-specific saves, critical errors, and secondary partial failures. Detail reads use `Promise.allSettled` so a secondary timeline failure does not discard otherwise safe request data.

Mutation success and lifecycle conflict paths refetch authoritative queue and detail data. Generation guards prevent obsolete responses from changed requests, roles, or unmounted components from replacing current state. Arrangement data is request-scoped rather than globally loaded.

## Accessibility And Responsive Verification

- Admin mutation prompts were replaced by labelled modal dialogs.
- Dialogs support Escape, a keyboard focus loop, initial focus, and focus restoration.
- Forms retain explicit labels and validation/error states.
- Browser accessibility-tree inspection found `0` unnamed buttons.
- Desktop and 390-pixel viewport checks showed no incoherent overlap; workspace navigation scrolls horizontally at narrow widths.
- Local role-navigation browser smoke reported `0` console errors.

## Automated Verification

Final local verification on 2026-07-18:

- `npm ci`: passed; 81 packages installed from lockfile
- frontend tests: `173/173` passed
- infrastructure tests: `23/23` passed
- production build: passed
- dependency audit: `0` vulnerabilities
- tracked files scanned for secrets: `257`
- tracked local environment files: `0`
- real secret-pattern matches: `0`
- exact local-secret matches: `0`
- synthetic infrastructure-test secret fixtures: `3`, classified and not credentials

The build emits lazy chunks for the role workspaces. The largest output is the main JavaScript chunk at `476,289` bytes, below Vite's 500 kB advisory threshold. The participant and Admin Logistics chunks are approximately 15 kB and 18 kB respectively.

## Browser Handoff Verification

The complete role handoff was exercised against the staging Supabase project using temporary, uniquely identified fixtures:

1. Manufacturer signed in, created a booking draft from eligible Shipping Readiness, saved it, and submitted it for arrangement.
2. Admin opened the submitted request, created a freight-forwarder/ocean option and a carrier/trucking option, selected the provider, and marked the request ready for external booking.
3. Buyer opened the request and saw the selected provider, service/mode, dates, transit estimate, cost/currency, readiness, and safe timeline.
4. Manufacturer refreshed and saw the updated participant-safe provider and readiness state.

Results:

- Manufacturer draft/save/submit: passed
- Admin candidate creation/selection/readiness: passed
- Buyer participant-safe read: passed
- Manufacturer refreshed participant-safe read: passed
- provider contacts exposed to participants: `0`
- quote references/internal notes exposed to participants: `0`
- actor IDs/event metadata exposed to participants: `0`
- browser console errors: `0`
- unsafe browser log matches: `0`
- credentials, access tokens, refresh tokens, and full signed URLs logged: `0`

## Staging And Cleanup

Staging project ref: `bvzbkjpbnczquecwqvlm`

Production denylisted ref: `eoyrfrjbjglfudfuwxdf`

The staging safety guard passed before fixture creation and rejected the production ref. The repository's normal linked Supabase workspace was not used; staging SQL checks used an isolated temporary CLI workspace.

Read-only migration-history verification after the browser smoke reported:

- migration rows: `24`
- first/last migration: `0001` / `0024`
- migration `0024` rows: `1`
- migrations beyond `0024`: `0`
- pending migration implied by local/remote set comparison: none

Cleanup deleted the exact temporary business chain in reverse dependency order and then deleted the three temporary Auth users. A separate residue audit returned `0` for all audited categories: Auth users, profiles, Manufacturers, Products, RFQs, Quotes, Purchase Orders, Contracts, Invoices, Shipping Readiness, Logistics Booking Requests, booking events, provider candidates, provider selections, and arrangement events.

Production was not accessed. No migration was applied, no deployment occurred, and no branch was merged.

## Security Boundaries

- Participant Logistics reads remain on fixed-column, ownership-checked RPCs.
- Admin internal reads and mutations remain on Admin-authorized RPCs.
- Direct internal base-table access was not introduced.
- UI role checks are presentation controls only; database authority remains unchanged.
- Demo mode does not synthesize booking requests or provider records.
- No service-role key, password, token, signed URL, fixture manifest, or generated browser artifact is tracked.

## Known Beta Limitations

- The Users workspace does not yet provide production user search or account administration.
- Notifications are represented by workspace activity and next-action summaries; there is no centralized notification service.
- Logistics readiness is internal planning state only. It does not contact a provider, reserve capacity, schedule pickup, confirm a booking, dispatch cargo, clear customs, track a shipment, or complete delivery.
- Mobile workspace navigation uses an intentional horizontal rail.
- Error monitoring and operational telemetry remain deployment concerns.

Post-Beta work explicitly excludes from this release:

- real multi-currency payment processing
- automatic email
- automatic shipment tracking
- third-party carrier APIs
- customs filing automation
- AI quote recommendations
- full audit logging
- enterprise reports

## Release Decision

The integrated Beta implementation is ready for review in one draft pull request targeting `auth-profiles`. The PR must not target or merge into `main`, and no production deployment is part of this verification.
