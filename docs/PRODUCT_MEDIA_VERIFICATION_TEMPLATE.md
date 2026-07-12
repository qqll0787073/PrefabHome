# Product Media Verification Template

Use this template after PH-004 review approval and before any production release.

## Branch And Commit

- Branch:
- Commit:
- Reviewer approval:

## Migration

- Migration file: `supabase/migrations/0008_product_media_foundation.sql`
- Applied to linked Supabase project: yes/no
- Linked project ref:
- Command:

```bash
npx.cmd supabase db push --yes
```

Do not mark `0008` as applied until it has actually been pushed through the normal linked Supabase CLI migration flow after approval.

## Rollback-Only SQL And Storage Verification

Command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/product_media_security.sql
```

If `0008` has not been applied remotely, evaluate `0008_product_media_foundation.sql` and this test together inside one transaction and roll it back.

Expected checks:

1. direct public URL access is not possible because product-images is private
2. product-documents bucket is private
3. unapproved manufacturer cannot upload media metadata
4. approved manufacturer can create media for own draft product
5. manufacturer cannot create media for another manufacturer product
6. manufacturer cannot edit media for submitted product
7. manufacturer cannot delete media for published product
8. manufacturer can edit media for own rejected product
9. manufacturer cannot forge manufacturer storage path
10. anon cannot directly select public.product_media
11. buyer cannot directly select public.product_media public rows
12. buyer cannot read private document media
13. owner manufacturer can select own private media
14. admin can select all private media
15. anonymous cannot read unpublished product media
16. anonymous can read public media for published product
17. public projection excludes created_by
18. public projection excludes private document
19. document visibility can be private
20. document visibility public insert is blocked
21. document visibility update private to public is blocked
22. published_product_media never returns document records
23. published public image can receive a signed URL through the approved flow
24. published_product_media still returns public published images
25. unpublished image cannot receive a public or buyer signed URL
26. visibility private image cannot receive a public or buyer signed URL
27. archived product image cannot receive a public or buyer signed URL
28. admin can view all media
29. admin can manage media for published product
30. direct insert of a document with is_primary true is blocked
31. direct update of a document to is_primary true is blocked
32. direct update of an image to is_primary true is blocked
33. existing primary image remains unchanged after invalid direct primary attempts
34. set-primary RPC can set a valid image primary
35. set-primary RPC is atomic
36. set-primary RPC rejects media from another product
37. set-primary RPC rejects documents
38. failed target validation does not clear current primary image
39. existing primary image remains unchanged after invalid RPC attempt
40. only one primary media item is allowed per product
41. duplicate storage path is blocked
42. invalid visibility is blocked
43. invalid media_type is blocked
44. negative file size is blocked
45. negative sort order is blocked
46. cascade delete removes media records when product is deleted
47. updated_at changes on valid update
48. storage policy blocks upload to another manufacturer path
49. storage policy blocks unauthorized document read
50. storage policy permits valid owner upload to editable product
51. security-definer helper EXECUTE grants are restricted

## Application Checks

```bash
npm ci
npm run build
npm run test
```

## Security Notes

- No service-role key committed:
- Secret scan completed:
- No existing production rows deleted:
- Migration `0006` unchanged:
- Migration `0007` unchanged:
- Migration `0008` not remotely applied before approval:
- No production deployment:
- Public marketplace still uses static prototype data:
- Product-images bucket remains private:
- Private documents require signed URLs:
- Public images require signed URLs:
- Product documents bucket remains private:
- Public media projection excludes internal fields:
- Direct public.product_media access remains owner/admin only:
- Atomic primary image RPC verified:
- Primary image cannot be set through generic table updates:
- Documents are always private:
- Public media projection contains images only:

## Deferred Work

- virus scanning/content inspection:
- image processing/CDN variants:
- public marketplace Supabase media integration:
- quote/payment/shipping:
- PH-005:
