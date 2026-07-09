# Product Requirements

## Goal

PrefabHome Marketplace connects U.S. buyers with prefab and modular home manufacturers, while supporting quote requests, messaging, import planning, CRM workflows, and AI-assisted home planning.

## Current Prototype Scope

- Buyer, manufacturer, and admin portal surfaces.
- Product listing browse, save, compare, and detail workflows.
- Quote request and quotation status surfaces.
- Buyer/manufacturer messaging surface.
- Import and customs document center placeholder.
- AI Home Advisor placeholder.

The current UI is preserved as a frontend prototype while the implementation is reorganized for production work.

## Target Users

- Buyers: homeowners, investors, ADU buyers, and small developers.
- Manufacturers: prefab home factories and sales teams.
- Admins: marketplace operators responsible for verification, moderation, support, and compliance review.

## Core Production Features

- Supabase Auth with role-aware onboarding.
- Buyer Portal for saved products, quote requests, messages, advisor sessions, and document tracking.
- Manufacturer Portal for listings, quote responses, CRM contacts, outreach, and messages.
- Admin Portal for manufacturer approval, listing moderation, user support, and audit logs.
- Product listings with media, specs, compliance notes, pricing ranges, lead times, and manufacturer ownership.
- Quote requests with structured customization, budget, destination, status, and attachments.
- Messaging linked to buyers, manufacturers, listings, and quotes.
- Manufacturer CRM with contacts, companies, outreach activity, and generated email drafts.
- Email outreach tracking for sends, opens, clicks, replies, and manual notes.
- Import/customs document center for invoices, packing lists, bills of lading, certificates, and buyer/manufacturer access control.
- AI Home Advisor for model fit, planning checklists, zoning guidance, and import workflow assistance.

## Non-Goals For This Cleanup

- No live Supabase integration.
- No AI provider calls from the browser.
- No payment processing.
- No production email provider integration.
- No legal, engineering, zoning, or customs determinations.

## Acceptance Criteria For Production Readiness

- All user data persists in Supabase PostgreSQL.
- All sensitive keys remain server-side or in platform-managed secret storage.
- Supabase Row Level Security protects every user-owned table.
- Role-based routes prevent client-only admin/manufacturer access.
- Build, type check, lint, and tests run in CI.
- Uploaded documents use private storage buckets and signed URLs.
