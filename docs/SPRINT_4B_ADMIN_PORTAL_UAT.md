# Sprint 4B Admin Portal UAT Evidence

## Purpose

This document is the redacted, immutable record of the completed Sprint 4B
authenticated Admin Portal browser UAT. It closes the evidence gap identified by
the Sprint 4C review of PR #29. It records an already completed run; no UAT was
rerun to create this report.

## Evidence identity

- UAT date: `2026-08-01 UTC`
- Repository: `qqll0787073/PrefabHome`
- Pull request: `#29`
- Exact tested and deployed commit:
  `f2393ab8e3fec4b668221553cb9db02b46b730d1`
- Published navigation commit:
  `f2393ab8e3fec4b668221553cb9db02b46b730d1`
- Immutable Preview:
  `https://bef3915d.prefabhome-staging.pages.dev`
- Stable branch Preview:
  `https://production-sprint-3a.prefabhome-staging.pages.dev`
- Authorized Staging Supabase project ref: `bvzbkjpbnczquecwqvlm`
- CI run: `30722347507` — success

The Production Supabase project was prohibited. Production was not configured,
contacted, inspected, or changed during this UAT. This report intentionally does
not record the Production project ref.

## Authentication and session results

| Check | Result |
| --- | --- |
| Admin login | Passed |
| Authenticated Admin role | Passed |
| Session persistence after refresh | Passed |
| Logout | Passed |
| Protected-route handling after logout | Passed |

Authentication identifiers are redacted. No password, token, JWT, cookie, key,
complete request header, or private audit record is included in this document.

## Admin workspace results

| Workspace or behavior | Result |
| --- | --- |
| Dashboard | Passed |
| Users | Passed |
| Manufacturers | Passed |
| Products | Passed |
| RFQs | Passed |
| Workspace navigation | Passed |
| URL updates | Passed |
| Refresh persistence | Passed |
| Browser Back/Forward | Passed |
| Direct protected routes | Passed |

The navigation repair tested and published at the exact commit above restored
direct, addressable Admin workspace links without exposing Admin workspaces to
other portal roles.

## Role isolation

Buyer and Manufacturer portal selections from the authenticated Admin test context
returned `Role access required`. No Buyer or Manufacturer full authenticated
browser-UAT pass is claimed by this result.

## Browser, console, and network results

- Browser console errors: zero.
- Failed-request loops: none observed.
- Supabase traffic: only the authorized Staging host for project
  `bvzbkjpbnczquecwqvlm` was used.
- Production Supabase traffic: none.
- Production Supabase configuration: absent from the tested deployment.
- Business-record mutations: none.
- Environment-setting mutations: none.

The run exercised navigation and read-only Admin Portal behavior. It did not alter
Supabase or Cloudflare configuration and did not provision or modify any user or
profile.

## Test and CI evidence

- Focused Admin navigation tests: `2/2` passed.
- Frontend tests: `236/236` passed in the completed Sprint 4B verification.
- Infrastructure tests: `96/96` passed.
- Dependency vulnerabilities: zero.
- Tracked-secret scan: 401 tracked files, zero findings in the completed Sprint 4B
  verification.
- GitHub Actions run `30722347507`: success for the tested commit.
- Migration inventory: exactly `0001` through `0025`.
- Migration `0026`: absent.

The later documentation-only Sprint 4C.1 commit is expected to produce new test,
artifact, tracked-file, and CI identifiers. Those publication checks do not change
the historical Sprint 4B result recorded above.

## Bundle and artifact evidence

- CSS: 27,997 bytes; budget passed.
- Production artifact verification: passed.
- Source maps: zero.
- No service-role key or credential material was bundled.

## Deferred browser UAT

The following remain explicitly deferred and are not represented as passed:

- Buyer full authenticated browser UAT.
- Manufacturer full authenticated browser UAT.

## Final Sprint 4B verdict

**A. CSS BUDGET PASSED — NAVIGATION PUBLISHED AND SPRINT 4B PASSED**

This evidence authorizes none of the following:

- merge of PR #29;
- Production migration;
- Production deployment;
- Production Admin provisioning; or
- legal publication.

PR #29 remained Draft and unmerged when this evidence document was created.
