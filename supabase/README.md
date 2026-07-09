# Supabase Foundation

This folder contains draft database and Row Level Security migrations for the PrefabHome Marketplace production foundation.

The frontend is wired for optional Supabase configuration through:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Real credentials are not required for local builds yet. Do not commit `.env.local` or any service-role keys.

## Files

- `migrations/0001_foundation_schema.sql`: schema draft for core marketplace tables.
- `migrations/0002_foundation_rls_policies.sql`: initial RLS policy draft.

Apply these to a disposable development Supabase project first. They are intentionally marked as foundation drafts and should be reviewed before production use.
