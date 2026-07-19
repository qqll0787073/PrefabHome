# Security Headers Policy

## Purpose

The placeholder template at `config/security-headers.example` defines the minimum browser response policy for a future PrefabHome host. It is not active configuration. Every placeholder must be replaced and tested in a non-production preview before separate production approval.

## Required Headers

### Content-Security-Policy

Use a response header, not a report-only meta tag, as the enforcing policy. The template:

- defaults content to the same origin
- blocks plugins and embedding
- permits Vite's external hashed scripts and styles without `unsafe-inline`
- permits data/blob images needed by local previews and media rendering
- permits HTTPS API/Storage and WebSocket connections only to the reviewed Supabase project
- restricts forms, workers, fonts, manifests, and base URLs
- upgrades insecure subresource requests

Replace `<SUPABASE_PROJECT_ORIGIN>` with an origin only, such as `https://project-ref.supabase.co`, and `<SUPABASE_REALTIME_ORIGIN>` with its reviewed `wss://` origin. Do not paste a key, path, signed query string, or credential into CSP.

If a future integration requires another origin or inline content, document the exact resource, data flow, and threat tradeoff. Prefer a nonce/hash or external static asset. `unsafe-inline` is not approved by this template.

### Strict-Transport-Security

Use `max-age=31536000` only after HTTPS and renewal are validated. `includeSubDomains` and preload are intentionally absent from the base template because they affect every subdomain and require separate approval.

### X-Content-Type-Options

Set `nosniff`. Hosts must return true 404 responses for missing assets; otherwise an SPA HTML fallback can still produce blocked MIME-type errors.

### Referrer-Policy

Use `strict-origin-when-cross-origin` to avoid sending full internal paths/query state to other origins while preserving same-origin diagnostics.

### Permissions-Policy

Disable camera, microphone, geolocation, payment, USB, serial, Bluetooth, and other unused browser capabilities. Add a capability only after a feature/security review.

### Frame Restrictions

Use CSP `frame-ancestors 'none'` as the authority and `X-Frame-Options: DENY` as legacy defense in depth. If approved embedding is added later, both must be updated consistently.

### Cross-Origin-Opener-Policy

Start with `same-origin-allow-popups` to retain compatibility with an approved popup-based Auth provider if one is later enabled. If browser testing proves no popup flow is needed, tighten to `same-origin`. Do not add cross-origin isolation headers without testing signed media, Auth, and third-party documents.

## Supabase Compatibility

- `connect-src` must include the exact Supabase HTTPS and realtime WebSocket origins.
- `img-src` and `media-src` may include the exact Supabase origin for signed private Storage resources.
- Auth confirmation/recovery redirects are top-level navigation and must also be present in Supabase's redirect allowlist.
- CSP never authorizes database access; RLS and trusted RPCs remain authoritative.
- Signed URLs must not be copied into CSP, logs, reports, or support tickets.

## Cache Header Companion Policy

Security headers apply to all HTML and assets. Caching differs:

- `index.html`: `Cache-Control: no-cache, max-age=0, must-revalidate`
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`

Do not apply immutable caching to `index.html`.

## Validation

Validate headers with browser network tools and a non-production scanner. Confirm no console CSP errors during anonymous, Buyer, Manufacturer, and Admin smoke. Exercise Auth confirmation/recovery, signed public images, private authorized documents, and realtime only where those features are enabled. Record sanitized evidence and never include keys or signed query tokens.

No external scanner or provider is connected by this task.
