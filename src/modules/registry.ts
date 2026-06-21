import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, Library, BookOpenCheck,
  NotebookPen, Wallet, Building2, Bus, Megaphone, FileBarChart, Ticket, Upload, Settings,
  ClipboardCheck, ClipboardList, BarChart3, Award, Mail, FilePlus2, PencilRuler, MessagesSquare,
  FolderOpen, ListChecks, Sparkles, UserSquare2, Activity, Package,
  Bot, Brain, ShieldAlert, Gauge, BookMarked, PenLine,
  ScrollText, Inbox as InboxIcon,
} from "lucide-react";
import { UserPlus, Workflow } from "lucide-react";
import { ModuleManifest } from "./types";

/**
 * In-repo module manifests. Each slug should match a row in public.modules.
 * When a school_modules row exists, `enabled` controls visibility.
 * When no row exists, modules marked `core: true` stay on; others fall back to on as well
 * for backwards compatibility (until super admin starts curating per-school modules).
 */
export const MODULE_MANIFESTS: ModuleManifest[] = [
  // ---- CORE (always on) ----
  {
    slug: "core-dashboard", name: "Dashboard", category: "academics", icon: LayoutDashboard, core: true,
    sidebar: [
      { label: "Dashboard", to: "",         icon: LayoutDashboard, roles: ["admin", "teacher", "student", "parent"] },
    ],
  },

  // ---- ADMIN ops ----
  {
    slug: "school-directory", name: "School Directory", category: "operations", icon: Users, core: true,
    sidebar: [
      { label: "Students",  to: "students",  icon: Users,         roles: ["admin"] },
      { label: "Parents",   to: "parents",   icon: UserSquare2,   roles: ["admin"] },
      { label: "Teachers",  to: "teachers",  icon: GraduationCap, roles: ["admin"] },
      { label: "Classes",   to: "classes",   icon: BookOpen,      roles: ["admin"] },
    ],
  },
  // ---- Admission hub (single parent nav grouping enrollments/invites/bulk) ----
  {
    slug: "admission-hub", name: "Admission", category: "operations", icon: UserPlus, core: true,
    sidebar: [
      { label: "Admission", to: "admission", icon: UserPlus, roles: ["admin"] },
    ],
  },
  // ---- Assessments hub (single parent nav grouping exams, proctoring, approvals, results) ----
  {
    slug: "assessments-hub", name: "Assessments", category: "academics", icon: ClipboardList, core: true,
    sidebar: [
      { label: "Assessments", to: "assessments", icon: ClipboardList, roles: ["admin"] },
    ],
  },
  // ---- AI Operation Center hub (Copilot, Parent Alerts, Knowledge, AI Activity, AI Settings) ----
  {
    slug: "ai-ops-hub", name: "AI Operation Center", category: "intelligence", icon: Brain, core: true,
    sidebar: [
      { label: "AI Operation Center", to: "ai-ops", icon: Brain, roles: ["admin"] },
    ],
  },
  // ---- Workspace (collaborator invites for staff with admin access) ----
  {
    slug: "workspace", name: "Workspace", category: "operations", icon: Workflow, core: true,
    sidebar: [
      { label: "Workspace", to: "workspace", icon: Workflow, roles: ["admin"] },
    ],
  },
  {
    slug: "timetable", name: "Timetable", category: "academics", icon: Calendar,
    sidebar: [{ label: "Timetable", to: "timetable", icon: Calendar, roles: ["admin"] }],
  },
  {
    slug: "hostel", name: "Hostel Management", category: "operations", icon: Building2,
    sidebar: [{ label: "Hostel", to: "hostel", icon: Building2, roles: ["admin"] }],
  },
  {
    slug: "transport", name: "Transport", category: "operations", icon: Bus,
    sidebar: [{ label: "Transport", to: "transport", icon: Bus, roles: ["admin"] }],
  },
  {
    slug: "announcements", name: "Announcements", category: "communication", icon: Megaphone, core: true,
    sidebar: [],
  },

  // ---- Academics ----
  {
    slug: "library", name: "Library", category: "academics", icon: Library,
    sidebar: [
      { label: "Library", to: "library", icon: Library, roles: ["admin", "teacher", "student"] },
    ],
  },
  {
    slug: "question-bank", name: "Question Bank", category: "academics", icon: BookOpenCheck,
    sidebar: [{ label: "Question Bank", to: "question-bank", icon: BookOpenCheck, roles: ["admin"] }],
  },
  {
    slug: "lesson-notes", name: "Lesson Notes", category: "academics", icon: NotebookPen,
    sidebar: [
      { label: "Lesson Notes", to: "lesson-notes", icon: NotebookPen, roles: ["admin", "teacher", "student"] },
    ],
  },
  {
    slug: "lesson-plan", name: "Lesson Plans", category: "academics", icon: NotebookPen,
    sidebar: [{ label: "Lesson Plan", to: "lesson-plan", icon: NotebookPen, roles: ["teacher"] }],
  },
  {
    slug: "attendance", name: "Attendance", category: "academics", icon: ClipboardCheck, core: true,
    sidebar: [
      { label: "Attendance", to: "attendance", icon: ClipboardCheck, roles: ["teacher"] },
      { label: "Attendance", to: "attendance", icon: ClipboardCheck, roles: ["parent"] },
    ],
  },
  {
    slug: "assignments", name: "Assignments", category: "academics", icon: ClipboardList,
    sidebar: [
      { label: "Assignments", to: "assignments", icon: ClipboardList, roles: ["teacher", "student"] },
    ],
  },
  {
    slug: "gradebook", name: "Gradebook", category: "academics", icon: BarChart3,
    sidebar: [
      { label: "Gradebook", to: "gradebook", icon: BarChart3, roles: ["teacher", "student"] },
    ],
  },
  {
    slug: "behavior", name: "Behavior & Conduct", category: "academics", icon: Award,
    sidebar: [
      { label: "Behavior", to: "behavior", icon: Award, roles: ["teacher", "student", "parent"] },
    ],
  },

  // ---- CBT / Exams ----
  {
    slug: "cbt", name: "CBT Simulation", category: "academics", icon: ListChecks,
    defaultConfig: {
      webcamProctoring: false,
      aiProctoring: false,
      negativeMarking: false,
      randomizeQuestions: true,
      violationLimit: 3,
      showAnswersAfterEach: false,
      autoSubmitOnTimeout: true,
    },
    sidebar: [
      { label: "Test Builder", to: "tests",   icon: FilePlus2,   roles: ["teacher"] },
      { label: "Grading",      to: "grading", icon: PencilRuler, roles: ["teacher"] },
      { label: "Exams",        to: "exams",   icon: ListChecks,  roles: ["student"] },
      { label: "Results",      to: "results", icon: FileBarChart, roles: ["student", "parent"] },
    ],
  },

  // ---- AI ----
  {
    slug: "ai-tutor", name: "AI Tutor", category: "intelligence", icon: Sparkles,
    sidebar: [{ label: "AI Tutor", to: "ai-tutor", icon: Sparkles, roles: ["student"] }],
  },
  {
    slug: "ai-co-teacher", name: "AI Co-Teacher", category: "intelligence", icon: Bot, core: true,
    sidebar: [{ label: "AI Co-Teacher", to: "ai-tutor", icon: Bot, roles: ["teacher"] }],
  },
  {
    slug: "ai-marking", name: "AI Essay Marking", category: "intelligence", icon: PenLine, core: true,
    sidebar: [{ label: "AI Marking", to: "ai-marking", icon: PenLine, roles: ["teacher"] }],
  },
  {
    slug: "parent-alerts", name: "Parent Risk Alerts", category: "intelligence", icon: ShieldAlert, core: true,
    sidebar: [],
  },
  {
    slug: "principal-copilot", name: "Principal Copilot", category: "intelligence", icon: Brain, core: true,
    sidebar: [
      { label: "Help & AI OPERATION CENTER", to: "copilot", icon: Brain, roles: ["teacher"] },
      { label: "Help & AI OPERATION CENTER", to: "copilot", icon: Brain, roles: ["student"] },
      { label: "Help & AI OPERATION CENTER", to: "copilot", icon: Brain, roles: ["parent"] },
    ],
  },
  {
    slug: "knowledge-base", name: "Knowledge Base", category: "intelligence", icon: BookMarked, core: true,
    sidebar: [],
  },
  {
    slug: "ai-governance", name: "AI Governance", category: "intelligence", icon: Gauge, core: true,
    sidebar: [],
  },

  // ---- Finance ----
  {
    slug: "fees", name: "Fees & Payments", category: "finance", icon: Wallet,
    sidebar: [
      { label: "Fees & Payments", to: "fees", icon: Wallet, roles: ["admin", "student", "parent"] },
    ],
  },

  // ---- Communication ----
  {
    slug: "communication-hub", name: "Communication Hub", category: "communication", icon: InboxIcon, core: true,
    sidebar: [
      { label: "Communication", to: "communication", icon: InboxIcon, roles: ["admin", "teacher", "student", "parent"] },
    ],
  },
  {
    slug: "messages", name: "Messaging", category: "communication", icon: MessagesSquare, core: true,
    sidebar: [
      { label: "Messages", to: "messages", icon: MessagesSquare, roles: ["teacher", "student", "parent"] },
    ],
  },
  {
    slug: "parent-comms", name: "Parent Communications", category: "communication", icon: Mail,
    sidebar: [
      { label: "Parent Comms",   to: "parent-comms",  icon: Mail, roles: ["teacher"] },
      { label: "Teacher Comms",  to: "teacher-comms", icon: Mail, roles: ["parent"] },
    ],
  },

  // ---- Teacher-only utilities ----
  {
    slug: "teacher-toolkit", name: "Teacher Toolkit", category: "academics", icon: FolderOpen, core: true,
    sidebar: [
      { label: "My Classes",  to: "classes",   icon: BookOpen,     roles: ["teacher"] },
      { label: "Students",    to: "students",  icon: Users,        roles: ["teacher"] },
      { label: "Parents",     to: "parents",   icon: UserSquare2,  roles: ["teacher"] },
      { label: "Resources",   to: "resources", icon: FolderOpen,   roles: ["teacher"] },
      { label: "Reports",     to: "reports",   icon: FileBarChart, roles: ["teacher"] },
    ],
  },

  // ---- Student / parent essentials ----
  {
    slug: "student-essentials", name: "Student Essentials", category: "academics", icon: BookOpen, core: true,
    sidebar: [
      { label: "My Classes", to: "classes",  icon: BookOpen, roles: ["student"] },
      { label: "Register Subjects", to: "register-subjects", icon: ListChecks, roles: ["student"] },
      { label: "Calendar",   to: "calendar", icon: Calendar, roles: ["student", "teacher"] },
    ],
  },
  {
    slug: "parent-essentials", name: "Parent Essentials", category: "academics", icon: UserSquare2, core: true,
    sidebar: [
      { label: "My Children",      to: "children", icon: UserSquare2,  roles: ["parent"] },
      { label: "Academic Records", to: "results",  icon: FileBarChart, roles: ["parent"] },
      { label: "Activity Feed",    to: "activity", icon: Activity,     roles: ["parent"] },
      { label: "Calendar",         to: "calendar", icon: Calendar,     roles: ["parent"] },
    ],
  },

  // ---- Admin tail ----
  {
    slug: "admin-reports", name: "Reports", category: "operations", icon: FileBarChart, core: true,
    sidebar: [{ label: "Reports", to: "reports", icon: FileBarChart, roles: ["admin"] }],
  },
  {
    slug: "proctoring", name: "Exam Proctoring", category: "academics", icon: ClipboardCheck,
    sidebar: [{ label: "Proctoring", to: "proctoring", icon: ClipboardCheck, roles: ["admin"] }],
  },
  {
    slug: "traditional-exams", name: "Exams", category: "academics", icon: ScrollText, core: true,
    sidebar: [
      { label: "Exams", to: "trad-exams", icon: ScrollText, roles: ["admin"] },
      { label: "Approvals",         to: "trad-exams-approvals", icon: ScrollText, roles: ["admin"] },
      { label: "Results",      to: "trad-exams-results",   icon: ScrollText, roles: ["admin"] },
      { label: "Exam Papers", to: "trad-exams", icon: ScrollText, roles: ["teacher"] },
      { label: "Grading Queue", to: "trad-exams-grading", icon: ScrollText, roles: ["teacher"] },
      { label: "Exams",       to: "trad-exams", icon: ScrollText, roles: ["student"] },
      { label: "Scratch Cards", to: "trad-cards", icon: ScrollText, roles: ["admin"] },
    ],
  },
  {
    slug: "admin-settings", name: "School Settings", category: "operations", icon: Settings, core: true,
    sidebar: [
      { label: "Modules",  to: "modules",  icon: Package,   roles: ["admin"] },
      { label: "Settings", to: "settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

export function getManifest(slug: string): ModuleManifest | undefined {
  return MODULE_MANIFESTS.find(m => m.slug === slug);
}