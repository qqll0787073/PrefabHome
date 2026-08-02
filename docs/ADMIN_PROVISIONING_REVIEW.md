# Admin Provisioning Security Review

## Architecture Decision

Primary design: a local operator CLI using the Supabase Admin Auth API plus a service-role PostgREST conditional update of the exact `public.profiles` UUID.

This uses existing trusted server behavior and requires no migration. The service role bypasses RLS as designed, while the tool adds application-level preconditions: exact email inventory, UUID equality, expected current role, active status, no Manufacturer ownership, exact confirmation, conditional update, one-row assertion, and postflight verification.

Alternatives:

- A `SECURITY DEFINER` promotion RPC was rejected because it would add a sensitive database surface and migration, with grant mistakes creating an escalation path.
- A one-time SQL transaction was deferred because it is harder to make idempotent across Auth API creation, easier to target incorrectly, and encourages privileged direct SQL.
- An Edge Function was deferred because deployment, operator authentication, secret storage, network exposure, and monitoring require a larger separately reviewed control plane.

## Security Boundaries

- Code lives under `scripts/admin-provisioning`, outside frontend bundles.
- No public RPC, grant, policy, trigger, schema, or migration changes.
- Mutation uses only verified UUID plus expected email, role, and status.
- Production mode always fails.
- No environment-file or repository-link fallback.
- Service-role key and temporary password are process-only inputs.
- Audit output is redacted and stored outside tracked paths.

## Commands

```text
npm run admin:provision -- --help
npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --dry-run
npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --mode existing
npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --mode new --email-confirm
npm run admin:provision -- --environment staging --email <email> --designation operator --reason <ticket> --mode resume --uuid <uuid>
npm run test:admin:provision
```

## Files Changed

- `scripts/admin-provisioning/core.mjs`
- `scripts/admin-provisioning/supabase-adapter.mjs`
- `scripts/admin-provisioning/cli.mjs`
- `scripts/admin-provisioning/core.test.mjs`
- `scripts/test-infrastructure/admin-provisioning-policy.test.mjs`
- `docs/ADMIN_PROVISIONING_THREAT_MODEL.md`
- `docs/ADMIN_PROVISIONING_RUNBOOK.md`
- `docs/ADMIN_PROVISIONING_REVIEW.md`
- `package.json`

## Test Matrix

Local mocks cover target proof, Production denial, ambiguous configuration, zero/one/duplicate identities, UUID/role/status/confirmation/ban checks, new creation, missing trigger profile, uncertain creation recovery, exact promotion counts, business ownership, idempotency, redaction, confirmation, and audit safety. Infrastructure tests prove frontend separation, migration inventory, explicit CLI modes, no password argument, and server-only credential naming. Tests make no remote request.

## Unresolved Owner Decisions

1. Approve the designated Staging Admin email and accountable owner.
2. Approve existing-user versus new-user mode after dry-run evidence.
3. Approve whether Staging operator accounts may be marked confirmed with `--email-confirm` or must use email confirmation.
4. Select the secure temporary-password delivery and forced-rotation procedure.
5. Select the restricted audit directory, retention period, and evidence custodian.
6. Approve who may possess the Staging service-role credential and whether dual control is required.
7. Decide whether a future secret-store integration must replace one-process environment injection.

## Future Production Gates

Production requires a separate sprint and written authorization. Required gates include ref allowlisting, removal of the unconditional Production block only after review, dual approval, stronger confirmation, approved secret store, durable restricted audit sink, organizational identity proof, monitoring, break-glass/rollback procedures, and Production-specific tests. Sprint 4A grants no Production execution authority.
