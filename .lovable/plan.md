# Super Admin Console — Complete Build Plan

The **Super Admin** (a.k.a. Platform Admin) is the internal LegacyKool staff console — the mission-control panel our CTO, ops, support and finance team use to run the entire multi-tenant platform. It is **not** the School Admin (which is the per-school tenant console).

This plan captures the full scope, split into 7 sprints. Sprints 1–3 are the current baseline; 4–7 are the remaining build.

---

## Guiding principles

- **Linear/Vercel dark shell** — dense, keyboard-first, split-pane over modals.
- **One shell, many workspaces** — same sidebar, breadcrumbs, sticky header, empty/loading states everywhere.
- **Impersonation always visible** — staff should never guess "am I acting as myself or as a school?"
- **Read-mostly, write-carefully** — destructive actions confirm; every mutation writes to `platform_audit`.
- **Reuse primitives** — `SectionCard`, `StatCard`, `InsightsCards`, `QuickActionsBar`, `SplitPane`, `SchoolBadges`.
- **No schema churn unless a sprint explicitly needs it.** Existing tables cover most surfaces.

---

## Sprint status overview

```text
Sprint 1  Shell + Dashboard              DONE
Sprint 2  Customers (Schools) workspace  DONE
Sprint 3  Products workspace             DONE
Sprint 4  Business (Revenue & Growth)    NEXT
Sprint 5  Operations (Support & Health)   DONE
Sprint 6  Intelligence (Analytics & AI)   DONE
Sprint 7  Security & Staff governance
```

---

## Sprint 1 — Shell + Dashboard  *(done)*

Global chrome that every other sprint plugs into.

- `SuperLayout`: left rail, top bar with global search, tenant switcher, ⌘K palette, user menu.
- `/super` dashboard: KPI hero (schools, MRR, active users, incidents), live tenant list, recent staff actions, system status strip.
- Route guard via `is_super_admin` + RLS.

## Sprint 2 — Customers (Schools) workspace  *(done)*

Everything about a tenant lives here.

- `/super/schools` directory: searchable table, plan/status filters, bulk actions.
- School detail split-pane: profile, plan, users, modules enabled, billing, activity, impersonate button.
- Wired to `schools`, `memberships`, `subscriptions`, `school_modules`, `school_payments`, `platform_audit`.

## Sprint 3 — Products workspace  *(done)*

- `/super/products` with 4 tabs: Modules · Marketplace · Licensing · Feature Flags.
- Split-pane list/detail per tab; legacy routes redirect in.
- Reads/writes: `modules`, `module_requests`, `plan_pricing`, `payment_plans`, `feature_flags`, `school_feature_flags`.

---

## Sprint 4 — Business (Revenue & Growth)  *(next)*

**Goal:** one place for finance and growth to see money in, money out, and pipeline.

Route: `/super/business` with tabs **Revenue · Invoices · Plans · Pilots · Growth**.

- **Revenue** — MRR/ARR chart, churn, expansion, top-paying schools; drill-down drawer.
- **Invoices** — `school_invoices` table with status filters, resend, mark paid, refund action; per-invoice drawer with line items from `invoices`.
- **Plans** — read-only summary of pricing (edits still live in Products → Licensing) plus per-plan cohort revenue.
- **Pilots** — `/super/pilots` folded in: pilot schools, start/end dates, conversion outcome, notes.
- **Growth** — signup funnel from `onboarding_events`, invite redemption from `invite_codes` / `invite_redeem_attempts`, referral sources.

Insight strip: MRR, net new MRR (30d), overdue invoices, active pilots, trial→paid conversion.

## Sprint 5 — Operations (Support & Health)

**Goal:** the queue our support + on-call staff live in.

Route: `/super/operations` with tabs **Tickets · Incidents · Announcements · System Health · Logs**.

- **Tickets** — `support_tickets` inbox split-pane: list left, conversation right (`support_messages`), assign/close/tag, category from `support_ticket_categories`. Reply UI + canned responses.
- **Incidents** — `client_errors` grouped by fingerprint, severity, first/last seen, affected schools; assign + resolve; link to a ticket.
- **Announcements** — CRUD on `platform_announcements`: target all schools, plan tier, or specific schools; schedule + preview.
- **System Health** — edge-function status, DB slow queries surface, `auth_events` failure rate, `rate_limits` hot keys.
- **Logs** — filtered `platform_audit` + `security_events` explorer with saved views.

Insight strip: open tickets, P1 incidents, error rate 24h, announcements live.

## Sprint 6 — Intelligence (Analytics & AI)

**Goal:** how the product is actually used, and what AI is costing us.

Route: `/super/intelligence` with tabs **Product Analytics · AI Usage · Content Quality · Cohorts**.

- **Product Analytics** — `page_views`, feature adoption per module, DAU/WAU/MAU by school, retention curve.
- **AI Usage** — `ai_jobs`, `ai_cache` hit rate, per-school spend vs `school_ai_quotas`, model mix from `ai_model_routing`, approval queue `ai_approvals`.
- **Content Quality** — `question_bank` coverage by subject/level, flagged questions, `assessment_violations_v2` trends, `exam_appeals` volume.
- **Cohorts** — signup cohort retention, plan-tier engagement, at-risk schools (drop in activity).

Insight strip: DAU, AI cost 7d, cache hit %, at-risk schools.

## Sprint 7 — Security & Staff governance

**Goal:** lock down the console itself and give leadership auditability.

Route: `/super/security` with tabs **Staff · Roles · Sessions · Audit · Policies**.

- **Staff** — everyone with a super-admin slot (`admin_role_slots`), invite/remove, last active, MFA status.
- **Roles** — role matrix for internal staff (super_admin, support, finance, read-only, on-call) — permission grid preview, no schema change unless we outgrow `user_roles`.
- **Sessions** — active staff sessions + `impersonation_sessions` log with end-session button.
- **Audit** — full-text search over `platform_audit`, `auth_events`, `security_events`; export CSV.
- **Policies** — global toggles from `platform_settings` (signups open, maintenance mode, default plan, email sender).

Insight strip: staff without MFA, active impersonations, security events 24h, last policy change.

---

## Cross-cutting deliverables (spread across sprints)

- **⌘K command palette** actions expand each sprint (jump to school, open ticket, toggle flag, start impersonation).
- **Global tenant switcher** enriched with recency + pinned schools.
- **Notification bell** in top bar for P1 incidents, overdue invoices, ticket SLA breach.
- **Every mutation** writes a `platform_audit` row with actor, target, before/after.
- **Impersonation banner** persists across all pages while a session is active.

## Technical section

- All routes live under `src/pages/super/*` and mount inside `SuperLayout`.
- Shared primitives already present: `SplitPane`, `SectionCard`, `StatCard`, `InsightsCards`, `QuickActionsBar`, `SchoolBadges`. New sprints add `RevenueChart`, `TicketThread`, `AuditTable`, `AIQuotaMeter` as needed.
- Data layer: direct Supabase queries via `@/integrations/supabase/client`; heavier aggregates go through SQL views or edge functions (`super-*`).
- Guards: `is_super_admin` at RLS + layout; sensitive mutations additionally check role in `admin_role_slots`.
- No new tables required for Sprints 4–6. Sprint 7 may add a `staff_mfa_status` view; decide during that sprint.
- Legacy per-feature routes (`/super/tickets`, `/super/announcements`, `/super/billing`, `/super/analytics`, `/super/security`, `/super/settings`, `/super/pilots`, `/super/errors`, `/super/logs`, `/super/quotas`, `/super/tenant-config`, `/super/subscriptions`) redirect into their new workspace tabs, same pattern as Sprint 3.
- No changes to School Admin, auth flows, or student/teacher surfaces.

## Out of scope for this plan

- Public marketing site, School Admin console, mobile apps.
- Payment provider swaps (Stripe/Paddle stays as-is).
- New AI models or prompt changes.

## Deliverable per sprint

One PR-sized workspace per sprint, mounted into the existing shell, with legacy routes redirecting in and a `platform_audit` trail on every write.
