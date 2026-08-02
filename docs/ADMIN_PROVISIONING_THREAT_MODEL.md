# Admin Provisioning Threat Model

## Scope And Security Objective

The operator CLI provisions one verified PrefabHome Admin identity without exposing a browser endpoint, weakening RLS, accepting client role metadata, or changing schema. Staging is the only executable remote design in Sprint 4A. Production execution is hard-disabled and requires separate authorization.

The trust boundary includes the operator workstation, process environment, Supabase Admin Auth API, service-role PostgREST access, the existing `on_auth_user_created` trigger, and an audit directory outside the repository. The service-role credential is powerful and must be injected only into the operator process.

## Threats And Controls

| Threat | Preventive and containment controls |
| --- | --- |
| Accidental Production targeting | Explicit environment, expected ref, and URL-derived ref must agree. Staging accepts only `bvzbkjpbnczquecwqvlm`; `eoyrfrjbjglfudfuwxdf` is denied. Production mode is disabled. No `.env.local` or CLI-link fallback exists. |
| Ambiguous configuration | Simultaneous `PREFAB_ADMIN_STAGING_*` and `PREFAB_ADMIN_PRODUCTION_*` variables fail closed. Missing or non-Supabase URL proof also fails. |
| Duplicate Admin creation | Exact normalized email inventories Auth and profiles before mutation. Zero/one/duplicate counts are explicit. New mode requires zero matches. Uncertain creation responses are re-inventoried and return a UUID-keyed resume state rather than retrying creation. |
| Wrong-profile promotion | Auth and profile email and UUID must agree. The final update uses verified UUID plus expected normalized email, current role, and active status. Exactly one returned row is required. |
| Email case mismatch | Comparison uses trimmed lowercase email. Stored records are still cross-checked after normalization. Mutation includes the normalized expected email. |
| Auth/profile UUID mismatch | Any mismatch blocks promotion and creation recovery. |
| Missing Auth trigger result | New mode polls boundedly for the profile, then returns `PROFILE_TRIGGER_MISSING` with a resume UUID. It never creates a second Auth user or deletes the first. |
| Ordinary-user role escalation | No public RPC is added. The CLI is outside `src`, uses a server-only credential, and preserves migrations `0001-0025`. Existing migration `0004` still blocks self-promotion and Admin signup metadata. |
| Operator-token exposure | Credentials are process environment inputs, redacted by key name and token/JWT patterns, never written into audit records, and never included in frontend configuration. |
| Plaintext password exposure | No password CLI argument exists. New mode accepts only `PREFAB_ADMIN_TEMP_PASSWORD`, injected for one process and cleared afterward. The tool never prints or audits it. |
| Credential-bearing logs/errors | All structured error and audit output passes through redaction. URLs are not logged; project refs and emails are masked. |
| Partial failure and retries | Auth creation followed by missing profile or failed promotion yields a contained state. Resume requires the exact verified UUID. Auth deletion is never automatic. |
| Concurrent attempts | Unique Auth/profile email constraints are expected to reject races; post-response inventory prevents blind recreation. Conditional promotion must affect exactly one row. Operators must serialize runs for one email. |
| Existing non-test user modification | Operator must supply an audit reason and exact confirmation. Existing Manufacturer ownership blocks promotion. The runbook requires proof that the identity is designated for operator/UAT use. |
| Misuse of service role | The key is limited to a local operator process. The adapter offers only inventory, one conditional role update, Auth creation, and ownership count. No SQL, schema, grant, or RLS operation exists. |
| Unreviewed direct SQL | The workflow uses Admin Auth API and conditional PostgREST update; direct SQL is neither implemented nor documented as an execution path. |
| Lost confirmation | Mutation requires the exact phrase `PROMOTE VERIFIED STAGING USER TO ADMIN` after displaying a redacted plan. EOF or mismatch aborts. |
| Email confirmation state | Inventory always reports it. Existing-user promotion requires confirmation. New-user creation requires an explicit `--email-confirm` decision; an unconfirmed newly created account may be promoted but cannot sign in until confirmed. |
| Banned or disabled Auth user | Promotion is blocked. Recovery of those states is outside this tool. |
| Rollback and containment | Role promotion is the only database mutation after Auth creation. On failure, preserve the user, record the contained UUID, stop, and use read-only inventory before an explicitly reviewed resume. |

## Residual Risks

- A stolen service-role key remains equivalent to a trusted backend credential; workstation and secret-delivery controls are external dependencies.
- Supabase Admin list pagination cannot provide a globally atomic uniqueness lock with the profile mutation. Database unique constraints and conditional writes provide the final safeguards.
- The tool cannot prove human ownership of an email or the organizational legitimacy of a requested Admin; the operator ticket and approval process must do so.
- Production needs a separately reviewed ref allowlist, stronger confirmation phrase, credential source, audit sink, dual approval, and incident procedure before it can be enabled.
