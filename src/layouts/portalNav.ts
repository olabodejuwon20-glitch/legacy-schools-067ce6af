import {
  LayoutDashboard, Users, BookOpen, FileBarChart, Settings, ClipboardCheck, FilePlus2,
  Calendar, Library, Sparkles, MessagesSquare, Wallet, Activity, UserSquare2, ListChecks,
  PencilRuler, Building2, Ticket, Upload, Bus, Megaphone, NotebookPen, FolderOpen,
  BookOpenCheck, ClipboardList, BarChart3, Award, Mail, Inbox as InboxIcon, Bot, Brain,
  ShieldAlert, Gauge, BookMarked, PenLine, Receipt, Layers, GraduationCap, CreditCard,
  HelpCircle, ShieldCheck, Package, Workflow, ScrollText, UserPlus, Home,
} from "lucide-react";
import { Role } from "@/contexts/SchoolContext";

export interface NavTab { label: string; to: string; icon: any }
export interface NavHub {
  key: string;
  label: string;
  icon: any;
  /** Route the hub button navigates to (defaults to first tab). */
  to?: string;
  tabs: NavTab[];
}

/**
 * Single source of truth for portal navigation.
 * Every role gets at most 8 sidebar entries; related pages live as tabs
 * inside a hub and surface in a secondary tab bar under the header.
 */
export const PORTAL_NAV: Record<Role, NavHub[]> = {
  admin: [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard, to: "", tabs: [] },
    {
      key: "people", label: "People", icon: Users, tabs: [
        { label: "Students", to: "students", icon: Users },
        { label: "Teachers", to: "teachers", icon: GraduationCap },
        { label: "Parents", to: "parents", icon: UserSquare2 },
        { label: "Classes", to: "classes", icon: BookOpen },
        { label: "Admission", to: "admission", icon: UserPlus },
        { label: "Onboarding", to: "onboarding-center", icon: Ticket },
        { label: "Custom Roles", to: "roles", icon: ShieldCheck },
      ],
    },
    {
      key: "academics", label: "Academics", icon: Layers, tabs: [
        { label: "Academic Structure", to: "academic", icon: Layers },
        { label: "Timetable", to: "timetable", icon: Calendar },
        { label: "Attendance", to: "attendance", icon: ClipboardCheck },
        { label: "Reports", to: "reports", icon: FileBarChart },
        { label: "Academic Setup", to: "academic-setup", icon: Gauge },
      ],
    },
    {
      key: "assessments", label: "Assessments", icon: ClipboardList, tabs: [
        { label: "Overview", to: "assessments", icon: ClipboardList },
        { label: "Question Bank", to: "question-bank", icon: BookOpenCheck },
        { label: "Exam Committee", to: "exam-committee", icon: ShieldCheck },
        { label: "Exam Appeals", to: "exam-appeals", icon: ShieldAlert },
        { label: "Scratch Cards", to: "trad-cards", icon: ScrollText },
        { label: "Proctoring", to: "proctoring", icon: ClipboardCheck },
      ],
    },
    {
      key: "library", label: "Library", icon: Library, tabs: [
        { label: "Library", to: "library", icon: Library },
        { label: "Lesson Notes", to: "lesson-notes", icon: NotebookPen },
      ],
    },
    {
      key: "finance", label: "Finance", icon: Wallet, tabs: [
        { label: "Fees & Payments", to: "fees", icon: Wallet },
        { label: "Subscription", to: "subscription", icon: CreditCard },
        { label: "Billing", to: "billing", icon: Receipt },
      ],
    },
    {
      key: "ai", label: "AI Operation Center", icon: Brain, tabs: [
        { label: "Overview", to: "ai-ops", icon: Brain },
        { label: "Copilot", to: "copilot", icon: Brain },
        { label: "Parent Alerts", to: "parent-alerts", icon: ShieldAlert },
        { label: "Knowledge", to: "knowledge", icon: BookMarked },
        { label: "AI Activity", to: "ai-activity", icon: Activity },
        { label: "AI Settings", to: "ai-settings", icon: Sparkles },
      ],
    },
    {
      key: "school", label: "School", icon: Settings, tabs: [
        { label: "Settings", to: "settings", icon: Settings },
        { label: "Communication", to: "communication", icon: InboxIcon },
        { label: "Announcements", to: "announcements", icon: Megaphone },
        { label: "Modules", to: "modules", icon: Package },
        { label: "Workspace", to: "workspace", icon: Workflow },
        { label: "Hostel", to: "hostel", icon: Building2 },
        { label: "Transport", to: "transport", icon: Bus },
        { label: "Help", to: "/app/help", icon: HelpCircle },
      ],
    },
  ],

  teacher: [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard, to: "", tabs: [] },
    {
      key: "classes", label: "My Classes", icon: BookOpen, tabs: [
        { label: "Classes", to: "classes", icon: BookOpen },
        { label: "Students", to: "students", icon: Users },
        { label: "Parents", to: "parents", icon: UserSquare2 },
      ],
    },
    { key: "attendance", label: "Attendance", icon: ClipboardCheck, to: "attendance", tabs: [] },
    {
      key: "coursework", label: "Coursework", icon: ClipboardList, tabs: [
        { label: "Assignments", to: "assignments", icon: ClipboardList },
        { label: "Gradebook", to: "gradebook", icon: BarChart3 },
        { label: "Behavior", to: "behavior", icon: Award },
      ],
    },
    {
      key: "assessments", label: "Assessments", icon: FilePlus2, tabs: [
        { label: "Overview", to: "assessments", icon: ClipboardCheck },
        { label: "Test Builder", to: "tests", icon: FilePlus2 },
        { label: "Grading", to: "grading", icon: PencilRuler },
        { label: "Exam Papers", to: "trad-exams", icon: ScrollText },
        { label: "Grading Queue", to: "trad-exams-grading", icon: ScrollText },
      ],
    },
    {
      key: "teaching", label: "Teaching Tools", icon: NotebookPen, tabs: [
        { label: "Lesson Plan", to: "lesson-plan", icon: NotebookPen },
        { label: "Lesson Notes", to: "lesson-notes", icon: BookOpenCheck },
        { label: "Library", to: "library", icon: Library },
        { label: "Resources", to: "resources", icon: FolderOpen },
        { label: "Reports", to: "reports", icon: FileBarChart },
      ],
    },
    {
      key: "ai", label: "AI Assistant", icon: Bot, tabs: [
        { label: "AI Co-Teacher", to: "ai-tutor", icon: Bot },
        { label: "AI Marking", to: "ai-marking", icon: PenLine },
        { label: "Copilot", to: "copilot", icon: Brain },
      ],
    },
    {
      key: "comms", label: "Communication", icon: InboxIcon, tabs: [
        { label: "Communication Hub", to: "communication", icon: InboxIcon },
        { label: "Parent Comms", to: "parent-comms", icon: Mail },
        { label: "Calendar", to: "calendar", icon: Calendar },
        { label: "Help", to: "/app/help", icon: HelpCircle },
      ],
    },
  ],

  student: [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard, to: "", tabs: [] },
    {
      key: "classes", label: "My Classes", icon: BookOpen, tabs: [
        { label: "Classes", to: "classes", icon: BookOpen },
        { label: "Register Subjects", to: "register-subjects", icon: ListChecks },
        { label: "Calendar", to: "calendar", icon: Calendar },
      ],
    },
    {
      key: "learn", label: "Learn", icon: Library, tabs: [
        { label: "Library", to: "library", icon: Library },
        { label: "Lesson Notes", to: "lesson-notes", icon: BookOpen },
        { label: "Practice", to: "practice", icon: Sparkles },
      ],
    },
    { key: "assignments", label: "Assignments", icon: ClipboardList, to: "assignments", tabs: [] },
    {
      key: "exams", label: "Exams", icon: ListChecks, tabs: [
        { label: "My Assessments", to: "assessments", icon: ClipboardCheck },
        { label: "CBT Exams", to: "exams", icon: ListChecks },
        { label: "NECO / JAMB Mock", to: "mock", icon: Award },
        { label: "Exam Papers", to: "trad-exams", icon: ScrollText },
      ],
    },
    {
      key: "progress", label: "My Progress", icon: FileBarChart, tabs: [
        { label: "Results", to: "results", icon: FileBarChart },
        { label: "Gradebook", to: "gradebook", icon: BarChart3 },
        { label: "Attendance", to: "attendance", icon: ClipboardCheck },
        { label: "Behavior", to: "behavior", icon: Award },
      ],
    },
    {
      key: "ai", label: "AI Tutor", icon: Sparkles, tabs: [
        { label: "AI Tutor", to: "ai-tutor", icon: Sparkles },
        { label: "Copilot", to: "copilot", icon: Brain },
      ],
    },
    {
      key: "more", label: "More", icon: Home, tabs: [
        { label: "Communication", to: "communication", icon: InboxIcon },
        { label: "Fees", to: "fees", icon: Wallet },
        { label: "Bus Tracking", to: "transport", icon: Bus },
        { label: "Help", to: "/app/help", icon: HelpCircle },
      ],
    },
  ],

  parent: [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard, to: "", tabs: [] },
    { key: "children", label: "My Children", icon: UserSquare2, to: "children", tabs: [] },
    { key: "records", label: "Academic Records", icon: FileBarChart, to: "results", tabs: [] },
    { key: "attendance", label: "Attendance", icon: ClipboardCheck, to: "attendance", tabs: [] },
    { key: "behavior", label: "Behavior", icon: Award, to: "behavior", tabs: [] },
    {
      key: "comms", label: "Messages", icon: InboxIcon, tabs: [
        { label: "Communication Hub", to: "communication", icon: InboxIcon },
        { label: "Teacher Comms", to: "teacher-comms", icon: Mail },
      ],
    },
    { key: "fees", label: "Fees & Payments", icon: Wallet, to: "fees", tabs: [] },
    {
      key: "more", label: "More", icon: Home, tabs: [
        { label: "Activity Feed", to: "activity", icon: Activity },
        { label: "Calendar", to: "calendar", icon: Calendar },
        { label: "Bus Tracking", to: "transport", icon: Bus },
        { label: "Copilot", to: "copilot", icon: Brain },
        { label: "Help", to: "/app/help", icon: HelpCircle },
      ],
    },
  ],
};

/** Primary destination for a hub button. */
export function hubTarget(hub: NavHub): string {
  return hub.to !== undefined ? hub.to : (hub.tabs[0]?.to ?? "");
}

/** All route segments a hub owns (used for active-state matching). */
export function hubSegments(hub: NavHub): string[] {
  const list = hub.tabs.map(t => t.to);
  if (hub.to !== undefined) list.unshift(hub.to);
  return Array.from(new Set(list));
}
