# Product Media Verification

Date: 2026-07-13

Branch: `auth-profiles`

Linked Supabase project ref: `eoyrfrjbjglfudfuwxdf`

PR #5 merge commit: `ac02926` (`Merge pull request #5 from qqll0787073/product-media-foundation`)

## Migration Application

Command:

```bash
npx.cmd supabase db push --yes
```

Result: migration `0008_product_media_foundation.sql` applied successfully through the linked Supabase CLI flow.

Follow-up result: migration `0009_fix_product_media_storage_authorization.sql` applied successfully through the linked Supabase CLI flow after the authenticated Storage smoke isolated the custom `storage.objects` trigger as incompatible with the live Storage API write path.

Remote migration confirmation:

- `0001`: applied
- `0002`: applied
- `0003`: applied
- `0004`: applied
- `0005`: applied
- `0006`: applied
- `0007`: applied
- `0008`: applied
- `0009`: applied

No production deployment was performed.

## Bucket Privacy And Limits

Linked project bucket settings:

| Bucket | Public | Size limit | Allowed MIME types |
| --- | --- | ---: | --- |
| `product-documents` | `false` | `26214400` | `application/pdf` |
| `product-images` | `false` | `10485760` | `image/jpeg`, `image/png`, `image/webp` |

## SQL And Storage Verification

Command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/product_media_security.sql
```

Result after `0009`: 61/61 checks passed.

Passed checks:

1. admin can manage media for published product
2. admin can select all private media
3. admin can view all media
4. anon cannot directly select public.product_media
5. anonymous can read public media for published product
6. anonymous cannot read unpublished product media
7. approved manufacturer can create media for own draft product
8. archived product image cannot receive a public or buyer signed URL
9. buyer cannot directly select public.product_media public rows
10. buyer cannot read private document media
11. cascade delete removes media records when product is deleted
12. custom storage.objects trigger no longer exists
13. direct insert of a document with is_primary true is blocked
14. direct public URL access is not possible because product-images is private
15. direct update of a document to is_primary true is blocked
16. direct update of an image to is_primary true is blocked
17. document visibility can be private
18. document visibility public insert is blocked
19. document visibility update private to public is blocked
20. duplicate storage path is blocked
21. existing primary image remains unchanged after invalid direct primary attempts
22. existing primary image remains unchanged after invalid RPC attempt
23. failed target validation does not clear current primary image
24. invalid media_type is blocked
25. invalid visibility is blocked
26. manufacturer can edit media for own rejected product
27. manufacturer cannot create media for another manufacturer product
28. manufacturer cannot delete media for published product
29. manufacturer cannot edit media for submitted product
30. manufacturer cannot forge manufacturer storage path
31. negative file size is blocked
32. negative sort order is blocked
33. only one primary media item is allowed per product
34. owner manufacturer can select own private media
35. product-documents bucket is private
36. public projection excludes created_by
37. public projection excludes private document
38. published public image can receive a signed URL through the approved flow
39. published_product_media never returns document records
40. published_product_media still returns public published images
41. security-definer helper EXECUTE grants are restricted
42. set-primary RPC can set a valid image primary
43. set-primary RPC is atomic
44. set-primary RPC rejects documents
45. set-primary RPC rejects media from another product
46. storage policy allows admin upload
47. storage policy blocks delete by unauthorized manufacturer
48. storage policy blocks invalid UUID path upload
49. storage policy blocks published product manufacturer upload
50. storage policy blocks rename into another product path
51. storage policy blocks submitted product manufacturer upload
52. storage policy blocks unauthorized document read
53. storage policy blocks unapproved manufacturer upload
54. storage policy blocks upload to another manufacturer path
55. storage policy blocks upload to another product path
56. storage policy permits valid owner upload to editable product
57. unapproved manufacturer cannot upload media metadata
58. unpublished image cannot receive a public or buyer signed URL
59. updated_at changes on valid update
60. valid authenticated owner upload policy evaluates true
61. visibility private image cannot receive a public or buyer signed URL

## Temporary Storage Smoke Test

Status: passed with a pre-existing approved manufacturer account and draft product.

Credential handling:

- Credentials were read only from `.env.smoke.local`.
- `.env.smoke.local` is ignored by Git via `.gitignore`.
- The smoke used the manufacturer account, not an admin account.
- No password, access token, refresh token, or signed URL query token was printed or recorded.
- No service-role key was used.

Verified flow:

1. Authenticated sign-in passed.
2. Approved manufacturer lookup passed.
3. Draft product lookup passed.
4. Small temporary PNG creation passed.
5. Private `product-images` upload passed.
6. Matching `product_media` metadata creation passed.
7. Manufacturer metadata read passed.
8. Signed image URL retrieval passed.
9. Signed URL image-byte fetch passed.
10. `set_primary_product_media(product_id, media_id)` passed.
11. Primary-image verification passed.
12. Storage object cleanup passed.
13. Metadata cleanup passed.
14. Verification confirmed no temporary storage object remained.
15. Verification confirmed no temporary `product_media` row remained.

Historical note: an earlier authenticated Storage smoke attempt isolated a live Storage API authorization failure in the custom `storage.objects` trigger from `0008`. Migration `0009_fix_product_media_storage_authorization.sql` removed that trigger and moved write authorization into Storage RLS policies. The same live smoke flow passed after `0009`.

## Build And Test Results

Commands:

```bash
npm ci
npm run build
npm run test
```

Results:

- `npm ci`: passed; 81 packages installed; 0 vulnerabilities.
- `npm run build`: passed.
- `npm run test`: passed; 31/31 tests.

## Secret Scan

Secret scan result: no committed secrets found.

The only matches were documentation references to the placeholder `SUPABASE_SERVICE_ROLE_KEY`; no credential values were found.

## Production Safety

- Migrations `0008` and `0009` were applied through the linked Supabase CLI flow.
- Existing production data was not manually edited or deleted.
- No production deployment occurred.
- `auth-profiles` was not merged into `main`.
- PH-005 was not started.
- Public marketplace integration was not started.
