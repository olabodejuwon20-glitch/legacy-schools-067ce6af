# Super Admin V2 — Sprint 3: Products Workspace

Sprints 1 (Shell + Dashboard) and 2 (Customer Workspace) are done. Sprint 3 unifies the four product-management surfaces into a single Linear/Vercel-style workspace that matches the Sprint 1 shell.

## Goal
Turn Modules, Licensing, Marketplace, and Feature Flags into one cohesive "Products" workspace where a super admin can see every product/module the platform ships, control who gets it, price it, and toggle experiments — all from split-pane views consistent with the Schools workspace.

## Scope

### 1. Products landing (`/super/products`)
- New top-level nav entry "Products" (replaces separate Modules/Marketplace/Licensing/Flags items in the sidebar; keep old routes as redirects so nothing breaks).
- 4 tabs: **Modules · Marketplace · Licensing · Feature Flags**.
- Sticky header with search + primary action per tab.
- Insight strip (reuse `InsightsCards`): total modules, active installs, MRR from paid modules, flags in rollout.

### 2. Modules tab
- Split-pane: left list of `modules` rows (name, category, status pill, install count). Right detail panel: description, pricing tier, dependencies, per-school adoption chart (mock where no data), enable/disable, edit metadata.
- Bulk actions: publish / archive / feature.

### 3. Marketplace tab
- Card grid of published modules with hero, tagline, install count, price.
- Detail drawer: screenshots (mock), changelog, requesting schools (`module_requests`).
- Approve/reject `module_requests` inline.

### 4. Licensing tab
- Table of `plan_pricing` × `payment_plans` with edit-in-place.
- Right panel: per-plan school count, MRR, churn (mock what's missing).
- Action: create/duplicate plan.

### 5. Feature Flags tab
- Two lists: **Global** (`feature_flags`) and **Per-school overrides** (`school_feature_flags`).
- Split-pane: flag key, description, rollout %, status. Detail shows targeted schools, recent toggles, quick rollout slider.

## UX rules
- Same shell, breadcrumbs, sticky header, empty/loading states as Sprint 2.
- Split-pane everywhere, no modal-heavy editing.
- Reuse `SectionCard`, `StatCard`, `InsightsCards`, `QuickActionsBar`, `SchoolBadges` primitives.
- Mock data only where backend endpoints truly don't exist; wire everything else to Supabase.

## Technical section
- New page: `src/pages/super/Products.tsx` with tabbed router-state (`?tab=modules|marketplace|licensing|flags`).
- Extract per-tab views into `src/components/super/products/{ModulesTab,MarketplaceTab,LicensingTab,FlagsTab}.tsx`.
- Shared list/detail primitive: `src/components/super/SplitPane.tsx` (generic, reused by future sprints).
- Update `src/layouts/SuperLayout.tsx` nav: single "Products" entry; keep `/super/modules`, `/super/marketplace`, `/super/licensing`, `/super/feature-flags` as `<Navigate>` redirects to `/super/products?tab=…` so no external link breaks.
- Data sources: existing tables `modules`, `module_requests`, `plan_pricing`, `payment_plans`, `feature_flags`, `school_feature_flags`, `school_modules`. No schema changes this sprint.
- Guard: `is_super_admin` already enforced by RLS + `SuperLayout`.
- No changes to auth, routing outside super area, or existing module/feature-flag business logic.

## Out of scope
- Sprints 4-7 (Business, Operations, Intelligence, Security).
- New DB tables (only reads/updates on existing ones).
- Payment integration changes.

## Deliverable
One PR-sized change adding the Products workspace, redirecting the four legacy routes, and updating the sidebar — nothing else touched.