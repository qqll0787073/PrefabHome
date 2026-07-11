# Product Database Verification Template

Use this template after PH-003 review approval and before any production release.

## Branch And Commit

- Branch:
- Commit:
- Reviewer approval:

## Migration

- Migration file: `supabase/migrations/0007_product_database_foundation.sql`
- Applied to linked Supabase project: yes/no
- Linked project ref:
- Command:

```bash
npx.cmd supabase db push --yes
```

Do not mark the migration as applied until it has actually been pushed through the normal linked Supabase CLI migration flow.

## Rollback-Only Security Verification

Command:

```bash
npx.cmd supabase db query --linked --file supabase/tests/product_database_security.sql
```

Expected checks:

1. unapproved manufacturer cannot create product
2. approved manufacturer can create own draft
3. manufacturer cannot create product for another manufacturer
4. manufacturer can edit own draft
5. manufacturer can submit own draft
6. manufacturer cannot edit submitted product
7. manufacturer cannot self-publish
8. manufacturer cannot change manufacturer_id
9. manufacturer cannot read another manufacturer's private draft
10. manufacturer can read another manufacturer's published product through `published_products`
11. buyer can read published product only through public projection
12. anonymous user can read published product only through public projection
13. admin can review all products
14. admin can perform submitted -> published
15. published_at is set on publication
16. admin can perform submitted -> rejected
17. archived products are hidden from public queries
18. admin can perform published -> archived
19. admin can perform rejected -> draft
20. rejected -> draft clears review workflow fields
21. admin cannot perform draft -> published
22. admin cannot perform draft -> archived
23. admin cannot perform archived -> rejected
24. admin cannot perform archived -> published
25. admin cannot perform published -> draft
26. admin cannot perform rejected -> published
27. anonymous user can read approved public fields from a published product
28. anonymous user cannot select notes
29. anonymous user cannot select review_notes
30. anonymous user cannot select reviewed_by/reviewed_at
31. buyer public query cannot expose private fields
32. manufacturer private product query still works
33. admin private product query still works
34. duplicate SKU per manufacturer is blocked
35. same SKU for different manufacturers is allowed
36. invalid negative price/dimensions are blocked
37. invalid status transition is blocked
38. updated_at changes on valid update

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
- `0007` was not applied remotely before approval:
- `0006` was not modified:
- No production deployment:
- Product public queries use `public.published_products`:
- Anonymous users cannot directly select internal fields from the public projection:
- Buyers use `PublicProductRecord`; manufacturer/admin code uses private `ProductRecord`:

## Admin Transition Matrix

Legal admin lifecycle transitions:

- `submitted` -> `published`
- `submitted` -> `rejected`
- `published` -> `archived`
- `rejected` -> `draft`
- same-status review edits

All other status changes must fail at service/UI level and at `public.manage_product_lifecycle()`.

## Public And Private Product Access

- Public/buyer listing reads: `public.published_products`
- Manufacturer private reads/writes: `public.products` under RLS
- Admin review reads/writes: `public.products` under RLS
- Public TypeScript type: `PublicProductRecord`
- Private TypeScript type: `ProductRecord`

## Deferred Work

- Storage:
- images:
- documents:
- public marketplace Supabase migration:
- search:
- quote workflow:
