## Goal
Reorganize the admin sidebar into clean parent groups, merge Communication, surface a few stray items in Academics, add a Workspace nav, and align Profile with Settings → General. Also enable edit / delete / reschedule on exams in `planning` status.

## Sidebar (admin role)
The sidebar will become this exact list:

```
Overview      → Dashboard
People        → Students, Teachers, Parents
Admission     → Admission (single hub link)
Academics     → Classes, Timetable, Attendance, Library, Lesson Notes,
                Question Bank, Reports, Scratch Cards
Assessments   → Assessments (single hub link)
AI Ops        → AI Operation Center (single hub link)
Communication → Communication (single hub link, includes Announcements + Inbox + DMs + Channels + Broadcasts + Tickets + Parent Alerts)
Finance       → Fees & Payments, Subscription
Operations    → Hostel, Transport
System        → Workspace, Custom Roles, Academic Setup, Modules, Settings, Help
```

Everything currently in the `More` group is folded into `Communication`; the More group disappears entirely.

## New hub pages
Three small pages, each is just a heading + grid of large link cards to the existing routes — no duplicate logic:

- `src/pages/admin/AdmissionHub.tsx` → Enrollments, Invites, Bulk Upload
- `src/pages/admin/AssessmentsHub.tsx` → Exams, Exam Committee, Proctoring, Approvals, Results, Exam Appeals
- `src/pages/admin/AIOpsHub.tsx` → Copilot, Parent Alerts, Knowledge, AI Activity, AI Settings

The underlying pages and routes stay intact, so anything already linked from dashboards / deep links keeps working. We just remove the standalone sidebar entries.

## Workspace
New page `src/pages/admin/Workspace.tsx` at `/app/admin/workspace` — collaborator invites for school staff with admin-level access (separate from the student/parent onboarding Invites page). It lists existing admin/co-admin memberships from `memberships` and lets the school admin send email invites scoped to admin / teacher collaborator roles. The existing `Invites` page (student onboarding codes) stays under Admission.

## Profile ↔ Settings General
Move the “School information” block (name, email, phone, address, motto, logo) from `Settings → General` into the admin `Profile` page so the admin's profile shows the same general info. The Settings page keeps Academic, Exam, NECO etc. but drops the duplicated General tab and links to Profile instead.

## Exams — edit / delete / reschedule (planning only)
In `ExamCommittee.tsx` and `TradExams.tsx`, when a paper / session is still in `planning` status:

- show Edit (title, subject, class, duration, paper instructions)
- show Reschedule (date + start time + venue) — uses existing drag-and-drop board logic
- show Delete (soft delete, confirms first)

Once status moves to `published` or `locked`, these actions are hidden — only Unlock (admin) re-enables editing.

## Technical notes
- The live sidebar source is `src/modules/registry.ts` (manifest-driven). Changes happen there, plus matching `SECTION_OF` / `SECTION_ORDER` in `src/layouts/AppLayout.tsx`.
- Hub pages use existing `SectionCard` + `NavLink` — no new data fetches.
- Routes added in `src/App.tsx`: `admin/admission`, `admin/assessments`, `admin/ai-ops`, `admin/workspace`.
- No DB migrations needed.

## Out of scope (confirm if you want these too)
- Reworking teacher / student / parent sidebars (only admin changes here).
- Building a full collaborator invite backend if `memberships`/email invite flow needs new tables — first pass uses what's already there.
