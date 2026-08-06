import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import {
  ChevronDown, ChevronRight, GraduationCap, LayoutDashboard, Users, BookOpen, FileBarChart,
  Settings, ClipboardCheck, FilePlus2, Calendar, Library, Sparkles, MessagesSquare,
  Wallet, Activity, Sun, Moon, Search, Menu, LogOut, UserSquare2, ListChecks, PencilRuler,
  Building2, Ticket, Upload, Bus, Megaphone, NotebookPen, FolderOpen, UserCog,
  BookOpenCheck, ClipboardList, BarChart3, Award, Mail, Inbox as InboxIcon,
  Bot, Brain, ShieldAlert, Gauge, BookMarked, PenLine, Receipt, Layers,
} from "lucide-react";
import { ROLE_META, Role, useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useEnabledModules } from "@/modules/useModules";
import { MODULE_MANIFESTS } from "@/modules/registry";
import { PORTAL_NAV, hubTarget, hubSegments, type NavHub } from "@/layouts/portalNav";
import { useFeatureFlag } from "@/lib/featureFlags";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/comms/NotificationBell";
import { RealtimeNotifier } from "@/components/comms/RealtimeNotifier";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { HelpCircle, CreditCard } from "lucide-react";
import { warmSchoolCache } from "@/lib/dataCache";
import { useAdminPermissions } from "@/lib/adminPermissions";
import { ShieldCheck } from "lucide-react";
import { PilotReadOnlyBanner } from "@/components/pilot/PilotReadOnlyBanner";
import { Helmet } from "react-helmet-async";
import { GlobalSearch, type SearchGroup } from "@/components/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { Users as UsersIcon, BookOpen as BookOpenIcon, UserSquare2 as ParentIcon, GraduationCap as TeacherIcon } from "lucide-react";

// Group every sidebar destination into a labelled section.
// Keys are the `to` field used by NAV / module manifests.
const SECTION_OF: Record<string, string> = {
  "": "Overview",
  // People
  "students": "People", "teachers": "People", "children": "People",
  "parents": "People",
  // Admission hub (single nav covering enrollments / invites / bulk upload)
  "admission": "Admission",
  "enrollments": "Admission", "invites": "Admission", "bulk": "Admission",
  // Academics
  "classes": "Academics", "timetable": "Academics", "calendar": "Academics",
  "attendance": "Academics", "assignments": "Academics", "gradebook": "Academics",
  "behavior": "Academics",
  "register-subjects": "Academics",
  // Reports + Scratch Cards live inside Academics now
  "reports": "Academics", "trad-cards": "Academics",
  // Library (groups all reading / lesson-note / question-bank tools)
  "library": "Library", "lesson-notes": "Library",
  "question-bank": "Library", "resources": "Library",
  // Assessments hub (single nav covering exams / proctoring / approvals / results)
  "assessments": "Assessments",
  "tests": "Assessments", "grading": "Assessments",
  "exams": "Assessments", "results": "Assessments", "mock": "Assessments",
  "practice": "Assessments", "proctoring": "Assessments", "trad-exams": "Assessments",
  "trad-exams-approvals": "Assessments", "trad-exams-results": "Assessments", "trad-exams-grading": "Assessments",
  "exam-committee": "Assessments",
  // AI Operation Center hub (admin) + Copilot tools for other roles
  "ai-ops": "AI Ops",
  "ai-tutor": "Copilot", "ai-marking": "Copilot", "parent-alerts": "AI Ops",
  "copilot": "Copilot", "knowledge": "AI Ops", "ai-activity": "AI Ops",
  "ai-settings": "AI Ops", "lesson-plan": "Copilot",
  // Communication
  "messages": "Communication", "inbox": "Communication",
  "announcements": "Communication", "parent-comms": "Communication",
  "teacher-comms": "Communication", "activity": "Communication",
  "communication": "Communication",
  // Finance
  "fees": "Finance", "subscription": "Finance",
  "billing": "Finance",
  // Operations
  "hostel": "Operations", "transport": "Operations",
  // System
  "settings": "System", "modules": "System", "roles": "System", "/app/help": "System",
  "workspace": "System",
  "academic-setup": "System", "academic": "Academics", "exam-appeals": "Assessments",
};

const SECTION_ORDER = [
  "Overview", "People", "Admission", "Academics", "Library", "Assessments",
  "AI Ops", "Copilot", "Communication", "Finance", "Operations", "System",
];

function sectionFor(to: string) {
  return SECTION_OF[to] ?? "More";
}

// Consistent ordering for items inside the AI section across every role.
const AI_ORDER = [
  "copilot",       // admin: principal copilot
  "ai-tutor",      // student: tutor / teacher: co-teacher
  "ai-marking",    // teacher: AI essay/test marking
  "parent-alerts", // admin: AI parent risk alerts
  "knowledge",     // admin: RAG knowledge base
  "ai-activity",   // admin: AI usage / activity
  "ai-settings",   // admin: AI governance settings
];
function sortAI<T extends { to: string }>(arr: T[]) {
  return [...arr].sort((a, b) => {
    const ai = AI_ORDER.indexOf(a.to); const bi = AI_ORDER.indexOf(b.to);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

const NAV: Record<Role, { label: string; to: string; icon: any }[]> = {
  admin: [
    { label: "Dashboard", to: "",          icon: LayoutDashboard },
    { label: "Students",  to: "students",  icon: Users },
    { label: "Teachers",  to: "teachers",  icon: GraduationCap },
    { label: "Parents",   to: "parents",   icon: UserSquare2 },
    { label: "Classes",   to: "classes",   icon: BookOpen },
    { label: "Academic Structure", to: "academic", icon: Layers },
    { label: "Timetable", to: "timetable", icon: Calendar },
    { label: "Attendance", to: "attendance", icon: ClipboardCheck },
    { label: "Library",   to: "library",   icon: Library },
    { label: "Question Bank", to: "question-bank", icon: BookOpenCheck },
    { label: "Lesson Notes", to: "lesson-notes", icon: NotebookPen },
    { label: "Fees & Payments", to: "fees", icon: Wallet },
    { label: "Subscription", to: "subscription", icon: CreditCard },
    { label: "Billing", to: "billing", icon: Receipt },
    { label: "Hostel",    to: "hostel",    icon: Building2 },
    { label: "Transport", to: "transport", icon: Bus },
    { label: "Announcements", to: "announcements", icon: Megaphone },
    { label: "Inbox",     to: "inbox",     icon: InboxIcon },
    { label: "Reports",   to: "reports",   icon: FileBarChart },
    { label: "Invites",   to: "invites",   icon: Ticket },
    { label: "Bulk Upload", to: "bulk",    icon: Upload },
    { label: "Parent Alerts", to: "parent-alerts", icon: ShieldAlert },
    { label: "Copilot",   to: "copilot",   icon: Brain },
    { label: "Knowledge", to: "knowledge", icon: BookMarked },
    { label: "AI Activity", to: "ai-activity", icon: Activity },
    { label: "AI Settings", to: "ai-settings", icon: Sparkles },
    { label: "Custom Roles", to: "roles", icon: ShieldCheck },
    { label: "Academic Setup", to: "academic-setup", icon: Gauge },
    { label: "Exam Committee", to: "exam-committee", icon: ClipboardList },
    { label: "Exam Appeals", to: "exam-appeals", icon: ShieldCheck },
    { label: "Settings",  to: "settings",  icon: Settings },
    { label: "Help",      to: "/app/help", icon: HelpCircle },
  ],
  teacher: [
    { label: "Dashboard",   to: "",            icon: LayoutDashboard },
    { label: "My Classes",  to: "classes",     icon: BookOpen },
    { label: "Students",    to: "students",    icon: Users },
    { label: "Parents",     to: "parents",     icon: UserSquare2 },
    { label: "Attendance",  to: "attendance",  icon: ClipboardCheck },
    { label: "Assignments", to: "assignments", icon: ClipboardList },
    { label: "Gradebook",   to: "gradebook",   icon: BarChart3 },
    { label: "Behavior",    to: "behavior",    icon: Award },
    { label: "Parent Comms",to: "parent-comms",icon: Mail },
    { label: "Inbox",       to: "inbox",       icon: InboxIcon },
    { label: "Help & Copilot", to: "copilot",  icon: Brain },
    { label: "AI Co-Teacher", to: "ai-tutor",  icon: Bot },
    { label: "AI Marking",  to: "ai-marking",  icon: PenLine },
    { label: "Lesson Plan", to: "lesson-plan", icon: NotebookPen },
    { label: "Lesson Notes", to: "lesson-notes", icon: BookOpenCheck },
    { label: "Library",     to: "library",     icon: Library },
    { label: "Test Builder",to: "tests",       icon: FilePlus2 },
    { label: "Assessments", to: "assessments", icon: ClipboardCheck },
    { label: "Grading",     to: "grading",     icon: PencilRuler },
    { label: "Messages",    to: "messages",    icon: MessagesSquare },
    { label: "Calendar",    to: "calendar",    icon: Calendar },
    { label: "Resources",   to: "resources",   icon: FolderOpen },
    { label: "Driver mode", to: "/app/driver/trip", icon: Bus },
    { label: "Reports",     to: "reports",     icon: FileBarChart },
    { label: "Help",        to: "/app/help",   icon: HelpCircle },
  ],
  student: [
    { label: "Dashboard",  to: "",          icon: LayoutDashboard },
    { label: "My Classes", to: "classes",   icon: BookOpen },
    { label: "Assignments",to: "assignments", icon: ClipboardList },
    { label: "Attendance", to: "attendance", icon: ClipboardCheck },
    { label: "Exams",      to: "exams",     icon: ListChecks },
    { label: "My Assessments", to: "assessments", icon: ClipboardCheck },
    { label: "NECO/JAMB Mock", to: "mock",  icon: Award },
    { label: "Practice",   to: "practice",  icon: Sparkles },
    { label: "Results",    to: "results",   icon: FileBarChart },
    { label: "Gradebook",  to: "gradebook", icon: BarChart3 },
    { label: "Behavior",   to: "behavior",  icon: Award },
    { label: "Library",    to: "library",   icon: Library },
    { label: "Lesson Notes", to: "lesson-notes", icon: BookOpen },
    { label: "AI Tutor",   to: "ai-tutor",  icon: Sparkles },
    { label: "Fees",       to: "fees",      icon: Wallet },
    { label: "Bus tracking", to: "transport", icon: Bus },
    { label: "Inbox",      to: "inbox",     icon: InboxIcon },
    { label: "Messages",   to: "messages",  icon: MessagesSquare },
    { label: "Calendar",   to: "calendar",  icon: Calendar },
    { label: "Help",       to: "/app/help", icon: HelpCircle },
  ],
  parent: [
    { label: "Dashboard",       to: "",            icon: LayoutDashboard },
    { label: "My Children",     to: "children",    icon: UserSquare2 },
    { label: "Academic Records",to: "results",     icon: FileBarChart },
    { label: "Attendance",      to: "attendance",  icon: ClipboardCheck },
    { label: "Behavior",        to: "behavior",    icon: Award },
    { label: "Teacher Comms",   to: "teacher-comms", icon: Mail },
    { label: "Inbox",           to: "inbox",         icon: InboxIcon },
    { label: "Activity Feed",   to: "activity",    icon: Activity },
    { label: "Fees & Payments", to: "fees",        icon: Wallet },
    { label: "Messages",        to: "messages",    icon: MessagesSquare },
    { label: "Bus tracking",    to: "transport",   icon: Bus },
    { label: "Calendar",        to: "calendar",    icon: Calendar },
    { label: "Help",            to: "/app/help",   icon: HelpCircle },
  ],
};

const TITLES: Record<string, { title: string; sub: string }> = {
  "":           { title: "Dashboard",          sub: "Overview" },
  "students":   { title: "Students",           sub: "Manage all enrolled students" },
  "teachers":   { title: "Teachers",           sub: "Manage staff and assignments" },
  "parents":    { title: "Parents",            sub: "Manage parents and link them to their children" },
  "classes":    { title: "Classes",            sub: "All active classes" },
  "timetable":  { title: "Timetable",          sub: "Weekly schedule" },
  "hostel":     { title: "Hostel",             sub: "Accommodation" },
  "transport":  { title: "Transport",          sub: "Routes & vehicles" },
  "announcements": { title: "Announcements",   sub: "Broadcast updates" },
  "reports":    { title: "Reports",            sub: "Performance & insights" },
  "invites":    { title: "Invites",            sub: "Generate onboarding codes" },
  "bulk":       { title: "Bulk Upload",        sub: "Onboard members from CSV" },
  "settings":   { title: "Settings",           sub: "School preferences" },
  "attendance": { title: "Attendance",         sub: "Daily attendance" },
  "tests":      { title: "Test Builder",       sub: "Create assessments" },
  "assessments":{ title: "Assessments",        sub: "Unified tests, exams, and AI assessments" },
  "grading":    { title: "Grading",            sub: "Review submissions" },
  "exams":      { title: "Exam Interface",     sub: "Computer-based test" },
  "results":    { title: "Results",            sub: "Performance summary" },
  "library":    { title: "Library",            sub: "Books & resources" },
  "question-bank": { title: "Question Bank",   sub: "Reusable NECO-style questions" },
  "ai-tutor":   { title: "AI Tutor",           sub: "Ask anything, learn faster" },
  "calendar":   { title: "Calendar",           sub: "Upcoming events" },
  "children":   { title: "My Children",        sub: "Overview of your children" },
  "activity":   { title: "Activity Feed",      sub: "Latest updates" },
  "fees":       { title: "Fees & Payments",    sub: "Pay & track invoices" },
  "messages":   { title: "Messages",           sub: "Conversations" },
  "lesson-plan":{ title: "Lesson Plan",        sub: "Plan and save your lessons" },
  "lesson-notes":{ title: "Lesson Notes",      sub: "AI-generated lesson notes with admin approval" },
  "resources":  { title: "Resources",          sub: "Files shared with the school" },
  "profile":    { title: "My Profile",         sub: "Personal info & photo" },
  "assignments":{ title: "Assignments",        sub: "Homework and projects" },
  "gradebook":  { title: "Gradebook",          sub: "Continuous-assessment scores" },
  "behavior":   { title: "Behavior",           sub: "Commendations & incidents" },
  "parent-comms":{ title: "Parent Communications", sub: "Direct updates to parents" },
  "teacher-comms":{ title: "Teacher Messages", sub: "Updates from your child's teachers" },
  "inbox":      { title: "Inbox",              sub: "All your conversations" },
  "mock":       { title: "NECO / JAMB Mock",   sub: "Pick subjects and sit a UTME-style timed mock" },
  "practice":   { title: "Practice Mode",      sub: "Study from your library — no timer, no score" },
  "ai-marking":  { title: "AI Essay Marking",   sub: "Upload essays and let AI draft rubric-based feedback" },
  "parent-alerts":{ title: "Parent Risk Alerts", sub: "AI-drafted alerts for attendance, grades, and fees" },
  "copilot":     { title: "Principal Copilot",  sub: "Ask anything about your school — backed by live data" },
  "knowledge":   { title: "Knowledge Base",     sub: "Curate documents the AI can reason over" },
  "ai-activity": { title: "AI Activity",        sub: "Usage, latency, and spend by feature" },
  "ai-settings": { title: "AI Settings",        sub: "Budgets and feature toggles for AI" },
  "roles":       { title: "Custom Admin Roles", sub: "Define up to 3 sub-admin roles and what they can access" },
};

export default function AppLayout() {
  const { school, activeRole, theme, toggleTheme, signOut, displayName, email, photoUrl } = useSchool();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: enabledModules } = useEnabledModules(school?.id);
  const { isFullAdmin, allowed, slotRow } = useAdminPermissions();
  const { enabled: busTrackingEnabled, loading: busFlagLoading } = useFeatureFlag(school?.id, "transport.bus_tracking");

  useEffect(() => {
    if (school?.id) warmSchoolCache(school.id, activeRole);
  }, [school?.id, activeRole]);

  if (!school || !activeRole) return <Navigate to={schoolPath(school?.slug, "/signin")} replace />;

  const meta = ROLE_META[activeRole];
  // ---- Navigation: max 8 hubs per portal, related pages become hub tabs. ----
  // Modules that a school has switched off hide their destinations (tabs), not
  // whole sidebar rows.
  const enabledTos = new Set(
    (enabledModules ?? [])
      .flatMap(m => m.sidebar)
      .filter(i => i.roles.includes(activeRole))
      .map(i => i.to)
  );
  const manifestTos = new Set(
    MODULE_MANIFESTS.flatMap(m => m.sidebar)
      .filter(i => i.roles.includes(activeRole))
      .map(i => i.to)
  );
  const moduleHidden = (to: string) =>
    enabledTos.size > 0 && manifestTos.has(to) && !enabledTos.has(to);
  // Sub-admins only see what their slot allows. Billing reuses `subscription`;
  // academic structure accepts the legacy `classes` key.
  const permKeyFor = (to: string) => (to === "billing" ? "subscription" : to);
  const permAllows = (to: string) => {
    if (activeRole !== "admin" || isFullAdmin) return true;
    if (!to || to.startsWith("/")) return true;
    if (to === "academic") return allowed.has("academic") || allowed.has("classes");
    return allowed.has(permKeyFor(to));
  };
  const busHidden = (to: string) =>
    !busFlagLoading && busTrackingEnabled === false &&
    (to === "transport" || to === "/app/driver/trip");
  const visible = (to: string) => permAllows(to) && !busHidden(to) && !moduleHidden(to);

  const hubs: NavHub[] = PORTAL_NAV[activeRole]
    .map(h => ({ ...h, tabs: h.tabs.filter(t => visible(t.to)) }))
    .filter(h => (h.to !== undefined ? visible(h.to) : h.tabs.length > 0));
  const userLabel = displayName || email || "User";
  const initials = userLabel.split(/[\s@]/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
  // Show the slot's assigned role name for sub-admins, otherwise the portal role.
  const roleLabel = activeRole === "admin" && !isFullAdmin && slotRow?.name
    ? slotRow.name
    : activeRole;

  const { pathname } = useLocation();

  // Build search palette groups from the same items the sidebar renders.
  const pathFor = (to: string) =>
    !to
      ? schoolPath(school.slug, `/app/${activeRole}`)
      : to.startsWith("/")
        ? schoolPath(school.slug, to)
        : schoolPath(school.slug, `/app/${activeRole}/${to}`);
  const searchGroups: SearchGroup[] = hubs.map((hub) => ({
    heading: hub.label,
    items: (hub.tabs.length
      ? hub.tabs
      : [{ label: hub.label, to: hubTarget(hub), icon: hub.icon }]
    ).map((it) => ({
      label: it.label,
      to: pathFor(it.to),
      icon: it.icon,
      hint: hub.label,
      keywords: [hub.label, it.to],
    })),
  }));

  // Which hub owns the current route (drives sidebar highlight + tab bar).
  const afterRole = pathname.split(`/app/${activeRole}`)[1] ?? "";
  const currentSeg = afterRole.replace(/^\//, "").split("/")[0] ?? "";
  const matchesSeg = (to: string) =>
    to.startsWith("/") ? pathname.endsWith(to) : to === currentSeg;
  const activeHub =
    hubs.find(h => hubSegments(h).some(s => (s === "" ? currentSeg === "" && !afterRole.replace(/^\//, "") : matchesSeg(s))))
    ?? undefined;

  // Dynamic search — everyone can search announcements/exams/assignments;
  // admin & teacher additionally get the people & classes directory.
  const canDirectorySearch = activeRole === "admin" || activeRole === "teacher";
  const fetcher = async (q: string) => {
        const like = `%${q}%`;
        const groups: SearchGroup[] = [];
        // ---- Content search (all roles) ----
        try {
          const rolePath = (seg: string) => schoolPath(school.slug, `/app/${activeRole}/${seg}`);
          const [{ data: anns }, { data: exms }, { data: asgs }] = await Promise.all([
            supabase.from("announcements")
              .select("id,title,body,created_at")
              .eq("school_id", school.id)
              .or(`title.ilike.${like},body.ilike.${like}`)
              .order("created_at", { ascending: false })
              .limit(6),
            supabase.from("exams")
              .select("id,title,scheduled_at")
              .eq("school_id", school.id)
              .ilike("title", like)
              .order("scheduled_at", { ascending: false, nullsFirst: false })
              .limit(6),
            (activeRole === "teacher" || activeRole === "student")
              ? supabase.from("assignments")
                  .select("id,title,due_at")
                  .eq("school_id", school.id)
                  .ilike("title", like)
                  .order("due_at", { ascending: false, nullsFirst: false })
                  .limit(6)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          if (anns?.length) {
            groups.push({
              heading: "Announcements",
              items: anns.map((a: any) => ({
                label: a.title,
                hint: a.body ? String(a.body).slice(0, 60) : "Announcement",
                to: `${rolePath("communication/announcements")}?q=${encodeURIComponent(q)}`,
                icon: Megaphone,
                keywords: ["announcement", a.body ?? ""],
              })),
            });
          }
          if (exms?.length) {
            const examSeg =
              activeRole === "admin" ? "trad-exams"
              : activeRole === "teacher" ? "trad-exams"
              : activeRole === "student" ? "trad-exams"
              : "calendar";
            groups.push({
              heading: "Exams",
              items: exms.map((e: any) => ({
                label: e.title,
                hint: e.scheduled_at ? new Date(e.scheduled_at).toLocaleDateString() : "Exam",
                to: `${rolePath(examSeg)}?q=${encodeURIComponent(q)}`,
                icon: ClipboardCheck,
                keywords: ["exam", "test"],
              })),
            });
          }
          if (asgs?.length) {
            groups.push({
              heading: "Assignments",
              items: asgs.map((a: any) => ({
                label: a.title,
                hint: a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : "Assignment",
                to: `${rolePath("assignments")}?q=${encodeURIComponent(q)}`,
                icon: ClipboardList,
                keywords: ["assignment", "homework"],
              })),
            });
          }
        } catch { /* noop */ }

        // Quick-nav shortcuts for Attendance & Reports across roles.
        const q2 = q.toLowerCase();
        const shortcuts: { label: string; seg: string; icon: any; match: string[] }[] = [
          { label: "Attendance", seg: "attendance", icon: ClipboardCheck, match: ["attendance", "present", "absent"] },
          { label: activeRole === "student" || activeRole === "parent" ? "Results" : "Reports",
            seg: activeRole === "student" || activeRole === "parent" ? "results" : "reports",
            icon: FileBarChart, match: ["report", "reports", "results", "grade", "grades"] },
        ];
        const navItems = shortcuts
          .filter(s => s.match.some(m => m.includes(q2) || q2.includes(m)))
          .map(s => ({
            label: `Go to ${s.label}`,
            to: schoolPath(school.slug, `/app/${activeRole}/${s.seg}`),
            icon: s.icon,
            hint: "Shortcut",
          }));
        if (navItems.length) groups.push({ heading: "Shortcuts", items: navItems });

        if (!canDirectorySearch) return groups;
        // ---- People & classes directory (admin/teacher) ----
        try {
          const allowedRoles = (activeRole === "admin"
            ? ["student", "teacher", "parent"]
            : ["student"]) as ("student" | "teacher" | "parent")[];
          const [{ data: profiles }, { data: classes }] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, full_name, email")
              .or(`full_name.ilike.${like},email.ilike.${like}`)
              .limit(40),
            supabase
              .from("classes")
              .select("id, name")
              .eq("school_id", school.id)
              .ilike("name", like)
              .limit(8),
          ]);
          const ids = (profiles ?? []).map((p: any) => p.id);
          let mems: { user_id: string; role: string }[] = [];
          if (ids.length) {
            const { data } = await supabase
              .from("memberships")
              .select("user_id, role")
              .eq("school_id", school.id)
              .eq("status", "active")
              .in("role", allowedRoles)
              .in("user_id", ids);
            mems = (data ?? []) as any;
          }
          const roleByUser = new Map(mems.map((m) => [m.user_id, m.role]));
          const bucket: Record<string, any[]> = { student: [], teacher: [], parent: [] };
          (profiles ?? []).forEach((p: any) => {
            const role = roleByUser.get(p.id);
            if (!role || !bucket[role]) return;
            const target =
              role === "student"
                ? schoolPath(school.slug, `/app/${activeRole}/students`)
                : role === "teacher"
                  ? schoolPath(school.slug, `/app/${activeRole}/teachers`)
                  : schoolPath(school.slug, `/app/${activeRole}/parents`);
            bucket[role].push({
              label: p.full_name || p.email,
              hint: p.full_name && p.email ? p.email : role,
              to: `${target}?q=${encodeURIComponent(q)}`,
              icon: role === "teacher" ? TeacherIcon : role === "parent" ? ParentIcon : UsersIcon,
              keywords: [role, p.email ?? ""],
            });
          });
          if (bucket.student.length) groups.push({ heading: "Students", items: bucket.student.slice(0, 6) });
          if (bucket.teacher.length) groups.push({ heading: "Teachers", items: bucket.teacher.slice(0, 6) });
          if (bucket.parent.length) groups.push({ heading: "Parents", items: bucket.parent.slice(0, 6) });
          if (classes?.length) {
            groups.push({
              heading: "Classes",
              items: classes.map((c: any) => ({
                label: c.name,
                to: `${schoolPath(school.slug, `/app/${activeRole}/classes`)}?q=${encodeURIComponent(q)}`,
                icon: BookOpenIcon,
                hint: "Class",
              })),
            });
          }
        } catch {
          /* noop */
        }
        return groups;
      };

  return (
    <div className="min-h-screen flex bg-background">
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <RealtimeNotifier />
      <PWAInstallPrompt schoolName={school?.name} />
      <aside className={cn(
        "fixed lg:sticky lg:top-0 lg:h-screen lg:self-start inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[76px]" : "w-[260px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: meta.color, color: "white" }}>
            {school.logo_url ? (
              <img src={school.logo_url} alt="" className="size-9 rounded-md object-contain bg-white/90 p-0.5" />
            ) : (
              <div className="grid place-items-center size-9 rounded-md bg-white/15 backdrop-blur"><GraduationCap className="size-5" /></div>
            )}
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <div className="font-display font-bold text-base truncate">{school.name}</div>
                <div className="text-[11px] opacity-90 truncate">{meta.portal}</div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {hubs.map((hub) => {
              const Icon = hub.icon;
              const isActive = activeHub?.key === hub.key;
              return (
                <NavLink
                  key={hub.key}
                  to={pathFor(hubTarget(hub))}
                  title={collapsed ? hub.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{hub.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="size-9 border border-sidebar-border ring-2 ring-background">
              {photoUrl && <AvatarImage src={photoUrl} alt={userLabel} />}
              <AvatarFallback style={{ background: meta.color, color: "white" }} className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{userLabel}</div>
                <div className="text-[11px] text-muted-foreground truncate capitalize">{roleLabel}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button variant="ghost" size="sm" className="w-full justify-start mt-3 text-muted-foreground" onClick={signOut}>
              <LogOut className="size-4 mr-2" /> Logout
            </Button>
          )}
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-4 lg:px-8 py-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setCollapsed(c => !c)}><Menu className="size-5" /></Button>
            <PageHeading />
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch
                groups={searchGroups}
                fetcher={fetcher}
                placeholder="Search pages, people, classes…"
              />
              <Button variant="ghost" size="icon" onClick={toggleTheme}>{theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}</Button>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-secondary/60">
                    <Avatar className="size-9 ring-2 ring-background">
                      {photoUrl && <AvatarImage src={photoUrl} alt={userLabel} />}
                      <AvatarFallback style={{ background: meta.color, color: "white" }} className="text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left leading-tight">
                      <div className="text-sm font-semibold">{userLabel}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{roleLabel}</div>
                    </div>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{school.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <NavLink to={schoolPath(school.slug, `/app/profile`)} className="flex items-center gap-2 cursor-pointer">
                      <UserCog className="size-4" /> My profile
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={signOut}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden px-3 sm:px-4 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-6 animate-fade-in">
          {activeHub && activeHub.tabs.length > 1 && (
            <div className="-mx-3 sm:-mx-4 lg:-mx-8 mb-4 border-b border-border">
              <div className="flex gap-1 overflow-x-auto px-3 sm:px-4 lg:px-8 scrollbar-none">
                {activeHub.tabs.map((t) => {
                  const active = matchesSeg(t.to);
                  return (
                    <NavLink
                      key={t.to + t.label}
                      to={pathFor(t.to)}
                      className={cn(
                        "whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                        active
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          )}
          <AdminPermissionGuard />
          <PilotReadOnlyBanner />
          <Outlet />
        </main>
      </div>

      {activeRole && (
        <NavLink
          to={schoolPath(school.slug, `/app/${activeRole}/copilot`)}
          title={activeRole === "admin" ? "Ask Principal Copilot" : "Ask Portal Copilot"}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full pl-4 pr-5 py-3 shadow-lg bg-primary text-primary-foreground hover:opacity-90 transition-all hover:scale-105"
        >
          <Brain className="size-5" />
          <span className="hidden sm:inline text-sm font-semibold">Ask Copilot</span>
        </NavLink>
      )}
    </div>
  );
}

function PageHeading() {
  const { activeRole, school } = useSchool();
  const { pathname } = useLocation();
  if (!activeRole || !school) return null;
  const segs = pathname.split("/").filter(Boolean);  // ["app", role, ...sub]
  const sub = segs.slice(2).join("/");
  const meta = TITLES[sub] ?? { title: ROLE_META[activeRole].name + " Portal", sub: school.name };
  return (
    <div className="min-w-0">
      <h1 className="font-display text-lg sm:text-xl font-bold leading-tight truncate">{meta.title}</h1>
      <p className="text-xs text-muted-foreground truncate">{meta.sub}</p>
    </div>
  );
}

/** Sub-admins (memberships with admin_slot set) are only allowed on routes
 *  matching their slot's permission keys. The dashboard root and the Roles page
 *  itself stay off-limits (Roles is full-admin only). */
function AdminPermissionGuard() {
  const { activeRole, school } = useSchool();
  const { isFullAdmin, allowed, loading } = useAdminPermissions();
  const { pathname } = useLocation();
  if (!school || activeRole !== "admin" || isFullAdmin || loading) return null;
  const prefix = `/${school.slug}/app/admin`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).replace(/^\//, "").split("/")[0];
  if (!rest) return null; // dashboard always visible
  if (rest === "roles") return <Navigate to={prefix} replace />; // full-admin only
  if (rest === "billing") return allowed.has("subscription") ? null : <Navigate to={prefix} replace />;
  if (rest === "academic") return (allowed.has("academic") || allowed.has("classes")) ? null : <Navigate to={prefix} replace />;
  if (allowed.has(rest)) return null;
  return <Navigate to={prefix} replace />;
}

function SidebarSection({
  section, items, collapsed, isFirstSection, activeRole, schoolSlug, pathname, onNavigate,
}: {
  section: string;
  items: { label: string; to: string; icon: any }[];
  collapsed: boolean;
  isFirstSection: boolean;
  activeRole: Role;
  schoolSlug: string;
  pathname: string;
  onNavigate: () => void;
}) {
  const pathFor = (to: string) =>
    !to
      ? schoolPath(schoolSlug, `/app/${activeRole}`)
      : to.startsWith("/")
        ? schoolPath(schoolSlug, to)
        : schoolPath(schoolSlug, `/app/${activeRole}/${to}`);

  const containsActive = items.some(it => {
    const p = pathFor(it.to);
    return !it.to ? pathname === p : pathname === p || pathname.startsWith(p + "/");
  });

  // Single-item or Overview groups never collapse — render flat.
  const isCollapsible = false;
  const storageKey = `sidebar:open:${activeRole}:${section}`;

  const [open, setOpen] = useState<boolean>(() => {
    if (!isCollapsible) return true;
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {}
    return containsActive; // default: open if it owns the active route
  });

  // Force the group open whenever navigation lands inside it.
  useEffect(() => {
    if (isCollapsible && containsActive) setOpen(true);
  }, [containsActive, isCollapsible]);

  const toggle = () => {
    setOpen(o => {
      const next = !o;
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <div>
      {!collapsed && (
        isCollapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="w-full flex items-center justify-between px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            <span>{section}</span>
            <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section}
          </div>
        )
      )}
      {collapsed && !isFirstSection && (
        <div className="mx-3 mb-1.5 h-px bg-sidebar-border" />
      )}
      {(collapsed || !isCollapsible || open) && (
        <ul className="space-y-1">
          {items.map((it) => {
            const path = pathFor(it.to);
            return (
              <li key={path}>
                <NavLink
                  to={path}
                  end={!it.to}
                  onClick={onNavigate}
                  title={collapsed ? it.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                    )
                  }
                >
                  <it.icon className="size-[18px] shrink-0" />
                  {!collapsed && <span>{it.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
