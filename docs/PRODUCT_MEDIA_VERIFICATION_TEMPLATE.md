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

1. unapproved manufacturer cannot upload media metadata
2. approved manufacturer can create media for own draft product
3. manufacturer cannot create media for another manufacturer product
4. manufacturer cannot edit media for submitted product
5. manufacturer cannot delete media for published product
6. manufacturer can edit media for own rejected product
7. manufacturer cannot forge manufacturer storage path
8. anonymous cannot read unpublished product media
9. buyer cannot read private document media
10. anonymous can read public media for published product
11. public projection excludes created_by
12. public projection excludes private document
13. admin can view all media
14. admin can manage media for published product
15. only one primary media item is allowed per product
16. duplicate storage path is blocked
17. invalid visibility is blocked
18. invalid media_type is blocked
19. negative file size is blocked
20. negative sort order is blocked
21. cascade delete removes media records when product is deleted
22. updated_at changes on valid update
23. storage policy blocks upload to another manufacturer path
24. storage policy blocks unauthorized document read
25. storage policy permits valid owner upload to editable product

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
- Private documents require signed URLs:
- Product documents bucket remains private:
- Public media projection excludes internal fields:

## Deferred Work

- virus scanning/content inspection:
- image processing/CDN variants:
- public marketplace Supabase media integration:
- quote/payment/shipping:
- PH-005:
