
# Exam Workflow Realignment + Premium Report Card

## Goal

One single exam pipeline. Teachers no longer publish exams or release results. They draft questions and submit for approval. Admin (and workspace collaborators with the right permission) review → approve → publish → schedule result release. Students only ever see results after the admin-set release moment. Report cards become a premium, per-school branded PDF.

## New End-to-End Flow

```text
Teacher (draft)
   └─ create paper, add/upload questions, set marks/sections
   └─ Submit for approval ─────────────►
                                        Exam Committee / Admin (review)
                                          ├─ Edit / request changes
                                          ├─ Approve
                                          └─ Schedule (date, time, duration, venue, class)
                                                 │
                                                 ▼
                                        Admin: Publish to students
                                                 │
                                                 ▼
                                        Student: Take exam in window
                                                 │
                                                 ▼
                                        Auto-grade MCQ · Teacher marks theory
                                                 │
                                                 ▼
                                        Committee validates ─► Admin schedules release
                                                 │
                                                 ▼
                                        Student / Parent: result visible at release_at
                                                 │
                                                 ▼
                                        Premium branded Report Card PDF
```

## Scope of Removal (Teacher portal)

Remove from teacher portal:
- Publishing CA tests / exams to students
- Scheduling exam dates/times
- Releasing results to students
- Any "Make live" / "Open to students" toggles on school exams & CA tests

Teacher portal keeps:
- Assignments (full create + grade + return — unchanged)
- Drafting school exam / CA test questions (manual or AI from upload) and **Submit for approval**
- Marking theory answers after approval (when assigned)
- Viewing their own gradebook / class analytics (read-only of released results)

## Scope of Addition (Admin portal + permitted collaborators)

`exams:create` and `exams:approve` permissions (already in admin permissions model) now gate:
- Create exam/test directly (admin-authored path)
- Review submitted teacher drafts (approve / send back with notes)
- Schedule (date, time, duration, class, venue)
- Publish to students
- Schedule result release datetime (auto-unlock); manual "Release now" / "Withdraw"

A new consolidated page **Admin → Assessments → Approvals queue** lists every teacher-submitted paper with status chips (Submitted, Changes requested, Approved, Scheduled, Published, Closed, Results pending, Released).

## Data model changes

Reuse existing tables; minimal additions:

- `trad_exams.draft_status` already supports `draft | submitted | approved | locked` — add `changes_requested` and `published`.
- `trad_exams` add: `submitted_at`, `submitted_by`, `approved_at`, `approved_by`, `published_at`, `published_by`, `review_notes`.
- `exams` (legacy CA/test) add the same lifecycle columns + `results_release_at` (already present).
- Tighten RLS so teachers can only write while `draft_status in ('draft','changes_requested')` and cannot set `published_at` / `results_release_at`.
- A small `exam_review_events` table for the audit trail (who submitted, who approved, notes, timestamps).

## UI work

Teacher portal:
- Replace publish/schedule buttons on `teacher/Assessments.tsx`, `teacher/TestBuilder.tsx`, `teacher/TradExams.tsx` with **Submit for approval** + status badge + "Changes requested" banner with reviewer notes.
- Hide the "Release results" controls entirely.
- Keep grading screens for theory marking once approved.

Admin portal:
- New **Approvals queue** card in `admin/Assessments.tsx`.
- Review drawer: preview paper, edit, Approve / Request changes (with note).
- Schedule modal: class, date, time, duration, venue.
- Publish action (one click after approved + scheduled).
- Result release: existing `ExamResultsRelease.tsx` extended to cover both legacy `exams` and `trad_exams`.

Student portal:
- Only sees papers where `published_at is not null` and inside the window.
- Result page shows lock state until `results_release_at <= now()`.

## Premium Report Card

New utility `src/lib/reportCard.ts` producing a branded multi-page PDF using `jspdf` (already in deps via `exporters.ts`):

- Page 1 — Cover: school logo, school name, motto, academic year/term, student photo, full name, class/arm, admission no.
- Page 2 — Subjects table: CA1, CA2, Exam, Total, Grade, Position, Remarks per subject; colour-coded grade chips from school's `grading_scales`.
- Page 3 — Summary: overall %, class position, attendance, behaviour, teacher comment, principal comment, next term begins.
- Footer on every page: school name + motto + page x/y; subtle watermark of school logo.
- Reads `schools.name`, `schools.logo_url`, `schools.motto` (add column if missing).
- Hooked into `components/results/ResultSlipButton.tsx` so any "Download report card" button across admin/teacher/parent/student uses the same premium template; old basic slip generator stays only as a fallback when `results_release_at` is null and caller is staff.

## Files touched (high-level)

- `supabase/migrations/*` — lifecycle columns, `exam_review_events`, tighten RLS, add `schools.motto` if absent.
- `src/lib/tradExams.ts` — new statuses + helpers (`submitForApproval`, `approve`, `requestChanges`, `publish`).
- `src/pages/teacher/Assessments.tsx`, `teacher/TestBuilder.tsx`, `teacher/TradExams.tsx` — remove publish/schedule, add submit-for-approval flow + status banner.
- `src/pages/admin/Assessments.tsx` — add Approvals queue + review drawer + schedule + publish.
- `src/pages/admin/ExamResultsRelease.tsx` — cover both exam tables.
- `src/pages/student/TradExams.tsx`, `student/MyAssessments.tsx`, `student/Results.tsx` — gate visibility by `published_at` / `results_release_at`.
- `src/lib/reportCard.ts` (new) + integrate via `components/results/ResultSlipButton.tsx`.
- `src/modules/registry.ts` — drop teacher sidebar items that no longer apply (e.g. "Schools Exam" stays as draft list only; remove "Result release" from teacher).

## Out of scope

- Mock exams (JAMB/WAEC/NECO simulations) — student self-practice, unchanged.
- Assignments — unchanged on teacher side.
- Workspace/role permission model — already built; we only consume `exams:create` and `exams:approve`.

## Open questions before I build

1. **Changes-requested loop**: when admin sends back, should the teacher get a notification + inbox entry, or just a status flip on the paper?
2. **Who can mark theory** after approval — original author teacher only, or any teacher the admin assigns? (Today it's the author.)
3. **Report card trigger**: generate per term automatically when admin releases results, or on-demand download only?
4. **Motto field** — confirm I can add `schools.motto` (text) if it doesn't exist; otherwise point me to the field you already use.
