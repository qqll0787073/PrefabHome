# PH-004 Product Media Foundation

## Scope

PH-004 adds secure product media and document metadata foundations using Supabase Storage and PostgreSQL.

Deferred:

- production deployment
- applying migration `0008` remotely before PR approval
- virus scanning and deep content inspection
- image transformation/CDN variants
- public marketplace migration from static prototype data
- quote, payment, shipping, or PH-005 work

## Migration

Migration file:

- `supabase/migrations/0008_product_media_foundation.sql`

The migration is additive and does not delete or modify existing product rows.

## Table Schema

New table:

- `public.product_media`

Core fields:

- product relationship: `product_id`
- media classification: `media_type`
- storage identity: `storage_bucket`, `storage_path`
- file metadata: `original_filename`, `mime_type`, `file_size_bytes`
- display metadata: `title`, `alt_text`, `sort_order`, `is_primary`
- access metadata: `visibility`
- audit metadata: `created_by`, `created_at`, `updated_at`

Constraints:

- supported `media_type`
- supported `visibility`
- non-negative `file_size_bytes`
- non-negative `sort_order`
- supported buckets only
- unique `(storage_bucket, storage_path)`
- only one primary media item per product

## Storage Buckets

`product-images`

- Public bucket
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Maximum file size: 10 MB

`product-documents`

- Private bucket
- Allowed MIME types: `application/pdf`
- Maximum file size: 25 MB

Private document URLs must be created with signed URLs. Private document paths are not exposed through the public projection.

## Storage Paths

Paths are owner-aware and deterministic:

```text
<manufacturer_id>/<product_id>/<uuid>-<sanitized-filename>
```

The bucket name is stored separately in `storage_bucket`.

The frontend generates paths with `createProductMediaStoragePath()`, and database/storage policies validate that the path manufacturer and product IDs match the real product owner.

## Authorization Model

Manufacturer rules:

- Approved manufacturers may upload media only for their own products.
- Manufacturer-managed products must be in `draft` or `rejected`.
- Manufacturers cannot change media for `submitted`, `published`, or `archived` products.
- Manufacturers cannot upload into another manufacturer's path.

Admin rules:

- Admins can view and manage all media.
- Admins can manage media on submitted, published, rejected, or archived products when operationally needed.

Public and buyer rules:

- Anonymous users and buyers read only public media for published products.
- Private documents are excluded.
- Unpublished product media is excluded.
- Internal audit fields such as `created_by` are excluded.

## RLS And Storage Policies

Database enforcement includes:

- `public.can_manage_product_media(product_uuid)`
- `public.can_view_private_product_media(product_uuid)`
- `public.can_read_public_product_media(product_uuid)`
- storage path parsing helpers for manufacturer/product IDs
- `public.manage_product_media()` trigger
- `public.enforce_product_media_storage_object()` trigger on `storage.objects`

RLS policies protect:

- `public.product_media`
- `storage.objects`

The storage write trigger validates path ownership and editable product status. The storage read policy also allows a rightful uploader to read a newly uploaded object before the metadata row is created, which supports the upload-then-record workflow.

## Public Projection

Public view:

- `public.published_product_media`

Included fields:

- `id`
- `product_id`
- `media_type`
- `storage_bucket`
- `storage_path`
- `original_filename`
- `mime_type`
- `file_size_bytes`
- `title`
- `alt_text`
- `sort_order`
- `is_primary`
- `visibility`
- `created_at`

Excluded:

- `created_by`
- `updated_at`
- private documents
- unpublished product media

## Service Layer

Service file:

- `src/lib/productMedia.ts`

Responsibilities:

- filename sanitization
- owner-aware storage path generation
- image/PDF validation
- public/private type separation
- upload file first, then create metadata record
- compensation cleanup if metadata creation fails after upload
- metadata updates
- primary image selection
- delete object first, then delete metadata record
- signed URL creation for private documents
- readable storage and database errors

Public queries use `PublicProductMediaRecord`. Manufacturer/admin workflows use `ProductMediaRecord`.

## UI

Feature folder:

- `src/features/product-media/`

Components:

- `ProductMediaManager.tsx`
- `ProductImageUploader.tsx`
- `ProductDocumentUploader.tsx`
- `ProductMediaGallery.tsx`
- `ProductMediaList.tsx`

Manufacturer portal:

- media manager appears for the selected product
- supports image upload, PDF upload, metadata, sort order, primary image, signed admin document access, and delete controls
- shows locked state for submitted, published, and archived products

Admin portal:

- media manager appears inside product review items
- admins can view/manage all product media
- private documents are opened through signed URLs

The public marketplace still uses static prototype data in PH-004.

## File Validation

Frontend validation checks:

- MIME type
- file extension
- non-empty file
- maximum size

Limits:

- images: JPEG, PNG, WebP, 10 MB
- documents: PDF, 25 MB

This does not prove file contents are safe. Virus scanning, malware detection, and deeper content inspection are deferred infrastructure work.
