# Sprint 3A UAT Checklist

## Scope and Safety

This verification was run from `production-sprint-3a` against the approved staging project only. Production access, migration changes, deployment, merge, tag, and release were prohibited and did not occur. Staging migrations remained `0001` through `0024`.

Status meanings:

- **Pass:** verified through the browser, authenticated staging API, or a deterministic automated test.
- **Fail:** observed behavior violates the required security or workflow contract.
- **Blocked:** the frontend cannot complete the workflow because the staging database authority is defective.

## Buyer UAT

| Item | Status | Evidence |
| --- | --- | --- |
| Login | Pass | Disposable Buyer authenticated through normal Supabase Auth. |
| Browse Products | Pass | Published staging fixture appeared in the marketplace and Product detail opened. |
| Create Product RFQ | Pass | Request Quote opened from Product detail. |
| Save Draft | Pass | A draft RFQ was persisted and its UUID retained by the dialog. |
| Edit Draft | Pass | Quantity, destination, and message were edited on the saved row. |
| Submit RFQ | Pass | The saved UUID was transitioned; no second RFQ was inserted. |
| No duplicate RFQ | Pass | Authenticated verification returned one RFQ for the Product after save, edit, and submit. |
| View RFQ | Pass | My RFQs and RFQ detail loaded the submitted transaction. |
| Timeline | Blocked | Staging RFQ event triggers are disabled. RPC-generated events can exist, but normal lifecycle history is incomplete. |
| Conversation | Blocked | The database sender derivation trigger is disabled, so a browser message insert fails safely instead of accepting browser-provided role data. |
| Quote comparison | Pass | Buyer saw the submitted quote, line items, subtotal, Incoterm, and version data; draft quotes remained hidden. |
| SQL date rendering | Pass | Unit and component tests verify date-only values retain their calendar day at timezone boundaries. Native date entry was not conclusively exercised in the live browser run. |

## Manufacturer UAT

| Item | Status | Evidence |
| --- | --- | --- |
| Login | Pass | Disposable approved Manufacturer authenticated normally. |
| RFQ inbox | Pass | Submitted assigned RFQ appeared and opened. |
| Buyer draft hidden in UI/service | Pass | Query adds `status <> draft` and the returned list is filtered again before rendering. |
| Buyer draft hidden by RLS | Fail | A direct authenticated Manufacturer query returned the assigned Buyer's draft. This requires a forward database migration. |
| Unrelated Manufacturer isolation | Pass | An unrelated Manufacturer received zero fixture RFQs. |
| Create Quote | Pass | Manufacturer created a draft through the approved RPC. |
| Save Quote metadata | Pass | Currency, Incoterm, ports, lead times, and notes were retained. |
| Add/edit/delete line items | Pass | Browser add was exercised; helper and service tests cover edit/delete refresh behavior. |
| Immediate subtotal | Pass | Current editor values produced a decimal-safe `$154,000.00` preview before persistence. |
| Preserve unsaved metadata during item refresh | Pass | Unsaved metadata remained after line-item mutation; regression tests cover refresh merging. |
| Submit Quote | Pass | Trusted RPC submitted the draft and the UI became read-only. |
| Refresh authoritative RFQ/Quote status | Pass | Inbox selection refreshed from server data and displayed `Quoted`; no optimistic status override was used. |
| View Quote history | Pass | Submitted version appeared in the Manufacturer history. |
| Revision superseding | Blocked | The approved RPC does not supersede a prior `revision_requested` version when a revision is submitted. No client-side workaround was added. |
| Conversation reply | Blocked | Message sender identity trigger is disabled. The UI reported a sanitized database error and did not send `sender_role`. |

## Admin UAT

| Item | Status | Evidence |
| --- | --- | --- |
| Login and role | Pass | Disposable Admin authenticated and `profiles.role` was `admin`. |
| Read RFQs, quotes, messages, events | Pass | RFQ Management and Quote Detail loaded authorized records. |
| Read-only UI | Pass | No lifecycle, quote, or message mutation controls were exposed. |
| Participant isolation inspection | Pass | Unrelated Manufacturer received zero rows; Buyer and owning Manufacturer surfaces were scoped to the fixture. |
| Database lifecycle authority | Fail | Disabled protection triggers permit direct mutations that the committed migration intends to reject. This is a Critical staging schema drift issue. |
| No role escalation/event forgery UI | Pass | No such controls exist. Database trigger drift still requires correction before release. |

## Remediation Regression Matrix

| Required correction | Status | Verification |
| --- | --- | --- |
| Existing draft submission keeps saved RFQ ID | Pass | `persistProductRFQ()` updates/submits the supplied draft UUID. |
| Save then submit keeps record count at one | Pass | Unit test records one create and one staging row remained. |
| Manufacturer service excludes Buyer drafts | Pass | Query and post-query boundary checks are tested. |
| Database remains authoritative | Fail | Existing RLS policy still exposes assigned drafts; documented as a blocker rather than concealed. |
| Subtotal uses current item form state | Pass | Integer-cent preview helper and browser display verified. |
| Item mutations preserve unsaved metadata | Pass | Form merge helper and browser flow verified. |
| Date-only rendering avoids UTC conversion | Pass | `formatDateOnly()` and component tests cover near-boundary values. |
| Quote submit refreshes authoritative state | Pass | Parent and selected RFQ reload after server confirmation. |
| Revision superseding audited before changes | Pass | Existing RPC audited; unsupported behavior documented, with no client fake. |
| Conversation role remains database-derived | Pass | Browser payload remains role-free; database defect blocks the action safely. |

## Browser and Network Safety

| Check | Status | Result |
| --- | --- | --- |
| Browser console errors | Pass | 0 errors. |
| Unsafe browser logs | Pass | 0 credential, access-token, refresh-token, full signed-URL, or production-reference matches. |
| Network destination | Pass | The UAT harness allowed only the approved staging hostname. |
| Production endpoint contact | Pass | 0 production requests observed. |
| Admin mutation controls | Pass | 0 controls exposed. |

Screenshots were captured as ignored local evidence:

- `.tmp/sprint3a-remediation-buyer-quote.png`
- `.tmp/sprint3a-remediation-admin.png`

## Cleanup and Repository State

- Exact fixture RFQs and Product: 0 rows remain.
- Exact fixture Profiles and Manufacturers: 0 rows remain.
- Disposable Auth users: deleted.
- Cleanup network destinations: approved staging host only.
- Local migrations: exactly `0001` through `0024`, unchanged.
- Production: untouched.
- Deployment, merge, tag, release, and migration operations: none.

## Release Decision

Sprint 3A frontend remediation passes its regression checks, but staging is **not release-ready** until the Critical disabled-trigger drift and the High Manufacturer draft RLS exposure are corrected and reverified through an authorized forward migration. Quote revision superseding and conversation history also remain database blockers.
