# Security Notes

## Current Cleanup

- No hardcoded API keys or secrets were added.
- `.env`, `.env.*`, and local build artifacts are ignored.
- `.env.example` contains variable names only.
- The UI uses static sample data only.

## Prototype Risks Identified

- Client-side role switching is not authorization.
- Local storage sessions are not secure authentication.
- Embedded sample users, quote requests, and CRM-like records should be treated as demo data and scrubbed before production.
- AI and CRM generation endpoints must keep provider keys server-side.
- Admin actions must be enforced by database policies and server checks, not UI state.

## Secret Handling Rules

- Never commit provider API keys.
- Never expose Supabase service-role keys to the browser.
- Use deployment platform secret storage for server-only values.
- Use `.env.local` for developer machines and keep it untracked.
- Rotate any key that is exposed in a frontend bundle, commit, log, or screenshot.

## Supabase RLS Requirements

- Enable RLS on every application table.
- Policies must restrict records by authenticated user and role.
- Buyers can access only their own quotes, messages, documents, and advisor sessions.
- Manufacturers can access only records tied to their manufacturer account.
- Admins can moderate records through explicit admin policies.

## AI Safety

- Route all AI calls through server endpoints.
- Add rate limits and abuse detection.
- Log request metadata without storing sensitive personal data unnecessarily.
- Make zoning, customs, and engineering outputs advisory only.
- Provide escalation paths to licensed professionals where required.

## Document Security

- Import, customs, and verification documents must use private buckets.
- Access should use short-lived signed URLs.
- Log document access for sensitive records.
- Validate file type and size before upload.

## Production Checklist

- Secret scan before every release.
- Dependency audit in CI.
- RLS policy tests.
- Admin access review.
- Backups and restore test.
- Error monitoring and audit logging.
