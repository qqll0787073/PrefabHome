# Sprint 3B Staging Migration Validation

## Verdict

**B. STAGING MIGRATION PASSED — UAT CONDITIONS REMAIN**

Migration 0025 is installed and validated on the authorized Staging project. The
database migration, authority postflight, rollback assertions, authenticated API
smoke, retry checks, and concurrency checks passed. Owner review remains required
before PR #29 can leave Draft. The existing Buyer Message event-vocabulary decision
also remains: Buyer Messages do not create a new event type, while each Manufacturer
Message creates one trusted `manufacturer_replied` event. Broader vocabulary remains
deferred.

This verdict does not authorize Production access, deployment, merge, tag, release,
or a Production migration.

## Authorization And Target Isolation

- Repository: `qqll0787073/PrefabHome`
- Branch: `production-sprint-3a`
- Starting repository SHA: `e5b3b7f15e74aa84af3d2b12275db0e9621c10e3`
- Authorized Staging project: `bvzbkjpbnczquecwqvlm`
- Production denylisted project: `eoyrfrjbjglfudfuwxdf`
- Supabase CLI: `2.109.1`
- Staging PostgreSQL: `17.6`
- Connection role: `postgres` through the approved Staging pooler
- Client-to-pooler TLS: verified active

The repository's persistent Supabase link was classified as Production and was not
used or modified. All CLI operations ran from an ignored isolated workspace that
contained only generated Supabase configuration and migrations `0001` through
`0025`. Inherited Supabase service/project variables were scrubbed before each
command. The Staging safety guard, URL/ref match, and Production denylist ran before
each remote phase.

No secret value, credential, JWT, password, database URL, or service-role key is
recorded in this report or tracked by Git.

## Repository And Migration Gate

- Branch and worktree baseline: passed.
- Starting HEAD matched the authorized SHA.
- Local migrations: exactly `0001` through `0025`; no `0026`.
- Migrations `0001` through `0024`: byte-for-byte equal to `auth-profiles`.
- Frozen migration: `0025_restore_rfq_quote_authority.sql`.
- Authorized and executed SHA-256:
  `db870d008fd18c7e528d65def3c038d717e2d79f1f41f9a71eb295cd4fb73695`.
- PR #29: confirmed open and Draft before execution.

## Recovery Capability

The read-only Supabase Management API returned eight available physical backup
records. The newest backup was `COMPLETED` at `2026-07-26T09:25:57.904Z`. No plan,
backup configuration, project setting, or recovery setting was changed.

## Migration History And Preflight

Immediately before execution:

- Remote migration history was exactly `0001` through `0024`.
- Migration `0025` was not recorded.
- No later or unknown migration was present.
- `supabase db push --dry-run` reported only
  `0025_restore_rfq_quote_authority.sql`.
- The exact frozen migration preflight ran inside a read-only transaction and passed.
- All six RFQ/Quote tables were present, owned by `postgres`, RLS-enabled, and not
  FORCE RLS.
- The six RFQ/Quote table row counts were all zero.
- All reviewed columns, types, constraints, indexes, functions, policies, grants,
  trigger definitions, and lifecycle vocabularies matched Migration 0025's
  preconditions.
- Duplicate current Quotes, duplicate draft Quotes, duplicate terminal Events,
  participant mismatches, decision mismatches, and browser schema-create privileges
  were all zero.
- The 12 scoped RFQ triggers existed with reviewed definitions and were disabled.
- Exactly 17 non-RFQ triggers were disabled; their table/name/state/definition hashes
  were captured before execution.

Preflight catalog time: `2026-07-26T20:37:00.480Z`.

Preflight fingerprints:

| Surface | Before |
| --- | --- |
| Columns | `f7816f338b2947adc65c2d9b00ee27de` |
| Constraints | `de73f28eb9c94f48ea6c29e412c77e13` |
| Indexes | `3d832ee53639751dbbc015cd9dd75059` |

## Execution Result

The isolated command was:

```text
supabase db push --yes --linked --workdir <ignored-isolated-workspace>
```

The frozen migration retained its reviewed `BEGIN`/`COMMIT` transaction boundary.
The final dry-run evidence was written at `2026-07-26T20:42:21.0889677Z`. The first
post-commit catalog snapshot was captured at `2026-07-26T20:43:57.7882539Z`, so the
commit occurred within that 96.70-second bounded interval.

The PowerShell/native-command wrapper did not return its apply transcript after the
CLI completed. The safety logic therefore performed no automatic retry. A fresh
read-only migration-list query found `0025` recorded exactly once, and complete
postflight inspection proved the transaction committed. The migration-history table
contains `version`, `statements`, and `name`, but no execution timestamp; PostgreSQL
commit-timestamp tracking is disabled. An exact command duration cannot be recovered
without fabricating evidence.

Result:

- Remote history after execution: exactly `0001` through `0025`.
- Migration-history count for `0025`: exactly one.
- No migration later than `0025` exists.
- No retry, repair, reset, pull, partial DDL, or second apply occurred.

## Immediate Postflight

Immediate postflight completed at `2026-07-26T20:43:57.750Z`.

- All six RFQ/Quote tables remained present with safe owners and RLS state.
- All five new Migration 0025 columns were present.
- Quote lineage constraints, `ON DELETE RESTRICT`, current-Quote uniqueness,
  revision-source uniqueness, event provenance checks, and event-key uniqueness were
  present.
- Policy count changed from 18 to the reviewed 11-policy authority surface.
- Reviewed RFQ-related function inventory changed from 34 to 45 signatures.
- Internal functions retained no `PUBLIC`, `anon`, `authenticated`, or explicit
  `service_role` execution authority.
- Authenticated participant RPC grants and search paths matched the migration.
- Anonymous RFQ/Quote table privileges were absent.
- Authenticated direct mutation grants on protected tables were absent.
- The 12 scoped RFQ triggers were enabled and their definition hashes were unchanged.
- All 17 non-RFQ trigger states and definition hashes matched preflight exactly.
- No self lineage, cross-RFQ lineage, duplicate revision source, duplicate current
  Quote, duplicate Event key, or partial event provenance existed.
- RFQ/Quote row counts remained zero immediately after migration.

Postflight fingerprints:

| Surface | After |
| --- | --- |
| Columns | `212c619822095b6655dfe2d08a34538b` |
| Constraints | `ff94ebeec76b8b9149cc31ef46f97c2e` |
| Indexes | `601ed213140a480829e91b9c2656c852` |

Independent postflight assertions passed `25/25`. The committed rollback-only
authority suite passed its enforced `54/54` terminal assertion.

## Existing Data Integrity

All six RFQ/Quote tables contained zero pre-existing rows before migration. Immediate
postflight counts also remained zero, proving that migration execution did not delete,
rewrite, or synthesize business records. All later rows listed below are explicitly
marked Sprint 3B synthetic UAT data.

## Authenticated Staging UAT

The completed normal Auth/PostgREST/database smoke passed `44/44` assertions.

| Role or surface | Result |
| --- | --- |
| Buyer | Created, read, edited, and submitted one stable RFQ UUID; exactly one RFQ remained; trusted cancellation and draft deletion passed |
| Assigned Manufacturer | Could not see Buyer draft; saw submitted RFQ; opened it; sent a Message; created/submitted initial and revision Quotes |
| Unrelated Manufacturer | Received zero participant rows and could not submit another Manufacturer's Quote |
| Admin | Read RFQ data; participant mutation RPC was denied |
| Anonymous | Private-table read and protected RPC invocation were denied |
| Direct writes | Direct Event and Message inserts were denied |
| Identity | Buyer/Manufacturer profile roles and Message sender identity/role were database-derived |

### Messages And Events

- Buyer and Manufacturer Messages were created through `send_rfq_message`.
- Direct Message and Event inserts were denied.
- The Manufacturer Message produced exactly one source-aware
  `manufacturer_replied` event.
- Per the approved vocabulary decision, the Buyer Message produced no new event type.
- Quote submissions each produced exactly one `quote_created` event.
- Actor, role, timestamp, source type, source ID, event key, and snapshot provenance
  remained database-derived.

### Quote, Revision, And Retry

- Initial Quote draft, line item, subtotal, and submission passed.
- Repeating the same committed submission returned the authoritative submitted Quote.
- No duplicate Quote, transition, or `quote_created` event was produced.
- Buyer Quote-open and revision request passed.
- The Manufacturer revision copied line items, received database-derived version 2
  and lineage, and submitted successfully.
- The previous Quote became `superseded`; the revision became the one current
  `submitted` Quote; both remained visible in history.

### Concurrency

Three bounded two-session Staging races passed:

- Same Quote submitted simultaneously: both calls resolved idempotently; one current
  Quote and one event remained.
- Competing revision creation: both calls returned the same revision UUID.
- RFQ cancellation versus Quote submission: exactly one operation succeeded and the
  loser returned a controlled error.

No deadlock, duplicate current Quote, duplicate terminal Event, duplicate event key,
or lineage corruption occurred.

## Synthetic Data And Cleanup

The first harness attempt failed before submission because a draft-only API argument
was sent to `submit_rfq`; its exact-ID draft fixture, product, manufacturers, profiles,
and Auth users were removed. Residue was zero.

The second harness attempt submitted an RFQ before discovering that the trusted opened
RPC returns SQL `void`. That submitted audit fixture was retained rather than directly
deleting audit history. The completed third fixture was also retained as designated
Staging UAT evidence. No passwords or tokens were persisted.

Retained exact-ID manifests are local, ignored, and not committed. Aggregate retained
records are:

| Object | Count |
| --- | ---: |
| Auth users | 8 |
| Profiles | 8 |
| Manufacturers | 4 |
| Products | 2 |
| RFQs | 5 |
| Messages | 2 |
| Quotes | 5 |
| Quote items | 5 |
| Decisions | 2 |
| Events | 23 |

The final invariant audit at `2026-07-26T21:34:57.853Z` found zero duplicate current
Quotes, duplicate drafts, duplicate terminal Events, participant mismatches, lineage
errors, event-key collisions, or partial provenance. All retained records remain
unmistakably synthetic and exactly identifiable for a separately authorized cleanup.

## Findings

| Severity | Finding | Result |
| --- | --- | --- |
| Blocker | None | Migration and postflight passed |
| High | None | Authority, RLS, grants, and participant isolation passed |
| Medium | Buyer Message event vocabulary does not provide a Buyer-message timeline event | Existing owner decision retained; broader vocabulary remains deferred |
| Low | CLI apply transcript did not return from the PowerShell wrapper | No retry occurred; history, transaction outcome, and complete postflight were independently verified |
| Low | The composite `verify:quality` npm script returned after its nested build command on this Windows shell | Every constituent quality command was run directly and passed; Linux CI will rerun the composite gate |
| Harness | Two temporary smoke assumptions differed from real PostgREST signatures/void returns | First draft fixture cleaned; submitted fixture retained; corrected smoke passed 44/44 |

## Repository Verification

- `npm ci`: passed.
- Frontend tests: `234/234` passed.
- Infrastructure tests: `92/92` passed.
- Production build: passed; 191 modules transformed.
- Dependency audit: zero vulnerabilities.
- Production artifact: passed; 64 files, 817,469 bytes, 52 JavaScript files,
  one CSS file, zero source maps.
- Artifact SHA-256:
  `7295c537ede4988f2fdde9879a25ce0a20d08106119cfba7bbf99b8b968ebb48`.
- Bundle, legal-structure, and Beta document gates: passed.
- `verify:quality` was invoked; because Windows returned after its nested build
  command, all remaining constituent gates were run directly and passed.
- Tracked-secret scan: passed; zero findings.
- Migrations remain exactly `0001` through `0025` and match the starting commit.

## Required Statements

Migration 0025 was applied only to Staging project bvzbkjpbnczquecwqvlm.

Migration 0025 has NOT been applied to Production.

Production Supabase was not accessed.

The 17 non-RFQ triggers were not modified.

Production Deployment Authorization is NOT GRANTED.

PR #29 remains Draft and unmerged.

## PR Description Update

The connected GitHub integration had already returned `403 Resource not accessible
by integration` for this PR. The Sprint 3B update call was blocked before reaching
GitHub to honor the instruction not to retry the denied mutation. No alternate path
was attempted. Current ready-to-paste text is maintained in
`docs/PR_29_OWNER_UPDATE.md`.
