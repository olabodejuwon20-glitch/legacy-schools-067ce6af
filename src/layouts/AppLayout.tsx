import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom";
import {
  ChevronDown, ChevronRight, GraduationCap, LayoutDashboard, Users, BookOpen, FileBarChart,
  Settings, ClipboardCheck, FilePlus2, Calendar, Library, Sparkles, MessagesSquare,
  Wallet, Activity, Sun, Moon, Search, Menu, LogOut, UserSquare2, ListChecks, PencilRuler,
  Building2, Ticket, Upload, Bus, Megaphone, NotebookPen, FolderOpen, UserCog,
  BookOpenCheck, ClipboardList, BarChart3, Award, Mail, Inbox as InboxIcon,
  Bot, Brain, ShieldAlert, Gauge, BookMarked, PenLine,
} from "lucide-react";
import { ROLE_META, Role, useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useEnabledModules } from "@/modules/useModules";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/comms/NotificationBell";
import { RealtimeNotifier } from "@/components/comms/RealtimeNotifier";
import { HelpCircle, CreditCard } from "lucide-react";
import { warmSchoolCache } from "@/lib/dataCache";
import { useAdminPermissions } from "@/lib/adminPermissions";
import { ShieldCheck } from "lucide-react";

// Group every sidebar destination into a labelled section.
// Keys are the `to` field used by NAV / module manifests.
const SECTION_OF: Record<string, string> = {
  "": "Overview",
  // People
  "students": "People", "teachers": "People", "children": "People",
  "parents": "People",
  // Admission (formerly Enrollments) — invites + bulk upload live here too
  "enrollments": "Admission", "invites": "Admission", "bulk": "Admission",
  // Academics
  "classes": "Academics", "timetable": "Academics", "calendar": "Academics",
  "attendance": "Academics", "assignments": "Academics", "gradebook": "Academics",
  "behavior": "Academics",
  "register-subjects": "Academics",
  // Library (groups all reading / lesson-note / question-bank tools)
  "library": "Library", "lesson-notes": "Library",
  "question-bank": "Library", "resources": "Library",
  // Assessments
  "tests": "Assessments", "assessments": "Assessments", "grading": "Assessments",
  "exams": "Assessments", "results": "Assessments", "mock": "Assessments",
  "practice": "Assessments", "proctoring": "Assessments", "trad-exams": "Assessments",
  "trad-exams-approvals": "Assessments", "trad-exams-results": "Assessments", "trad-exams-grading": "Assessments",
  // Copilot (all AI features grouped here)
  "ai-tutor": "Copilot", "ai-marking": "Copilot", "parent-alerts": "Copilot",
  "copilot": "Copilot", "knowledge": "Copilot", "ai-activity": "Copilot",
  "ai-settings": "Copilot", "lesson-plan": "Copilot",
  // Communication
  "messages": "Communication", "inbox": "Communication",
  "announcements": "Communication", "parent-comms": "Communication",
  "teacher-comms": "Communication", "activity": "Communication",
  // Finance
  "fees": "Finance",
  // Operations
  "hostel": "Operations", "transport": "Operations",
  // Reports
  "reports": "Reports",
  // System
  "settings": "System", "modules": "System", "roles": "System", "/app/help": "System",
};

const SECTION_ORDER = [
  "Overview", "People", "Admission", "Academics", "Library", "Assessments",
  "Copilot", "Communication", "Finance", "Operations", "Reports", "System",
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
    { label: "Timetable", to: "timetable", icon: Calendar },
    { label: "Attendance", to: "attendance", icon: ClipboardCheck },
    { label: "Library",   to: "library",   icon: Library },
    { label: "Question Bank", to: "question-bank", icon: BookOpenCheck },
    { label: "Lesson Notes", to: "lesson-notes", icon: NotebookPen },
    { label: "Fees & Payments", to: "fees", icon: Wallet },
    { label: "Subscription", to: "subscription", icon: CreditCard },
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
  const { isFullAdmin, allowed } = useAdminPermissions();

  useEffect(() => {
    if (school?.id) warmSchoolCache(school.id, activeRole);
  }, [school?.id, activeRole]);

  if (!school || !activeRole) return <Navigate to={schoolPath(school?.slug, "/signin")} replace />;

  const meta = ROLE_META[activeRole];
  // Build sidebar dynamically from enabled module manifests; fall back to static NAV
  // until module data has hydrated (prevents an empty sidebar flash).
  const moduleItems = (enabledModules ?? [])
    .flatMap(m => m.sidebar.map(item => ({ ...item, _slug: m.slug })))
    .filter(item => item.roles.includes(activeRole));
  const seen = new Set<string>();
  const items = moduleItems.length
    ? moduleItems
        .filter(it => {
          const key = `${it.to}|${it.label}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(({ label, to, icon }) => ({ label, to, icon }))
    : NAV[activeRole];
  // Restrict sidebar for slotted (sub-)admins. Dashboard ("") and absolute paths stay visible.
  const filteredItems = activeRole === "admin" && !isFullAdmin
    ? items.filter(it => it.to === "" || it.to.startsWith("/") || allowed.has(it.to))
    : items;
  // Group items into sections preserving the role-defined order within each group.
  const grouped = new Map<string, typeof items>();
  filteredItems.forEach((it) => {
    const key = sectionFor(it.to);
    if (!grouped.has(key)) grouped.set(key, [] as any);
    (grouped.get(key) as any).push(it);
  });
  // Apply deterministic ordering inside the AI section so every portal lists
  // AI tools in the same sequence.
  if (grouped.has("Copilot")) grouped.set("Copilot", sortAI(grouped.get("Copilot") as any) as any);
  const orderedSections = [
    ...SECTION_ORDER.filter(s => grouped.has(s)),
    ...Array.from(grouped.keys()).filter(s => !SECTION_ORDER.includes(s)),
  ];
  const userLabel = displayName || email || "User";
  const initials = userLabel.split(/[\s@]/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();

  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      <RealtimeNotifier />
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
          <div className="space-y-5">
            {orderedSections.map((section) => (
            <SidebarSection
              key={section}
              section={section}
              items={(grouped.get(section) ?? []) as any}
              collapsed={collapsed}
              isFirstSection={section === orderedSections[0]}
              activeRole={activeRole}
              schoolSlug={school.slug}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
          </div>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          {!collapsed && (
            <div className="mb-3 rounded-lg border border-sidebar-border p-3 bg-card/50">
              <div className="flex items-center gap-2"><Building2 className="size-3.5 text-muted-foreground" /><div className="text-xs font-semibold text-foreground truncate">{school.name}</div></div>
              <div className="text-[11px] text-muted-foreground truncate">/{school.slug}</div>
            </div>
          )}
          <div className="flex items-center gap-3 px-1">
            <Avatar className="size-9 border border-sidebar-border ring-2 ring-background">
              {photoUrl && <AvatarImage src={photoUrl} alt={userLabel} />}
              <AvatarFallback style={{ background: meta.color, color: "white" }} className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{userLabel}</div>
                <div className="text-[11px] text-muted-foreground truncate capitalize">{activeRole}</div>
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
              <div className="hidden md:flex relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search anything..." className="pl-9 w-[260px] bg-secondary/60 border-transparent focus-visible:bg-card" />
              </div>
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
                      <div className="text-[11px] text-muted-foreground capitalize">{activeRole}</div>
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
          <AdminPermissionGuard />
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
