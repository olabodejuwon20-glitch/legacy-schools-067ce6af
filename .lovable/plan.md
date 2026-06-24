# Academic Structure Engine

A configurable engine that ships with **Nigerian Secondary School** as the default template but stores every level/class/arm/department/subject as data — no hardcoded JSS/SS strings anywhere on the data path. Future templates (Primary, Cambridge, Montessori, K-12, Custom) drop in without schema changes.

## 1. Data Model (new tables, all `school_id`-scoped with RLS + GRANTs)

```text
academic_templates          ← global library of starter templates (Nigerian SS, Primary, …)
  code, name, country, body (jsonb: levels, departments, subjects, arms)
  is_active (only "nigerian_secondary" is_active=true today; others marked coming_soon)

school_academic_structure   ← one row per school: chosen template + status
  school_id, template_code, activated_at, settings jsonb

academic_levels             ← Junior Secondary, Senior Secondary (or Lower/Upper Primary, etc.)
  school_id, code, name, sort_order, promotion_target_level_id

academic_classes            ← JSS1, JSS2, SS1, SS2, … (generated from template)
  school_id, level_id, code, name, category, capacity, description, status, sort_order
  promotion_target_class_id (FK self) ← drives JSS1→JSS2 etc.

academic_arms               ← JSS1 A, SS1 Science, SS1 Arts … (unlimited per class)
  school_id, class_id, name, code, department_id NULL, capacity,
  class_teacher_user_id NULL, status (active|archived)

academic_departments        ← Science, Arts, Commercial, +custom
  school_id, code, name, description, status

academic_subjects           ← English, Maths, Physics, … (configurable)
  school_id, code, name, department_id NULL, category (core|elective|department),
  description, status

subject_arm_assignments     ← Subject ↔ Arm (inheritance happens here, NOT per-student)
  school_id, subject_id, arm_id, is_required (true|false ← elective flag),
  UNIQUE(school_id, subject_id, arm_id)

arm_enrollments             ← Student ↔ Arm (replaces ad-hoc class_enrollments going forward;
  school_id, arm_id, student_user_id, status, joined_at         existing table stays as legacy view)

teacher_subject_arm         ← Teacher ↔ Subject ↔ Arm
  school_id, teacher_user_id, subject_id, arm_id, role (lead|assistant)

promotion_rules             ← per school, per level transition
  school_id, from_level_id, to_level_id, min_average, attendance_pct,
  require_core_pass jsonb (subject_ids)
```

All tables: UUID PK, `created_at`, `updated_at` triggers, soft-delete via `status='archived'` (no hard DELETE). Composite indexes on `(school_id, …)`. RLS: school admins full CRUD within their `school_id`, teachers read-only on rows tied to their assignments, students read-only on their own arm and inherited subjects.

## 2. Template Engine

- `academic_templates.body` is the spec:
  ```json
  {
    "levels": [{"code":"jss","name":"Junior Secondary","classes":[{"code":"JSS1"},{"code":"JSS2"},{"code":"JSS3"}]},
               {"code":"sss","name":"Senior Secondary","classes":[{"code":"SS1"},{"code":"SS2"},{"code":"SS3"}]}],
    "promotion_chain": ["JSS1","JSS2","JSS3","SS1","SS2","SS3","GRADUATED"],
    "departments": ["Science","Arts","Commercial"],
    "subjects": {
      "core":   ["English Language","Mathematics","Civic Education","Computer Studies"],
      "junior": ["Basic Science","Basic Technology","Social Studies","Business Studies","Agricultural Science"],
      "Science":["Physics","Chemistry","Biology","Further Mathematics"],
      "Commercial":["Economics","Commerce","Financial Accounting"],
      "Arts":   ["Government","Literature","CRS","IRS","History"]
    }
  }
  ```
- DB function `apply_academic_template(_school_id, _template_code)` reads `body` and idempotently inserts levels, classes, departments and subjects. Re-running it never duplicates rows.
- Only **Nigerian Secondary School** has `is_active=true`. UI lists the rest as **Coming Soon** and disables them.

## 3. Onboarding integration

Add a new step ("Academic Structure") to the existing admin onboarding wizard. Default selection is Nigerian Secondary; on confirm we call `apply_academic_template`. Schools already onboarded see the same picker on the new Academic Structure page.

## 4. Admin UI — Airtable-style screens (new under `/app/admin/academic/`)

```text
academic/structure      ← template chooser + summary cards (levels, classes, depts, subjects)
academic/classes        ← table: Class · Arms · Students · Subjects · Class Teacher · Status
academic/arms           ← table per class with inline create/edit/archive, assign teacher
academic/departments    ← rename / add / archive
academic/subjects       ← table: Subject · Code · Department · Category · Classes · Teachers · Status
academic/assignments    ← matrix: Subject × Arm (toggle required/elective)
academic/teachers       ← Teacher × Subject × Arm assignment grid
academic/promotion      ← rules editor + "Run promotion" action
```

All screens use the existing toolbar/search/filter pattern from the Workspace page (search input, status filter, count, mobile horizontal scroll wrappers). Drawers for detail editing.

## 5. Sidebar + permissions

- Add a new **Academics** sidebar group entry: "Academic Setup" (already exists, renamed to "Academic Structure"), "Classes & Arms", "Subjects", "Departments", "Promotion".
- New permission key `academic` (view + edit) added to `PERMISSION_GROUPS` under Academics. Old `classes` permission is preserved; new screens are also gated by `classes` for back-compat.
- Slotted admins respect view/edit just like the rest.

## 6. Subject inheritance (critical rule)

- Students are **never** linked directly to subjects. The student list for a subject is derived: `arm_enrollments` ⋈ `subject_arm_assignments`. A SQL view `student_subjects_v2` exposes this for the teacher/gradebook/report-card modules.
- Existing modules (attendance, gradebook, exams, results) continue to use their current foreign keys; a thin compatibility layer maps `class_id` → `arm_id` so nothing breaks. The legacy `classes` / `class_enrollments` tables stay; new arms are mirrored into them at creation time so existing exam/result code keeps working unchanged.

## 7. Promotion

- `promote_arm(_arm_id)` DB function: for each active student in the arm, evaluate `promotion_rules`, then move them to the matching arm in the next class (`promotion_target_class_id`). Students who fail rules stay; SS3 graduates move to status `graduated`.
- Admin UI: per-class "Run promotion" with dry-run preview.

## 8. Out of scope for this batch

- Custom template builder UI (only the engine + Nigerian template ship now).
- Importing legacy classes into the new arm model (we keep both, mirror new → old).
- Bulk teacher/subject CSV import (reuse the existing bulk-upload flow later).

## Technical notes

- One Supabase migration creates all tables + RLS + GRANTs + `apply_academic_template` + `promote_arm` + the `student_subjects_v2` view. A second migration inserts the Nigerian Secondary template row into `academic_templates`.
- Frontend: new folder `src/pages/admin/academic/` with one page per screen, shared hooks in `src/lib/academic.ts`. Routes registered in `App.tsx` behind `RoleGate allow="admin"`. Sidebar entries added to `AppLayout.tsx` NAV + `SECTION_OF`.
- Mobile: every table wrapped in `overflow-x-auto` (project rule).
- No hardcoded JSS/SS strings in components — labels always come from `academic_classes.name`.
