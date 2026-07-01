import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, EmptyState, Skel } from "@/components/super/primitives";
import { PlanBadge, SchoolStatusBadge } from "@/components/super/SchoolBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building2, MoreHorizontal, ExternalLink, Eye, PauseCircle, PlayCircle, Download, Search, ShieldAlert, UserCog } from "lucide-react";
import { superAction, timeAgo } from "@/lib/super";
import { buildSchoolUrl } from "@/lib/tenant";
import { toast } from "sonner";
import ImpersonateDialog from "@/components/super/ImpersonateDialog";

const PAGE_SIZE = 25;
const PLANS = ["trial", "basic", "standard", "premium", "enterprise"];
const STATUSES = ["trial", "active", "suspended", "expired"];

function renderPilotCell(s: { pilot_status: string | null; pilot_ends_at: string | null }) {
  const status = s.pilot_status ?? "none";
  if (status === "none") return <span className="text-xs text-muted-foreground">—</span>;
  const days = s.pilot_ends_at
    ? Math.max(0, Math.ceil((new Date(s.pilot_ends_at).getTime() - Date.now()) / 86400_000))
    : null;
  const cls =
    status === "converted" ? "bg-success/15 text-success border-success/30" :
    status === "expired"   ? "bg-destructive/15 text-destructive border-destructive/30" :
    days != null && days <= 7  ? "bg-destructive/15 text-destructive border-destructive/30" :
    days != null && days <= 14 ? "bg-warning/15 text-warning border-warning/30" :
    "bg-primary/15 text-primary border-primary/30";
  const label = status === "active"
    ? (days != null ? `Pilot · ${days}d` : "Pilot")
    : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>{label}</span>;
}

type School = {
  id: string; name: string; slug: string; logo_url: string | null;
  plan: string; status: string;
  plan_expires_at: string | null; created_at: string;
  suspended_reason: string | null;
  pilot_status: string | null;
  pilot_ends_at: string | null;
};

export default function SuperSchools() {
  const [rows, setRows] = useState<School[] | null>(null);
  const [impSchool, setImpSchool] = useState<School | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "name" | "expiring">("newest");
  const [stats, setStats] = useState<{ total: number; active: number; trial: number; suspended: number }>({ total: 0, active: 0, trial: 0, suspended: 0 });
  const [debounced, setDebounced] = useState(search);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); }, [debounced, planFilter, statusFilter, sort]);

  async function load() {
    setRows(null);
    let q = supabase.from("schools").select("id,name,slug,logo_url,plan,status,plan_expires_at,created_at,suspended_reason,pilot_status,pilot_ends_at", { count: "exact" });
    if (debounced) q = q.or(`name.ilike.%${debounced}%,slug.ilike.%${debounced}%,email.ilike.%${debounced}%`);
    if (planFilter !== "all") q = q.eq("plan", planFilter as any);
    if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
    if (sort === "newest") q = q.order("created_at", { ascending: false });
    if (sort === "name") q = q.order("name", { ascending: true });
    if (sort === "expiring") q = q.order("plan_expires_at", { ascending: true, nullsFirst: false });
    const from = page * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);
    const { data, count: c, error } = await q;
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows((data ?? []) as School[]);
    setCount(c ?? 0);
  }

  async function loadStats() {
    const counts = await Promise.all([
      supabase.from("schools").select("id", { count: "exact", head: true }),
      supabase.from("schools").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("schools").select("id", { count: "exact", head: true }).eq("status", "trial"),
      supabase.from("schools").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    ]);
    setStats({
      total: counts[0].count ?? 0, active: counts[1].count ?? 0,
      trial: counts[2].count ?? 0, suspended: counts[3].count ?? 0,
    });
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [debounced, planFilter, statusFilter, sort, page]);
  useEffect(() => { loadStats(); }, []);

  async function suspend(s: School) {
    const reason = window.prompt(`Suspend "${s.name}"? Optional reason:`, "");
    if (reason === null) return;
    await superAction("suspend_school", { school_id: s.id, reason });
    toast.success("School suspended");
    load(); loadStats();
  }
  async function reactivate(s: School) {
    await superAction("reactivate_school", { school_id: s.id });
    toast.success("School reactivated");
    load(); loadStats();
  }

  function exportCsv() {
    if (!rows?.length) return;
    const header = ["id","name","slug","plan","status","expires","created"];
    const lines = [header.join(",")].concat(rows.map(r => [r.id, JSON.stringify(r.name), r.slug, r.plan, r.status, r.plan_expires_at ?? "", r.created_at].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.download = `schools-page-${page+1}.csv`; a.click();
    URL.revokeObjectURL(u);
  }

  const last = Math.min(count, (page + 1) * PAGE_SIZE);
  const first = count === 0 ? 0 : page * PAGE_SIZE + 1;

  return (
    <div>
      <PageHeader
        title="Schools"
        description="Every tenant on the platform. Manage plans, status, modules, and configuration."
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows?.length}><Download className="size-4 mr-2" />Export CSV</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total schools" value={stats.total} icon={<Building2 className="size-4" />} />
        <MetricCard label="Active" value={stats.active} />
        <MetricCard label="Trial" value={stats.trial} />
        <MetricCard label="Suspended" value={stats.suspended} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, slug, email…" className="pl-9 h-9 bg-background" />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {PLANS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pilot</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="flex items-center gap-3"><Skel className="size-8 rounded-md" /><Skel className="h-4 w-40" /></div></TableCell>
                <TableCell><Skel className="h-5 w-16" /></TableCell>
                <TableCell><Skel className="h-5 w-20" /></TableCell>
                <TableCell><Skel className="h-5 w-16" /></TableCell>
                <TableCell><Skel className="h-4 w-20" /></TableCell>
                <TableCell><Skel className="h-4 w-24" /></TableCell>
                <TableCell><Skel className="h-6 w-6" /></TableCell>
              </TableRow>
            ))}
            {rows?.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell>
                  <Link to={`/super/schools/${s.id}`} className="flex items-center gap-3 group">
                    <div className="size-8 rounded-md border border-border bg-muted overflow-hidden grid place-items-center text-xs font-semibold text-muted-foreground">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="size-full object-cover" /> : s.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm group-hover:underline truncate max-w-[260px]">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">/{s.slug}</div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell><PlanBadge plan={s.plan} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <SchoolStatusBadge status={s.status} />
                    {s.suspended_reason && <ShieldAlert className="size-3 text-destructive" />}
                  </div>
                </TableCell>
                <TableCell>{renderPilotCell(s)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.plan_expires_at ? new Date(s.plan_expires_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{timeAgo(s.created_at)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to={`/super/schools/${s.id}`}><Eye className="size-4 mr-2" />View details</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(buildSchoolUrl(s.slug, "/"), "_blank")}><ExternalLink className="size-4 mr-2" />Open portal</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setImpSchool(s)} className="text-red-600 focus:text-red-700"><UserCog className="size-4 mr-2" />Login as…</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {s.status === "suspended"
                        ? <DropdownMenuItem onClick={() => reactivate(s)}><PlayCircle className="size-4 mr-2" />Reactivate</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => suspend(s)} className="text-destructive focus:text-destructive"><PauseCircle className="size-4 mr-2" />Suspend</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows?.length === 0 && (
          <div className="p-8"><EmptyState icon={<Building2 className="size-5" />} title="No schools match" description="Try adjusting filters or onboarding the first tenant." /></div>
        )}

        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {first}–{last} of {count}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={last >= count} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
      {impSchool && (
        <ImpersonateDialog
          open={!!impSchool}
          onOpenChange={(v) => { if (!v) setImpSchool(null); }}
          school={{ id: impSchool.id, name: impSchool.name, slug: impSchool.slug }}
        />
      )}
    </div>
  );
}
