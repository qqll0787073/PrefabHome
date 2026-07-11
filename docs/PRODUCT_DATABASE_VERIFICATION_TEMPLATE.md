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
10. manufacturer can read another manufacturer's published product
11. buyer can read published product only
12. anonymous user can read published product only
13. admin can review all products
14. admin can publish submitted product
15. published_at is set on publication
16. admin can reject submitted product
17. archived products are hidden from public queries
18. duplicate SKU per manufacturer is blocked
19. same SKU for different manufacturers is allowed
20. invalid negative price/dimensions are blocked
21. invalid status transition is blocked
22. updated_at changes on valid update

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
- Product public queries expose only intended published product fields:

## Deferred Work

- Storage:
- images:
- documents:
- public marketplace Supabase migration:
- search:
- quote workflow:
