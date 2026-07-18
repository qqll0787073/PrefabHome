# Observability And Runtime Safety

## Runtime Configuration

`src/lib/runtimeConfig.ts` is the single parser for browser-safe runtime values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_MARKETPLACE_DEMO`
- `VITE_DEPLOYMENT_ENV`
- `VITE_APP_VERSION`
- `VITE_COMMIT_SHA`

The parser validates HTTP/HTTPS URL syntax, requires URL and key together for connected operation, accepts only explicit boolean forms, distinguishes `local`, `staging`, and `production`, and disables marketplace and Auth demo behavior in production. Missing release metadata falls back to `development`, `unknown`, and `local` without failing local builds.

Configuration errors are safe user-facing statements. They never include the complete key or privileged environment values. Frontend configuration determines connectivity and display metadata only; it does not grant a role or authorize data.

## Safe Logging

`src/lib/observability/safeLogger.ts` exposes typed `info`, `warn`, and `error` methods through a replaceable sink. Application code calls this interface explicitly; the global console is not modified.

Before a record reaches a sink, recursive sanitization redacts or omits:

- Authorization and Cookie header values
- access and refresh tokens
- passwords, secrets, API keys, service-role keys, and database credentials
- JWT-like strings and Supabase access/secret token formats
- database URLs
- URL query strings, including signed Storage parameters
- complete email addresses
- nested sensitive keys
- Error stacks, causes, and custom properties

Error serialization retains only a sanitized name and message. Do not log Buyer/Manufacturer profiles, addresses, RFQ/Quote contents, invoice/payment details, provider contacts, document contents, or entire Supabase response/error objects even when redaction exists.

## Error Boundary

The root React tree is wrapped by `AppErrorBoundary`. Render and lifecycle failures show an accessible fallback containing:

- a clear heading and live alert semantics
- Retry and Reload actions
- a safe incident/reference ID
- deployment environment, app version, and shortened commit metadata

The fallback never renders the caught Error, stack, tokens, signed URLs, profile data, transaction data, payment details, or provider contacts. Retry resets the boundary and remounts its child tree; Reload uses the browser reload path. Focus moves to the fallback heading for keyboard and assistive-technology users.

## Global Browser Errors

The boundary installs explicit `window.error` and `unhandledrejection` listeners while mounted and removes them on unmount. Repeated references or equivalent sanitized events are deduplicated within a bounded window before logging. These listeners record safe operational summaries; they do not replace React recovery or change application state.

## Incident References And Release Metadata

Incident references are random, non-user identifiers generated in the browser. They may be shown to users and included in safe logs to correlate a report. They are not authentication, trace, or database identifiers.

Release metadata is limited to normalized deployment environment, sanitized app version, and a shortened/sanitized commit SHA. Optional local metadata does not block development.

## Future Provider Boundary

The logger sink is the only intended integration boundary for a future approved monitoring provider. An integration must undergo separate privacy/security review, data minimization, retention, sampling, source-map, region, and incident-response approval. Call sites should continue using the provider-neutral logger.

No external monitoring provider is integrated in this task.

## Incident Handling

1. Capture the incident reference, release metadata, UTC time, affected workspace, and sanitized user-visible behavior.
2. Do not request passwords, tokens, signed URLs, private documents, or full transaction records.
3. Stop affected release/deployment activity and preserve sanitized evidence.
4. Assess whether the issue is configuration, frontend, Auth/RLS, Storage, database, or hosting related.
5. Rotate credentials only through the owning control plane when exposure is suspected.
6. Use the documented application rollback and staging-first restore process.
7. Verify the fix through tests and approved non-production smoke before any production authorization.

Production deployment remains separately controlled and is not authorized by this foundation.
