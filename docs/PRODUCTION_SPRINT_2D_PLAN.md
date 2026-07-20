# Production Sprint 2D Plan

## Objective

Create a centralized, reviewable public-operations and draft legal foundation for PrefabHome while preserving existing marketplace authorization and keeping every publication and deployment decision explicitly blocked.

Starting SHA: `9bebfc345be6fac56dc8d3407f8f61bc6addab3b`

## Scope

- A typed, browser-safe public operator and contact model with obvious neutral placeholders
- Versioned draft metadata and plain-language content for six required legal pages
- A reusable public footer, contact center, and public status-page model
- Route-specific metadata and draft indexing controls
- Deterministic legal structure and legal publication checks
- Accessibility, mobile, browser, documentation, and release-checklist coverage

## Explicit Non-Goals

- Legal advice, legal sufficiency, compliance, certification, counsel approval, or publication authorization
- Production or staging access, deployment, release, tag, merge, migration, RLS, RPC, Auth, or Storage work
- Consent collection or storage, analytics, monitoring, tracking, email, payment, signature, freight, customs, or AI integrations
- Real operator addresses, personal contacts, registration numbers, tax identifiers, or support response-time commitments

## Legal Review Boundary

Every legal document is **Draft - Pending legal review** and is not effective until approved and published by the operator. Repository checks validate structure and block publication; they do not substitute for counsel, privacy, accessibility, security, or jurisdiction-specific review.

## Operator Data Approval Boundary

Checked-in public operator data uses obvious placeholders. Public identity, legal entity, jurisdiction, address, contacts, support hours, and approvers require written operator approval before replacement. No placeholder is a live channel or authorization signal.

## Deliverables

- Central operator, legal-document, and public status models
- Privacy, Terms, Cookie/Tracking, Accessibility, Acceptable Use, and Copyright/Trademark draft pages
- Public contact center and consistent legal footer
- Legal structure and intentionally blocked publication gates
- Updated public metadata, indexing guidance, release checklists, tests, and local browser smoke

## Accessibility Requirements

- One `h1`, semantic sections, labelled navigation, stable main target, and skip link on every public route
- Native keyboard-operable links and controls, visible focus, logical heading order, and readable status text
- Reflow at 200% and 400% proxies; reduced-motion and forced-colors behavior retained
- Manual assistive-technology and contrast review remain mandatory

## Mobile Requirements

Public content and footer links must wrap without page-level horizontal overflow at 320, 375, 390, 414, 768, and 1280 CSS-pixel widths. Long legal headings, paragraphs, metadata, and contact categories must remain readable without clipping.

## Indexing Requirements

Draft and pending-review legal pages receive `noindex, nofollow` and remain outside the sitemap. Indexing can change only after the legal publication gate, effective dates, operator identity, and explicit release approval are complete. Robots guidance is informational, not access control.

## Security And Privacy Constraints

- Browser-visible data must be public-safe and contain no credential or private person data
- No HTML injection, live contact link, form submission, account state, transaction data, or authorization decision may enter public metadata or content
- Existing Supabase, role, RLS, private Storage, artifact, source-map, and secret-scan boundaries remain unchanged

## Manual Review Requirements

Product Owner, Legal Counsel, Privacy, Accessibility, Security, Operations, Corporate/Entity Information, Contact Information, Jurisdiction/Governing Law, Cookie/Tracking Inventory, and Final Publication Authorization must each be reviewed. Final authorization defaults to **NOT GRANTED**.

## Rollback Strategy

Rollback is a source revert of Sprint 2D commits. No database, remote service, published document, consent record, or deployment requires rollback.

## Definition Of Done

- Six draft legal routes render with required warnings, metadata, safe content, and noindex behavior
- Central operator/contact data remains placeholder-only and private-data-free
- Contact center, footer, status model, Version metadata, Back/Forward, and deep links work locally
- Legal structure passes; legal publication fails clearly and intentionally
- Existing tests, build, artifact, bundle, secret, Beta, quality, and production-readiness checks pass
- Migrations remain exactly `0001` through `0024`, unchanged
- Draft PR targets `auth-profiles` and remains unmerged

**Production Deployment Authorization is NOT GRANTED.**

**Legal Publication Authorization is NOT GRANTED.**
