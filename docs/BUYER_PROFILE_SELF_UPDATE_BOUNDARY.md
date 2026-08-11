# Buyer Profile Self-Update Boundary

Migration `0026_secure_buyer_profile_self_update.sql` establishes the only approved browser-facing Buyer profile mutation boundary. It does not enable Profile editing in the frontend.

## Approved field

`full_name` is the sole Buyer-editable profile field. The RPC trims outer whitespace, requires a non-empty value, permits international Unicode, and limits the stored name to 160 characters. It does not otherwise normalize personal names.

The following remain system-managed and cannot be supplied to the RPC: `id`, `role`, `status`, `email`, `created_at`, and `updated_at`. Supabase Auth remains authoritative for account email. The existing database trigger maintains `updated_at`.

## Mutation contract

Authenticated clients may later call `public.update_my_buyer_profile(full_name_text text)`. The `SECURITY DEFINER` function has a fixed `search_path`, derives the target from `auth.uid()`, locks and verifies the caller's profile, requires `role = 'buyer'` and `status = 'active'`, and updates only `full_name`. It returns only `full_name`, `role`, `status`, and `updated_at`.

`PUBLIC`, `anon`, and `service_role` receive no execute grant. `authenticated` receives only the named RPC grant.

## Direct table access

Migration 0026 revokes `INSERT`, `UPDATE`, and `DELETE` on `public.profiles` from `authenticated` and removes the obsolete mutation policies. Authorized profile reads remain protected by the existing SELECT policy. This prevents PostgREST callers from bypassing the RPC with crafted JSON or protected columns.

The Auth-user trigger continues to create profiles inside the trusted Auth transaction. Admin provisioning uses its existing server-only service-role workflow and is not converted to Buyer semantics. No current Manufacturer browser workflow writes `public.profiles` directly.

## Deployment scope

Frontend editing remains deferred. This migration is not authorization to apply changes to Production. Staging validation must use the established isolated non-Production workflow and approved hidden operator credentials.
