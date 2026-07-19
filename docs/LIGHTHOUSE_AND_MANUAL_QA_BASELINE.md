# Lighthouse And Manual QA Baseline

## Environment

- Starting SHA: `eb56cf5cef895f556400aefcf544d466a7c240e0`
- Browser available: Google Chrome 150.0.7871.115
- Local Node runtime: 24.17.0
- Routes requested: `/`, `/about`, and `/marketplace?view=dashboard`
- Production and staging services: not contacted

## Lighthouse Status

Lighthouse CLI is not installed in this repository or available as a local command. Sprint 2C does not add an analyzer dependency or use a remote testing service solely to manufacture scores. Therefore Performance, Accessibility, Best Practices, and SEO scores are recorded as **not measured**, not estimated.

Targets for a future reproducible local or approved preview-host run remain:

| Category | Target | Sprint 2C score |
| --- | ---: | --- |
| Performance | 90+ | Not measured |
| Accessibility | 95+ | Not measured |
| Best Practices | 95+ | Not measured |
| SEO | 95+ | Not measured |

## Deterministic Local Baseline

- Bundle baseline and budgets are documented in `PERFORMANCE_BASELINE_AND_BUDGETS.md`.
- Static accessibility tests cover main targets, skip links, focus rules, image behavior, auth labels/errors, reduced motion, forced colors, lazy boundaries, and source safety.
- `npm run quality:browser` exercises six viewport sizes, public navigation, Not Found, unauthenticated marketplace login, skip-link focus, Back/Forward, reduced motion, zoom/reflow proxies, console errors, and unsafe logs.

## Local Chrome Smoke Result

Run on 2026-07-19 against the local Vite production preview with no credentials and no Supabase connection:

- Passed at `320x568`, `375x667`, `390x844`, `414x896`, `768x1024`, and `1280x800`.
- Public navigation, browser Back/Forward, Not Found, marketplace login semantics, and keyboard skip-link behavior passed.
- Reduced-motion emulation passed.
- 200% and 400% CSS-width reflow proxies showed no page-level horizontal overflow on the public home or login surfaces.
- Browser console errors: `0`.
- Unsafe log matches: `0`.

## Limitations

- Local static serving does not reproduce production CDN, caching, compression, security headers, or network latency.
- The marketplace login smoke uses no credentials and does not contact Supabase.
- CSS viewport proxies for 200% and 400% validate reflow but require manual confirmation with actual browser zoom.
- No automated run substitutes for screen-reader, keyboard, contrast, and real-device QA.

**Production Deployment Authorization is NOT GRANTED.**
