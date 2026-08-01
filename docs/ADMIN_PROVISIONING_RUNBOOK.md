# Secure Admin Provisioning Runbook

## Purpose

This runbook describes the local operator CLI for inventorying and provisioning one PrefabHome Admin. It is not a public application feature. Sprint 4A authorizes implementation and local testing only; it does not authorize a Staging execution. Production execution is explicitly prohibited.

## Prerequisites

- Written authorization naming the environment, normalized email, reason/ticket, and whether an existing or new Auth user is expected.
- A clean, isolated clone or worktree containing no `.env.local`, `.env.staging.local`, `supabase/.temp`, Production configuration, browser profile, or smoke credentials.
- Reviewed commit and migrations exactly `0001-0025`.
- A securely delivered Staging service-role credential and, for new-user mode, a unique temporary Staging password.
- An approved out-of-band mechanism for delivering the temporary password or confirmation/invitation instructions.

Required process variables:

```text
PREFAB_ADMIN_TARGET_PROJECT_REF
PREFAB_ADMIN_SUPABASE_URL
PREFAB_ADMIN_SERVICE_ROLE_KEY
PREFAB_ADMIN_TEMP_PASSWORD        # new mode only
PREFAB_ADMIN_AUDIT_DIR            # optional; must be outside the repository
```

The CLI never loads environment files and never reads `supabase/.temp/project-ref`. Do not use `VITE_` variables for privileged credentials.

## Review And Dry Run

From the isolated workspace, inject only Staging values into one process and run:

```text
npm run admin:provision -- --environment staging --email <admin-email> --designation operator --reason <ticket> --dry-run
```

Dry-run uses read-only Auth/profile inventory calls and performs zero mutations. Review the redacted result for exact match counts, UUID alignment, current role, active status, confirmation state, ban/disable state, and conflicts. Duplicate or mismatched identities must not be repaired by this tool.

## Existing-User Procedure

Use only when dry-run proves exactly one Auth user and one matching active profile, the UUIDs match, email is confirmed, current role is the explicitly expected safe role (`buyer`), and no Manufacturer business ownership exists.

```text
npm run admin:provision -- --environment staging --email <admin-email> --designation operator --reason <ticket> --mode existing
```

Review the redacted plan and type exactly:

```text
PROMOTE VERIFIED STAGING USER TO ADMIN
```

The conditional update targets the verified UUID and also requires the normalized email, `role=buyer`, and `status=active`. Exactly one returned row and a clean postflight inventory are required.

## New-User Procedure

Use only when dry-run proves zero Auth and zero profile matches. Generate a unique temporary Staging-only password, inject it into `PREFAB_ADMIN_TEMP_PASSWORD` for this process, and clear it immediately afterward. Never pass it on the command line.

```text
npm run admin:provision -- --environment staging --email <admin-email> --designation operator --reason <ticket> --mode new --email-confirm
```

`--email-confirm` is an explicit operator assertion that the approved Staging procedure permits marking this test/operator email confirmed. Without it, the created account remains unconfirmed and cannot sign in until the normal confirmation path completes. Signup metadata is deliberately `buyer`; it never grants Admin.

The CLI proves absence, creates one Auth user through the Admin Auth API, waits boundedly for the existing Auth trigger to create the profile, verifies UUID/email/default role/status, and performs the same exact conditional promotion.

## Resume And Idempotency

If Auth creation returns an uncertain response or the trigger/profile/promotion step fails, do not rerun new mode and do not delete the Auth user. Preserve the reported UUID, repeat dry-run, resolve the external condition, and use:

```text
npm run admin:provision -- --environment staging --email <admin-email> --designation operator --reason <ticket> --mode resume --uuid <verified-uuid>
```

Resume requires the UUID to match the sole Auth user and sole profile. An already-Admin account returns the idempotent `already_admin` result without another update.

## Containment Cases

Stop and escalate on duplicates, UUID/email mismatch, missing profile, wrong role, inactive profile, banned/disabled user, Manufacturer business ownership, conditional update count other than one, or failed postconditions. The tool does not merge, delete, unban, confirm, repair, or demote accounts.

## Evidence And Password Handling

Successful mutation writes a sanitized JSON record outside the repository, defaulting to the operator home audit directory. It includes timestamp, version, Git SHA, masked environment identity, target UUID, operation, before/after role, status, reason, and outcome. It excludes passwords, keys, tokens, sessions, database credentials, and complete URLs.

Deliver a temporary password only through the approved owner-facing secret channel. Require rotation at first use when supported. Never reuse it across roles or environments.

## Cleanup Policy

Permanent designated Admin accounts are not fixtures. Temporary UAT Admin removal requires separate authorization, exact UUID inventory, business-record dependency review, reverse-order cleanup, and Auth deletion last. This provisioning tool performs no cleanup or deletion.

## Production Adaptation

Production remains disabled in code. Enabling it requires a separate security review and authorization covering an explicit Production allowlist, dual control, stronger typed phrase, non-environment secret-store integration, durable restricted audit storage, account ownership proof, monitoring, rollback, and incident response. Merely changing a constant is not an approved procedure.
