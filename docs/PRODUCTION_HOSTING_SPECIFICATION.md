# Production Hosting Specification

## Status And Scope

PrefabHome builds a static Vite single-page application into `dist/`. This specification defines acceptance requirements for a future provider review; it does not choose, connect, or configure a production host.

## Transport And Domain

- Serve every production response over HTTPS and redirect HTTP to HTTPS before application content is returned.
- Use TLS 1.2 or newer and an automatically renewed certificate for the approved custom domain.
- Validate DNS ownership, certificate coverage, renewal alerts, CAA behavior, and canonical-host redirects before launch.
- Enable HSTS only after HTTPS works on every included hostname. Add `includeSubDomains` or preload only through a separate domain-wide review.
- Keep preview URLs and production custom domains in separate projects/environments with separate browser-safe variables.

## SPA Routing

The application stores navigation in query parameters such as `?view=dashboard&workspace=logistics&request=...`. Refreshing `/` with these query parameters must serve the same `index.html`; the host must preserve the query string.

For future path-based routes, an unknown navigation path may also serve `index.html` with status 200. Existing static files must win before fallback. Missing `/assets/*` requests and file-like paths must return 404, never `index.html`, so stale asset references fail clearly instead of producing a JavaScript MIME error.

Provider behavior must be tested with:

- `/`
- `/?view=dashboard&workspace=logistics`
- an approved unknown application path
- an existing hashed JS and CSS asset
- a missing `/assets/missing.js` path, which must be 404
- a missing non-application file such as `/robots-missing.txt`, which must be 404

The examples under `config/hosting/` are review aids. Provider semantics must be verified against current provider documentation before adoption. Cloudflare Pages can infer an SPA when no top-level `404.html` exists; catch-all `_redirects` rules are not supplied because Cloudflare applies redirect rules even when an asset exists. Netlify-style shadowing serves existing files before its final SPA rule by default.

## Caching And Compression

| Content | Required cache policy |
| --- | --- |
| `index.html` | `Cache-Control: no-cache, max-age=0, must-revalidate` or stricter no-store policy |
| Hashed `/assets/*` | `Cache-Control: public, max-age=31536000, immutable` |
| Non-hashed metadata | Short cache or explicit revalidation according to its update process |

Enable Brotli and/or gzip for HTML, JavaScript, CSS, JSON, SVG, and other compressible types. Compression must not change the reviewed uncompressed artifact checksum; the host may negotiate transfer encoding at the edge.

## Security Headers

Apply the reviewed policy in [Security Headers Policy](SECURITY_HEADERS_POLICY.md). Test it in a preview environment using browser console/network inspection before production approval. The host must be able to set different caching headers for `index.html` and hashed assets.

## Supabase Compatibility

- Add the exact approved production and preview origins to Supabase Auth site/redirect allowlists before smoke testing.
- Include confirmation, password recovery, and any supported OAuth callback paths.
- Permit HTTPS requests to the selected Supabase project origin and WebSocket requests to its realtime host in CSP `connect-src`.
- Permit images/media from the selected Supabase origin when signed private Storage URLs are rendered.
- Do not cache signed URL responses beyond their authorization lifetime or log full signed query strings.
- A publishable/anon key is browser configuration protected by RLS; service-role and database credentials must never enter the build or host browser-variable configuration.

## Environment And Release Metadata

The selected host must inject only these reviewed browser variables during the immutable build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_MARKETPLACE_DEMO=false`
- `VITE_DEPLOYMENT_ENV=production`
- `VITE_APP_VERSION`
- `VITE_COMMIT_SHA`

Production readiness rejects unknown `VITE_*` names and requires version/commit metadata tied to the checked-out commit. Values must be reviewed without printing complete keys. Build logs and artifacts must never contain service-role, database, provider, or test-account credentials.

## Source Maps

Public source maps are disabled by default in Vite and rejected by the artifact verifier. Enabling source maps requires a separate monitoring/privacy review, an explicitly approved non-public upload path, retention limits, source-content review, and a mechanism that prevents `.map` files from entering the public artifact.

## Artifact Integrity

1. Check out the exact candidate commit with a clean worktree.
2. Install from the lockfile and run `verify:production-readiness` with reviewed public variables. The command runs Beta gates in a disconnected, demo-disabled test environment, then performs a separate production build with the reviewed variables.
3. Record the artifact root SHA-256 and manifest path produced by the verifier.
4. Preserve the exact `dist/` bytes and manifest in an approved immutable release store.
5. Deploy those bytes without rebuilding, mutation, HTML injection, or environment substitution.
6. Compare the deployed file inventory/checksum where the provider permits it.

The local verifier does not upload or contact Supabase or a hosting service.

## Preview And Production Separation

- Preview uses a non-production hostname and non-production Supabase project.
- Preview cannot receive production secrets, production cookies, or production-only Auth redirects.
- Production approval evidence cannot be inferred from a preview deployment built at another commit.
- Promotion must preserve the exact reviewed artifact rather than trigger an unreviewed rebuild.

## Rollback

Retain a previous known-good artifact and its checksum. Before rollback, confirm it is compatible with the currently applied additive database schema. Rollback redeploys that exact artifact, runs read-only role smoke first, and records the incident/release owner. It does not edit migrations or restore the database automatically.

## Provider Review References

- Cloudflare Pages serving and SPA behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
- Cloudflare Pages redirect ordering: https://developers.cloudflare.com/pages/configuration/redirects/
- Netlify SPA rewrite and shadowing: https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/

**Production Deployment Authorization is NOT GRANTED.**
