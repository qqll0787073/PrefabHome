# Production Release Checklist

## Candidate Identity

- Candidate commit (full SHA): ______________________________________________
- Source branch: ____________________________________________________________
- App version: ______________________________________________________________
- Artifact root SHA-256: ____________________________________________________
- Artifact manifest/checksum record: ________________________________________
- Previous known-good commit/artifact: ______________________________________
- Planned release window: ___________________________________________________
- Incident owner and contact path: __________________________________________

## Automated Evidence

- [ ] Clean lockfile install completed with `npm ci`.
- [ ] Frontend and infrastructure tests passed at the candidate SHA.
- [ ] Production build passed with `VITE_DEPLOYMENT_ENV=production`.
- [ ] Marketplace demo mode was explicitly false.
- [ ] Dependency audit passed or every exception has written Security approval.
- [ ] Beta verification gate passed.
- [ ] Production artifact verification passed.
- [ ] Artifact manifest is immutable and its root SHA-256 matches the candidate bytes.
- [ ] Secret scan found no tracked or bundled credential.
- [ ] Migrations remain the reviewed ordered set and the production dry-run has separate Database approval.
- [ ] `npm run verify:legal-structure` passed.
- [ ] `npm run verify:legal-publication` passed with approved operator data and legal documents; an expected placeholder-state failure is not a release pass.

## Legal And Public Operations Review

- [ ] Legal Counsel approved the exact text and version of all six required public legal documents.
- [ ] Product Owner approved the public description of implemented and deferred workflows.
- [ ] Approved operator identity, legal entity, jurisdiction, and business address replaced every placeholder.
- [ ] General, Buyer Support, Manufacturer Onboarding, Sales, Partnerships, Accessibility, Privacy, Legal, and Press channels are organization-controlled, monitored, and approved for publication.
- [ ] Effective and last-reviewed dates are final and consistent across the page, repository record, and approval evidence.
- [ ] Privacy, cookie/tracking, retention, minors, cross-border, governing-law, accessibility, and intellectual-property language received the required specialist review.
- [ ] Approved legal routes use `index, follow` only after final publication authorization and appear in the approved sitemap.
- [ ] The Contact page makes only approved support ownership and service-level statements.
- [ ] Final Publication Authorization names the exact commit and is recorded as granted.

## Environment Review

- [ ] Custom domain, canonical host, DNS ownership, TLS coverage, renewal, and HTTPS redirect reviewed.
- [ ] Preview and production environment separation reviewed.
- [ ] Browser variables contain only the six approved `VITE_*` names.
- [ ] Supabase URL is the independently confirmed production project origin.
- [ ] Supabase key is publishable/anon only; no complete key appears in evidence.
- [ ] Version and full commit metadata match this candidate.
- [ ] Service-role, database, test-account, and provider credentials are absent from browser/build configuration.

## Supabase And Database Review

- [ ] Remote migration list and isolated `db push --dry-run` reviewed by Database approver.
- [ ] No unexpected pending migration, repair, reset, pull, or history edit exists.
- [ ] Auth site URL and confirmation/recovery redirect allowlists include only approved origins.
- [ ] Password/email-confirmation policy reviewed.
- [ ] RLS, RPC grants, private Storage buckets, limits, and signed URL behavior remain verified.
- [ ] Pre-release backup/checkpoint and restore capability reviewed.

## Hosting And Browser Review

- [ ] SPA query-string refresh and approved unknown application path return `index.html`.
- [ ] Existing hashed assets return correct MIME types and long immutable cache headers.
- [ ] Missing asset/file requests return 404, not `index.html`.
- [ ] `index.html` is revalidated and never immutable-cached.
- [ ] Compression is active.
- [ ] Security headers match the approved environment-specific policy.
- [ ] CSP produces no unexplained violations and contains no `unsafe-inline` exception.
- [ ] Public source maps are absent.
- [ ] Desktop browser smoke passed for anonymous, Buyer, Manufacturer, and Admin.
- [ ] Mobile viewport/browser smoke passed for critical Buyer and Manufacturer flows.
- [ ] Browser console has zero errors and zero unsafe credential/token/signed-URL logs.

## Rollback And Post-Deploy Review

- [ ] Previous known-good immutable artifact and checksum are available without rebuilding.
- [ ] Rollback artifact is compatible with current additive migrations.
- [ ] Rollback owner and decision threshold are named.
- [ ] Post-deploy health checks cover root/SPA routes, Auth, public marketplace, private portal reads, and asset integrity.
- [ ] Monitoring/uptime and Supabase operational review owners are active.
- [ ] Incident communication and credential-rotation paths are confirmed.

## Approval Gates

| Gate | Required decision | Approver | Date/evidence |
| --- | --- | --- | --- |
| Product Owner | Scope, limitations, release messaging | | |
| Technical Review | Commit, architecture, build, artifact | | |
| QA | Browser, mobile, accessibility, console | | |
| Security | Headers, Auth/RLS/Storage, secrets | | |
| Database | Migrations, dry-run, compatibility | | |
| Operations | Domain, TLS, cache, monitoring, rollback | | |
| Backup/Restore | Backup evidence and staging restore drill | | |
| Legal Publication | Operator identity, contacts, final text, dates, indexing | **NOT GRANTED** | |
| Deployment Authorization | Explicit environment/window authorization | **NOT GRANTED** | |

## Decision

- Product Owner: **PENDING**
- Technical Review: **PENDING**
- QA: **PENDING**
- Security: **PENDING**
- Database: **PENDING**
- Operations: **PENDING**
- Backup/Restore: **PENDING**
- Legal Publication Authorization: **NOT GRANTED**
- Deployment Authorization: **NOT GRANTED**

This checklist does not itself grant deployment permission. Authorization must name the exact commit, immutable artifact checksum, target environment, operator, and release window.
