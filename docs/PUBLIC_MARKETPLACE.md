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
- approved manufacturer public display fields
- one primary or first public product image metadata record

The projection excludes:

- manufacturer `owner_id`
- manufacturer private email and phone
- private address fields
- product notes
- review notes and reviewer identities
- submitted or archived workflow timestamps
- private images
- product documents
- unpublished products
- products from unapproved manufacturers

The view uses `security_barrier = true` and explicit predicates rather than `security_invoker` because anon direct base-table grants would weaken existing private-table permission boundaries.

## Service Responsibilities

Service file:

- `src/lib/marketplace.ts`

Responsibilities:

- query only `marketplace_products` and `published_product_media`
- map database rows into `MarketplaceProduct`
- keep `ProductRecord` and `ProductMediaRecord` internal to manufacturer/admin workflows
- construct safe search, filter, sort, and pagination queries
- resolve image signed URLs with limited concurrency
- fall back gracefully when a signed image URL cannot be created
- support anonymous users and authenticated buyers
- preserve demo fallback when Supabase env vars are missing

No public marketplace component queries Supabase directly.

## Search, Filters, Sorting, Pagination

Search covers:

- product name
- model name
- category
- short description

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

Pagination is server-side with a fixed page size of 12. Filter and sort changes reset the page to 1.

Current limitation: partial full-text search across array tags is not implemented in SQL. Exact target market and certification filters use array containment.

## Signed Image URL Flow

Both Storage buckets remain private.

Marketplace images:

1. Query public-safe image metadata from `marketplace_products` or `published_product_media`.
2. Request a short-lived signed URL from the private `product-images` bucket.
3. Render the signed URL in the listing card or detail gallery.
4. Never store signed URL tokens in the database.
5. Never use public bucket URLs.

Signed image URL lifetime is documented in `marketplaceSignedUrlTtlSeconds` as 10 minutes.

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
- approved manufacturer public display information
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

Manufacturer/admin product and media workflows remain on their existing private services and RLS policies.
