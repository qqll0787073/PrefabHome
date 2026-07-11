# App Architecture

## Directory Structure

The frontend is organized by app shell, shared components, feature modules, and service/data helpers:

```text
src/
  app/
    App.tsx
    constants.ts
  components/
    common/
      ErrorList.tsx
      LoadingState.tsx
      StatusBadge.tsx
    layout/
      AppHeader.tsx
      PortalNavigation.tsx
  features/
    advisor/
      AiAdvisorView.tsx
    auth/
      AuthPanel.tsx
    dashboard/
      PortalDashboard.tsx
    import-center/
      ImportCenterView.tsx
    manufacturers/
      AdminManufacturerReview.tsx
      ManufacturerApplicationForm.tsx
      ManufacturerStatusPanel.tsx
      ManufacturerWorkspace.tsx
    marketplace/
      BrowseView.tsx
      CompareView.tsx
      ProductDetailsPanel.tsx
  lib/
    auth.ts
    authRoles.ts
    format.ts
    manufacturers.ts
    supabase.ts
    supabase.types.ts
  App.tsx
  data.ts
  main.tsx
  styles.css
  types.ts
```

`src/App.tsx` remains as a compatibility export for the existing `src/main.tsx` import. The real application shell lives in `src/app/App.tsx`.

## Component Responsibilities

- `src/app/App.tsx` owns top-level view state, selected role, selected product, saved product ids, and comparison ids.
- `src/components/layout/AppHeader.tsx` renders portal role switching and auth summary/logout controls.
- `src/components/layout/PortalNavigation.tsx` renders the primary view tabs.
- `src/components/common/*` contains small reusable presentation helpers.
- `src/features/auth/AuthPanel.tsx` owns login/register form state and calls the existing auth actions.
- `src/features/marketplace/*` renders browsing, comparison, and product details.
- `src/features/advisor/AiAdvisorView.tsx` renders the current AI advisor placeholder UI.
- `src/features/import-center/ImportCenterView.tsx` renders the current import checklist.
- `src/features/dashboard/PortalDashboard.tsx` preserves role-gated portal behavior and composes manufacturer/admin feature views.
- `src/features/manufacturers/*` owns manufacturer onboarding form state, status display, and admin review UI.

## Data Flow

Static prototype data remains in `src/data.ts` and is passed down from `src/app/App.tsx` into feature views.

Supabase access remains in service/helper modules under `src/lib`:

- `src/lib/auth.ts` handles Supabase Auth, demo auth fallback, session restoration, profile loading, login, registration, and logout.
- `src/lib/manufacturers.ts` handles manufacturer application fetch/create/update/submit/review helpers and validation helpers.
- `src/lib/supabase.ts` owns client initialization from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

UI components call existing service helpers; database authorization behavior remains enforced by Supabase RLS and triggers.

## Auth And Role Flow

`useAuth()` returns the active auth mode, current user, loading/error state, and auth actions. `PortalDashboard` compares the signed-in user role with the selected portal role and preserves the existing protected portal behavior.

Self-service registration remains limited to buyer and manufacturer roles. Admin access remains a supported role but must be granted through the existing operator-controlled process.

Demo mode remains available when Supabase environment variables are missing.

## Manufacturer Onboarding Flow

`ManufacturerWorkspace` keeps manufacturer-specific state close to the feature:

- loads the current user's manufacturer application
- preserves demo fallback behavior
- validates draft vs submit intent
- saves drafts
- submits draft or rejected applications
- preserves locked editing states for submitted, under-review, approved, and suspended applications

`ManufacturerApplicationForm` renders fields only. `ManufacturerStatusPanel` renders status and review metadata. `AdminManufacturerReview` loads all applications visible to an admin and calls the existing review helper.

No database schema, migration, RLS, or trigger behavior changed during this refactor.

## Future Product Database Work

Future Product Database code should be added under a dedicated feature folder, for example:

```text
src/features/products/
  ProductDatabaseView.tsx
  ProductForm.tsx
  ProductTable.tsx
```

Supabase product data access should live in `src/lib/products.ts`, keeping product queries and mutations outside React presentation components. Product database routes or tabs should be introduced from `src/app/App.tsx` or a future router layer after the product requirements are approved.
