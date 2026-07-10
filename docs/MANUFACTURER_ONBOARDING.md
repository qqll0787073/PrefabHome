# PH-002 Manufacturer Onboarding and Admin Approval

## Scope

This feature adds the manufacturer onboarding application workflow while preserving the existing marketplace browsing UI.

Implemented:

- Manufacturer onboarding form fields for company, contact, address, experience, categories, certifications, and description.
- Manufacturer application status view.
- Admin manufacturer review queue with review notes and status actions.
- Additive Supabase migration for onboarding fields and approval workflow.
- RLS and trigger protections for owner-only access, admin review, and approved-manufacturer product creation.
- Unit tests for frontend role/status payload safety.
- Rollback-only SQL verification script for database security checks.

Not implemented:

- Product upload UI.
- Production deployment.
- Automatic migration application from this feature branch.

## Workflow

Manufacturer application statuses:

- `draft`
- `submitted`
- `under_review`
- `approved`
- `rejected`
- `suspended`

Manufacturers may create one application for their own account as either `draft` or `submitted`. After creation, manufacturers can update profile fields but cannot change `application_status`, `review_notes`, `reviewed_by`, `reviewed_at`, or ownership.

Admins can view all applications and move applications through review statuses. Returning an application for revision uses `draft`.

## Database Changes

Migration:

- `supabase/migrations/0006_manufacturer_onboarding.sql`

The migration keeps the existing `verification_status` column for compatibility and adds `application_status` as the PH-002 workflow source of truth.

Added manufacturer fields include:

- company legal/display names
- contact person/title
- email, phone, website
- country, province/state, city, street address, postal code
- year established
- export experience
- product categories
- certifications
- company description
- application status
- review notes
- reviewed by / reviewed at
- submitted at

Added indexes and constraints:

- unique manufacturer application per owner
- application status index
- reviewed-by index
- application status check
- year-established check

## Security

Database protections are enforced by RLS and triggers:

- Manufacturer can select only their own application.
- Admin can select and review all applications.
- Manufacturer can create only one own application.
- Manufacturer cannot change approval status or review metadata.
- Anonymous users have no private application access.
- Product insert/update requires the manufacturer application to be approved.

Verification script:

- `supabase/tests/manufacturer_onboarding_security.sql`

The SQL script is rollback-only and covers:

- manufacturer can access only own application
- manufacturer cannot change approval status
- admin can review all applications
- anonymous user cannot access private applications
- approved manufacturer status is enforced before product creation

## UI

Updated:

- `src/App.tsx`
- `src/styles.css`

Added:

- Manufacturer onboarding form
- Manufacturer application status panel
- Admin manufacturer review queue
- Loading, empty, validation, success, and error states

The UI uses Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist, and keeps a demo fallback when credentials are absent.
