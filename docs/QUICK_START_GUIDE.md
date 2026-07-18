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
