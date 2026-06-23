import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";

/** Permission catalog shown as toggles on the Roles page and enforced in the admin portal.
 *  Keys for page-level permissions intentionally match the route segment used in App.tsx
 *  and the `to` field in the admin sidebar so we can filter both with one set. */
export type PermissionKey = string;

export interface PermissionItem {
  key: PermissionKey;
  label: string;
  description?: string;
  /** When true, this permission supports a separate "edit" level (key + ":edit").
   *  When false, it's a binary view-only toggle (action: items also stay binary). */
  editable?: boolean;
}
export interface PermissionGroup {
  label: string;
  items: PermissionItem[];
}

/** Access level for a permission. `none` = hidden, `view` = read-only, `edit` = read + write. */
export type AccessLevel = "none" | "view" | "edit";
export const EDIT_SUFFIX = ":edit";

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "People",
    items: [
      { key: "students", label: "Students", editable: true },
      { key: "teachers", label: "Teachers", editable: true },
      { key: "parents", label: "Parents", editable: true },
      { key: "invites", label: "Invite codes", editable: true },
      { key: "bulk", label: "Bulk upload members", editable: true },
      { key: "enrollments", label: "Admissions", editable: true },
    ],
  },
  {
    label: "Workspace",
    items: [
      { key: "workspace", label: "Workspace collaborators", description: "View members and invites. Edit lets them invite, revoke and change roles.", editable: true },
    ],
  },
  {
    label: "Academics",
    items: [
      { key: "classes", label: "Classes", editable: true },
      { key: "academic", label: "Academic structure (classes, arms, subjects, promotion)", editable: true },
      { key: "timetable", label: "Timetable", editable: true },
      { key: "attendance", label: "Attendance", editable: true },
      { key: "lesson-notes", label: "Lesson notes (approve)", editable: true },
      { key: "question-bank", label: "Question bank", editable: true },
      { key: "library", label: "Library", editable: true },
      { key: "proctoring", label: "Proctoring", editable: true },
      { key: "reports", label: "Reports", editable: true },
    ],
  },
  {
    label: "Examinations",
    items: [
      { key: "trad-exams", label: "Traditional Exams", description: "Plan exam sessions, build timetables, view papers", editable: true },
      { key: "action:approve_trad_exam", label: "Action — approve exam papers" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "fees", label: "Fees & payments", editable: true },
      { key: "subscription", label: "Subscription & billing", editable: true },
      { key: "action:edit_fees", label: "Action — edit fee structure" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "hostel", label: "Hostel", editable: true },
      { key: "transport", label: "Transport", editable: true },
      { key: "modules", label: "Modules", editable: true },
    ],
  },
  {
    label: "Communication",
    items: [
      { key: "announcements", label: "Announcements", editable: true },
      { key: "inbox", label: "Inbox", editable: true },
      { key: "parent-alerts", label: "Parent alerts", editable: true },
      { key: "action:send_announcement", label: "Action — publish announcements" },
    ],
  },
  {
    label: "AI & Insights",
    items: [
      { key: "copilot", label: "Principal Copilot", editable: true },
      { key: "knowledge", label: "Knowledge base", editable: true },
      { key: "ai-activity", label: "AI activity", editable: true },
      { key: "ai-settings", label: "AI settings", editable: true },
    ],
  },
  {
    label: "System",
    items: [
      { key: "settings", label: "School settings", editable: true },
      { key: "onboarding", label: "Onboarding wizard", editable: true },
      { key: "roles", label: "Manage role slots", editable: true },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));
/** Every key plus its :edit twin for editable items — used by "Grant all". */
export const ALL_GRANTABLE_KEYS = PERMISSION_GROUPS.flatMap(g =>
  g.items.flatMap(i => i.editable ? [i.key, i.key + EDIT_SUFFIX] : [i.key])
);

/** Resolve the access level for a permission given the stored permission array. */
export function getLevel(perms: string[] | Set<string>, key: PermissionKey): AccessLevel {
  const set = perms instanceof Set ? perms : new Set(perms);
  if (set.has(key + EDIT_SUFFIX)) return "edit";
  if (set.has(key)) return "view";
  return "none";
}

export interface RoleSlot {
  slot: number;
  name: string;
  enabled: boolean;
  permissions: PermissionKey[];
}

/** Hook the admin portal uses to decide which pages / actions are visible.
 *  A full admin (no admin_slot on their membership) has unrestricted access.
 *  A slotted admin only sees permissions listed on their slot. */
export function useAdminPermissions() {
  const { school, memberships, user, activeRole } = useSchool();
  const membership = school
    ? memberships.find(m => m.school_id === school.id && m.role === "admin")
    : null;
  const slot = membership?.admin_slot ?? null;
  const isFullAdmin = activeRole === "admin" && (slot === null || slot === undefined);

  const [slotRow, setSlotRow] = useState<RoleSlot | null>(null);
  const [loading, setLoading] = useState(!!slot);

  useEffect(() => {
    let cancelled = false;
    if (!school || !slot || !user) { setSlotRow(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("admin_role_slots")
      .select("slot,name,enabled,permissions")
      .eq("school_id", school.id)
      .eq("slot", slot)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSlotRow(data ? { ...(data as any), permissions: (data as any).permissions ?? [] } : null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [school?.id, slot, user?.id]);

  const allowed = new Set<string>(isFullAdmin ? ALL_GRANTABLE_KEYS : (slotRow?.permissions ?? []));
  const can = (key: PermissionKey) => isFullAdmin || allowed.has(key);
  const canEdit = (key: PermissionKey) => isFullAdmin || allowed.has(key + EDIT_SUFFIX);
  const levelOf = (key: PermissionKey): AccessLevel =>
    isFullAdmin ? "edit" : getLevel(allowed, key);

  return { isFullAdmin, slot, slotRow, allowed, can, canEdit, levelOf, loading };
}
