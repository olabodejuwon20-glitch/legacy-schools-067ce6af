# Legacyskool — Master Project Handoff Document

**Audience:** an AI coding agent (Cursor / Google Antigravity) taking over development outside Lovable.
**Generated:** 2026-09-22 (UTC) from the live codebase + generated DB types.
**Product name:** Legacyskool (brand also written "LegacyKool"/"Legacy Schools" in places).
**Domains:** `https://legacy-schools.lovable.app` (published), `www.legacyschools.study` (custom domain, DNS initiated, not yet live).
**Support email:** `Support@legacyschools.study`

> READ THIS FIRST — three facts that will save the next agent hours:
> 1. **The database schema is NOT in the repo.** `drizzle/migrations/` contains exactly one migration (`0000_mock_question_topic_tagger.sql`). Every other table, RLS policy, function and trigger was applied directly to the hosted Postgres by the Lovable Cloud tooling. The only in-repo source of schema truth is the generated file `src/integrations/supabase/types.ts` (9,096 lines, 146 tables, 3 views, ~140 RPC functions, 30+ enums). **Before doing anything else, dump the real schema** (`pg_dump --schema-only`) from the Supabase project and commit it. Instructions in §7.4.
> 2. **The backend is a real Supabase project** (`project ref: fiigsvxlxaqyzcvykkvw`, region default, one instance serves both preview and production). Lovable Cloud is just a management wrapper. Once you own the Supabase project directly you keep the database, auth users, storage buckets and all 46 edge functions. Nothing needs re-platforming.
> 3. **All business logic that matters for security lives in Postgres**, not in React. ~140 `SECURITY DEFINER` RPCs + RLS policies enforce multi-tenancy. The React app is a thin, trusting client. Do not "move logic to the frontend."

---

## 1. Project Overview & Evolution

### 1.1 Core purpose

Legacyskool is a **multi-tenant School Management Operating System for Nigerian schools**. One deployment serves many schools ("tenants"); each school gets a slug-scoped portal (`/<school-slug>/...`) with four+ role-specific portals (admin, teacher, student, parent, plus `driver` and generic `staff` roles) and a separate internal **Super Admin** console at `/super` for the platform operator (the company/CTO).

Currency is NGN, stored everywhere in **kobo** (integer). Exam simulation targets the Nigerian exam bodies: **JAMB / WAEC / NECO**, plus internal school exams.

### 1.2 The five core product pillars (all shipped, in priority order)

From `docs/ROADMAP.md`:

1. **CBT & exam simulation** — internal exams + JAMB/NECO/WAEC mocks, questions sourced from the ALOC question-bank API.
2. **Attendance & student organisation** — daily attendance, classes, arms, enrolments.
3. **Digital CA, tests & results** — continuous assessment, term reports, QR-verifiable result slips.
4. **Online payments** — invoicing, Paystack checkout, offline payment recording with uploaded proof.
5. **AI for teachers, students & operations** — lesson-note generator, AI tutor, AI grading assists, principal copilot, daily platform intelligence.

### 1.3 Evolution — build journey in order

This is the real chronology, reconstructed from the development history:

**Phase A — Tenancy + auth foundation.** `schools` / `memberships` / `profiles` tables, slug-based tenant resolution (`src/lib/tenant.ts`), `SchoolContext` provider, `RequireAuth` / `RequireSchool` / `RoleGate` guards, invite-code join flow, PIN-based student/parent onboarding (`must_change_pin`, `bio_completed` gates).

**Phase B — Academic core.** Classes → the richer `academic_levels` / `academic_arms` / `academic_subjects` / `arm_enrollments` model layered on top of the original flat `classes` / `class_enrollments` (both still exist — see technical debt §6.3). Attendance, timetable, gradebook, grading scales, term weights, results, promotion rules.

**Phase C — CBT/exams.** Three parallel exam systems grew up (see §4.3 — this is the single biggest source of confusion in the codebase):
- `exams` / `exam_questions` / `exam_attempts` / `exam_answers` — the original internal CBT.
- `assessments` / `assessment_sections` / `assessment_structures` / `assessment_results` — the "v2" assessment engine with draft→review→publish workflow.
- `mock_*` — JAMB/WAEC/NECO mock simulation with multi-subject sessions.
- `trad_*` — "traditional" paper/theory exams with committee approval workflow, scratch-card result unlocking, theory grading queues, timetables.

**Phase D — Payments & subscriptions.** Two separate money systems: school→platform subscription billing (`invoices`, `subscriptions`, `plan_pricing`) and parent→school fee billing (`payment_types`, `school_invoices`, `school_payments`). Both via Paystack, currently on **TEST keys** (see §5.1 and §6.2 — this is a launch blocker).

**Phase E — AI layer.** Lovable AI Gateway (Gemini models) behind `supabase/functions/_shared/ai-call.ts` with caching (`ai_cache`), per-school quotas (`school_ai_quotas`), model routing (`ai_model_routing`), and RAG (`knowledge_documents` / `knowledge_chunks` / `match_knowledge_chunks` with pgvector).

**Phase F — Super Admin Console V2** (7 sprints, sprints 1–7 shipped). Consolidated the old one-page-per-concern super admin into five workspaces: Customers (Schools/Users), Products, Business, Operations, Intelligence — plus Security, Settings, Trash. Old routes now `Navigate`-redirect into the right workspace tab (see `src/App.tsx` lines ~250-277).

**Phase G — Polish & hardening passes.** Sidebar simplification (max 8 hubs per portal, `src/layouts/portalNav.ts`); unified branded export system (PDF/Word/CSV with per-school branding); global Cmd+K command palette; soft-delete/trash with 30-day `pg_cron` purge; client error reporting into the super admin; PWA/offline; MCP server exposure; repeated security-scan remediation rounds on RLS.

**Phase H — Exam UX redesign.** A dedicated `src/components/exam/` component library (distraction-free "testing appliance"), untimed practice runner, per-topic accuracy analytics, resumable CBT sessions.

### 1.4 Future roadmap (explicitly agreed, not yet built)

Tracked in `mem/pending-plans.md`, `docs/ROADMAP.md`, `mem/aws-s3-plan.md`:

1. **Performance optimization plan** (not started): paginate `mock_questions`; add indexes on `mock_questions`, `results`, `memberships`, analytics tables; batch `page_views`/`auth_events` inserts (flush every 10s + on `visibilitychange`); React Query `staleTime` caching for profile/memberships/school_modules; `React.memo` heavy rows; split Auth/Tenant/Theme providers; `React.lazy` route groups; lazy-load `exporters.ts`/`reportCard.ts`; target initial bundle < 500KB.
2. **AWS S3 storage migration** (paused, awaits user's AWS bucket) — move uploads off Supabase Storage.
3. **Attendance phases 2–6**: excuse/justification workflow; per-period attendance (`daily` vs `period` school mode + timetable integration); biometric/QR/RFID kiosk check-in with offline sync queue; automated parent alerts with configurable thresholds → push/SMS/WhatsApp; truancy analytics & heat-maps, attendance on term slips.
4. **Deferred / unscoped**: native mobile shells over the PWA; predictive performance analytics; public APIs & webhooks for state ministries and exam bodies; multi-currency & multi-language beyond NGN/English.

---

## 2. System Architecture & Tech Stack

### 2.1 Frontend stack (exact, from `package.json`)

| Concern | Choice | Version | Why |
|---|---|---|---|
| Framework | React | ^18.3.1 | SPA, no SSR needed (all content is behind auth) |
| Build | Vite | ^5.4.19 | fast HMR; `@vitejs/plugin-react-swc` for SWC transform |
| Language | TypeScript | ^5.8.3 | DB types generated from Postgres → end-to-end typing |
| Routing | react-router-dom | 7.9.4 | nested routes + slug params for tenancy |
| Server state | @tanstack/react-query | ^5.83.0 | **all** data fetching/caching; no Redux anywhere |
| Client state | React Context | — | exactly one global context: `SchoolContext` |
| UI primitives | Radix UI + shadcn/ui | various | every `src/components/ui/*` file is a shadcn component |
| Styling | Tailwind CSS | ^3.4.17 | + `tailwindcss-animate`, `@tailwindcss/typography` |
| Icons | lucide-react | ^0.462.0 | |
| Forms | react-hook-form + zod + @hookform/resolvers | | |
| Charts | recharts | ^2.15.4 | super-admin + school analytics |
| Animation | framer-motion | ^12.42.2 | landing page + transitions |
| Command palette | cmdk | ^1.1.1 | global Cmd+K search |
| Toasts | sonner + Radix toast | | `sonner` is the primary |
| Docs export | docx ^9.7.1 | | native `.docx` generation (see §4.7) |
| PDF export | browser print pipeline | — | no pdf lib; branded HTML → `window.print()` |
| Maps | leaflet + react-leaflet 4.2.1 | | bus/transport live tracking |
| Math | katex + @types/katex | | exam question rendering (`src/components/exam/Math.tsx`) |
| Markdown | react-markdown + remark-gfm + rehype-highlight | | AI output rendering |
| QR | qrcode ^1.5.4 | | result-slip verification codes |
| Zip | jszip | | bulk export bundles |
| PWA | vite-plugin-pwa ^1.3.0 | | offline shell + Supabase GET caching |
| SEO | react-helmet-async | | `src/components/SEO.tsx`, `TenantHead.tsx` |
| MCP | @lovable.dev/mcp-js ^0.20.0 | | exposes the app as an MCP server (§5.4) |
| Backend SDK | @supabase/supabase-js ^2.105.3 | | |
| Migrations | drizzle-kit ^0.31.10 + postgres ^3.4.9 | | **migration runner only — no ORM models** |
| Tests | vitest ^3.2.4 + @testing-library/react + jsdom | | only one real test file exists (§6.3) |

**Deliberate non-choices:** no Next.js (no SSR need, and Lovable only supports Vite/React); no Redux/Zustand/Jotai (React Query covers server state; one context covers session/tenant/theme); no ORM (all queries go through PostgREST or `SECURITY DEFINER` RPCs so RLS is always in force); no pdfmake/jspdf (branded HTML + print gives perfect font/logo fidelity and zero bundle cost).

### 2.2 Entry point & provider tree

`src/main.tsx`:
```tsx
void registerAppSW();              // PWA service worker
installGlobalErrorReporter();      // window.onerror/unhandledrejection -> report_client_error RPC
installUserSafeToasts();           // sanitises raw DB/HTTP errors before they reach the user

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </HelmetProvider>
);
```

`src/App.tsx` (34KB — the routing hub) wraps everything in `QueryClientProvider` → `SchoolProvider` → `TooltipProvider` → `BrowserRouter`, mounts `<Toaster/>`, `<AnalyticsTracker/>`, `<RealtimeNotifier/>`, `<ImpersonationBanner/>`, `<PWAInstallPrompt/>`, `<GlobalSearch/>` and defines every route with `React.lazy` for the page components.

### 2.3 Routing architecture

Three route families:

**A. Public / platform root**
```
/                        Landing
/register                School registration (creates a tenant)
/signin                  Platform-level sign-in
/verify/:id              Public QR result-slip verification
/privacy /terms /refer   Static
/subscription/callback   Paystack return URL for platform subscriptions
/.lovable/oauth/consent  OAuth consent screen for the MCP server
/app/*  /admin/*         Slugless legacy redirects -> /<slug>/app...
```

**B. Super Admin console** — `/super` with `SuperLayout` (permanent, non-collapsing sidebar; all menus visible; seamless scroll):
```
/super                  Dashboard (KPIs + AI DailyIntel)
/super/claim            Bootstrap first super_admin
/super/schools          Tenant directory
/super/schools/:id      Tenant detail (timeline, health gauge, badges, impersonate)
/super/users            School-first drill-down: school -> role tab -> user
/super/products         Modules | Licensing | Marketplace | Feature flags
/super/configurations   Per-tenant config
/super/business         Revenue | Plans | Growth | Invoices | Pilots
/super/subscriptions
/super/operations       Tickets | Incidents | Announcements | System health | Logs
/super/intelligence     Product analytics | AI usage | Content quality
/super/security
/super/settings
/super/academic-defaults
/super/trash            Soft-deleted records, restore / purge now
# Legacy routes -> <Navigate> into the workspace tabs above:
/super/modules /licensing /marketplace /billing /pilots /announcements
/super/tickets /errors /logs /quotas /analytics /feature-flags
```

**C. Tenant routes** — everything school-scoped is prefixed by the slug:
```
/:slug                   SchoolHome (public school landing)
/:slug/signin            Student/teacher/parent sign-in
/:slug/admin             School-admin sign-in (separate screen)
/:slug/join              Invite-code / QR join
/:slug/change-pin        Forced when memberships.must_change_pin
/:slug/bio               Forced when memberships.bio_completed = false (non-admins)
/:slug/onboarding        Admin first-run wizard
/:slug/app/*             The authenticated app shell (AppLayout)
```

`/:slug/app` is guarded as `RequireSchool` → `OnboardingGate` → `AppLayout`, and every child route is additionally wrapped in `RoleGate allow="admin|teacher|student|parent"`, with some wrapped in `PremiumGate` (paid-plan features: Advanced Reports, Proctoring, Principal Copilot). Child paths are `admin/*`, `teacher/*`, `student/*`, `parent/*`, plus shared `communication/*`, `library`, `inbox`, `profile`, `help`.

### 2.4 Guard chain (`src/components/Guards.tsx`) — read this verbatim

```tsx
RequireAuth   : loading -> spinner; no user -> /<slug>/signin
RequireSchool : loading -> spinner
                no user            -> /<slug>/signin
                no resolved school -> /
                no activeRole      -> /<slug>
                must_change_pin    -> /<slug>/change-pin
                bio_completed===false && role!=="admin" -> /<slug>/bio
                else -> <PortalAccessGate>{children}</PortalAccessGate>
RoleGate      : role not in allow -> /<slug>/app
```

`PortalAccessGate` implements the school-controlled **portal open/close switch**: a school admin can close the portal for students/teachers/parents/staff/drivers with a custom closing message; the admin portal itself is never blocked. The switch + message live in `schools.settings` (JSON) and are edited in `src/pages/admin/Settings.tsx` → "Portal access" tab.

### 2.5 Tenant resolution (`src/lib/tenant.ts`)

Slug resolution order: `?school=` query param → first path segment (unless in `RESERVED` = `register, signin, auth, app, bio, join, change-pin, admin-signin, api, assets, favicon.ico, super`) → `localStorage["legacyskool:last-school-slug"]`. Helpers: `schoolPath(slug, path)`, `buildSchoolUrl`, `buildRootUrl`, `tenantHomePath`, `storeSchoolSlug`.

### 2.6 The one global context — `src/contexts/SchoolContext.tsx`

Exposes: `user, session, loading, displayName, email, photoUrl, school, schoolLoading, memberships, activeRole, theme, toggleTheme, refreshMemberships, refreshProfile, signOut`.

Behaviour worth knowing:
- Resolves the school via RPC `get_school_by_slug(_slug)` (works for signed-out visitors).
- If no slug is resolvable but the user has memberships, it falls back to `memberships[0].school_id`.
- `activeRole` = the role of the current user **within the currently resolved school**. A user can hold different roles in different schools.
- `onAuthStateChange` handler defers profile/membership loading via `setTimeout(...,0)` — **this is deliberate**: calling Supabase inside the auth callback synchronously deadlocks the client.
- Theme is a `dark` class on `documentElement`, persisted in `localStorage["edusmart-theme"]` (legacy key name).
- `ROLE_META` maps each role to display name, colour token and portal label.

### 2.7 Navigation model — `src/layouts/portalNav.ts`

Single source of truth: `PORTAL_NAV: Record<Role, NavHub[]>`, where `NavHub = { key, label, icon, to?, tabs: NavTab[] }`. **Hard product rule: max 8 sidebar hubs per role.** Related pages are `tabs` inside a hub and render in a secondary horizontal tab bar under the page header (horizontally scrollable on mobile via `overflow-x-auto` + the `no-scrollbar` utility in `src/index.css`).

Admin hubs: Dashboard, People, Academics, Assessments, Library, Finance, Communication, Settings (8).

### 2.8 Module system — `src/modules/`

- `registry.ts` — in-repo `MODULE_MANIFESTS: ModuleManifest[]`; each manifest has `slug` (matching a `public.modules` row), `name`, `category`, `icon`, `core: boolean`, `defaultConfig`, and a `sidebar[]` of `{ label, to, icon, roles[] }`.
- `useModules.ts` — `useEnabledModules(schoolId)` joins `school_modules` → `modules`. Resolution rule: `core` manifests are always on; otherwise a DB row's `enabled` wins; **if no row exists the module defaults to ON** (backwards compatibility for unprovisioned schools). Config = `{...manifest.defaultConfig, ...row.config}`. `useModuleConfig<T>(schoolId, slug)` reads a single module's merged config.

---

## 3. Database & Backend (Supabase)

**Project ref:** `fiigsvxlxaqyzcvykkvw` · **anon key** is public and committed in `.env` (safe — RLS enforces everything).
**Counts:** 146 tables, 3 views, ~140 RPC functions, 33 enums, 46 edge functions.

> Authoritative schema reference in-repo: `src/integrations/supabase/types.ts`. It lists, per table, the exact `Row`, `Insert`, `Update` shapes **and every foreign-key relationship** in the `Relationships` array. Regenerate with the Supabase CLI: `supabase gen types typescript --project-id fiigsvxlxaqyzcvykkvw > src/integrations/supabase/types.ts`.

### 3.1 Enums (complete list)

```
app_role               : admin | teacher | student | parent | super_admin
member_role            : admin | teacher | student | parent | driver | staff
school_plan            : trial | basic | standard | premium | enterprise
school_status          : active | suspended | expired | trial
attendance_status      : present | absent | late | excused
assessment_delivery    : proctored | open | practice
assessment_source      : manual | question_bank | ai_generated | mixed
assessment_status_v2   : draft | in_review | scheduled | published | archived
assessment_type        : school_test | school_exam | jamb_mock | neco_mock | waec_mock | ai_assessment
attempt_status         : in_progress | submitted | expired | voided
bank_scope             : school | global
exam_body              : jamb | waec | neco | school | generic
exam_mode              : neco_sim | school | practice
exam_status            : draft | scheduled | active | closed
question_type          : mcq | multi | short | essay | numeric
question_difficulty    : easy | medium | hard
fee_status             : pending | paid | overdue
invoice_status         : pending | partial | paid | overdue | waived | cancelled
payment_audience       : school | level | class | custom
payment_category       : tuition | levy | uniform | exam | hostel | transport | excursion | book | other
payment_method         : paystack | cash | bank_transfer | pos | waiver
payment_recurrence     : one_off | termly | sessional | monthly
payment_status         : initiated | successful | failed | refunded
trad_draft_status      : draft | submitted | approved | (+rejected/published)
trad_exam_type         : mcq | theory | mixed
trad_question_type     : mcq | theory
trad_session_status    : planning | published | locked
trad_timetable_status  : draft | pending | approved
trad_upload_status     : pending | parsing | parsed | failed
```

### 3.2 Table inventory by domain (all 146)

**Tenancy & identity (7):** `schools`, `memberships`, `profiles`, `user_roles`, `admin_role_slots`, `school_custom_roles`, `invite_codes` (+ `invite_redeem_attempts`).

**Academic structure (13):** `academic_levels`, `academic_arms`, `academic_departments`, `academic_subjects`, `academic_calendar`, `academic_policies`, `academic_policy_defaults`, `academic_promotion_rules`, `academic_templates`, `school_academic_structure`, `arm_enrollments`, `subject_arm_assignments`, `teacher_subject_arm`.

**Legacy flat academic (5, still live):** `classes`, `class_enrollments`, `class_subject_teachers`, `subjects`, `student_subjects`, `promotion_rules`.

**Teaching & daily ops (10):** `attendance`, `timetable`, `gradebook_entries`, `grading_scales`, `term_grade_weights`, `assignments`, `assignment_submissions`, `behavior_notes`, `lesson_notes`, `lesson_plans`, `library_files`.

**Assessment engine v2 (8):** `assessments`, `assessment_sections`, `assessment_structures`, `assessment_results`, `assessment_legacy_map`, `marking_rubrics`, `question_banks`, `question_bank`, `question_bank_versions`, `question_tags`.

**CBT exams v1 (8):** `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, `exam_approvals`, `exam_appeals`, `exam_audit_entries`, `exam_review_events`, `exam_violations`.

**Mock exams / JAMB-WAEC-NECO sim (5):** `mock_subjects`, `mock_questions`, `mock_sessions`, `mock_session_subjects`, `mock_answers`.

**Traditional / theory exams (14):** `trad_exams`, `trad_exam_sections`, `trad_exam_questions`, `trad_exam_attempts`, `trad_exam_answers`, `trad_exam_results`, `trad_exam_sessions`, `trad_exam_timetable`, `trad_exam_uploads`, `trad_result_unlocks`, `trad_scratch_batches`, `trad_scratch_cards`, `trad_scratch_purchases`.

**Results & reporting (5):** `results`, `result_release_rules`, `result_verifications`, `student_topic_mastery`, `student_assessments_v` (view).

**Money — school→platform (6):** `invoices`, `subscriptions`, `plan_pricing`, `payment_plans`, `platform_settings`.

**Money — parent→school (4):** `payment_types`, `school_invoices`, `school_payments`, `school_payment_settings`, `fees`.

**Communication (14):** `conversations`, `conversation_messages`, `conversation_participants`, `messages`, `inbox_stars`, `announcements`, `announcement_reads`, `platform_announcements`, `broadcast_jobs`, `broadcast_deliveries`, `comms_templates`, `comms_events`, `parent_comms`, `parent_alerts`, `parent_links`, `notify` targets.

**AI (9):** `ai_chats`, `ai_conversations`, `ai_jobs`, `ai_cache`, `ai_approvals`, `ai_model_routing`, `school_ai_quotas`, `knowledge_documents`, `knowledge_chunks`.

**Transport (7):** `transport_routes`, `transport_stops`, `transport_buses`, `transport_student_stops`, `transport_trips`, `transport_trip_events`, `transport_trip_locations`.

**Facilities (1):** `hostels`.

**Platform ops / super admin (17):** `modules`, `school_modules`, `module_requests`, `feature_flags`, `school_feature_flags`, `support_tickets`, `support_messages`, `support_ticket_categories`, `platform_audit`, `security_events`, `client_errors`, `auth_events`, `page_views`, `onboarding_events`, `rate_limits`, `impersonation_sessions`.

**Views (3):** `school_directory`, `schools_public`, `student_assessments_v`.

### 3.3 Core table columns (verbatim, from generated types)

```
schools
  id uuid PK · name · slug (unique, tenant key) · logo_url · motto · email · phone · address
  status school_status · plan school_plan · plan_started_at · plan_expires_at · billing_cycle
  included_students · extra_student_kobo · student_count · currency (NGN)
  current_session · current_term · term_starts_at · term_ends_at · resumption_date
  grading_system · exams_violation_limit · proctoring_default
  branding jsonb · report_theme jsonb · settings jsonb · neco_subject_codes jsonb
  pilot_status · pilot_started_at · pilot_ends_at · pilot_premium_until · pilot_converted_at · pilot_alerts_sent jsonb
  platform_notice · suspended_reason · created_by · created_at · updated_at · deleted_at

memberships                       -- the join table that defines "who is what, where"
  id · school_id -> schools · user_id -> auth.users · role member_role
  status ('active'|...) · admin_slot int · must_change_pin bool · bio_completed bool
  profile_data jsonb · created_at · deleted_at

profiles                          -- 1:1 with auth.users, id = auth.users.id
  id · full_name · email · phone · photo_url · dob · gender · address · created_at

user_roles                        -- PLATFORM roles only (super_admin). Never school roles.
  id · user_id · role app_role · created_at

academic_levels  id · school_id · code · name · sort_order · status · promotion_target_level_id · timestamps
academic_arms    id · school_id · class_id · code · name · capacity · department_id · class_teacher_user_id · status
arm_enrollments  id · school_id · arm_id · student_user_id · joined_at · status
academic_subjects id · school_id · code · name · category · department_id · description · status

classes          id · school_id · code · name · grade_level · arm · track · subject · teacher_id  (LEGACY)
class_enrollments id · school_id · class_id · student_id                                          (LEGACY)

attendance       id · school_id · class_id · student_id · date · status attendance_status · marked_by

assessments      id · school_id · title · description · type assessment_type · status assessment_status_v2
                 delivery_mode assessment_delivery · source assessment_source · class_id
                 config jsonb · weight · counts_to_results · opens_at · closes_at · scheduled_at · created_by

exams            id · school_id · title · subject · mode exam_mode · status exam_status
                 duration_minutes (+legacy duration_min) · randomize · proctored
                 proctor_action · proctor_snapshot_interval_sec · violation_limit
                 class_id · class_restrictions text[] · counts_to_results · show_answers_after_each
                 scheduled_at · auto_close_at · auto_publish_at · results_release_at
                 submitted_by/_at · approved_by/_at · published_by/_at · review_notes
exam_attempts    id · school_id · exam_id · student_id · started_at · submitted_at · score
exam_answers     id · attempt_id · question_id · selected_index · marked_for_review · updated_at

mock_sessions    id · school_id · student_id · mode · duration_minutes · questions_per_subject
                 total_questions · total_score · status · started_at · submitted_at
                 lockdown · fullscreen · integrity_score · integrity_events jsonb · ai_summary jsonb
mock_questions   id · school_id · subject_id -> mock_subjects · position · prompt
                 options jsonb · correct_index · explanation · topic
mock_session_subjects  (+ score, answered_count)

trad_exams       id · school_id · title · exam_type trad_exam_type · draft_status trad_draft_status
                 instructions · total_marks · timetable_id · author_id
                 submitted_by/_at · approved_by/_at · published_by/_at · rejection_reason · review_notes
trad_exam_attempts id · school_id · exam_id · student_id · status · mcq_score · theory_score
                 total_score · max_score · percentage · integrity_events jsonb · started_at · submitted_at

results          id · school_id · student_id · class_id · teacher_id · subject · term · session
                 ca_score · exam_score · assignment_score · report_score · score · grade
                 breakdown jsonb · remarks · published_by · published_at

-- PLATFORM billing (school pays Legacyskool)
invoices         id · school_id · number · kind · plan · period_start/_end
                 amount_cents · amount_kobo · currency · status · line_items jsonb · metadata jsonb
                 due_at · issued_at · paid_at · paid_method
                 paystack_reference · paystack_authorization_url
subscriptions    id · school_id · plan school_plan · status · monthly_amount_cents
                 period_start · current_period_end · started_at · last_invoice_id · paystack_reference

-- SCHOOL billing (parent pays school)
payment_types    id · school_id · name · code · category payment_category · audience payment_audience
                 recurrence payment_recurrence · default_amount_kobo · late_fee_kobo · currency
                 class_id · level · term · session · due_date · mandatory · allow_partial · active
school_invoices  id · school_id · student_id · payment_type_id · amount_due_kobo · amount_paid_kobo
                 currency · status invoice_status · term · session · due_date · issued_by · issued_at · notes
school_payments  id · school_id · invoice_id · student_id · payer_user_id · recorded_by
                 amount_kobo · currency · method payment_method · status payment_status
                 provider_reference · provider_payload jsonb · proof_url · notes · paid_at

invite_codes     id · school_id · code · role member_role · admin_slot · max_uses · uses
                 assigned_to_user_id · expires_at · revoked_at · metadata jsonb · created_by
parent_links     id · school_id · parent_user_id · student_user_id · relationship · is_primary
                 can_pickup · phone_e164 · receives_attendance/_behavior/_fees/_results

conversations    id · school_id · kind · channel_type · title · created_by
                 last_message_at · last_message_preview · metadata jsonb
conversation_messages id · school_id · conversation_id · sender_id · body · kind
                 attachments jsonb · reply_to · edited_at · created_at

client_errors    id · fingerprint · message · stack · cause · severity · source · route · role
                 school_id · user_id · affected_users text[] · occurrence_count
                 first_seen_at · last_seen_at · browser · os · user_agent · context jsonb · metadata jsonb
                 resolution_status · resolution_note · resolved_by · resolved_at · deleted_at

modules          id · slug · name · description · category · icon · version · status
                 global_default · core-ish flags · pricing_model · term_price_kobo · monthly_price_cents
                 config_schema jsonb · default_config jsonb · deleted_at
school_modules   id · school_id · module_id · enabled · beta · config jsonb
                 term_price_kobo_override · enabled_at · expires_at
feature_flags    id · key · name · description · category · default_enabled
                 default_rollout_percent · is_kill_switch
school_ai_quotas school_id PK · enabled · monthly_token_cap · monthly_cost_cap_usd
                 tokens_used · cost_used_usd · period_start · updated_at
support_tickets  id · school_id · opened_by · assignee · subject · status · priority · deleted_at
transport_buses  id · school_id · name · plate_number · capacity · route_id
                 driver_user_id · driver_name · driver_phone (RLS-restricted, see §3.5) · active
platform_audit   id · actor · action · school_id · payload jsonb · ip · created_at
```

### 3.4 Auth implementation

- **Supabase Auth**, email/password primary. Google OAuth is configured. `supabase/functions/phone-auth/` supports phone-based sign-in for Nigerian numbers.
- Client is created once in `src/integrations/supabase/client.ts` with a custom storage adapter `brokeredPreviewStorage()` from `previewAuthStorage.ts` (a Lovable-preview iframe concern — **when you leave Lovable you can simplify this to the default `localStorage` adapter**, see §6.4).
- **No anonymous sign-ups.** Students/parents are provisioned by the school: admin issues an `invite_codes` row (6-character code) or a QR link; `join-with-code` edge function creates the `auth.users` row + `profiles` + `memberships` with `must_change_pin = true` and `bio_completed = false`, forcing the PIN change and bio-completion flows.
- **`profiles`** mirrors `auth.users` 1:1 (`profiles.id = auth.users.id`) and holds the user-editable identity.
- **Two distinct role systems — do not conflate them:**
  - `public.user_roles(user_id, role app_role)` → **platform** roles only, i.e. `super_admin`. Checked by `has_role(_user_id, _role)` / `is_super_admin()`. Roles are in a separate table (never on `profiles`) specifically to prevent privilege escalation.
  - `public.memberships(user_id, school_id, role member_role)` → **per-school** roles. Checked by `is_member(school, user)`, `is_school_admin(school, user)`, `has_school_role(school, user, role)`.
- `admin_role_slots` + `school_custom_roles` + `src/lib/adminPermissions.ts` implement granular admin sub-permissions: `PERMISSION_GROUPS` → keys with a `:edit` suffix convention, resolved to `AccessLevel = none|view|edit` by `getLevel(perms, key)`; `useAdminPermissions()` hook reads the current user's slot permissions.
- **Impersonation:** super admin → `start_impersonation` / `log_impersonation_action` / `end_impersonation` RPCs + `impersonation_sessions` table; client state in `src/lib/impersonation.ts`; a persistent `ImpersonationBanner` is always visible while active.

### 3.5 RLS model

Every table in `public` has RLS enabled. The pattern is uniform:

```sql
-- security-definer helpers (all with `set search_path = public`), EXECUTE granted to anon + authenticated
is_member(_school uuid, _user uuid) returns boolean
is_school_admin(_school uuid, _user uuid) returns boolean
has_school_role(_school uuid, _user uuid, _role member_role) returns boolean
is_super_admin() returns boolean
has_role(_user_id uuid, _role app_role) returns boolean
is_conversation_participant(...) returns boolean
is_feature_enabled(...) / school_is_pilot_writable(...) / can_approve_exams(...)
```

Typical policy shape: `USING (public.is_member(school_id, auth.uid()))` for reads, `USING (public.is_school_admin(school_id, auth.uid()))` for admin writes, `USING (student_id = auth.uid())` for own-row student reads, plus a `public.is_super_admin()` escape hatch.

**Grants matter as much as policies.** Supabase does not grant default privileges on `public` to `anon`/`authenticated`, so every table has explicit `GRANT`s. A past incident: a migration revoked `EXECUTE` on the helper functions from `anon`, which broke every page for signed-out visitors ("permission denied"). The helpers must keep `EXECUTE` for both `anon` and `authenticated`.

Notable hardening decisions already made (don't regress them):
- `memberships` self-update policy has a `WITH CHECK` that pins `role`, `status`, `school_id`, `admin_slot` to their current values — prevents self privilege escalation even if a trigger is bypassed.
- `transport_buses.driver_phone` is only visible to school staff, the driver themselves, and linked students/parents.
- `mock_questions` is **not** directly SELECTable by students (policy `mock_questions_restrict_students`); they get questions only through `SECURITY DEFINER` RPCs that never return `correct_index`.
- `anon` has `SELECT` on `schools(id, name, logo_url, slug)` so the public join/landing pages work; `get_school_by_slug` is also anon-executable.

**Intentionally "flagged but accepted"** (recorded so the next agent doesn't "fix" them): public read on `academic_policy_defaults`, `academic_templates`, `feature_flags` (global reference data), broad staff read on `profiles` (staff need to see each other), and a deliberately permissive policy on `trad_exam_questions`.

### 3.6 Key RPC functions (~140 total; grouped)

```
Tenancy/identity : get_school_by_slug, get_public_profiles, admin_list_memberships_with_profile,
                   complete_admin_onboarding, get_school_custom_roles, has_role, has_school_role,
                   is_member, is_school_admin, is_super_admin, is_conversation_participant
Academics        : apply_academic_template, resolve_academic_policy, promote_arm,
                   compute_grade, recompute_term_result, recompute_term_results_for_class,
                   publish_results, publish_assessment
CBT v1 / v2      : get_exam_questions_for_attempt, get_exam_review,
                   get_assessment_questions_for_attempt, get_assessment_review
Mocks            : get_mock_questions_for_session, get_mock_practice_questions(_subject_id,_limit),
                   check_mock_answer(_question_id,_selected), grade_mock_session, get_mock_review,
                   infer_mock_topic, log_mock_integrity_event
Traditional exams: trad_start_attempt, trad_submit_attempt, trad_get_attempt_questions,
                   trad_get_paper_questions, trad_get_theory_grading_queue, trad_grade_theory,
                   trad_finalize_result, trad_validate_result, trad_review_paper,
                   trad_committee_forward_result, trad_admin_schedule_release,
                   trad_list_student_papers, trad_hash_pin, trad_redeem_card, trad_my_cards,
                   trad_is_result_unlocked
Results/verify   : verify_result_slip, publish_results
Money            : create_subscription_invoice, apply_subscription_payment, set_subscription_status,
                   issue_invoices_for_audience, apply_payment
AI               : bump_ai_quota, bump_ai_quota_savings, match_knowledge_chunks
Comms            : comms_ensure_class_channel, comms_sync_class_participants,
                   can_read_platform_announcement
Platform/super   : super_soft_delete, super_restore_deleted, super_purge_now, super_list_ai_quotas,
                   super_set_ai_quota, super_list_feature_flags, super_upsert_feature_flag,
                   super_list_school_flags, super_set_school_flag, super_clear_school_flag,
                   super_recent_auth_events, pilot_convert_manual, pilot_extend_days,
                   start_impersonation, log_impersonation_action, end_impersonation,
                   log_security_event, report_client_error, check_rate_limit,
                   trash_and_errors_maintenance, is_feature_enabled, school_is_pilot_writable
```

### 3.7 Triggers & scheduled jobs

- `tg_mock_question_topic()` on `mock_questions` — auto-fills `topic` via `infer_mock_topic(subject, prompt, explanation)` on insert/update when null. Keyword rules mapped to the Nigerian/WAEC syllabus; placeholder questions get `"General Revision"`; fallback `"<Subject> — Core Topics"`. Backfilled over 6,598 rows.
- Standard `updated_at` touch triggers on most tables.
- Result recomputation triggers feeding `results` from `gradebook_entries` / `assessment_results` via `recompute_term_result`.
- **`pg_cron`**: `trash_and_errors_maintenance()` runs daily — purges soft-deleted rows (`deleted_at` older than 30 days) across tables, and auto-resolves `client_errors` that have not recurred within 7 days (so fixing a bug in code marks it resolved in the super admin).

### 3.8 Storage buckets

| Bucket | Access | Contents |
|---|---|---|
| `school-logos` | public read | tenant logos, used in exports |
| `avatars` | public read | profile photos |
| `payment-proofs` | **private** | bank-transfer/cash proof uploads; admin-only via signed URLs (`getProofSignedUrl`, 1h) |
| library / knowledge / exam-upload buckets | private | lesson notes, library files, question docs, proctor snapshots |

Upload helpers: `src/lib/uploads.ts`, `src/lib/payments.ts#uploadPaymentProof` (path convention `${schoolId}/${userId}/${uuid}.${ext}`).

### 3.9 Edge Functions (46, all in `supabase/functions/`)

```
_shared/                ai-call.ts (Lovable AI Gateway wrapper), ai-cache.ts, embed.ts,
                        paystack.ts (live-key-with-test-fallback), tenant.ts (auth+tenant guard)

AI                      ai-tutor, comms-ai-assist, generate-lesson-note, generate-lesson-plan,
                        generate-parent-digest, generate-questions, generate-report-comment,
                        mark-essay, grade-exam-attempt, mock-result-summary, principal-copilot,
                        super-daily-intel, transcribe-audio, ingest-knowledge, rag-search,
                        parse-questions-doc, parse-trad-exam-doc
Exams                   fetch-aloc-questions (ALOC external question bank), neco-export,
                        generate-result-slip, public-verify-result
Money                   payments-checkout, payments-webhook*, payments-record-offline,
                        payments-verify-proof, issue-invoices,
                        subscription-checkout, subscription-verify*, subscription-webhook*,
                        trad-card-checkout, trad-card-generate, trad-card-verify
Onboarding/identity     register-school, join-with-code, bulk-onboard, send-admin-invite, phone-auth
Comms                   broadcast-dispatch, notify-recipients, parent-alerts-scan, pilot-alerts-scan
Platform                super-action, super-metrics, automation-runner, school-manifest*, mcp

* verify_jwt = false in supabase/config.toml: subscription-webhook, subscription-verify, school-manifest
```

`supabase/config.toml` is the only function config file:
```toml
project_id = "fiigsvxlxaqyzcvykkvw"
[functions.subscription-webhook] verify_jwt = false
[functions.subscription-verify]  verify_jwt = false
[functions.school-manifest]      verify_jwt = false
```
**Note:** `payments-webhook` is NOT listed with `verify_jwt = false` — see §6.2, bug #1.

---

## 4. Core Business Logic & Workflows

### 4.1 School registration → first login

1. Visitor fills `/register` → calls `register-school` edge function.
2. Function creates the `auth.users` admin account, `profiles` row, the `schools` row (unique slug, `plan='trial'`, `pilot_status`, `status='trial'`), a `memberships` row with `role='admin'`, `admin_slot=1`, and seeds `school_modules` / `academic_templates` defaults.
3. Admin lands on `/:slug/onboarding` (forced by `OnboardingGate`, which checks an onboarding-complete flag in `schools.settings`). The wizard collects session/term, levels/arms, subjects, grading scale, then calls `complete_admin_onboarding`.
4. Admin invites people from Onboarding Center → `invite_codes` (6-char codes, `max_uses`, `expires_at`, optional `assigned_to_user_id`), plus a printable QR poster (`src/lib/onboardingPoster.ts`).

### 4.2 Student/parent join

1. `/:slug/join` → code entered → `join-with-code` edge function.
2. Function validates the code against `invite_codes` (uses < max_uses, not revoked, not expired), rate-limits via `invite_redeem_attempts` + `check_rate_limit`, creates/attaches the user, inserts `memberships` (`must_change_pin=true`, `bio_completed=false`), and for parents creates `parent_links`.
3. `RequireSchool` then forces `/:slug/change-pin` → `/:slug/bio` before the portal opens.

### 4.3 Exams — the three engines (critical to understand)

**A. `exams` (v1 CBT).** Admin/teacher builds `exams` + `exam_questions`. Workflow `draft → scheduled → active → closed` with an optional committee gate (`exam_approvals`, `can_approve_exams`, `submitted_by → approved_by → published_by`). Student attempt: `exam_attempts` row → `get_exam_questions_for_attempt(attempt)` RPC returns questions **without** correct answers → answers upserted into `exam_answers` (`selected_index`, `marked_for_review`) → submission triggers `grade-exam-attempt` (auto-marks MCQ, queues essays to `mark-essay`) → `results` row. Proctoring: `exam_violations` + snapshot interval + `proctor_action` + `violation_limit`; client helpers `src/lib/examLockdown.ts` (fullscreen/visibility/copy detection), `proctorVision.ts`, `proctorEvidence.ts`. Review: `get_exam_review` (post-release only, gated by `result_release_rules` / `results_release_at`).

**B. `assessments` (v2).** Richer: `assessment_structures` + `assessment_sections` define weighting; `source` can be `question_bank`/`ai_generated`; `status` runs `draft → in_review → scheduled → published → archived`; results land in `assessment_results`, mapped back to the v1 world through `assessment_legacy_map`. RPCs `get_assessment_questions_for_attempt`, `get_assessment_review`, `publish_assessment`.

**C. `mock_*` (JAMB/WAEC/NECO simulation).** `mock_sessions` is a multi-subject sitting: `questions_per_subject`, `duration_minutes`, `lockdown`, `fullscreen`, `integrity_score`. `mock_session_subjects` holds per-subject `score`/`answered_count`. Questions come from `mock_questions` (6,598 rows, topic-tagged) or are pulled from the **ALOC API** via `fetch-aloc-questions`. Runner flow:
- `get_mock_questions_for_session` returns the position-ordered slice per subject, capped at `questions_per_subject`, never including `correct_index`.
- Answers upsert into `mock_answers` through a **1,200 ms flush queue** in `MockRunner.tsx` with `saveState: idle|saving|saved` surfaced in `ExamCommandBar`.
- **Resume:** `localStorage["mock-resume:<sessionId>"] = { subjectId, idx }`, restored once via `restoredRef`; stale server answers never overwrite the pending queue; `online`/`offline` listeners toast and invalidate `["mock-runner", sessionId]`.
- Submit → `grade_mock_session` → `mock-result-summary` edge function produces the AI markdown summary **and** `per_topic` analytics (correct/wrong/skipped per topic, label = question topic or `"<Subject> — General"`), cached in `mock_sessions.ai_summary` (cache-busted when `per_topic` is absent).
- `MockResult.tsx` renders a "Topic accuracy" card, weakest first (green ≥70%, orange ≥40%, red below).
- `PracticeRunner.tsx` is the **untimed** mode: `get_mock_practice_questions(_subject_id, _limit)` + `check_mock_answer(_question_id, _selected)` → `{ selected, isCorrect, correctIndex, explanation }` with instant feedback. Keyboard: A–D answer, arrows navigate, F flag. Nothing scored.

**D. `trad_*` (traditional/theory exams).** Paper-centric: `trad_exam_timetable` → `trad_exam_sessions` (`planning|published|locked`) → `trad_exams` with `draft_status` (`draft → submitted → approved → published`, `rejection_reason`) → `trad_exam_sections` + `trad_exam_questions` (mcq/theory). Papers can be imported from documents via `parse-trad-exam-doc`. Attempts: `trad_start_attempt` → `trad_get_attempt_questions` → `trad_submit_attempt` → MCQ auto-scored, theory queued to `trad_get_theory_grading_queue` → `trad_grade_theory` → `trad_finalize_result` → `trad_exam_results`. **Results are gated behind scratch cards:** `trad_scratch_batches` → `trad_scratch_cards` (PIN hashed by `trad_hash_pin`) → purchased via `trad-card-checkout` (Paystack) → `trad_redeem_card` → `trad_result_unlocks` → `trad_is_result_unlocked` lets the student view.

Shared exam UI library, `src/components/exam/`: `ExamCommandBar` (timer + save state + offline banner), `QuestionCanvas`, `OptionList`, `QuestionPalette` (answered/flagged grid), `TimerRing`, `SubmitSummaryDialog`, `Math.tsx` (KaTeX), `ResultReleaseBadge`, `PracticeRunner`.

### 4.4 Results & QR verification

`gradebook_entries` + `assessment_results` + exam scores → `recompute_term_result(student, term, session)` applies `term_grade_weights` and `grading_scales` (`compute_grade`) → writes `results` (`ca_score`, `exam_score`, `assignment_score`, `report_score`, `score`, `grade`, `breakdown` jsonb). `publish_results` sets `published_at/by` respecting `result_release_rules`. `generate-result-slip` builds a branded slip with a QR code (`src/lib/qr.ts`, `slip.ts`, `reportCard.ts`); the QR points at `/verify/:id`, which calls `public-verify-result` → `verify_result_slip` and logs to `result_verifications`. Verification works for signed-out visitors.

### 4.5 Attendance

`attendance(school_id, class_id, student_id, date, status, marked_by)` — one row per student per class per day, unique on (class, student, date). Teacher marks a roll; admin sees school-wide rates. Parent/student views read their own rows. Phase 1 only (daily) — phases 2–6 in §1.4.

### 4.6 Data mutations & caching conventions

- **All reads** go through React Query. Query keys are array-style and always include the tenant/entity id: `["enabled-modules", schoolId]`, `["mock-runner", sessionId]`, `["practice-questions", subject.id, limit]`. `staleTime` is set per query (e.g. modules 60s).
- **Mutations** are `supabase.from(...).insert/update/upsert` or `supabase.rpc(...)` or `supabase.functions.invoke(...)`, followed by `queryClient.invalidateQueries`.
- **Edge-function errors** are always routed through `friendlyInvokeError(error, fallbackMessage)` from `src/lib/errors.ts` so users never see raw Postgres text; `src/lib/error-sanitizer.ts#installUserSafeToasts` is a global net for the same.
- **Client errors** → `src/lib/error-reporter.ts` hooks `window.onerror` + `unhandledrejection` + the React `RootErrorBoundary` and calls the `report_client_error` RPC (fingerprinted, dedup by `occurrence_count`/`last_seen_at`, `affected_users[]`). Surfaces in `/super/operations?tab=incidents`. NOTE: this function needs `extensions` on its `search_path` for `pgcrypto` — that fix is applied; don't drop it.
- **Analytics** → `src/lib/analytics.ts`: `trackPageView` (via `<AnalyticsTracker/>` on route change) into `page_views`, `trackAuthEvent` into `auth_events`. Currently **one insert per event** — batching is in the performance plan.
- **Realtime** → `RealtimeNotifier.tsx` + `src/lib/realtime-status.ts` subscribe to `conversation_messages` / notifications for the bell badge.
- **Local caches** → `src/lib/dataCache.ts` (generic), `exportBrand.ts` (per-school brand cache with `clearExportBrandCache`), `pilot.ts` (pilot info cache).
- **Offline** → `vite-plugin-pwa` `NetworkFirst` for navigations and Supabase `/rest/` GETs (7-day, 200 entries), `CacheFirst` for hashed assets/fonts/images.

### 4.7 Export system (PDF / Word / CSV)

`src/lib/exporters.ts`:
- `exportBrandedPDF(opts: BrandedPDFOptions)` — builds branded HTML (compact header band with logo + school name + metadata strip; **explicitly not** the old full-bleed purple cover page) and prints via a hidden window → user "Save as PDF".
- `exportBrandedWord(opts)` — **async**, generates a genuine `.docx` with the `docx` library. (It used to emit renamed HTML, which corrupted on mobile Word. Do not regress to that.)
- `exportBrandedCSV(opts)` — flat CSV with the same title/metadata preamble.
- `BrandedSection` supports table and key/value sections; helpers `tableHTML`, `escapeHtml`, `downloadCSV`, `printToPDF`.

`src/lib/exportBrand.ts` resolves per-school branding automatically: `fetchExportBrand(schoolId)` reads `schools.report_theme` + `schools.settings` (logo, primary/accent colour, font preset from `EXPORT_FONTS` mapping CSS ↔ Word font names), caches it, falls back to `DEFAULT_EXPORT_BRAND`. `useExportBrand()` is the hook; `src/components/ExportMenu.tsx` is the single reusable dropdown that merges the resolved brand into every export. School admins edit this in Settings → "Export template" tab with a live preview.

### 4.8 Communication hub

One unified hub at `/:slug/app/communication` (`src/pages/comms/Hub.tsx`) with views: Inbox, DM, Channels, Announcements, Broadcasts, Scheduled, Templates, Tickets, Notifications, Analytics. Backed by `conversations` / `conversation_participants` / `conversation_messages` (+ `is_conversation_participant` RLS helper), `announcements` / `announcement_reads`, `broadcast_jobs` / `broadcast_deliveries` (dispatched by `broadcast-dispatch` + `notify-recipients`), `comms_templates`, `comms_events`. Class channels are auto-provisioned by `comms_ensure_class_channel` / `comms_sync_class_participants`. Per-role legacy Messages pages were deleted in favour of this hub — `parent_comms` (teacher↔parent, with read receipts) is intentionally separate.

### 4.9 Super Admin intelligence

`super-daily-intel` edge function pulls platform metrics (schools, active users, revenue from the payments tables in NGN, error counts, AI spend) and asks Gemini for a structured daily report: progress, problems, solutions — each item carrying a deep link into the relevant super-admin workspace. Rendered by `src/components/super/DailyIntel.tsx` on `/super`. `super-metrics` serves the KPI cards; `super-action` executes privileged mutations; `src/lib/super.ts` + `schoolHealth.ts` compute health gauges and badges.

### 4.10 Soft delete / trash

Tables carry `deleted_at`. `super_soft_delete` / `super_restore_deleted` / `super_purge_now` RPCs back `/super/trash`. Destructive UI requires typing `DELETE` in `src/components/super/ConfirmDeleteDialog.tsx`. `pg_cron` purges after 30 days. Separately, `src/components/SoftClearButton.tsx` gives "Clear from view" semantics (records hidden, not deleted) for admin dashboards; the admin dashboard keeps a rolling 30-day Recent Activities window with cleared-timestamps in `localStorage` per school; Proctoring has the same clear controls.

---

## 5. Integrations & Third-Party Services

### 5.1 Paystack (payments) — two separate flows

Shared helper `supabase/functions/_shared/paystack.ts`:
```ts
getPaystackKey(): { key, mode: "live" | "test" } | null
// prefers PAYSTACK_SECRET_KEY (live); falls back to PAYSTACK_TEST_SECRET_KEY.
// Adding the live secret switches everything to live with zero code changes.
PAYSTACK_BASE = "https://api.paystack.co"
paystackInit(body)            -> POST /transaction/initialize -> { authorization_url, reference, access_code, mode }
paystackVerify(reference)     -> GET  /transaction/verify/:ref -> { status, reference, amount, currency, metadata }
```

**Flow A — school fees (parent pays school).**
1. Admin defines `payment_types` (category, audience `school|level|class|custom`, recurrence, `default_amount_kobo`, `late_fee_kobo`, due date, mandatory/partial flags).
2. `issue-invoices` (or `issue_invoices_for_audience`) fans out `school_invoices` rows per student (`amount_due_kobo`, `amount_paid_kobo`, `status invoice_status`).
3. Parent/student clicks Pay → `startPaystackCheckout(invoiceId, amountKobo)` → `payments-checkout` → `paystackInit` → redirect to `authorization_url`. A `school_payments` row is created with `status='initiated'` and `provider_reference`.
4. Paystack calls `payments-webhook`: reads the raw body, computes `createHmac("sha512", PAYSTACK_SECRET_KEY).update(raw).digest("hex")`, compares to the `x-paystack-signature` header (401 on mismatch), handles only `charge.success`, looks up `school_payments` by `provider_reference`, is idempotent (returns early if already `successful`), then updates `status='successful'`, `paid_at`, `provider_payload` and calls the `apply_payment(_payment_id)` RPC which increments `school_invoices.amount_paid_kobo` and flips `status` to `partial`/`paid`.
5. **Offline payments:** `recordOfflinePayment({invoice_id, amount_kobo, method: cash|bank_transfer|pos|waiver, notes, proof_url})` → `payments-record-offline`. Or the parent self-submits proof: `submitPaymentProof` uploads to the private `payment-proofs` bucket and inserts a `school_payments` row with `status='initiated'` and a synthetic `provider_reference` (`proof_<invoice8>_<ts>`); the admin then calls `payments-verify-proof` (approve/reject with reason).
6. Money is always **kobo**. `naira(kobo)`, `toKobo(naira)` in `src/lib/payments.ts`.

**Flow B — platform subscription (school pays Legacyskool).**
1. `plan_pricing` defines tiers: `plan`, `label`, `term_price_kobo`, `included_students`, `extra_student_kobo`, `sort_order`. Revenue maths in `src/lib/pricing.ts` (`RevenueArgs` → base plan + extra students + addons, termly and annual).
2. `startSubscriptionCheckout({school_id, plan, cycle: "termly"|"annual"})` → `subscription-checkout` → `create_subscription_invoice` RPC → `invoices` row (`kind`, `plan`, `period_start/_end`, `paystack_reference`, `paystack_authorization_url`) → Paystack redirect.
3. Return URL `/subscription/callback` → `verifyReference(reference)` → `subscription-verify` (`verify_jwt = false`) → `paystackVerify` → `apply_subscription_payment` + `set_subscription_status` → updates `subscriptions` and `schools.plan` / `plan_expires_at`.
4. `subscription-webhook` (`verify_jwt = false`) handles the async confirmation for the same path.
5. `payInvoice(invoice_id)` re-opens checkout for an existing unpaid invoice.

**Flow C — scratch cards.** `trad-card-generate` mints batches, `trad-card-checkout` sells them via Paystack, `trad-card-verify`/`trad_redeem_card` unlocks a result.

### 5.2 Lovable AI Gateway (Gemini)

All AI calls go through `supabase/functions/_shared/ai-call.ts`, authenticated with the `LOVABLE_API_KEY` secret. Default model family is Gemini (e.g. `google/gemini-3-flash` for the daily intel). `ai-cache.ts` + the `ai_cache` table dedupe identical prompts; `bump_ai_quota` / `bump_ai_quota_savings` meter tokens and USD against `school_ai_quotas` (`monthly_token_cap`, `monthly_cost_cap_usd`, `enabled`); `ai_model_routing` lets the super admin route task kinds to model tiers; `src/lib/aiModels.ts` holds the client-side catalogue (`AI_MODELS`, `AI_TASKS`, `AI_ROLES`, `TIER_BADGE`); `ai_jobs` tracks async work and `ai_approvals` holds human-in-the-loop review of AI output.

**MIGRATION IMPACT:** `LOVABLE_API_KEY` and the gateway URL are Lovable-specific. Off-platform you must repoint `_shared/ai-call.ts` at Google AI Studio / Vertex / OpenAI directly and supply your own key. This is the single hardest dependency to leave behind. See §6.4.

RAG: `ingest-knowledge` chunks + embeds documents (`_shared/embed.ts`) into `knowledge_documents` / `knowledge_chunks` (pgvector); `rag-search` / `match_knowledge_chunks` do similarity retrieval for the AI tutor and principal copilot.

### 5.3 ALOC question bank

`fetch-aloc-questions` calls the external ALOC API using the `Aloc_Access_Token` secret to pull JAMB/WAEC/NECO questions into the mock engine. (A past bug: students couldn't fetch — fixed via RLS + function headers.)

### 5.4 MCP server (agent integrations)

`@lovable.dev/mcp-js` + `mcpPlugin()` in `vite.config.ts` publish an MCP manifest (`.lovable/mcp/manifest.json`); `src/lib/mcp/index.ts` registers tools `echo` and `verify-result`; `supabase/functions/mcp/` is the server endpoint; `/.lovable/oauth/consent` (`src/pages/OAuthConsent.tsx`) is the consent screen. Secured with OAuth 2.1 — the verification tool requires a user's OAuth token (it was unauthenticated and was hardened).

### 5.5 Other

- **PWA**: installable, `PWAInstallPrompt.tsx`, `public/manifest.webmanifest`, offline caching per §4.6.
- **Leaflet/OpenStreetMap**: bus tracking maps (`BusMap.tsx`, `src/lib/geo.ts`).
- **WhatsApp**: `WhatsAppFab.tsx` + `src/lib/contact.ts` — deep link only, no API.
- **Google Fonts**: Inter + Plus Jakarta Sans, preconnected in `index.html`.
- **Sitemap**: `scripts/generate-sitemap.ts` runs on `predev` and `prebuild` → `public/sitemap.xml`.
- **Secrets currently configured** (names only): `Aloc_Access_Token`, `CRON_SECRET`, `LOVABLE_API_KEY`, `PAYSTACK_TEST_PUBLIC_KEY`, `PAYSTACK_TEST_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.

---

## 6. Current State — Brutally Honest

### 6.1 Fully working (verified in preview / via Playwright)

- Multi-tenant slug routing, auth, guard chain, PIN/bio onboarding, invite codes (6-char), QR join posters.
- All four portals render with the ≤8-hub navigation; mobile tab bars scroll.
- Academic structure (levels/arms/departments/subjects), attendance (daily), timetable, gradebook, grading scales, term weights, results, promotion.
- CBT: v1 exams, v2 assessments, mock sessions (resume, offline queue, topic analytics), traditional/theory exams with committee workflow, scratch-card unlocking, proctoring with violations.
- Question bank + AI question generation + document parsing; 6,598 `mock_questions` topic-tagged.
- Results publishing + branded result slips + public QR verification.
- Fees: payment types, invoice issuance, Paystack checkout (test mode), offline recording, proof upload/verify.
- Subscriptions: plan pricing, checkout, verify, invoices, pilot tracking.
- Communication hub (DMs, channels, announcements, broadcasts, templates, tickets, notifications) + realtime bell.
- AI: tutor, lesson notes/plans, report comments, essay marking, parent digests, principal copilot, RAG knowledge base, quotas, caching, model routing.
- Super Admin V2: all workspaces live with real data; old routes redirect; impersonation; trash/restore/purge; daily AI intel; client-error inbox with auto-resolution.
- Export system: branded PDF, native `.docx`, CSV, with automatic per-school branding.
- Global Cmd+K search across people, classes, announcements, exams, assignments + quick-nav.
- Transport (routes, stops, buses, trips, live map), hostels, library, behaviour notes, parent links/alerts.
- PWA install + offline shell. Build is green (`build OK`) and `tsgo --noEmit -p tsconfig.app.json` is clean.

### 6.2 Known bugs / launch blockers — fix these first

1. **`payments-webhook` will 401 every Paystack call.** It is not declared with `verify_jwt = false` in `supabase/config.toml`, so Supabase requires a JWT that Paystack does not send. Add:
   ```toml
   [functions.payments-webhook]
   verify_jwt = false
   ```
   It also reads only `PAYSTACK_SECRET_KEY` (returns 503 when absent) while the rest of the codebase falls back to `PAYSTACK_TEST_SECRET_KEY` — so in test mode the webhook is dead even once JWT is off. Make it use `getPaystackKey()` from `_shared/paystack.ts`.
2. **Payments are on TEST keys.** Only `PAYSTACK_TEST_*` secrets exist. No real money can be collected until `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY` (live) are added and the live webhook URL is registered in the Paystack dashboard.
3. **The database was unreachable at the time of writing** (`SUPABASE_POOLER_UNAVAILABLE` — project paused/cold). If introspection fails, resume the project first. Verify the project is on a plan that does not auto-pause before launch.
4. **`index.html` metadata is stale**: description contains typos ("Mordern", double space), `og:url` is `/`, JSON-LD and OG images still point at `legacy-skool.lovable.app` (an old preview host), `twitter:site` is `@Lovable`. Fix before the custom domain goes live.
5. **Custom domain `www.legacyschools.study` is not live** (status: initiated). DNS must be completed on the new host.
6. **No dedicated migration history.** See the banner at the top — this is the number-one migration task.

### 6.3 Technical debt (not blocking, but real)

- **Duplicate academic models.** `classes`/`class_enrollments`/`subjects`/`student_subjects` (legacy flat) coexist with `academic_levels`/`academic_arms`/`academic_subjects`/`arm_enrollments` (current). Different pages read different models. Pick one, backfill, and mark the other deprecated with `COMMENT ON TABLE`.
- **Three exam engines** (`exams`, `assessments`, `mock_*`, plus `trad_*`) with overlapping concepts and an `assessment_legacy_map` bridging table. Consolidation is a large but high-value refactor.
- **Two question-bank lineages**: `question_bank`/`question_bank_versions`/`question_banks`/`question_tags` vs `mock_questions` vs `exam_questions` vs `trad_exam_questions`. The topic-tagging trigger covers **only `mock_questions`**; `question_bank` (4 rows) and `questions_v2` are untouched, so exam-question topic analytics outside mocks will be blank.
- **Duplicate columns kept for compatibility**: `invoices.amount_cents` + `amount_kobo`; `exams.duration_min` + `duration_minutes`; `results.score` + `report_score`. Always write both or you will get silent zeros.
- **Testing is effectively absent.** `src/test/example.test.ts` is the only test plus `setup.ts`. No unit tests on grading, invoicing, or RLS. Playwright was used ad-hoc from the sandbox, not committed as a suite.
- **`src/App.tsx` is 34KB** of route declarations and `src/pages/admin/Settings.tsx` is 43KB — both should be split.
- **Performance debt** as itemised in §1.4 item 1 (unpaginated `mock_questions`, un-batched analytics inserts, missing indexes, single vendor chunk).
- **`vite.config.ts` deliberately uses one `vendor` chunk.** Read the comment before "optimising" it: splitting React/Radix into manual chunks previously created a circular production import chain that left React undefined and produced a blank published page.
- **`src/components/ui/use-toast.ts` and `src/hooks/use-toast.ts`** duplicate each other (shadcn artefact).
- **Naming inconsistency** across brand spellings (Legacyskool / LegacyKool / Legacy Schools / edusmart in the theme localStorage key).
- **`src/pages/admin/Fees.tsx`** is a one-line re-export of `Payments.tsx`; similar thin aliases exist elsewhere (e.g. `student/BusTracking.tsx`).
- Accepted-by-design RLS "findings" listed in §3.5 — don't let a scanner talk you into changing them without reading the justification.

### 6.4 Lovable-specific code you must replace when leaving

| File / thing | What it does | Action |
|---|---|---|
| `src/integrations/supabase/previewAuthStorage.ts` + its use in `client.ts` | brokers auth storage across the Lovable preview iframe | replace with default `localStorage` persistence |
| `lovable-tagger` in `vite.config.ts` (dev only) | component tagging for Lovable's visual editor | remove the plugin + devDependency |
| `@lovable.dev/mcp-js` + `mcpPlugin()` + `.lovable/mcp/manifest.json` | MCP server scaffolding | keep only if you still want MCP; otherwise remove |
| `supabase/functions/_shared/ai-call.ts` (`LOVABLE_API_KEY`) | Lovable AI Gateway | repoint at Google/OpenAI with your own key; keep the caching/quota wrapper |
| `.lovable/` and `mem/` folders | plan archives + agent memory | keep as documentation; they explain past decisions |
| `index.html` OG/JSON-LD URLs, `twitter:site=@Lovable`, `/__l5e/assets-v1/...` preload path | Lovable asset pipeline | replace with real asset paths on the new host |
| `src/assets/student-cbt-exam.jpg.asset.json` | a pointer file, not an image | resolve to a real committed image before building off-platform |
| `drizzle.config.ts` (`LOVABLE_DB_MIGRATION_URL`) | migration connection | point at your own `DATABASE_URL` |

---

## 7. Environment & Deployment

### 7.1 Frontend `.env` (Vite — these are PUBLIC, embedded in the bundle)

```
VITE_SUPABASE_PROJECT_ID="fiigsvxlxaqyzcvykkvw"
VITE_SUPABASE_URL="https://fiigsvxlxaqyzcvykkvw.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<supabase anon/publishable key — safe to commit, RLS enforces access>"
```

### 7.2 Backend secrets (edge-function environment — NEVER in the bundle)

```
# Supabase-managed (auto-injected)
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # not retrievable from Lovable; get it from the Supabase dashboard once you own the project
SUPABASE_DB_URL
SUPABASE_JWKS
SUPABASE_PUBLISHABLE_KEYS
SUPABASE_SECRET_KEYS

# Payments
PAYSTACK_TEST_SECRET_KEY         # currently set
PAYSTACK_TEST_PUBLIC_KEY         # currently set
PAYSTACK_SECRET_KEY              # MISSING — add to go live
PAYSTACK_PUBLIC_KEY              # MISSING — add to go live

# AI
LOVABLE_API_KEY                  # Lovable AI Gateway — replace with GOOGLE_AI_API_KEY / OPENAI_API_KEY off-platform

# External question bank
Aloc_Access_Token

# Scheduled jobs
CRON_SECRET                      # shared secret guarding cron-triggered functions

# Migrations (local tooling)
LOVABLE_DB_MIGRATION_URL         # rename to DATABASE_URL off-platform; used by drizzle.config.ts
```

### 7.3 Build & deploy config

- `npm run dev` → `predev` runs `tsx scripts/generate-sitemap.ts`, then `vite` on **port 8080**, host `::`, HMR overlay disabled.
- `npm run build` → sitemap, then `vite build`. `npm run build:dev` builds in development mode.
- `npm run test` → `vitest run`. `npm run lint` → `eslint .`.
- `vite.config.ts`: `@` → `./src`; `dedupe` for react, react-dom, jsx runtimes, `@tanstack/react-query`, `query-core`; `manualChunks` puts all `node_modules` into a single `vendor` chunk (see warning in §6.3); `chunkSizeWarningLimit: 800`.
- **PWA** (`VitePWA`): `registerType: "autoUpdate"`, `injectRegister: false` (registered manually in `main.tsx`), dev disabled, `navigateFallback: /index.html` with `navigateFallbackDenylist: [/^\/~oauth/]`, `maximumFileSizeToCacheInBytes: 8MB`, runtime caching per §4.6. Manifest: name "Legacyskool", `theme_color #2563eb`, icons 192/512 + maskable.
- **SPA rewrite** is mandatory. `vercel.json` already has `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. On Netlify use `/* /index.html 200`; on Nginx `try_files $uri /index.html`.
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`; Tailwind config in `tailwind.config.ts` reading semantic CSS variables from `src/index.css`. **All colours are HSL design tokens** — never hardcode `text-white`/`bg-[#hex]` in components; it breaks dark mode and per-school theming.
- Edge functions deploy with `supabase functions deploy <name>`; `supabase/config.toml` carries the per-function `verify_jwt` settings.

### 7.4 Migration checklist for the new agent (do these in order)

1. Take ownership of the Supabase project (or `pg_dump`/restore into a fresh one). Confirm it is not on an auto-pausing tier.
2. `pg_dump --schema-only --no-owner --no-privileges` **plus** a separate dump of policies/grants/functions/triggers, and commit it as `drizzle/migrations/0001_baseline_schema.sql` (or switch to plain `supabase/migrations/`). Also dump `pg_cron` jobs.
3. Regenerate types: `supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`.
4. Fix `payments-webhook` (`verify_jwt = false` + `getPaystackKey()`), then add live Paystack keys and register the webhook URL.
5. Strip the Lovable-specific pieces listed in §6.4; replace the AI gateway.
6. Clean `index.html` metadata and asset URLs; point the custom domain at the new host with the SPA rewrite.
7. Add a real test suite: start with grading (`compute_grade`, `recompute_term_result`), invoicing (`apply_payment`, `issue_invoices_for_audience`), and RLS tenant-isolation tests.
8. Then pick up the performance plan (§1.4 item 1) — it is the highest-leverage remaining work.

---

## 8. Conventions the next agent must respect

1. **Money is always integer kobo.** Never store naira floats.
2. **Never store roles on `profiles`.** Platform roles in `user_roles`, school roles in `memberships`.
3. **Every new `public` table needs explicit `GRANT`s** (`authenticated`, `service_role`, and `anon` only when a policy allows anon reads) *plus* `ENABLE ROW LEVEL SECURITY` *plus* policies. RLS without grants = permission-denied at runtime.
4. **Never return correct answers to a student client.** Questions always come through a `SECURITY DEFINER` RPC that strips `correct_index`.
5. **Colours/shadows/gradients are semantic tokens** in `src/index.css`, themed through shadcn variants.
6. **Max 8 sidebar hubs per role**; extra pages become tabs in `src/layouts/portalNav.ts`.
7. **Two "admins" exist.** "Super Admin" = the internal platform/CTO console (`/super`). "School Admin" = a customer school's administrator. Never merge their language or their routes.
8. **Auth-callback rule:** never call Supabase synchronously inside `onAuthStateChange`; defer with `setTimeout(...,0)`.
9. **User-facing errors** go through `friendlyInvokeError` / the sanitizer — never surface raw Postgres text.
10. **Additive migrations only** in the historical style of this project: add nullable/defaulted columns, backfill, switch code, deprecate with `COMMENT ON`, don't drop.
