# Supabase Setup

## Environment Variables

Frontend-safe variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- AI provider API keys
- Email provider API keys
- Webhook signing secrets

Never commit real values. Use `.env.example` for names only.

## Project Setup

1. Create separate Supabase projects for development, staging, and production.
2. Enable email auth providers required for launch.
3. Configure redirect URLs for local, staging, and production domains.
4. Add database migrations under `supabase/migrations`.
5. Enable Row Level Security on every application table.
6. Add private storage buckets for documents and verification files.
7. Add public or moderated storage for product images.

## Auth Model

- Supabase Auth owns identity.
- `profiles.id` references `auth.users.id`.
- `profiles.role` determines buyer, manufacturer, or admin access.
- Admin status should be granted manually or through a controlled server-only process.

## Client Initialization

The browser may use only:

- Supabase project URL.
- Supabase anon key.

The service-role key must never be imported into frontend code.

## Local Development

Recommended workflow:

1. Install Supabase CLI.
2. Run local Supabase stack.
3. Apply migrations.
4. Seed safe sample data.
5. Run the frontend with `.env.local` values.

## Deployment

- Store secrets in the deployment platform secret manager.
- Use separate environment variables for staging and production.
- Rotate keys if any secret is accidentally exposed.
- Restrict storage policies before accepting real documents.
