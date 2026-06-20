
# Plan: Academic Config + Exam Lifecycle + Integrity Engine

Three modules delivered as **extensions** to what already exists. Nothing in `exams`, `trad_exams`, `gradebook_entries`, `term_grade_weights`, `Proctoring.tsx`, `ExamInterface.tsx`, `TestBuilder.tsx`, or the Comms hub will be rebuilt — they get cleaner UIs and the missing pieces wired in.

---

## Module 1 — Academic Configuration Engine

Today the project has `term_grade_weights` (CA/Assignment/Exam/Report sums to 100), `schools.current_term`/`current_session`, and ad-hoc grading inside result functions. We add a single **policy layer** that sits on top.

### New tables (all RLS, GRANT to authenticated + service_role)
- `academic_policy_defaults` (super-admin owned) — platform-wide defaults for calendar/grading/promotion/result rules. One row per `policy_kind`.
- `academic_policies` (per school) — overrides keyed by `school_id` + `policy_kind`. JSON body validated against a schema.
- `academic_calendar` — `school_id`, `session`, `kind` (term|semester|custom), `periods jsonb[]` (name, start, end, is_current).
- `grading_scales` — `school_id`, `name`, `bands jsonb` ([{min,max,grade,remark}]), `is_default`.
- `assessment_structures` — `school_id`, `name`, `components jsonb` ([{key,label,weight}]), `is_default`. Replaces hard-coded weights in `term_grade_weights` (kept for back-compat via a view).
- `promotion_rules` — `school_id`, `min_average`, `core_subjects text[]`, `min_attendance_pct`, `extra jsonb`.
- `result_release_rules` — `school_id`, `auto_release_at`, `requires_approval`, `approval_chain text[]` (teacher→hod→admin), `pin_required`, `pin_price_kobo`, `template_id`.

### New UI
- **Super Admin → Academic Defaults** (`src/pages/super/AcademicDefaults.tsx`) — Airtable-style table editor per policy kind. Lives next to `TenantConfig.tsx`.
- **School Admin → Academic Setup** (`src/pages/admin/AcademicSetup.tsx`) — single page with 6 cards (Calendar / Assessment / Grading / Promotion / Result / Policies). Live preview panel right side: enter a sample score → see grade, remark, position, promotion verdict computed live with current draft.
- Reuses existing `GradingWeightsCard` but rebuilds it as one component of the new page.

### Engine functions (Postgres)
- `public.resolve_academic_policy(_school, _kind) returns jsonb` — school override → super default → hardcoded fallback.
- `public.compute_grade(_school, _score numeric) returns table(grade, remark)` — uses resolved scale.
- `public.evaluate_promotion(_school, _student, _term, _session) returns jsonb` — uses promotion_rules.
- Existing `recompute_term_result*` switches to `compute_grade` so any change in scale instantly flows through.

---

## Module 2 — Examination Management Engine

Existing assets reused: `exams`, `exam_questions`, `exam_attempts`, `question_bank`, `trad_exams` + timetable, `parse-trad-exam-doc` edge function, `generate-questions`, `mark-essay`, `grade-exam-attempt`, scratch-card system, `TestBuilder.tsx`, `TradExams*` pages. **No rebuild.**

### Gaps to add
1. **Exam Committee workspace** (`src/pages/admin/ExamCommittee.tsx`) — single workspace listing timetable + sessions + subject scheduling + coordinators. Wraps existing `trad_exam_timetable` + `trad_exam_sessions` with a cleaner board view.
2. **Unified Question Bank** — `question_bank` table gets `difficulty`, `topic`, `subject`, `approval_status`, `version`, `parent_id` columns. New page `src/pages/admin/QuestionBank.tsx` already exists → extend with filters (subject/topic/difficulty), reuse picker.
3. **Approval workflow** — new table `exam_approvals` (`exam_id`, `stage` enum teacher|hod|admin, `actor`, `status`, `note`, `at`). Add HOD role to `member_role` enum (additive). UI: approval ribbon on `TradExamPaper.tsx` + `TestBuilder.tsx`. Edge function `exam-approve` to advance stage.
4. **Question versioning** — `question_bank_versions` table, auto-snapshot on update via trigger.
5. **Scheduling engine** — extend `exams` with `auto_publish_at`, `auto_close_at`, `class_restrictions uuid[]`; cron job `exam-scheduler` (every minute via `pg_cron`+`pg_net`) flips published/closed.
6. **Student exam dashboard** polish — `src/pages/student/MyAssessments.tsx` gets countdown, navigator, autosave indicator (autosave already in `ExamInterface.tsx`, just surface status).
7. **Result processing** — new `compute_exam_result(_exam)` aggregates → calls `compute_grade` → writes `results`. Approval chain reuses `exam_approvals`.
8. **Scratch-card result access** — already exists (`trad_scratch_*`). Add Admin pricing editor `src/pages/admin/ScratchCardPricing.tsx` reading `result_release_rules.pin_price_kobo`.

---

## Module 3 — Examination Integrity & Fairness Engine

Existing: `exam_violations` table + realtime, `proctorVision.ts`, `examLockdown.ts`, `Proctoring.tsx`, configurable threshold action per exam (warn vs auto_submit), voice warnings. **No rebuild — extend.**

### New storage
- Storage bucket `proctor-evidence` (private). Path: `{school_id}/{attempt_id}/{ts}.jpg`. Signed-URL access only.
- RLS on `storage.objects` for that bucket: students can write to their own attempt prefix; admins/HOD of the school can read; nobody can delete (immutability).

### Schema extensions
- `exam_violations` add: `risk_score int`, `evidence_path text` (storage key), `student_explanation jsonb`, `reviewer_decision text`, `reviewer_id uuid`, `reviewed_at timestamptz`.
- New `risk_score_rules` per school (defaults: tab_switch=10, fullscreen_exit=10, multi_face=30, no_face=15, camera_off=30, copy/paste=5, devtools=20). Resolved via Module 1 policy resolver.
- New `exam_appeals` table — `attempt_id`, `student_id`, `reason`, `status` (open|teacher_review|hod_review|admin_review|approved|rejected|recalculated), `stage_notes jsonb[]`, `recalculation jsonb`.
- New `exam_audit_entries` table — immutable per-question audit (`attempt_id`, `question_id`, `student_answer`, `correct_answer`, `score_awarded`, `at`). Written by trigger on `exam_answers` insert/update. Append-only (REVOKE update/delete from authenticated; service_role only).

### Client changes
- `ExamInterface.tsx`: on every violation → capture snapshot (canvas → JPEG blob → signed PUT to `proctor-evidence`), compute risk_score from rules, insert violation row with `evidence_path`. Show 3-tier warning UI (popup + audio + visual ring) keyed off cumulative score (0-20 normal, 21-50 review, 51-80 high, 81+ critical). When multi-face/no-face fires, prompt **Student Explanation** modal with reasons (Parent entered, Teacher present, Other) — never auto-fails.
- Autosave already every 5s; add reconnect-resync watchdog (offline queue in IndexedDB, flushes on `online`).
- `Proctoring.tsx`: add Risk Score column, Evidence thumbnails (signed URLs via edge function `proctor-evidence-url`), Explanation column, Review actions (Approve / Reject / Recalculate → triggers `compute_exam_result`).
- New `src/pages/admin/ExamAppeals.tsx` + student-side `src/pages/student/AppealForm.tsx`. Multi-stage UI: Teacher → HOD → Admin, each stage logged to `stage_notes`.
- `src/pages/admin/ResultVerification.tsx` — per-attempt detailed scoring report from `exam_audit_entries` (used in disputes; printable).

### Edge functions
- `proctor-evidence-url` — issues signed write URLs to students for their own attempt, signed read URLs to admins/HOD.
- `exam-appeal-advance` — moves appeal through teacher→hod→admin chain with auth checks.
- `exam-recalculate` — re-runs `compute_exam_result` for a single attempt, writes diff to `exam_appeals.recalculation`.

### Fairness guarantees (enforced in code)
- No DB trigger ever updates `exam_attempts.status` to `failed`/`cancelled` based on violations.
- All auto-actions limited to: warn, notify examiner, capture evidence. Auto-submit only fires when teacher explicitly set `proctor_action='auto_submit'` (already in place).
- Evidence bucket has no DELETE policy → immutable.
- `exam_audit_entries` is append-only.

---

## Delivery order

1. **M1 schema + policy resolver + School Admin Academic Setup page** (unblocks M2 result rules and M3 risk rules).
2. **M1 Super Admin defaults page.**
3. **M2 approval workflow + scheduling cron + Exam Committee workspace + Question Bank polish.**
4. **M3 storage bucket + audit/appeals/risk-score schema + ExamInterface integration + Proctoring dashboard upgrade + Appeals UI.**

Each step ends with a migration + UI in the same commit so it's usable immediately. Existing pages remain functional throughout (additive columns, no breaking renames).

## Technical notes

- All new tables follow the GRANT+RLS pattern. No `auth.users` FKs.
- All new edge functions validate JWT in code and use Zod for input.
- Cron jobs registered via `cron.schedule` calling `pg_net.http_post` (per Lovable scheduling pattern) — registered with `supabase--insert`, not migration.
- Realtime already enabled for `exam_violations`; we add `exam_appeals` to the publication.
- No external services. Lovable Cloud only.
