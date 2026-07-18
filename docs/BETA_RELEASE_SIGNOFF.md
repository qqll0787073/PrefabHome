# Beta v1.0 Release Signoff

Release candidate SHA: ______________________________

Release date/window: ________________________________

Target environment: _________________________________

## Automated Evidence

| Gate | Result | Evidence/owner |
| --- | --- | --- |
| `npm ci` | Pending | |
| Frontend tests | Pending | |
| Infrastructure tests | Pending | |
| Production build | Pending | |
| Dependency audit | Pending | |
| Tracked-secret scan | Pending | |
| Documentation/link audit | Pending | |
| Migration checksum/list audit | Pending | |

## Manual Approvals

| Area | Required confirmation | Approver/date |
| --- | --- | --- |
| Product | Beta scope, limitations, and user messaging accepted | |
| Engineering | Candidate SHA, build, tests, and known risks accepted | |
| Security | Auth/RLS/Storage/RPC boundaries and secret handling accepted | |
| Database | Migration state, backup plan, restore drill, and rollback approach accepted | |
| QA | Role/browser/accessibility/console checklist passed | |
| Operations | Hosting, headers, monitoring, incident owner, and rollback artifact ready | |
| Data/privacy | Synthetic demo data and personal-data handling accepted | |
| Deployment | Separate production deployment authorization granted | |

## Required Release Facts

- [ ] Production Supabase project/ref independently confirmed by an authorized operator.
- [ ] Production denylist remains active in staging fixture tooling.
- [ ] Migrations `0001` through `0024` are the reviewed database baseline.
- [ ] No service-role key or credential is present in browser configuration or tracked files.
- [ ] `VITE_ENABLE_MARKETPLACE_DEMO=false` in production.
- [ ] Backup/restore capability has been verified outside this repository.
- [ ] Monitoring and incident response ownership are active.
- [ ] External signature, email, payment, logistics, customs, tracking, and AI integrations are explicitly out of scope.
- [ ] No staging fixture residue remains.

## Go/No-Go

Decision: `GO / NO-GO`

Decision owner: _____________________________________

Reason/conditions: __________________________________

Rollback owner and previous known-good SHA/artifact: __________________________________

This signoff authorizes only the recorded release action. It does not authorize unreviewed migrations, production fixtures, or follow-on features.
