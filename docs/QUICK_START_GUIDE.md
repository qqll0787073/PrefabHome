# Beta Quick Start Guide

## 1. Prepare Local Configuration

```bash
npm ci
cp .env.example .env.local
```

Populate the ignored `.env.local` with:

```text
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_ANON_KEY=<publishable/anon key>
VITE_ENABLE_MARKETPLACE_DEMO=false
```

The publishable/anon key is expected in a browser client and is protected by RLS. Never use a service-role key in frontend configuration. Do not commit `.env.local`.

Use local or staging credentials only. Production credentials and the production project are prohibited for local development and smoke testing.

## 2. Prepare Supabase

Use a non-production project for development. Apply migrations `0001` through `0024` through the normal, reviewed Supabase CLI flow. Do not edit an already-applied migration. See [Supabase setup](SUPABASE_SETUP.md) and [Deployment and operations](DEPLOYMENT_AND_OPERATIONS_GUIDE.md).

## 3. Start The App

```bash
npm run dev
```

Open the URL printed by Vite. Supabase Auth sessions persist across refreshes.

## 4. Establish Roles

- Buyer and Manufacturer accounts can self-register.
- Manufacturer accounts must complete onboarding and receive Admin approval before product creation.
- Admin accounts are not self-service. Create the Auth user through an operator-controlled process, then grant `public.profiles.role = 'admin'` using a trusted database/Admin operation. Never accept client signup metadata as Admin authority.

After sign-in, choose Dashboard and use the role-aware workspace rail. Buyers see transaction workspaces; Manufacturers also see Company and Products; Admins see operational review queues. Workspace and selected Logistics request state are stored in the URL query string, so refresh and browser navigation restore supported state.

## Local Marketplace Demo

Set `VITE_ENABLE_MARKETPLACE_DEMO=true` only when developing the public marketplace without Supabase. Demo inventory is visibly labelled, does not authenticate users or create transaction records, and must remain `false` in staging/production. Missing Supabase configuration otherwise fails safely with an unavailable state.

## 5. Exercise The Happy Path

1. Admin approves a Manufacturer.
2. Manufacturer creates and submits a Product; Admin publishes it.
3. Buyer finds the Product and submits an RFQ.
4. Manufacturer reviews the RFQ, messages the Buyer, and submits a Quote.
5. Buyer accepts the Quote and creates/submits a Purchase Order.
6. Manufacturer reviews/confirms the Purchase Order.
7. Admin creates and readies a Contract; participants complete review.
8. Admin prepares signature records only; no external signature is sent.
9. Manufacturer creates/issues an Invoice and records external payments as applicable.
10. Manufacturer prepares Shipping Readiness and submits a Logistics Booking Request.
11. Admin records provider candidates, selection, and internal readiness.

## 6. Verify Before Sharing

```bash
npm run verify:beta
```

Then complete [Beta QA checklist](BETA_QA_CHECKLIST.md) and [Beta release signoff](BETA_RELEASE_SIGNOFF.md). The command is local-only and does not validate live Auth, Storage, RLS, email confirmation, browser behavior, backups, monitoring, or hosting configuration.

## Common Setup Errors

- **Marketplace unavailable:** set both Vite Supabase variables or explicitly enable local demo mode.
- **Registration created but not signed in:** confirm the email when Supabase confirmation is enabled.
- **Wrong portal access:** verify `public.profiles.role`; the login role selector does not grant authority.
- **Manufacturer Product controls missing:** complete onboarding and obtain approval.
- **Build cannot load Vite config on restricted Windows paths:** use the tracked `npm run build`, which selects Vite's runner config loader.
- **Lifecycle conflict:** refresh; the server may already have accepted a competing transition.
