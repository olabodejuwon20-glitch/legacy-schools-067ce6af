import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Users, MoreHorizontal, Search, Download, ShieldCheck, ShieldOff, KeyRound, UserX, UserCheck, Trash2, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { superAction } from "@/lib/super";
import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "@/components/super/ConfirmDeleteDialog";

type Row = {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  school_id: string;
  school_name: string;
  is_super: boolean;
};

type SchoolLite = { id: string; name: string; slug: string | null };

const ROLE_TABS: { key: string; label: string }[] = [
  { key: "student",  label: "Students"  },
  { key: "teacher",  label: "Teachers"  },
  { key: "admin",    label: "Admins"    },
  { key: "parent",   label: "Parents"   },
  { key: "driver",   label: "Drivers"   },
  { key: "other",    label: "Other"     },
];

const KNOWN_ROLES = new Set(["student","teacher","admin","parent","driver"]);

export default function SuperUsers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [schools, setSchools] = useState<SchoolLite[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [schoolQ, setSchoolQ] = useState("");
  const [userQ, setUserQ] = useState("");
  const [tab, setTab] = useState("student");
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);

  async function load() {
    setRows(null);
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id,user_id,role,status,school_id,deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    const userIds = Array.from(new Set((memberships ?? []).map((m: any) => m.user_id)));
    const schoolIds = Array.from(new Set((memberships ?? []).map((m: any) => m.school_id)));
    const [{ data: profiles }, { data: sch }, { data: supers }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from("schools").select("id,name,slug").is("deleted_at", null).order("name"),
      supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
    ]);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const smap = new Map((sch ?? []).map((s: any) => [s.id, s.name]));
    const superSet = new Set((supers ?? []).map((s: any) => s.user_id));
    setSchools((sch ?? []) as SchoolLite[]);
    const out: Row[] = (memberships ?? []).map((m: any) => ({
      membership_id: m.id, user_id: m.user_id, role: m.role, status: m.status,
      school_id: m.school_id, school_name: smap.get(m.school_id) ?? "—",
      full_name: pmap.get(m.user_id)?.full_name ?? "—",
      email: pmap.get(m.user_id)?.email ?? "—",
      is_super: superSet.has(m.user_id),
    }));
    setRows(out);
    if (!selectedSchool && sch && sch.length > 0) setSelectedSchool((sch[0] as any).id);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Count per school
  const perSchool = useMemo(() => {
    const map = new Map<string, number>();
    (rows ?? []).forEach(r => map.set(r.school_id, (map.get(r.school_id) ?? 0) + 1));
    return map;
  }, [rows]);

  const filteredSchools = useMemo(() => {
    const n = schoolQ.trim().toLowerCase();
    if (!n) return schools;
    return schools.filter(s => s.name.toLowerCase().includes(n));
  }, [schools, schoolQ]);

  // Rows for the selected school
  const schoolRows = useMemo(
    () => (rows ?? []).filter(r => r.school_id === selectedSchool),
    [rows, selectedSchool],
  );

  // Role counts inside selected school
  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    ROLE_TABS.forEach(t => (c[t.key] = 0));
    schoolRows.forEach(r => {
      const key = KNOWN_ROLES.has(r.role) ? r.role : "other";
      c[key] = (c[key] ?? 0) + 1;
    });
    return c;
  }, [schoolRows]);

  // Filtered rows for current tab + search
  const visible = useMemo(() => {
    const n = userQ.trim().toLowerCase();
    return schoolRows.filter(r => {
      const inTab = tab === "other" ? !KNOWN_ROLES.has(r.role) : r.role === tab;
      if (!inTab) return false;
      if (!n) return true;
      return r.full_name.toLowerCase().includes(n) || r.email.toLowerCase().includes(n);
    });
  }, [schoolRows, tab, userQ]);

  const currentSchool = schools.find(s => s.id === selectedSchool) ?? null;

  async function act(action: string, payload: any, label: string) {
    try { await superAction(action, payload); toast.success(label); await load(); }
    catch {/* superAction already toasts */}
  }

  function exportCsv() {
    const header = ["name","email","role","status","school","super_admin"];
    const src = schoolRows;
    const lines = src.map(r => [r.full_name, r.email, r.role, r.status, r.school_name, r.is_super ? "yes":"no"]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${currentSchool?.slug ?? "users"}-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Users grouped by their school, then by role. Delete moves the membership to Trash for 30 days before auto-purge."
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!selectedSchool}><Download className="size-3.5 mr-1.5" />Export school CSV</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Left pane: schools */}
        <Card className="p-0 overflow-hidden self-start">
          <div className="px-3 py-2 border-b border-border/70 bg-muted/30">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={schoolQ} onChange={e => setSchoolQ(e.target.value)} placeholder="Search schools…" className="pl-7 h-8 bg-background" />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto py-1">
            {rows === null ? (
              <div className="p-3 space-y-1.5">{Array.from({length:8}).map((_,i)=><Skel key={i} className="h-9" />)}</div>
            ) : filteredSchools.length === 0 ? (
              <div className="p-6 text-xs text-center text-muted-foreground">No schools</div>
            ) : filteredSchools.map(s => {
              const active = selectedSchool === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSchool(s.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] transition-colors border-l-2",
                    active
                      ? "bg-muted/70 border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <Building2 className={cn("size-3.5 shrink-0", active ? "text-primary" : "opacity-70")} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{perSchool.get(s.id) ?? 0}</span>
                  <ChevronRight className={cn("size-3 opacity-40", active && "opacity-100")} />
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right pane: role tabs + table */}
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/70 flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{currentSchool?.name ?? "Select a school"}</div>
              <div className="text-[11px] text-muted-foreground">{schoolRows.length} members</div>
            </div>
            <div className="relative w-56">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search name or email…" className="pl-7 h-8" />
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 pt-2 border-b border-border/70 overflow-x-auto">
            {ROLE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 h-8 text-[12px] font-medium rounded-t-md transition-colors border-b-2 -mb-px",
                  tab === t.key
                    ? "border-primary text-foreground bg-muted/40"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">{roleCounts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>

          {!selectedSchool ? (
            <EmptyState icon={<Building2 className="size-5 text-muted-foreground" />} title="Pick a school on the left" />
          ) : visible.length === 0 ? (
            <EmptyState icon={<Users className="size-5 text-muted-foreground" />} title={`No ${ROLE_TABS.find(t=>t.key===tab)?.label.toLowerCase()} here`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">User</th>
                    <th className="text-left px-3 py-2 font-medium">Role</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Platform</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.membership_id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="font-medium truncate max-w-[280px]">{r.full_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[280px]">{r.email}</div>
                      </td>
                      <td className="px-3 py-2"><Badge variant="secondary" className="capitalize text-[10px]">{r.role}</Badge></td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2">{r.is_super ? <Badge className="text-[10px]"><ShieldCheck className="size-3 mr-1" />Super</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-7"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.is_super
                              ? <DropdownMenuItem onClick={() => act("revoke_super", { user_id: r.user_id }, "Revoked platform access")}><ShieldOff className="size-3.5 mr-2" />Revoke super admin</DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => act("grant_super", { user_id: r.user_id }, "Granted platform access")}><ShieldCheck className="size-3.5 mr-2" />Grant super admin</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            {r.status === "active"
                              ? <DropdownMenuItem onClick={() => act("set_membership_status", { membership_id: r.membership_id, status: "suspended" }, "Membership suspended")}><UserX className="size-3.5 mr-2" />Suspend membership</DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => act("set_membership_status", { membership_id: r.membership_id, status: "active" }, "Membership reactivated")}><UserCheck className="size-3.5 mr-2" />Reactivate</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => act("force_pin_reset", { membership_id: r.membership_id }, "PIN reset required on next sign-in")}><KeyRound className="size-3.5 mr-2" />Force PIN reset</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setPendingDelete(r)} className="text-destructive focus:text-destructive"><Trash2 className="size-3.5 mr-2" />Move to Trash</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Move membership to Trash"
        description="The user's membership will be sent to Trash. It auto-purges after 30 days. You can restore it from the Trash page before then."
        itemName={pendingDelete ? `${pendingDelete.full_name} · ${pendingDelete.role} @ ${pendingDelete.school_name}` : undefined}
        onConfirm={async (confirm) => {
          if (!pendingDelete) return;
          await act("soft_delete", { table: "memberships", id: pendingDelete.membership_id, confirm }, "Moved to Trash");
        }}
      />
    </div>
  );
}