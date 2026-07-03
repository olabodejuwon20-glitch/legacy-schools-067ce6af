---
name: Pending plans backlog
description: Master list of unfinished plans/sprints to resurface every ~5 prompts or when user mentions related topics (performance, S3, super admin, attendance, sprints).
type: feature
---
# Pending Plans — Backlog

Resurface these proactively every ~5 prompts, or whenever the user mentions a related keyword.

## 1. Performance Optimization Plan
Source: `.lovable/plan.md`
Status: not started. Trigger words: "slow", "performance", "bundle", "lag", "cost", "queries".
Highlights:
- DB: paginate `mock_questions`, add indexes (`mock_questions`, `results`, `memberships`, analytics tables).
- Client: batch `page_views`/`auth_events` inserts (flush every 10s / on visibilitychange); cache profile+memberships+school_modules in React Query with staleTime.
- Re-renders: `React.memo` heavy rows; split Auth/Tenant/Theme providers.
- Bundle: `React.lazy` route groups in `src/App.tsx`; `manualChunks` in `vite.config.ts`; lazy-load `exporters.ts`/`reportCard.ts`.
- Verify: re-run slow_queries, bundle report < 500KB initial.

## 2. AWS S3 Storage Migration
Source: `mem/aws-s3-plan.md` (details there).
Status: paused, awaiting user AWS bucket + connector. Trigger words: "S3", "AWS", "storage full", "uploads slow".

## 3. Super Admin V2 — remaining sprints
Sprint 1 (Shell + Dashboard) ✅ done.
Sprint 2 (Customer Workspace / Schools) ✅ done.
Pending sprints (implied by original master brief):
- Sprint 3 — Products workspace (Modules, Licensing, Marketplace, Feature Flags overhaul).
- Sprint 4 — Business workspace (Billing, Subscriptions, Invoices, Revenue analytics).
- Sprint 5 — Operations workspace (Tickets, Announcements, Logs, Errors, Automations).
- Sprint 6 — Intelligence workspace (Analytics deep-dive, AI usage, principal copilot surfacing).
- Sprint 7 — Security & Platform Settings polish (audit, RLS visualiser, tenant config).
Trigger words: "super admin", "sprint", "workspace", "modules page", "billing page".

## 4. Full Attendance System — phases 2-6
Source: `docs/ROADMAP.md`. Phase 1 (daily roll) shipped.
- Phase 2: Excuse & justification workflow (parent submits, admin approves).
- Phase 3: Per-period attendance (school-level `daily` vs `period` mode, timetable integration).
- Phase 4: Biometric / QR / RFID kiosk check-in with offline queue.
- Phase 5: Automated parent alerts (AI thresholds → push/SMS/WhatsApp).
- Phase 6: Analytics & truancy insights, term-slip integration.
Trigger words: "attendance", "roll call", "truancy", "kiosk", "biometric".

## Resurface protocol
Every ~5 user prompts (or on trigger words), post a short reminder:
"Reminder — pending plans: Performance, S3 migration, Super Admin Sprints 3-7, Attendance phases 2-6. Want to pick one up?"