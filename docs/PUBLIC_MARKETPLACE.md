# PH-005 Public Product Marketplace

## Scope

PH-005 replaces the static public marketplace prototype with real published Supabase product data and authorized signed product-image URLs.

Deferred:

- production deployment
- applying migration `0010` remotely before approval
- quote requests
- payments
- shipping calculators
- buyer messaging
- favorites
- compare workflows
- PH-006 work

## Source Views

Primary marketplace view:

- `public.marketplace_products`

Supporting image view:

- `public.published_product_media`

`marketplace_products` is introduced by:

- `supabase/migrations/0010_public_product_marketplace.sql`

The migration is additive and does not modify migrations `0001` through `0009`.

## Public-Safe Fields

`marketplace_products` exposes explicit public-safe columns only:

- published product fields needed for browse and detail pages
- approved manufacturer display name and country
- one primary or first public product image metadata record
- a public `search_text` helper built from public product names, category, short description, and tags

The projection excludes:

- manufacturer `owner_id`
- manufacturer private email and phone
- manufacturer onboarding province, city, street address, postal code, and website
- product notes
- review notes and reviewer identities
- private notes in public search text
- submitted or archived workflow timestamps
- private images
- product documents
- unpublished products
- products from unapproved manufacturers

The view uses `security_barrier = true` and explicit predicates rather than `security_invoker` because anon direct base-table grants would weaken existing private-table permission boundaries.

Explicit Manufacturer Public Profile fields and visibility controls are deferred to a later phase. PH-005 does not automatically expose manufacturer onboarding location or website fields merely because an application is approved.

## Service Responsibilities

Service file:

- `src/lib/marketplace.ts`

Responsibilities:

- query only `marketplace_products` and `published_product_media`
- map database rows into `MarketplaceProduct`
- keep `ProductRecord` and `ProductMediaRecord` internal to manufacturer/admin workflows
- construct safe search, filter, sort, and pagination queries
- resolve image signed URLs with limited concurrency
- reuse an already-signed primary image URL when opening the detail gallery
- fall back gracefully when a signed image URL cannot be created
- support anonymous users and authenticated buyers
- fail safely when Supabase env vars are missing unless local demo mode is explicitly enabled

No public marketplace component queries Supabase directly.

## Demo Mode

Marketplace demo data is disabled by default.

Local development may opt in with:

```bash
VITE_ENABLE_MARKETPLACE_DEMO=true
```

When enabled without Supabase configuration, the UI displays a visible "Demo data" banner. Production must keep this flag disabled. Missing or invalid Supabase configuration in production should render a safe unavailable/error state rather than static inventory from `src/data`.

## Search, Filters, Sorting, Pagination

Search covers:

- product name
- model name
- category
- short description
- tags

Filter controls include:

- category
- minimum bedrooms
- minimum bathrooms
- minimum floor area
- maximum floor area
- minimum FOB price
- maximum FOB price
- target market
- certification

Sorting includes:

- newest published
- price low to high
- price high to low
- floor area low to high
- floor area high to low

Pagination is server-side with a default page size of 12 and a service-layer maximum of 24. Filter and sort changes reset the page to 1.

Exact target market and certification filters use array containment.

Migration `0010` adds partial indexes for common marketplace filters and sorts:

- category
- FOB price
- floor area
- target markets
- certifications

## Signed Image URL Flow

Both Storage buckets remain private.

Marketplace images:

1. Query public-safe image metadata from `marketplace_products` or `published_product_media`.
2. Request a short-lived signed URL from the private `product-images` bucket.
3. Render the signed URL in the listing card or detail gallery.
4. Never store signed URL tokens in the database.
5. Never use public bucket URLs.

Signed image URL lifetime is documented in `marketplaceSignedUrlTtlSeconds` as 10 minutes.
The detail gallery reuses the primary image signed URL generated for the listing/detail entry and signs only additional gallery images.

## Empty Image Fallback

Products with no public image remain readable. Listing cards and detail pages show a deterministic "Image pending" placeholder.

## UI

Feature folder:

- `src/features/marketplace/`

Key components:

- `MarketplacePage.tsx`
- `MarketplaceSearch.tsx`
- `MarketplaceFilters.tsx`
- `MarketplaceSort.tsx`
- `MarketplaceProductGrid.tsx`
- `MarketplaceProductCard.tsx`
- `MarketplacePagination.tsx`
- `MarketplaceEmptyState.tsx`
- `MarketplaceErrorState.tsx`
- `MarketplaceProductDetail.tsx`
- `MarketplaceImageGallery.tsx`
- `MarketplaceProductSpecs.tsx`

The public detail path uses:

- `/products/<slug>`

The app still uses the existing lightweight app state approach and does not add React Router.

## Access Boundaries

Anonymous users and buyers may see:

- published products only
- approved manufacturer display name and country
- public image metadata
- signed URLs for public published product images

Anonymous users and buyers may not see:

- draft, submitted, rejected, or archived products
- private images
- documents
- product notes
- review notes
- reviewer identities
- manufacturer owner IDs
- private manufacturer contact fields
- manufacturer onboarding location or website fields

Manufacturer/admin product and media workflows remain on their existing private services and RLS policies.
