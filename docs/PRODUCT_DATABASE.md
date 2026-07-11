# PH-003 Product Database Foundation

## Scope

PH-003 establishes the product database foundation, Supabase authorization model, product service layer, basic manufacturer/admin product management UI, and rollback-only security verification.

Deferred:

- Supabase Storage
- image upload
- PDF/document upload
- public marketplace migration from static data
- search
- quote workflow
- payment
- shipping calculator
- production deployment

## Schema

Migration:

- `supabase/migrations/0007_product_database_foundation.sql`

The migration uses the existing `public.products` table. It does not create a duplicate products table.

New product columns cover:

- identity: `sku`, `model_name`, `slug`, `category`
- marketing: `short_description`, `description`, `tags`, `intended_uses`
- building specifications: area, rooms, dimensions, materials, utilities, wind/snow ratings
- commercial data: currency, FOB price, price unit, MOQ, lead time, port of loading
- compliance/import data: HS code, certifications, target markets, notes
- lifecycle/review data: status, submitted/published/archived timestamps, review notes, reviewer

## Legacy Compatibility

Legacy columns are preserved:

- `name`
- `base_price`
- `size_sqft`
- `lead_time_weeks`
- `specifications`
- `compliance_notes`

Backfill mapping in migration `0007`:

- `name` -> `model_name`
- `description` -> `short_description`
- `size_sqft` -> `floor_area_sq_ft`
- `base_price` -> `fob_price`
- `lead_time_weeks` -> `production_lead_time_weeks`
- `active` -> `published`
- `pending_review` -> `submitted`

The linked project was inspected before applying any remote migration for PH-003 work; the current `public.products` status snapshot returned no existing product rows.

## Product Lifecycle

Statuses:

- `draft`
- `submitted`
- `published`
- `rejected`
- `archived`

Manufacturer transitions:

- create `draft`
- create `submitted`
- edit current `draft`
- edit current `rejected`
- `draft` -> `submitted`
- `rejected` -> `submitted`

Manufacturers cannot self-publish, reject, archive, modify submitted/published/archived products, or change `manufacturer_id`.

Admin transitions:

- `submitted` -> `published`
- `submitted` -> `rejected`
- `published` -> `archived`
- `rejected` -> `draft`

Admins can make same-status edits such as review note updates without resetting lifecycle timestamps.

All other admin lifecycle transitions are rejected at the database trigger, including `draft` -> `published`, `draft` -> `archived`, `published` -> `draft`, `archived` -> `rejected`, `archived` -> `published`, and `rejected` -> `published`.

Timestamp behavior:

- `submitted` -> `published` sets `published_at` and clears `archived_at`
- `submitted` -> `rejected` records review metadata but does not set `published_at`
- `published` -> `archived` sets `archived_at`
- `rejected` -> `draft` clears review workflow fields so the manufacturer can revise
- same-status admin edits do not reset `submitted_at`, `published_at`, or `archived_at`

## Public Visibility

Anonymous users, buyers, and manufacturers browsing public listings read from `public.published_products`, not from the private `public.products` table.

`public.published_products` is a database-level public projection that includes only buyer-safe fields for `published` products. It excludes internal/review fields such as:

- `notes`
- `review_notes`
- `reviewed_by`
- `reviewed_at`
- `submitted_at`
- `archived_at`
- legacy/internal compatibility blobs such as `specifications` and `compliance_notes`

The view uses an explicit `status = 'published'` predicate and grants `select` on the view to `anon` and `authenticated`. Anonymous direct `select` on `public.products` is revoked. Authenticated direct table visibility is limited by RLS to manufacturer owners and admins.

Manufacturers can read:

- their own products in any status
- published products from other manufacturers through `public.published_products`

Admins can read and manage all products.

Private review/internal fields are not selected by the public service helper `fetchPublishedProducts()`.

## RLS Policy Model

Migration `0007` replaces the older product RLS policies with:

- `products_public_select_published`
- `products_authenticated_select_visible`
- `products_manufacturer_insert_own_approved`
- `products_manufacturer_update_own_editable`
- `products_admin_manage_all`

Trigger-level enforcement in `public.manage_product_lifecycle()` protects:

- approved manufacturer requirement
- own manufacturer requirement
- allowed manufacturer create statuses
- manufacturer edit only while current status is `draft` or `rejected`
- manufacturer submit-only transitions
- manufacturer self-publish/reject/archive prevention
- immutable `manufacturer_id`
- admin transition matrix
- admin publication/archive timestamps
- public/private product access separation

## Service Layer

Product data access lives in `src/lib/products.ts`.

Responsibilities:

- explicit Supabase queries
- payload mapping
- draft and submit validation
- readable product errors
- manufacturer/admin status constants
- transition-aware `getAllowedAdminProductTransitions(currentStatus)`
- product lifecycle helper functions

Public browse code uses `PublicProductRecord` from `src/types.ts` and queries `public.published_products`. Manufacturer/admin workflows use private `ProductRecord` from `public.products`.

UI components must not use service-role credentials or place privileged Supabase queries directly in presentation code.

## UI

Product feature components live in `src/features/products/`:

- `ManufacturerProductList.tsx`
- `ManufacturerProductForm.tsx`
- `ProductStatusPanel.tsx`
- `AdminProductReview.tsx`

Manufacturer portal:

- lists own products
- creates drafts
- edits draft/rejected products
- submits products
- shows locked states

Admin portal:

- lists all products
- filters by status
- reviews submitted products
- renders only legal lifecycle actions for the current product status

The public marketplace still uses static prototype products in PH-003. Migrating public browse to Supabase belongs to a later phase.
