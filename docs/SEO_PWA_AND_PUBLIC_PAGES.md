# SEO, PWA, And Public Pages

## Scope

Production Sprint 2B adds a public website shell and installability metadata without selecting a host or deploying. Production Sprint 2D adds draft legal/public-operations structure without legal publication approval. Neither sprint adds analytics, tracking vendors, consent storage, a service worker, offline support, or deployment.

## Metadata Model

`index.html` contains useful JavaScript-independent defaults for the PrefabHome title, description, viewport, theme/color scheme, organization name, canonical link, robots, Open Graph, and Twitter/X card fields. These defaults contain no account or portal state.

`src/lib/publicSite.ts` defines route-specific public titles, descriptions, canonicals, preview image URLs, and indexing directives. JavaScript updates only these allowlisted values when public navigation changes. Portal entry switches to a fixed title and `noindex, nofollow`; it never writes a user, role, workspace, transaction, or signed URL into metadata.

## Public URL Handling

`VITE_PUBLIC_SITE_URL` is a browser-safe build value used for canonical URLs, social-preview URLs, robots, and sitemap output. It is not an authorization signal.

- Local development may use `http://localhost:5173`.
- Values must be absolute HTTP/HTTPS URLs with a hostname.
- Credentials, query strings, and fragments are rejected.
- Production readiness requires HTTPS and rejects localhost.
- The committed and CI-safe fallback is `https://example.invalid`; no production domain is assumed.

The Vite build replaces the fallback in `index.html`, `robots.txt`, and `sitemap.xml` deterministically from the local build environment. This step reads and writes local files only and performs no network request.

## Indexing Boundary

Publicly indexable paths are:

- `/`
- `/about`
- `/contact`
- `/version`

The draft legal paths `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/acceptable-use`, and `/copyright-trademark` are stable and deep-linkable, but receive `noindex, nofollow` and remain outside `public/sitemap.xml`. Approval requires final text, operator identity, contacts, dates, legal publication status, and an explicit indexing decision. `robots.txt` does not disallow these pages because crawlers must be able to observe their page-level noindex directive; robots guidance is not publication authorization or access control.

`/marketplace` hosts public marketplace browsing and private role-controlled workspaces, using existing query state such as `?view=dashboard`. It is excluded from the sitemap and disallowed in `robots.txt`; portal pages also receive a runtime `noindex, nofollow` directive. Unknown paths render a noindex Not Found page.

Robots directives are crawler guidance, not access control. Supabase Auth, profile roles, RLS, private Storage, and trusted RPCs remain authoritative.

## Manifest Behavior

`public/manifest.webmanifest` starts at `/`, stays within `/`, and uses standalone display with the approved theme colors. Its start URL is public and contains no role, account, or portal query. No service worker, install prompt, background behavior, or offline claim is included.

## Icon Inventory

| Asset | Purpose |
| --- | --- |
| `favicon.svg` | Scalable browser favicon |
| `favicon-32x32.png` | Legacy/small browser favicon |
| `apple-touch-icon.png` | 180px Apple touch icon |
| `icon-192.png` | Standard manifest icon |
| `icon-512.png` | Large manifest icon |
| `maskable-icon-512.png` | Padded maskable manifest icon |
| `og-image.svg` | Original 1200x630 social-preview artwork |

The assets are original geometric PrefabHome artwork, contain no user image or third-party mark, and are intentionally small. Social-platform SVG preview support must be checked before a real launch; a future approved PNG replacement may be needed.

## Public Routes And Navigation

Public pages use clean paths and native links enhanced with History API navigation. Browser back/forward is restored through `popstate`. Existing marketplace workspace state remains query-driven under `/marketplace`, and legacy root `?view=...` links continue to enter the portal shell.

- Home introduces the public/private boundary and links to marketplace discovery.
- About describes the current product and authorization boundary without unsupported claims.
- Contact publishes no personal contact data before launch.
- Version shows normalized non-sensitive version, short commit, environment, release-candidate, legal-publication, and operator-publication metadata with safe unavailable values for unsupplied build timestamp and checksum.
- The six legal routes render centralized draft metadata and plain-language sections with a prominent pending-review warning.
- Not Found returns visitors safely to Home and exposes no raw route error.

## Accessibility Expectations

- Semantic header, navigation, main, and footer landmarks
- Exactly one page-level `h1` on each public page
- Native links, keyboard operation, visible focus, and a skip link
- Polite live-region route loading with no automatic reload loop
- Meaningful social-image alternative text and decorative logo handling
- Reduced-motion overrides for future animation and transitions

## Mobile Verification

CSS constrains public assets, wraps long legal text, stacks hero/contact/metadata grids, wraps the footer, and provides a horizontally scrollable public navigation strip on smaller widths. The local browser smoke covers all legal and operations pages at 320x568, 375x667, 390x844, 414x896, 768x1024, and 1280x800, plus reduced motion, forced colors, Back/Forward, and 200%/400% reflow proxies. Manual screen-reader, actual browser zoom, contrast, text-spacing, and real-device review remain required.

## Hosting And CSP

All new runtime assets are same-origin, so the Sprint 2 CSP template already permits the manifest, icons, and social artwork without `unsafe-inline` or a new external origin. Clean public paths require the existing navigation fallback contract; missing static assets must continue to return 404.

## Explicit Boundaries

- No service worker or offline support
- No analytics, pixels, session replay, cookie consent, or tracking
- Draft legal text is not legal advice, approved policy, or effective terms
- No claim of production readiness, legal compliance, or launch approval
- No hosting connection or production deployment

**Production Deployment Authorization is NOT GRANTED.**

**Legal Publication Authorization is NOT GRANTED.**
