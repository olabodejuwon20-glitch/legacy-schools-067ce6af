# Sidebar Simplification — Max 8 Sections Per Portal

Every portal sidebar becomes a flat list of at most 8 destinations. Related pages merge into hub pages with tabs, so nothing is removed — only regrouped. Existing hubs (Admission, Assessments, AI Operation Center, Communication) already prove the pattern; this extends it everywhere.

## Admin — management & day-to-day administration

1. Dashboard
2. People — Students, Teachers, Parents, Classes, Admission (enrollments, invites, bulk upload), Custom Roles
3. Academics — Academic Structure, Timetable, Attendance, Reports
4. Assessments — exams, question bank, exam committee, appeals, scratch cards, proctoring
5. Library — library, lesson notes, resources
6. Finance — Fees & Payments, Subscription, Billing
7. AI Operation Center — copilot, parent alerts, knowledge, activity, settings (already a hub)
8. School Settings — settings, modules, workspace, hostel, transport, help

Communication stays reachable from the header (inbox icon + notification bell) plus a tab inside Dashboard quick actions, since it is already its own full-screen hub.

## Teacher — teaching & assessment

1. Dashboard
2. My Classes — classes, students, parents
3. Attendance
4. Assignments — assignments, gradebook, behavior
5. Assessments — test builder, assessments, grading, exam papers, grading queue
6. Teaching Tools — lesson plan, lesson notes, library, resources, question bank
7. AI Assistant — AI co-teacher, AI marking, copilot
8. Communication — inbox, messages, parent comms, calendar, reports

## Student — learning focused

1. Dashboard
2. My Classes — classes, register subjects, calendar
3. Learn — library, lesson notes, practice
4. Assignments
5. Exams — exams, my assessments, NECO/JAMB mock, trad exams
6. Results — results, gradebook, behavior, attendance
7. AI Tutor
8. More — fees, inbox/messages, bus tracking, help

## Parent — monitoring their child

1. Dashboard
2. My Children
3. Academic Records — results, gradebook
4. Attendance
5. Behavior
6. Messages — inbox, teacher comms, messages
7. Fees & Payments
8. More — activity feed, calendar, bus tracking, help

## Technical approach

- Add a `HubPage` shared component (header + horizontal tab bar + `Outlet`) modelled on the existing `AdmissionHub` / `CommsHub` pattern, so hub children keep their own routes and remain deep-linkable.
- Rewrite the sidebar source of truth: replace the per-role flat `NAV` lists and the `SECTION_OF` / `SECTION_ORDER` grouping in `src/layouts/AppLayout.tsx` with one `PORTAL_NAV` map of exactly 8 entries per role. Drop the collapsible `SidebarSection` grouping — the list is short enough to render flat.
- Update `src/modules/registry.ts` so each module's `sidebar` entries point at its hub route instead of adding a new top-level button; module enable/disable then hides the corresponding hub tab rather than a sidebar row.
- Add hub routes in `src/App.tsx` as parent routes with the existing pages as children (e.g. `/app/admin/people` → `students | teachers | parents | classes | admission`). Keep every current URL working via redirects so bookmarks and in-app links don't break.
- Highlight the active hub in the sidebar when any child route is active, and highlight the active tab inside the hub.
- Sub-admin permission filtering (`useAdminPermissions`) and the transport feature flag now filter hub *tabs*; a hub with zero permitted tabs is hidden from the sidebar.
- Global search (Cmd+K) keeps indexing individual pages, so merged destinations stay one keystroke away.
- Mobile: hub tabs scroll horizontally; sidebar stays a slide-over sheet.

## Out of scope

No page content, business logic, or data changes — only navigation structure and the new hub shells.
