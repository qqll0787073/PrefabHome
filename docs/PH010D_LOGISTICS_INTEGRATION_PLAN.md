# PH-010D Logistics Integration Plan

## 1. Executive Summary

PH-010D should integrate the existing Logistics Booking Request and Logistics Arrangement capabilities into a discoverable, role-appropriate workspace. The database foundation is already sufficient: migration `0023` owns booking-request creation and Manufacturer lifecycle actions, while migration `0024` owns provider candidates, selections, arrangement events, participant-safe reads, and Admin mutations.

The current implementation is secure at the database boundary but fragmented in the application. All portal modules render as one long dashboard, there are no logistics routes or focused navigation states, upstream-to-downstream handoffs depend on scrolling and interpreting eligibility cards, and independently mounted components do not share refresh state. PH-010D should address those integration concerns without changing schema or authorization.

**Database decision:** migration `0025` is not required for PH-010D. The existing RPCs support the required Buyer, Manufacturer, and Admin workflows. Optimistic version checks for concurrent Admin metadata edits would be useful future hardening, but they are optional and outside the required integration scope.

## 2. Current Implemented State

The application implements the transaction chain:

`RFQ -> Quote -> Purchase Order -> Contract -> Invoice -> Shipping Readiness -> Logistics Booking Request -> Logistics Arrangement`

Current behavior relevant to PH-010D:

- `PortalDashboard` role-gates Buyer, Manufacturer, and Admin content, then mounts every module for that role in a fixed vertical sequence.
- Manufacturer Shipping Readiness exposes records eligible for `ready_for_logistics`.
- Manufacturer Logistics Booking Requests can create one request from an eligible Shipping Readiness record, save an incomplete draft, submit a complete draft, and withdraw a draft or submitted request.
- Buyer and Admin can read Logistics Booking Requests; Manufacturer reads only requests associated with its own Manufacturer record.
- Admin Logistics Arrangement can create and update provider candidates, withdraw candidates, select or replace a provider, cancel a selection, and mark a complete selection ready for external booking.
- Buyer and Manufacturer arrangement views use participant-safe RPCs and show public planning candidates, the selected provider, and the safe event timeline.
- Demo mode creates no logistics records and currently presents the same empty-state copy as a real empty Supabase account.
- The database remains the lifecycle and authorization authority. Frontend helpers only predict valid actions.

## 3. Verified Branch and Schema Baseline

- Integration branch: `auth-profiles`
- Verified PH-010C merge commit: `7bd776e8f43f34cf9a28c74a87db09a63c82f7d1`
- PH-010D branch: `ph010d-logistics-integration`
- PH-010D branch base: the current `origin/auth-profiles` head at branch creation
- Local migrations: exactly `0001` through `0024`
- Protected migrations `0001` through `0023`: unchanged
- Migration `0024_logistics_arrangement_workspace_foundation.sql`: unchanged from the integrated baseline
- Staging migration history: exactly `0001` through `0024`, with no pending migration
- Production project ref `eoyrfrjbjglfudfuwxdf`: denylisted and not accessed during this audit

Audit baseline verification:

- `npm ci`: passed; 81 packages installed and 0 vulnerabilities reported
- frontend tests: `161/161` passed
- staging/infrastructure tests: `23/23` passed
- production build: passed; 170 modules transformed
- build advisory: the existing 670.19 kB main JavaScript chunk remains above Vite's 500 kB advisory threshold
- secret scan: passed with 0 matches
- isolated Supabase CLI `2.109.1` migration list: remote `0001` through `0024`
- isolated `db push --dry-run`: `Remote database is up to date.`
- remote writes performed by the audit: 0

## 4. Integration Gap Inventory

### A. Navigation and Discoverability

| Priority | Gap | Impact | Recommended PH-010D response |
| --- | --- | --- | --- |
| High | The dashboard mounts all workflow modules on one page. | Users must scroll through unrelated stages and can miss logistics actions. All modules also fetch immediately. | Add a role-aware dashboard workspace selector and a dedicated Logistics workspace. |
| High | There are no direct logistics URLs or request-focused links. App navigation is React state only. | Refresh, back/forward, bookmarking, and support links cannot restore a selected request. | Add lightweight URL query-state for `workspace=logistics` and `request=<uuid>` without requiring a router migration. |
| High | Shipping Readiness does not link directly to the eligible booking-request action. | The Manufacturer must discover the later Booking Request section manually. | Add a contextual `Prepare booking request` handoff that opens the Logistics workspace with the source Shipping Readiness record selected. |
| High | Admin Booking Requests and Arrangement are separate mounted sections. | Submitted requests do not lead directly into candidate management. | Use one Admin Logistics workspace with a request queue and request detail/action pane. |
| Medium | No status counts or actionable counts exist. | Users cannot see pending drafts, submitted requests, options available, or ready records at a glance. | Derive role-safe counts from already authorized booking-request rows. |
| Medium | The current status labels say `carrier` even when the selected organization is a forwarder, broker, or multimodal operator. | UI language can misrepresent the provider role. | Keep database statuses unchanged but use neutral UI copy such as `Provider options available` and `Provider selected`. |

### B. Workflow Continuity

| Priority | Gap | Impact | Recommended PH-010D response |
| --- | --- | --- | --- |
| High | Each stage owns isolated local state and has no shared transaction context. | A mutation in one module does not refresh downstream modules already mounted on the page. | Introduce feature-scoped invalidation/version state in the Logistics workspace and refetch affected booking, candidate, selection, and event data after every successful mutation. |
| High | Mutation failures do not refetch authoritative state. | A lifecycle conflict can leave stale controls visible after another session has changed the record. | On lifecycle/conflict failures, retain the error, refetch the selected request, and recompute available actions. |
| High | Prerequisites are implied by absent buttons or eligibility cards. | Users cannot tell why a booking request or readiness action is unavailable. | Add prerequisite checklists derived from current records and helper functions. |
| Medium | The selected Admin request ID can remain set after the request leaves the eligible collection. | The select control can point at an ID with no detail pane. | Reconcile selection after every load and fall back to the first valid request or the queue empty state. |
| Medium | Buyer and Manufacturer booking and arrangement histories are split into separate sections. | The user cannot read one coherent request story. | Combine booking facts, selected provider, candidate options, and both timelines in one request detail. |
| Medium | All participant arrangement data is loaded globally and filtered in the browser. | It is correct under RPC ownership checks but unnecessarily broad and less scalable. | Load request summaries first, then call participant RPCs with the selected request UUID. |

### C. Buyer Experience

| Priority | Gap | Impact | Recommended PH-010D response |
| --- | --- | --- | --- |
| High | There is no focused Buyer Logistics area. | Booking and arrangement information is hard to find among all Buyer modules. | Add a Buyer Logistics workspace with status filters, request list, and safe detail. |
| High | Arrangement cards omit service level, departure/arrival estimates, transit days, selection history, and explicit pending explanations. | The Buyer receives an incomplete planning summary despite those fields being in the safe RPC. | Render the complete participant-safe planning projection and selected-state semantics. |
| High | Submitted requests disappear from the arrangement component until the first candidate is created. | `No carrier options` can be confused with no request or a load failure. | Show distinct states: submitted/pending review, options available, selected, ready, withdrawn, and no request. |
| Medium | The event timeline shows only timestamp and label. | The Buyer cannot easily connect selection changes to the candidate involved. | Correlate safe `candidate_id` and `selection_id` with safe candidate names without exposing metadata. |
| Security | Internal contacts, quote references, notes, actors, metadata, and versions must remain absent. | Accidental use of Admin/base-table records would disclose internal operations. | Keep participant TypeScript records and participant RPC services separate; add shape assertions and browser network-response checks. |

### D. Manufacturer Experience

| Priority | Gap | Impact | Recommended PH-010D response |
| --- | --- | --- | --- |
| High | Shipping Readiness, Booking Request editing, and Arrangement status are separate sections. | The Manufacturer cannot follow a single record through logistics preparation. | Present eligible Shipping Readiness, booking draft/submission, and read-only arrangement detail in one Manufacturer workspace. |
| High | Submitted/withdrawn handoff status is not explained beyond generic disclaimer text. | Users may expect a selected provider or external booking from submission. | Add lifecycle-specific next-step copy and preserve the existing external-booking disclaimer. |
| High | No explicit refresh/retry exists after Admin arrangement changes. | A Manufacturer session can retain stale options until page reload. | Add manual retry and refresh-on-focus/request-open behavior; refetch selected detail after workspace invalidation. |
| Security | Ownership filtering depends on database RLS/RPC checks and must not be replaced by client filters. | Client-side ownership filtering would expose unrelated requests. | Continue using Manufacturer booking reads under RLS and participant-safe arrangement RPCs; test unrelated Manufacturer denial in SQL and browser smoke. |

### E. Admin Experience

| Priority | Gap | Impact | Recommended PH-010D response |
| --- | --- | --- | --- |
| High | The request queue has no filtering, search, sorting controls, counts, or focused action status. | Admin operations become difficult as request volume grows. | Add status tabs/counts, identifier search, deterministic sorting, and selected-request detail. Use existing authorized rows and RPCs. |
| High | Candidate actions use `window.prompt` and send an empty selection reason. | Reasons are awkward to validate, easy to cancel accidentally, and not visible before committing. | Replace prompts with accessible inline dialogs/forms for withdrawal, selection/replacement, and cancellation reasons. |
| High | Admin full-read fields are fetched but not fully displayed. | Contact details, quote reference, dates, and selection history cannot be reviewed efficiently. | Add an Admin-only internal details area using only Admin RPC records. |
| High | Lifecycle conflict errors are generic and stale data is not reloaded on failure. | Two Admin sessions can leave one session with misleading actions. | Map known RPC conflict messages to a conflict state, refetch, and explain the newly authoritative status. |
| Medium | Candidate update has database row locking but no expected-version argument. | Concurrent metadata edits are last-write-wins. | Treat optimistic version enforcement as optional future database hardening; PH-010D should display version and refresh before edit/save. |
| Medium | Selection/cancellation/readiness actions do not have tailored confirmations or post-action focus management. | High-impact planning actions are easy to misread and less accessible. | Add explicit confirmation summaries and return focus to the updated request status/action region. |
| Medium | Admin events include safe internal metadata but the UI renders only labels. | Audit context such as reason or replaced selection is hidden. | Render an allowlisted metadata summary for Admin only; never reuse it in participant components. |

### F. Error and State Handling

| Priority | Gap | Impact | Recommended PH-010D response |
| --- | --- | --- | --- |
| High | Initial loads use `Promise.all`; one failed request removes the entire workspace result. | Partial read failures prevent otherwise available information from rendering. | Use a coordinated loader with explicit critical and secondary requests, or `Promise.allSettled` with scoped errors. |
| High | No retry control is rendered with load errors. | Recovery requires a full page reload. | Add retry actions for queue and selected detail. |
| High | Existing data is not explicitly marked stale during background refresh or after a failed refresh. | Users may act on old information. | Track `initialLoading`, `refreshing`, `stale`, and `savingAction` separately. Disable mutations when authoritative refresh fails. |
| High | Mutation errors do not reconcile local lifecycle state. | Conflict and permission failures can leave invalid buttons visible. | Always refetch authoritative request detail after lifecycle errors where the session remains valid. |
| Medium | Demo mode silently renders normal empty states. | Local demo behavior can be mistaken for a real empty account. | Show a visible `Demo data unavailable for logistics` state; never synthesize logistics records. |
| Medium | No request cancellation/ignore guard exists for unmount or rapid role changes. | Late responses can update obsolete component state. | Use an effect cancellation flag or `AbortSignal` where supported. |
| Medium | Global `isSaving` disables every Admin action. | Unrelated actions appear frozen and action ownership is unclear. | Track the active mutation by request/candidate/action ID. |
| Performance | All role modules mount together; booking timelines use one query per request; arrangement reads load all rows. | Dashboard startup causes broad parallel requests and N+1 event queries. | Mount only the selected workspace, lazy-load selected request details, and add batched/event fetch helpers where the existing RLS surface allows. |

### G. Testing Gaps

| Priority | Gap | Recommended coverage |
| --- | --- | --- |
| High | No committed component/navigation tests cover logistics integration. | Test role navigation, direct-link restoration, queue/detail selection, empty states, and action visibility. |
| High | Existing frontend tests are primarily pure helper tests. | Add view-model/hook tests for counts, state grouping, selected request reconciliation, and mutation invalidation. |
| High | No browser E2E covers the integrated Buyer/Manufacturer/Admin handoff. | Add real-browser role flows using ignored credentials and exact-ID cleanup. |
| High | Stale-state and concurrent Admin sessions are not exercised in the UI. | Test selection replacement/cancellation/readiness conflicts and required refetch behavior. |
| High | Participant network payload shape is not checked in a browser. | Assert no contact, internal note, quote reference, actor, metadata, or version fields appear in participant responses/logs. |
| Medium | Demo-mode logistics behavior has no focused test. | Verify explicit demo indication, zero synthetic records, and no Supabase calls. |
| Medium | Accessibility behavior is untested. | Cover labels, focus movement, dialog semantics, live status announcements, and keyboard-only actions. |

## 5. Proposed PH-010D Scope

PH-010D should deliver a focused Logistics workspace inside each protected portal while preserving the existing marketplace and upstream business modules. The workspace should:

- expose role-appropriate status counts and request lists;
- connect Shipping Readiness eligibility to booking-request creation for Manufacturers;
- combine booking-request and arrangement detail into one coherent record view;
- use participant-safe RPCs only for Buyer and Manufacturer arrangement data;
- use Admin full-read and mutation RPCs only in Admin components;
- lazy-load detail for the selected request;
- provide explicit loading, empty, pending, error, stale, retry, and demo states;
- reconcile state after every mutation and lifecycle conflict;
- support a bookmarkable query-state URL for a selected logistics request;
- retain all external-booking disclaimers and avoid implying provider integration.

## 6. Explicit Non-Goals

- No migration `0025` or modification to migrations `0001` through `0024`.
- No carrier, freight-forwarder, broker, customs, tracking, booking, dispatch, pickup, or delivery integration.
- No automatic provider outreach, rate retrieval, reservation, or external booking.
- No schema/status renaming.
- No changes to RLS, RPC grants, authentication, or role authority.
- No exposure of provider contacts, quote references, internal notes, event actors, metadata, or internal versions to participants.
- No redesign of the marketplace or upstream RFQ/Quote/PO/Contract/Invoice domains.
- No deployment or production data operation as part of implementation.

## 7. Files Expected to Change

Expected existing files:

- `src/app/App.tsx`
- `src/app/constants.ts`
- `src/components/layout/PortalNavigation.tsx`
- `src/features/dashboard/PortalDashboard.tsx`
- `src/features/logistics-booking/BuyerLogisticsBookingRequests.tsx`
- `src/features/logistics-booking/ManufacturerLogisticsBookingRequests.tsx`
- `src/features/logistics-booking/AdminLogisticsBookingRequests.tsx`
- `src/features/logistics-booking/LogisticsBookingRequestSummary.tsx`
- `src/features/logistics-arrangement/LogisticsArrangementReadOnly.tsx`
- `src/features/logistics-arrangement/AdminLogisticsArrangementWorkspace.tsx`
- `src/lib/logisticsBookingRequests.ts`
- `src/lib/logisticsArrangement.ts`
- `src/lib/logisticsBookingRequests.test.ts`
- `src/lib/logisticsArrangement.test.ts`
- `src/types.ts`
- `src/styles.css`
- PH-010D documentation and verification files

Likely new files:

- `src/features/logistics/LogisticsWorkspace.tsx`
- `src/features/logistics/LogisticsWorkspaceNavigation.tsx`
- `src/features/logistics/LogisticsRequestList.tsx`
- `src/features/logistics/LogisticsRequestDetail.tsx`
- `src/features/logistics/LogisticsStatusSummary.tsx`
- `src/features/logistics/AdminProviderCandidateForm.tsx`
- `src/features/logistics/AdminSelectionDialog.tsx`
- `src/features/logistics/useLogisticsWorkspace.ts`
- `src/features/logistics/logisticsWorkspaceModel.ts`
- focused unit/component tests and a staging/browser smoke script

Exact extraction boundaries should follow the existing feature-module style and avoid circular imports.

## 8. Existing RPCs to Reuse

PH-010B trusted Manufacturer RPCs:

- `create_logistics_booking_request`
- `update_logistics_booking_request_draft`
- `submit_logistics_booking_request`
- `withdraw_logistics_booking_request`

PH-010C participant-safe read RPCs:

- `get_participant_logistics_provider_candidates`
- `get_participant_logistics_provider_selections`
- `get_participant_logistics_arrangement_events`

PH-010C Admin full-read RPCs:

- `admin_list_logistics_provider_candidates`
- `admin_list_logistics_provider_selections`
- `admin_list_logistics_arrangement_events`

PH-010C Admin mutation RPCs:

- `admin_create_logistics_provider_candidate`
- `admin_update_logistics_provider_candidate`
- `admin_withdraw_logistics_provider_candidate`
- `admin_select_logistics_provider_candidate`
- `admin_cancel_logistics_provider_selection`
- `admin_mark_ready_for_external_booking`

Booking Request rows and booking event rows should continue to use their existing authenticated RLS policies. No UI component should query the three internal PH-010C base tables directly.

## 9. New Frontend Components or Hooks Proposed

- `LogisticsWorkspace`: role-aware shell that owns navigation, URL state, selection, and invalidation.
- `LogisticsWorkspaceNavigation`: compact status tabs/counts and role-appropriate call to action.
- `LogisticsRequestList`: searchable/filterable request summaries with deterministic selection.
- `LogisticsRequestDetail`: combined Booking Request and Arrangement detail boundary.
- `LogisticsStatusSummary`: neutral lifecycle label, prerequisite explanation, and next step.
- `useLogisticsWorkspace`: coordinated loader with separate queue/detail state, retries, stale handling, and mutation invalidation.
- `logisticsWorkspaceModel`: pure grouping, count, action, and selection reconciliation helpers.
- `AdminProviderCandidateForm`: extracted candidate editor with validation and accessible status.
- `AdminSelectionDialog`: explicit selection, replacement, withdrawal, and cancellation reason workflow.

Participant and Admin records must remain distinct at both prop and service boundaries.

## 10. Navigation and Dashboard Changes

- Keep the existing top-level `Dashboard` tab.
- Add a role-aware dashboard workspace selector so only one operational workspace mounts at a time.
- Add `Logistics` as a Buyer, Manufacturer, and Admin workspace entry with actionable counts.
- Preserve role-gating in `PortalDashboard`.
- Use URL query state such as `?view=dashboard&workspace=logistics&request=<uuid>` to support refresh and direct links without adding React Router.
- Validate any request UUID from the URL against rows returned by the authorized query before rendering detail.
- From Manufacturer Shipping Readiness, open the Logistics workspace with the eligible source selected.
- From Admin submitted-request summaries, open the same Admin workspace and selected request.
- Support back/forward changes through a small URL-state hook and never treat a URL identifier as authorization.

## 11. Buyer Acceptance Criteria

- Buyer can discover Logistics from the protected portal without scrolling through unrelated modules.
- Buyer sees only its own Booking Requests and participant-safe Arrangement rows.
- Buyer can open a request from a list or direct URL and sees booking status, source identifiers, safe provider options, selected provider, service level, mode, estimates, and safe timeline.
- Submitted-without-options, options-available, selected, ready, withdrawn, empty, loading, error, stale, and demo states are distinct.
- Buyer never receives or renders provider contacts, quote reference, internal notes, event actor, event metadata, or internal version.
- Buyer has no logistics mutation controls.
- Refresh and back/forward restore an authorized selected request.

## 12. Manufacturer Acceptance Criteria

- Manufacturer can discover eligible Shipping Readiness records and its own Booking Requests in one Logistics workspace.
- Manufacturer can create, edit, submit, and withdraw only through existing trusted RPCs and only when database status permits.
- Draft validation remains partial-save/full-submit.
- Submitted and arrangement states are read-only and explain the next step.
- Manufacturer sees only participant-safe provider and event information for its own requests.
- Unrelated Manufacturer requests never appear, including through a manually edited URL.
- Successful mutations refresh request, event, status count, and arrangement detail state.
- Conflict/permission failures display a useful message and refetch authoritative state.

## 13. Admin Acceptance Criteria

- Admin sees a focused queue with status counts, search, filters, and stable sorting.
- Admin can select a submitted or in-progress request and load its full internal candidate, selection, and event data through Admin RPCs.
- Admin can create/edit/withdraw candidates, select/replace/cancel a provider, and mark readiness only when current state permits.
- `provider_type` and `transport_mode` remain independent inputs.
- Internal contact fields, quote reference, notes, version, actor, and allowlisted metadata are visible only in the Admin workspace.
- Selection/replacement/cancellation/withdrawal reasons use validated in-app forms, not prompts.
- Every mutation disables only the relevant action, announces progress/result, refetches authoritative detail, and reconciles the selected request.
- Lifecycle conflict responses cause a refresh and do not leave stale mutation controls active.

## 14. Error-State Acceptance Criteria

- Initial loading, background refresh, saving, empty, demo, stale, recoverable error, permission error, session error, and lifecycle conflict are represented separately.
- Every load error has a retry action.
- Partial secondary-read failure does not erase successfully loaded queue data.
- A failed mutation never applies an optimistic lifecycle change locally.
- Lifecycle conflict errors trigger an authoritative refetch before actions are re-enabled.
- Permission/session errors do not expose retained data after logout or role change.
- Unknown errors are readable without logging credentials, access tokens, refresh tokens, signed URLs, or internal database details.

## 15. Accessibility Considerations

- Use semantic headings and landmarks for queue, request detail, candidates, selection, and timeline.
- Give every icon-only action an accessible name and tooltip.
- Use real dialogs with labelled titles/descriptions for destructive or consequential actions.
- Move focus to the dialog on open and restore it to the invoking control on close.
- Announce loading, mutation success, conflict refresh, and validation failures through appropriate live regions.
- Associate validation messages with their fields using `aria-describedby` and `aria-invalid`.
- Ensure status is conveyed by text as well as color.
- Keep keyboard order predictable when the selected request changes.
- Do not auto-focus background content or cause large scroll jumps after refresh.

## 16. Browser E2E Test Plan

Use local ignored Buyer, Manufacturer, and Admin smoke credentials with normal Supabase Auth. Do not use service-role credentials in browser code.

1. Manufacturer opens Logistics from the dashboard, creates a request from eligible Shipping Readiness, saves a partial draft, completes it, and submits it.
2. Buyer opens the same authorized request and sees the submitted/pending state with no internal fields.
3. Admin filters to submitted requests, creates both `freight_forwarder + ocean` and `carrier + trucking` candidates, edits one, and selects one.
4. Buyer and Manufacturer refresh and see safe options and selected state.
5. Admin replaces the selection, cancels it, reselects a complete option, and marks readiness.
6. Buyer and Manufacturer see the safe timeline and final planning status.
7. An unrelated Manufacturer edits the direct request URL and receives no row/detail.
8. Anonymous access is denied or redirected to authentication.
9. Two Admin sessions exercise a selection or readiness conflict; the losing UI refetches and presents the authoritative state.
10. Refresh and browser back/forward preserve valid workspace/request state.
11. For all roles, assert zero console errors and zero unsafe log matches for credentials, tokens, full signed URLs, contacts, notes, actors, or metadata.
12. Clean up only exact fixture IDs and verify zero residue.

## 17. Unit and Component Test Plan

Unit/view-model tests:

- status grouping and role-specific counts;
- neutral status labels;
- request selection reconciliation after refresh/removal;
- URL parsing and rejection of unknown/unauthorized request IDs;
- prerequisite and next-step text;
- participant-safe candidate/event mapping;
- Admin action availability from request/candidate/selection states;
- stale/conflict error classification;
- no synthetic logistics data in demo mode.

Component/hook tests:

- workspace navigation mounts only the selected module;
- role-specific action visibility;
- initial, empty, pending, error, retry, stale, and saving states;
- queue/detail lazy loading and request-ID-scoped RPC calls;
- successful mutation invalidation/refetch;
- failed lifecycle mutation refetch;
- participant components reject internal record shapes;
- dialog validation, keyboard behavior, focus restoration, and live announcements.

Existing SQL security suites remain authoritative for role isolation and lifecycle writes.

## 18. Staging Verification Plan

- Run the staging safety guard before every remote command.
- Require project ref `bvzbkjpbnczquecwqvlm` and reject `eoyrfrjbjglfudfuwxdf`.
- Confirm migrations remain exactly `0001` through `0024` and no migration is pending.
- Do not run `db push`, migration repair, reset, pull, or schema reset for PH-010D.
- Run existing rollback SQL for migrations `0023` and `0024`.
- Run the integrated live browser scenario with exact-ID fixture cleanup.
- Verify participant-safe response shapes and unrelated-role isolation.
- Exercise Admin conflict recovery with two sessions.
- Verify zero fixture residue across the upstream transaction chain and all logistics tables.
- Run frontend tests, infrastructure tests, production build, and secret scan after browser verification.

## 19. Database Migration Decision

**Required migration:** none.

Migrations `0023` and `0024` already provide:

- all required booking and arrangement lifecycle states;
- Manufacturer booking mutation RPCs;
- Buyer/Manufacturer ownership-protected safe reads;
- Admin full-read RPCs;
- all six Admin arrangement mutation RPCs;
- row locking and state-conditional lifecycle updates;
- current-selection uniqueness;
- trusted event generation and protected internal tables.

**Optional future improvement:** add expected candidate/request version parameters for optimistic metadata-write conflict detection. That capability would require a new additive migration, likely `0025`, because the current Admin update RPC does not accept an expected version. It is not required for PH-010D: lifecycle conflicts are already serialized, and the integration can mitigate stale metadata by refreshing before edit, showing the current version, and refetching after failure.

Migration `0024` must not be modified.

## 20. Security Boundaries

- Database RLS and trusted RPCs remain authoritative; UI state never grants access.
- Buyer and Manufacturer arrangement reads must call only the three participant-safe RPCs.
- Admin internal reads must call only the three Admin list RPCs.
- Admin writes must call only the six Admin mutation RPCs.
- No component may directly select or mutate `logistics_provider_candidates`, `logistics_provider_selections`, or `logistics_arrangement_events`.
- Participant types must remain structurally separate from Admin internal types.
- Direct URL IDs must be validated against authorized query results.
- Internal contacts, quote references, notes, actor IDs, metadata, and internal versions must not enter participant props, browser logs, analytics, or error reporting.
- No service-role key may be used by frontend code or browser tests.
- Demo mode must not fabricate security-sensitive workflow data.

## 21. Rollback Strategy

PH-010D has no database migration. Rollback is therefore an application rollback:

- keep existing logistics services and RPC contracts intact;
- isolate new navigation/workspace composition from existing role/auth state;
- retain or restore the previous dashboard component composition if the integrated workspace must be reverted;
- avoid destructive type renames and preserve existing exported service functions until callers are migrated;
- gate URL-state parsing so removing it does not alter database behavior;
- verify rollback with frontend tests, build, and the existing `0023`/`0024` SQL suites.

No staging schema rollback is needed because PH-010D should not create schema objects.

## 22. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Participant component accidentally receives Admin records. | Separate hooks, return types, files, and tests; never use a union of safe/internal records. |
| URL state is mistaken for authorization. | Resolve IDs only through authorized service results and show not-found/denied without probing internal tables. |
| Dashboard refactor regresses upstream modules. | Mount existing modules through a conservative workspace map and add navigation regression tests. |
| Broad refetches create latency. | Load queue summaries once, lazy-load request-scoped details, and invalidate only affected resources. |
| Partial load failures create inconsistent UI. | Model each resource state explicitly and disable mutations when authoritative request/detail state is unavailable. |
| Concurrent Admin actions produce stale controls. | Rely on database locks/state conditions, refetch after conflicts, and optionally plan future expected-version RPCs. |
| Neutral UI labels diverge from database values. | Keep typed mapping helpers and never change persisted status values. |
| Browser smoke leaves fixtures. | Record exact IDs, clean in dependency order, and run a zero-residue audit. |
| Existing Vite bundle advisory grows. | Lazy-mount the selected workspace and inspect chunk output during implementation. |

## 23. Suggested Implementation Phases

### PH-010D-A: Navigation, Dashboard Integration, and Read-Only Participant Experience

- Add dashboard workspace navigation and query-state deep links.
- Mount only the selected workspace.
- Build the shared Logistics request list/detail shell.
- Integrate Manufacturer Shipping Readiness to Booking Request handoff.
- Combine Buyer and Manufacturer booking plus participant-safe arrangement detail.
- Add status counts, pending/empty/demo/error/retry states, and participant shape tests.
- Preserve all existing mutations and database authority unchanged.

### PH-010D-B: Admin Workflow Refinement and Mutation UX

- Merge Admin request queue and arrangement actions into one focused workspace.
- Add filters, search, sorting, internal candidate detail, and selection history.
- Extract validated candidate and reason dialogs.
- Add mutation-scoped progress, confirmation, notice, and refetch behavior.
- Add conflict classification and authoritative state reconciliation.
- Add unit/component coverage for Admin action availability and failure states.

### PH-010D-C: Browser E2E, Concurrency, Error Handling, and Staging Verification

- Run Buyer, Manufacturer, and Admin end-to-end browser flows.
- Exercise direct-link authorization, refresh/back-forward state, partial failures, retry, and two-session conflicts.
- Verify console/network safety and participant field exclusion.
- Run rollback SQL and staging smoke with exact-ID cleanup.
- Complete accessibility checks, performance review, regression tests, build, secret scan, and verification documentation.

## 24. Definition of Done

- Buyer, Manufacturer, and Admin can discover and open a focused Logistics workspace.
- The Manufacturer handoff from ready Shipping Readiness through Booking Request submission is clear.
- Buyer and Manufacturer see a coherent participant-safe request, selection, and timeline view.
- Admin can efficiently manage candidates and selections through the existing trusted RPCs.
- Direct links restore authorized workspace/request state and never bypass database authorization.
- Loading, empty, pending, demo, error, retry, stale, saving, permission, and conflict states meet the acceptance criteria.
- Participant responses and UI contain no internal provider contacts, quote references, notes, actor IDs, metadata, or internal versions.
- No migration is added or changed; staging remains exactly `0001` through `0024` with nothing pending.
- Frontend, infrastructure, SQL, browser, accessibility, build, and secret-scan verification pass.
- Exact-ID staging fixture cleanup returns zero residue.
- Production remains untouched and no deployment occurs.
