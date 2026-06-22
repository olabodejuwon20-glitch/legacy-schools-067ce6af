import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, StatusBadge, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Users, MoreHorizontal, Search, Download, ShieldCheck, ShieldOff, KeyRound, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { superAction } from "@/lib/super";

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

const PAGE = 50;

export default function SuperUsers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [school, setSchool] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    setRows(null);
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id,user_id,role,status,school_id")
      .order("created_at", { ascending: false })
      .limit(2000);
    const userIds = Array.from(new Set((memberships ?? []).map(m => m.user_id)));
    const schoolIds = Array.from(new Set((memberships ?? []).map(m => m.school_id)));
    const [{ data: profiles }, { data: sch }, { data: supers }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      schoolIds.length ? supabase.from("schools").select("id,name").in("id", schoolIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
    ]);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const smap = new Map((sch ?? []).map((s: any) => [s.id, s.name]));
    const superSet = new Set((supers ?? []).map((s: any) => s.user_id));
    setSchools((sch ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    const out: Row[] = (memberships ?? []).map((m: any) => ({
      membership_id: m.id, user_id: m.user_id, role: m.role, status: m.status,
      school_id: m.school_id, school_name: smap.get(m.school_id) ?? "—",
      full_name: pmap.get(m.user_id)?.full_name ?? "—",
      email: pmap.get(m.user_id)?.email ?? "—",
      is_super: superSet.has(m.user_id),
    }));
    setRows(out);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter(r =>
      (role === "all" || r.role === role) &&
      (school === "all" || r.school_id === school) &&
      (!needle || r.full_name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle)),
    );
  }, [rows, q, role, school]);

  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));

  async function act(action: string, payload: any, label: string) {
    try { await superAction(action, payload); toast.success(label); await load(); }
    catch {/* superAction already toasts */}
  }

  function exportCsv() {
    const header = ["name","email","role","status","school","super_admin"];
    const lines = filtered.map(r => [r.full_name, r.email, r.role, r.status, r.school_name, r.is_super ? "yes":"no"]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `users-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <div>
      <PageHeader title="Users & Roles" description="Every user across every tenant. Grant platform-level access, suspend, or force a PIN reset."
        actions={<Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-3.5 mr-1.5" />Export CSV</Button>} />

      <Section title={`Directory · ${filtered.length}`} description="Backed by memberships joined with profiles and platform roles."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Search name or email…" className="pl-7 h-8 w-56" />
            </div>
            <Select value={role} onValueChange={v => { setRole(v); setPage(0); }}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={school} onValueChange={v => { setSchool(v); setPage(0); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All schools</SelectItem>
                {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows === null ? (
          <div className="space-y-2">{Array.from({length:8}).map((_,i)=><Skel key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="size-5 text-muted-foreground" />} title="No users match" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">User</th>
                  <th className="text-left px-3 py-2 font-medium">School</th>
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Platform</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.membership_id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-5 py-2">
                      <div className="font-medium truncate max-w-[240px]">{r.full_name}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">{r.email}</div>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{r.school_name}</td>
                    <td className="px-3 py-2"><Badge variant="secondary" className="capitalize text-[10px]">{r.role}</Badge></td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2">{r.is_super ? <Badge className="text-[10px]"><ShieldCheck className="size-3 mr-1" />Super</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-5 py-2 text-right">
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground">
              <span>Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}