# Performance Baseline And Budgets

## Measurement Method

The baseline was built locally from starting SHA `eb56cf5cef895f556400aefcf544d466a7c240e0` with Vite 7.3.6, source maps disabled, non-connecting production placeholders, and no Supabase credentials. Measurements are uncompressed artifact bytes from `dist/`; Vite's console gzip values are informational and are not budget inputs.

## Sprint 2B Baseline

| Metric | Baseline |
| --- | ---: |
| Artifact files | 62 |
| Total artifact bytes | 771,181 |
| JavaScript files | 50 |
| Total JavaScript bytes | 727,781 |
| CSS files | 1 |
| Total CSS bytes | 24,473 |
| Source maps | 0 |
| Initial JavaScript chunk | 488,864 bytes |

Largest baseline files:

| File family | Bytes |
| --- | ---: |
| Initial `index` JavaScript | 488,864 |
| Main CSS | 24,473 |
| `logisticsWorkspaceModel` | 18,740 |
| `AdminLogisticsWorkspace` | 17,807 |
| `ParticipantLogisticsWorkspace` | 15,125 |

The public `PublicWebsite` module was lazy, but `src/app/App.tsx` statically imported the portal shell, marketplace, auth state, and dashboard. Public navigation therefore downloaded most portal entry code before requesting the 6.34 KB public page chunk. Deep role workspaces remained lazy.

## High-Confidence Improvement

`PortalApplication` is now its own route-level lazy module. The measured working build is:

| Metric | Working build |
| --- | ---: |
| Artifact files | 63 |
| Total artifact bytes | 774,741 |
| JavaScript files | 51 |
| Total JavaScript bytes | 730,965 |
| CSS files | 1 |
| Total CSS bytes | 24,849 |
| Initial JavaScript | 206,619 bytes |
| Largest JavaScript (`PortalApplication`) | 283,525 bytes |
| Source maps | 0 |

The initial JavaScript boundary is 282,245 bytes smaller, a 57.7% reduction. Total bytes rise by less than 0.5% because code is separated rather than removed. Public pages request the initial entry and `PublicWebsite`; portal routes request the initial entry and `PortalApplication`, while role-specific workspaces remain lazy.

## Reviewed Budgets

| Budget | Ceiling | Reason |
| --- | ---: | --- |
| Total artifact bytes | 825,000 | About 6.5% above the split build |
| Total JavaScript bytes | 780,000 | About 6.7% JavaScript headroom |
| Total CSS bytes | 28,000 | Allows small accessibility additions without hiding broad growth |
| Initial JavaScript bytes | 230,000 | About 11% headroom while preventing the former portal re-import |
| Largest JavaScript bytes | 310,000 | About 9% headroom above the portal chunk |
| Largest CSS bytes | 28,000 | Matches the total CSS ceiling |
| JavaScript files | 55 | Allows four additional intentional lazy chunks |
| CSS files | 2 | Allows one reviewed split stylesheet |
| Source maps | 0 | Public source maps remain unapproved |
| Duplicate exact-hash groups | 0 | Exact duplicate files are not accepted |
| Detectable unreferenced JS/CSS | 0 | Build graph should not contain orphaned assets |

## Analyzer Behavior

`npm run quality:bundle` reads local `dist/`, follows asset references in `index.html` and emitted JS/CSS, hashes every artifact, reports the largest files and initial HTML dependencies, and fails configured budgets. It performs no network request and writes no report file.

## Limitations

- Uncompressed bytes do not model transfer compression, cache reuse, parsing cost, device CPU, or network latency.
- Reference detection is reliable for current Vite output but is not a general JavaScript parser.
- Signed marketplace images are runtime data and are outside static artifact byte totals.
- Local measurements are not field performance or a substitute for production RUM, which is explicitly out of scope.
