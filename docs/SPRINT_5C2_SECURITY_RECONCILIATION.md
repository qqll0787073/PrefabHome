# Sprint 5C.2 security reconciliation: review and verification

## Decision

RECONCILIATION READY — BLOCKED BY MIGRATION ORDER/AUTHORIZATION.

The source repair and validation are ready for review. Staging's public RPC remains old because applying pending migrations 0033–0035 requires separate authorization. No migration has been applied by this task. PR #44 remains closed and merged.

## Requested consolidated results

| # | Item | Result |
|---|---|---|
| 1 | Starting auth-profiles SHA | 8f836db97ca8d9f5156387e69be1dd9b73c93feb, fetched before branch creation |
| 2 | Final branch | security/sprint-5c2-reconciliation |
| 3 | Working tree | Isolated clean start; only reviewed repair files added/changed; final commit/push status accompanies handoff |
| 4 | 0033 | 0033_secure_manufacturer_company_profile.sql: approved Manufacturer profile maintenance; merged, pending on Staging, separate apply approval not found |
| 5 | 0034 | 0034_admin_dashboard_user_management.sql: active-profile authority, Admin user status/list/summary RPCs; merged, pending, separate apply approval not found |
| 6 | 0035 | 0035_harden_suspended_buyer_transaction_authority.sql: active-Buyer transaction access; merged, pending, separate apply approval not found |
| 7 | Existing fix in 0033–0035 | None replaces save_my_manufacturer_product |
| 8 | Affected signature | Exact signature listed below |
| 9 | Old live semantics | greatest(coalesce(...)) < 0 groups seven numeric inputs; non-negative siblings mask a negative |
| 10 | Correct semantics | Independent negative checks for each numeric field; MOQ must be >=1 when present |
| 11 | Defect | Example negative price plus positive area bypasses the old explicit RPC check; table CHECK constraints still reject invalid persistence |
| 12 | 0036 created | YES |
| 13 | Filename | 0036_reconcile_manufacturer_product_numeric_validation.sql |
| 14 | Scope | One CREATE OR REPLACE FUNCTION, transaction-wrapped, regenerated from corrected canonical 0032 |
| 15 | Historical migrations modified | NO; 0001–0035 verified against starting Git blobs |
| 16 | Docker-free regression | Static assertions; 15 read-only SQL predicate cases; temporary-schema candidate with rollback fixtures on authorized Staging |
| 17 | Numeric validation | All 15 predicate cases passed; executable candidate rejects masked negatives in each position and accepts null/zero/positive inputs |
| 18 | Cross-Manufacturer | Candidate rejected updating another approved Manufacturer's Product |
| 19 | Publication/status | Manufacturer direct publication rejected; submitted Product edit rejected; Admin publication succeeds |
| 20 | Dry run | Exact sequence 0033,0034,0035,0036; no seeds/roles; remote remains 0001–0032 |
| 21 | Apply authorization | NO separate authorization established for 0033–0035; Path B |
| 22 | Ordered apply | NOT RUN |
| 23 | Remote inventory | 0001–0032; no post-apply inventory because no apply occurred |
| 24 | Public function after regression | Still old; candidate lived only in pg_temp and was rolled back |
| 25 | Live/source parity | NOT YET; migration-order/authorization blocker |
| 26 | Buyer TSX root cause | Stale regex expected literal RFQ URL after component switched to buyerProductRFQPath |
| 27 | Buyer fix | Assert helper use and evaluate canonical pathname/view/workspace/Product context |
| 28 | Normal npm test includes coverage | YES; deterministic recursive runner includes .test.ts and .test.tsx, propagates nonzero exit |
| 29 | Focused Buyer | 9/9 |
| 30 | High dependency | browserslist 4.28.5; vulnerable <=4.28.6; two advisories listed below |
| 31 | Moderate dependency | baseline-browser-mapping 2.10.42; vulnerable >=2.0.0 <2.11.0 |
| 32 | Remediation | browserslist 4.28.9, baseline-browser-mapping 2.11.23; same-major transitive build-tool updates and required data packages |
| 33 | Final audit | npm audit --audit-level=low: 0 vulnerabilities |
| 34 | Manufacturer tests | Product helpers 8/8, Product source/security 6/6, account foundation 4/4, reconciliation 6/6 |
| 35 | Buyer regressions | Marketplace 12/12 and explicit Product/RFQ 9/9; normal full suite includes both |
| 36 | Admin | Product transition helper passes; rollback candidate test confirms Admin publication succeeds |
| 37 | Infrastructure | 154/154 |
| 38 | npm test | 402/402 source tests across 58 files, including 2 TSX files; 154/154 infrastructure |
| 39 | Build | PASS after clean npm ci |
| 40 | verify:quality | PASS |
| 41 | Artifact verification | PASS; 70 files, SHA-256 1ef006618c6c06fc00cf8b68002cd64fdaca7c06b8e58b03a0f6101248d1642a |
| 42 | Performance | Existing budgets PASS; measurements below |
| 43 | Secret scan | PASS; repeated after staging newly added files |
| 44 | git diff --check | PASS |
| 45 | Preview | No browser artifact change: all 70 files byte-identical to canonical baseline. No new deployment required by this task's conditional gate; no repository rule requiring a Preview for SQL/test-only repair was identified. No current Preview claimed |
| 46 | Production contacts | 0 |
| 47 | Critical | 0 findings in reviewed repair |
| 48 | High | 0 unresolved findings in reviewed repair; dependency High fixed |
| 49 | Medium | 0 unresolved code findings; live Staging RPC drift remains a documented external apply blocker |
| 50 | Low/Nit | 0 |
| 51 | Commit | fix(security): reconcile manufacturer product validation; exact SHA provided in final handoff and PR |
| 52 | PR | Draft against auth-profiles; URL provided in final handoff |
| 53 | Blocker | Explicit approval for ordered Staging application of 0033–0036 |
| 54 | Security reconciliation complete? | NO: prepared/tested, but live public RPC not yet replaced |
| 55 | Next Owner action | Review Draft PR and approve the full ordered Staging sequence 0033–0036. Then apply normally and repeat live definition, privilege, inventory and regression postflight. Do not merge automatically |

## Pending migration dependency review

- **0033** replaces manage_manufacturer_application_review and adds update_my_manufacturer_company_profile. It writes approved Manufacturer contact/display fields through a narrow allowlist, relies on profiles/auth/manufacturer foundation, and retains protected review/ownership fields. It does not touch Product tables or the Product save RPC. 0036 has no logical dependency on its profile-maintenance function.
- **0034** replaces is_active_profile, current_profile_role, is_admin and owns_manufacturer; adds admin_list_users, admin_set_profile_status and admin_dashboard_summary; revokes direct profile DML and removes profile write policies. It reads Product counts and affects Product authorization indirectly through owns_manufacturer/is_admin, but does not replace the affected save RPC. 0036 uses owns_manufacturer, already supplied by 0031; the 0034 replacement preserves its active/approved owner test while tightening grants/search_path.
- **0035** depends on 0034's active-profile helpers. It replaces is_active_buyer, trusted transaction-write guards, participant access helpers, invoice payment summary, and SELECT policies on RFQ/Quote decisions, PO, Contract, Signature, Invoice, Payment, Shipping and Logistics tables. It does not replace Product save logic or Product policies.
- **0036** could logically fix the 0032 function on that schema alone, but canonical migration numbering requires normal application after 0033–0035. No migration repair, backward renumbering, or skipping is allowed.
- Repository policy: docs/DEPLOYMENT_AND_OPERATIONS_GUIDE.md requires separately approved Staging migrations. Existing release-operation tests label later migrations review-only. Merged source is not proof of remote execution authorization. No current-sprint authorization for those three separate features was found.

## Function contract and impact

Affected signature:

```text
public.save_my_manufacturer_product(uuid,text,text,text,text,text,text,text[],text[],numeric,integer,numeric,integer,numeric,numeric,numeric,text,text,text,text,text,text,text,numeric,text,numeric,text,integer,integer,text,text,text[],text[],text,boolean)
```

Corrected function in 0036 is identical to the final/current 0032 function:
- corrected 0032 Git blob: 2d61c4dc2739e312670ccae4a11166a4a403ae3f;
- earlier parent 0032 blob: 3a01c56893f5403b3997a0c96417595dff7869e7;
- independent checks cover price, area, bathrooms, dimensions, snow load, bedrooms, stories, and lead time; MOQ remains at least one;
- auth.uid-derived active approved Manufacturer ownership remains in owns_manufacturer;
- target Product ownership and draft/rejected lifecycle restrictions remain;
- input parameters do not include owner, Manufacturer ID, arbitrary status, reviewer or publication authority;
- SECURITY DEFINER, postgres ownership, fixed public search_path and existing grants remain unchanged by CREATE OR REPLACE;
- no broad DML grants, schema additions, persistent data rewrites or browser service-role paths.

The live table constraints independently protect persisted values. This reconciliation restores intended RPC validation semantics and error behavior; it is not evidence that negative values could be persisted despite those constraints.

## Regression design and limits

supabase/tests/manufacturer_product_numeric_predicate_readonly.sql executes the exact predicate extracted from canonical source in a SELECT/VALUES matrix. All 15 cases passed on authorized Staging.

supabase/tests/manufacturer_product_management_security.sql expands the repository's executable rollback harness. It tests ten masked negative numeric fields, invalid MOQ, optional nulls, permitted zeroes, positive values, cross-Manufacturer updates, direct publication forgery, submitted Product locking and authorized Admin publication.

audit/sprint-5c2/candidate-rollback-probe.sql uses the same candidate function under pg_temp, leaves public.save_my_manufacturer_product untouched, and runs the SQL harness against temporary transaction fixtures. Trigger definitions were inspected before execution; they perform local DB writes without external side effects. Statement and lock timeouts bound the probe. Every fixture and temporary function rolls back.

The initial probe failed when GRANT referenced the pg_temp alias as a literal schema name; PostgreSQL rolled the transaction back. Resolving pg_my_temp_schema() fixed the probe. Subsequent complete probes passed. Read-only postflight found zero fixture users/profiles/Manufacturers and unchanged public function grants/search_path/security mode.

This validates the candidate against the current Staging 0032 baseline, not deployment of 0033–0036. The full disposable 0001–0036 migration sequence still requires its normal database environment; no successful full-sequence DB run is claimed.

## Dependencies

Both findings were transitive development dependencies under @vitejs/plugin-react -> @babel/core -> @babel/helper-compilation-targets -> browserslist.

- browserslist 4.28.5 -> 4.28.9, vulnerable range <=4.28.6:
  - https://github.com/advisories/GHSA-c83g-rgw3-j3cx (unbounded query-cache memory).
  - https://github.com/advisories/GHSA-73wf-gq98-2v4g (untrusted custom stats crash/prototype write).
- baseline-browser-mapping 2.10.42 -> 2.11.23, vulnerable range >=2.0.0 <2.11.0:
  - https://github.com/advisories/GHSA-w5vr-8v7q-w6rv (invalid-input process termination).
- Updated their required caniuse-lite, electron-to-chromium, node-releases and update-browserslist-db data dependencies. No major upgrade, direct application dependency change or forced audit fix.
- Clean npm ci and npm audit report zero vulnerabilities.

## Browser artifact and performance

| Measurement | Bytes/count |
|---|---:|
| Artifact files | 70 |
| Artifact bytes | 895381 |
| Total JS | 848454 |
| Initial JS | 223489 |
| CSS | 28000 |
| Largest JS (PortalApplication) | 303323 |
| Source maps | 0 |
| Duplicate groups | 0 |
| Unreferenced assets | 0 |

All 70 built files were compared byte-for-byte with the clean baseline build and matched. Performance budgets were not changed. No old Preview is being presented as deployment evidence for this PR.

## Final review

Reviewed function equality, explicit parameters, derived ownership, lifecycle rules, RLS/direct DML boundaries, grants, search_path, source test discovery, dependency changes and migration ordering. The candidate rollback regression independently exercises authority failures and Admin success. No new Critical/High/Medium/Low/Nit code defect was found. The unresolved live drift is explicitly tracked as the Path B migration-order/authorization blocker.

B. RECONCILIATION READY — BLOCKED BY MIGRATION ORDER/AUTHORIZATION
