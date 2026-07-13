# Product Media Verification

Date: 2026-07-12

Branch: `auth-profiles`

Linked Supabase project ref: `eoyrfrjbjglfudfuwxdf`

PR #5 merge commit: `ac02926` (`Merge pull request #5 from qqll0787073/product-media-foundation`)

## Migration Application

Command:

```bash
npx.cmd supabase db push --yes
```

Result: migration `0008_product_media_foundation.sql` applied successfully through the linked Supabase CLI flow.

Remote migration confirmation:

- `0001`: applied
- `0002`: applied
- `0003`: applied
- `0004`: applied
- `0005`: applied
- `0006`: applied
- `0007`: applied
- `0008`: applied

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

Result: 51/51 checks passed.

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
12. direct insert of a document with is_primary true is blocked
13. direct public URL access is not possible because product-images is private
14. direct update of a document to is_primary true is blocked
15. direct update of an image to is_primary true is blocked
16. document visibility can be private
17. document visibility public insert is blocked
18. document visibility update private to public is blocked
19. duplicate storage path is blocked
20. existing primary image remains unchanged after invalid direct primary attempts
21. existing primary image remains unchanged after invalid RPC attempt
22. failed target validation does not clear current primary image
23. invalid media_type is blocked
24. invalid visibility is blocked
25. manufacturer can edit media for own rejected product
26. manufacturer cannot create media for another manufacturer product
27. manufacturer cannot delete media for published product
28. manufacturer cannot edit media for submitted product
29. manufacturer cannot forge manufacturer storage path
30. negative file size is blocked
31. negative sort order is blocked
32. only one primary media item is allowed per product
33. owner manufacturer can select own private media
34. product-documents bucket is private
35. public projection excludes created_by
36. public projection excludes private document
37. published public image can receive a signed URL through the approved flow
38. published_product_media never returns document records
39. published_product_media still returns public published images
40. security-definer helper EXECUTE grants are restricted
41. set-primary RPC can set a valid image primary
42. set-primary RPC is atomic
43. set-primary RPC rejects documents
44. set-primary RPC rejects media from another product
45. storage policy blocks unauthorized document read
46. storage policy blocks upload to another manufacturer path
47. storage policy permits valid owner upload to editable product
48. unapproved manufacturer cannot upload media metadata
49. unpublished image cannot receive a public or buyer signed URL
50. updated_at changes on valid update
51. visibility private image cannot receive a public or buyer signed URL

## Temporary Storage Smoke Test

Status: blocked by linked Supabase Auth constraints, with cleanup confirmed.

Attempted flow:

1. Create a temporary manufacturer auth user.
2. Create a temporary approved manufacturer and draft product.
3. Upload a small temporary image to `product-images`.
4. Create a matching `product_media` row.
5. Retrieve the image through an authorized signed URL.
6. Delete the object and metadata.
7. Confirm no temporary rows or objects remain.

Observed blockers:

- Supabase Auth rejected temporary `.test` and `example.com` signup addresses.
- Subsequent signup attempts hit project email rate limiting.
- Direct SQL-created temporary Auth users could not sign in through GoTrue on this linked project.
- The linked database did not expose `app.settings.jwt_secret`, so a short-lived local authenticated JWT could not be generated for the temporary user.

Cleanup confirmation after interrupted attempts:

- `product_media`: `0` temporary rows remaining
- `storage.objects`: `0` temporary objects remaining
- `products`: `0` temporary rows remaining
- `manufacturers`: `0` temporary rows remaining
- `auth.users`: `0` temporary users remaining

No service-role key was used in frontend code. No temporary Storage object was left behind.

Required follow-up: run the authenticated Storage smoke test with either a pre-approved temporary test account or temporary Auth email limits relaxed for the linked project.

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

The only match was the documented placeholder `SUPABASE_SERVICE_ROLE_KEY` in `docs/SUPABASE_SETUP.md`.

## Production Safety

- Migration `0008` was applied through the linked Supabase CLI flow.
- Existing production data was not manually edited or deleted.
- No production deployment occurred.
- `auth-profiles` was not merged into `main`.
- PH-005 was not started.
- Public marketplace integration was not started.
