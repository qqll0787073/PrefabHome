# Staging Buyer Provisioning Runbook

This operator-only workflow inventories and, after owner approval, recovers or creates one Staging Buyer. Production project `eoyrfrjbjglfudfuwxdf` is hard-denied. The tool performs no SQL and never loads environment files.

## Required environment

Inject values into one process only:

```text
PREFAB_BUYER_TARGET_PROJECT_REF=bvzbkjpbnczquecwqvlm
PREFAB_BUYER_SUPABASE_URL
PREFAB_BUYER_SERVICE_ROLE_KEY
PREFAB_BUYER_TEMP_PASSWORD       # create mode only
PREFAB_BUYER_AUDIT_DIR           # optional, outside repository
```

Never use `VITE_` variables for operator credentials. Never store values in the repository, shell history, logs, or screenshots.

## Mandatory reviewed dry run

```text
npm run buyer:provision -- --environment staging --email <buyer-email> --reason <ticket> --dry-run
```

The read-only inventory enumerates Auth users and `public.profiles` by normalized email. It blocks duplicate Auth users, duplicate profiles, UUID/email mismatches, non-Buyer roles, inactive profiles, and banned/disabled Auth users. It writes a short-lived plan outside the repository with owner-only requested permissions.

The plan binds the authorized Staging ref, normalized email, operation, expected Auth/Profile UUIDs or absence, role/status, complete inventory fingerprint, creation time, and expiration. A SHA-256 content digest detects accidental alteration. Because no second signing secret is introduced, the local operator account and plan directory are the trust boundary; the digest is not a defense against a malicious local user who can rewrite both payload and digest. Fresh authoritative inventory equality is always required before action.

Mutation without `--plan <exact-dry-run-plan-path>` is rejected. Plans expire after 15 minutes. A changed inventory, altered plan, different email/project/operation, or expired plan requires a new dry-run and owner review.

## Existing Buyer: recovery only

If exactly one active Buyer Auth/Profile pair exists, creation is rejected. With explicit owner approval, rerun:

```text
npm run buyer:provision -- --environment staging --email <buyer-email> --reason <ticket> --mode recovery --plan <reviewed-plan-path>
```

Review the dry-run plan and type `SEND STAGING BUYER RECOVERY`. After confirmation, the CLI inventories again and invalidates the plan if anything changed. Immediately before recovery it inventories once more and requires the reviewed UUID/email, confirmed and enabled Auth user, Buyer role, and active profile. Supabase then sends its normal recovery email; the CLI never reads or sets the new password. It inventories again afterward.

## Absent Buyer: create

Only if inventory proves zero Auth users and zero profiles, inject a unique temporary Staging password and, with explicit owner approval, run:

```text
npm run buyer:provision -- --environment staging --email <buyer-email> --reason <ticket> --mode create --plan <reviewed-plan-path> --email-confirm
```

Review the fresh plan and type `CREATE VERIFIED STAGING BUYER`. The Admin Auth API creates one Auth user with Buyer metadata. The existing database trigger must create `public.profiles`; the CLI waits with bounded backoff and verifies UUID, normalized email, role `buyer`, and status `active`.

If Auth creation is uncertain or the profile does not appear, do not run create again and do not insert a profile manually. Record the returned UUID, investigate the trigger, and rerun dry-run. Partial identities fail closed and require separately authorized remediation.

## Resume verification

For an Auth-only partial identity returned by contained creation, run a resume dry-run with the exact UUID:

```text
npm run buyer:provision -- --environment staging --email <buyer-email> --reason <ticket> --dry-run --mode resume --resume-uuid <exact-uuid>
```

After review, execute the read-only verification:

```text
npm run buyer:provision -- --environment staging --email <buyer-email> --reason <ticket> --mode resume --resume-uuid <exact-uuid> --plan <reviewed-plan-path>
```

Type `VERIFY STAGING BUYER RESUME`. Resume never calls Auth creation, recovery, or profile mutation. If the profile is still absent it returns `resume_pending`; if it appears it verifies UUID/email equality, Buyer role, active status, and enabled Auth state and returns `resume_verified`. Repeating either result is safe and idempotent.

## Audit and boundaries

Successful, pending, and contained failure outcomes write redacted audit files outside the repository. Passwords, keys, sessions, recovery tokens, links, JWT-shaped values, bearer values, and Supabase key-shaped values are excluded even when placed in neutral fields such as `reason`. The CLI cannot update roles/profiles, delete users, confirm existing users, repair identities, or access Production.

Auth pagination retains the reviewed bounded 100-page maximum. Authoritative next-page semantics were not sufficiently clear to change safely in this remediation and remain a documented Nit.
