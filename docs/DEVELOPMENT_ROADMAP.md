# Development Roadmap

## Phase 0: Repository Recovery And Hygiene

- Keep generated UI behavior but split source into maintainable files.
- Add build, TypeScript, and Vite configuration.
- Add `.env.example` and ignore real environment files.
- Add production planning docs.
- Confirm `npm run build` passes.

## Phase 1: App Architecture

- Add real routing for marketplace, buyer, manufacturer, admin, quote, message, document, and advisor pages.
- Split UI into reusable layout, listing, portal, messaging, document, and form components.
- Add typed service interfaces for future Supabase integration.
- Add validation for forms and quote request payloads.

## Phase 2: Supabase Foundation

- Create Supabase project and environments.
- Add migrations for profiles, manufacturers, products, quotes, messages, CRM, documents, advisor sessions, and audit logs.
- Enable Row Level Security on all tables.
- Add role claims or role lookup functions.
- Add Supabase client initialization using only public URL and anon key in frontend.

## Phase 3: Authentication And Portals

- Implement Supabase Auth sign up, sign in, sign out, password reset, and session refresh.
- Add buyer/manufacturer/admin protected routes.
- Build onboarding flows for buyers and manufacturers.
- Add admin manufacturer approval workflow.

## Phase 4: Marketplace Workflows

- Persist product listings and product media.
- Add listing create/edit workflow for manufacturers.
- Add buyer quote request workflow.
- Add manufacturer quotation workflow.
- Add status timelines and audit logs.

## Phase 5: Messaging And Documents

- Persist message threads.
- Add unread counts and message permissions.
- Add private document uploads with Supabase Storage.
- Add customs/import checklist and document status tracking.

## Phase 6: CRM And Email Outreach

- Add manufacturer CRM companies and contacts.
- Add email templates and AI-generated draft support through server endpoints.
- Integrate an email provider server-side.
- Track send/open/click/reply events.

## Phase 7: AI Home Advisor

- Add server-side AI endpoints.
- Store advisor sessions and messages.
- Add structured planning checklists, zoning prompts, source disclaimers, and handoff to quote requests.
- Add rate limits, moderation, and cost controls.

## Phase 8: Production Hardening

- Add automated tests and CI.
- Add dependency scanning and secret scanning.
- Add error monitoring, analytics, and audit trails.
- Add backup, migration, and incident response procedures.
- Prepare staging and production deployment pipelines.
