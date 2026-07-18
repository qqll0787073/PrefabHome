# Backup, Restore, And Rollback Guide

## Scope And Ownership

This repository does not configure or prove automated Supabase backups, point-in-time recovery, Storage-object backup, or restore drills. The Supabase organization owner must confirm the plan and retention actually available for each project before production Beta.

Assign named owners for database recovery, Storage recovery, Auth recovery, application rollback, and customer communication.

## Backup Readiness Checklist

- Confirm database backup frequency, retention, encryption, region, and restore target.
- Confirm whether point-in-time recovery is enabled and tested.
- Define how private Storage objects are backed up and restored with metadata consistency.
- Protect Auth user data and understand which recovery mechanisms include `auth` schemas.
- Store migration files and release commits in Git; never store database passwords or backup credentials in the repository.
- Perform a restore drill into an isolated non-production project and record recovery time and recovery point.

## Application Rollback

Frontend rollback should redeploy the previous known-good immutable build artifact/commit. A frontend rollback does not reverse database migrations and must remain compatible with the current database schema.

Before rollback:

1. Identify the incident and current application/database versions.
2. Confirm the previous frontend is forward-compatible with applied additive migrations.
3. Pause writes or affected workflows when data integrity is at risk.
4. Obtain the designated operations approval.

After rollback, run role-specific read smoke, inspect errors, and confirm no unsafe logging.

## Database Rollback

Do not delete migration-history rows, edit applied migrations, use remote reset, or run ad hoc destructive SQL to make history appear clean.

For a faulty additive migration:

1. Stop affected writes.
2. Assess whether a new forward-fix migration is sufficient.
3. Preserve data before any destructive correction.
4. Test the exact remediation and restore path in staging.
5. Apply through the normal reviewed migration flow.

For corruption or catastrophic loss, restore to a separate project first, validate row counts/constraints/RLS/Auth/Storage references, then execute the approved cutover procedure. Never overwrite production during an exploratory restore.

## Data Integrity Validation

After recovery, verify:

- migration history and schema checksums
- profile/Auth alignment and Admin role integrity
- private bucket configuration and media metadata/object consistency
- one-owner/one-current-record constraints
- transaction snapshots, line items, lifecycle timestamps, and trusted event counts
- participant isolation and Admin-only internal fields
- absence of staging/demo fixtures

## Evidence

Record timestamps, owners, environment/project alias, release SHA, backup identifier, commands (with secrets removed), validation counts, residue checks, and approval. Never record passwords, access/refresh tokens, service keys, database connection strings, or full signed URLs.
