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
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, MoreHorizontal, ExternalLink, Eye, PauseCircle, PlayCircle, Download, Search, ShieldAlert, UserCog, Bookmark, Star, X, Users2, GraduationCap, HardDrive, Sparkles, Activity } from "lucide-react";
import { superAction, timeAgo } from "@/lib/super";
import { buildSchoolUrl } from "@/lib/tenant";
import { toast } from "sonner";
import ImpersonateDialog from "@/components/super/ImpersonateDialog";
import { enrichSchool, formatBytes, formatCompact, healthColor } from "@/lib/schoolHealth";
import InsightsCards, { buildInsights } from "@/components/super/InsightsCards";
import { cn } from "@/lib/utils";

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

type SavedView = { id: string; name: string; search: string; plan: string; status: string; sort: "newest" | "name" | "expiring" };
const VIEWS_KEY = "super:schools:views";
const ACTIVE_VIEW_KEY = "super:schools:activeView";

const DEFAULT_VIEWS: SavedView[] = [
  { id: "all",       name: "All schools",    search: "", plan: "all", status: "all",       sort: "newest" },
  { id: "trial",     name: "Trial",          search: "", plan: "all", status: "trial",     sort: "expiring" },
  { id: "active",    name: "Active",         search: "", plan: "all", status: "active",    sort: "name" },
  { id: "suspended", name: "Suspended",      search: "", plan: "all", status: "suspended", sort: "newest" },
  { id: "expiring",  name: "Expiring soon",  search: "", plan: "all", status: "all",       sort: "expiring" },
];

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      const raw = localStorage.getItem(VIEWS_KEY);
      const custom = raw ? (JSON.parse(raw) as SavedView[]) : [];
      return [...DEFAULT_VIEWS, ...custom];
    } catch { return DEFAULT_VIEWS; }
  });
  const [activeView, setActiveView] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_VIEW_KEY) || "all"; } catch { return "all"; }
  });

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 250); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [debounced, planFilter, statusFilter, sort]);

  function applyView(id: string) {
    const v = views.find(x => x.id === id);
    if (!v) return;
    setActiveView(id);
    try { localStorage.setItem(ACTIVE_VIEW_KEY, id); } catch {}
    setSearch(v.search); setPlanFilter(v.plan); setStatusFilter(v.status); setSort(v.sort);
  }
  function saveCurrentView() {
    const name = window.prompt("Name this view:", "My view");
    if (!name) return;
    const v: SavedView = { id: `v_${Date.now()}`, name, search, plan: planFilter, status: statusFilter, sort };
    const custom = views.filter(x => !DEFAULT_VIEWS.some(d => d.id === x.id));
    const next = [...custom, v];
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch {}
    setViews([...DEFAULT_VIEWS, ...next]);
    setActiveView(v.id);
  }
  function removeView(id: string) {
    const custom = views.filter(x => !DEFAULT_VIEWS.some(d => d.id === x.id) && x.id !== id);
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(custom)); } catch {}
    setViews([...DEFAULT_VIEWS, ...custom]);
    if (activeView === id) applyView("all");
  }

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

  const enriched = useMemo(() => (rows ?? []).map(s => ({ ...s, ...enrichSchool(s) })), [rows]);
  const insights = useMemo(() => buildInsights(enriched.map(e => ({ status: e.status, plan_expires_at: e.plan_expires_at, healthScore: e.healthScore, storageBytes: e.storageBytes, aiTokens: e.aiTokens }))), [enriched]);
  const allSelected = enriched.length > 0 && enriched.every(r => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(enriched.map(r => r.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  async function bulkSuspend() {
    if (!selected.size) return;
    const reason = window.prompt(`Suspend ${selected.size} school(s)? Optional reason:`, "");
    if (reason === null) return;
    const ids = Array.from(selected);
    for (const sid of ids) { try { await superAction("suspend_school", { school_id: sid, reason }); } catch {} }
    toast.success(`Suspended ${ids.length} school(s)`);
    setSelected(new Set()); load(); loadStats();
  }
  async function bulkReactivate() {
    if (!selected.size) return;
    if (!window.confirm(`Reactivate ${selected.size} school(s)?`)) return;
    const ids = Array.from(selected);
    for (const sid of ids) { try { await superAction("reactivate_school", { school_id: sid }); } catch {} }
    toast.success(`Reactivated ${ids.length} school(s)`);
    setSelected(new Set()); load(); loadStats();
  }
  function bulkExport() {
    const rowsSel = enriched.filter(r => selected.has(r.id));
    if (!rowsSel.length) return;
    const header = ["id","name","slug","plan","status","students","teachers","parents","storage_bytes","ai_tokens","health","expires","created"];
    const lines = [header.join(",")].concat(rowsSel.map(r => [r.id, JSON.stringify(r.name), r.slug, r.plan, r.status, r.students, r.teachers, r.parents, r.storageBytes, r.aiTokens, r.healthScore, r.plan_expires_at ?? "", r.created_at].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.download = `schools-selected-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(u);
  }

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

      {/* Customer success insights */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer success signals</div>
          <div className="text-[11px] text-muted-foreground">Based on this page ({enriched.length})</div>
        </div>
        <InsightsCards insights={insights} />
      </div>

      {/* Saved views */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {views.map(v => {
          const isCustom = !DEFAULT_VIEWS.some(d => d.id === v.id);
          const active = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => applyView(v.id)}
              className={cn(
                "group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] border transition-colors",
                active ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {isCustom ? <Star className="size-3" /> : <Bookmark className="size-3" />}
              {v.name}
              {isCustom && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); removeView(v.id); }}
                  className="ml-1 opacity-60 hover:opacity-100"
                ><X className="size-3" /></span>
              )}
            </button>
          );
        })}
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px] text-muted-foreground" onClick={saveCurrentView}>
          + Save current view
        </Button>
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

        {selected.size > 0 && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center gap-2 text-xs">
            <span className="font-medium">{selected.size} selected</span>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="outline" size="sm" className="h-7" onClick={bulkExport}><Download className="size-3.5 mr-1" />Export</Button>
            <Button variant="outline" size="sm" className="h-7" onClick={bulkReactivate}><PlayCircle className="size-3.5 mr-1" />Reactivate</Button>
            <Button variant="outline" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={bulkSuspend}><PauseCircle className="size-3.5 mr-1" />Suspend</Button>
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36px]">
                <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>School</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"><Users2 className="size-3.5 inline-block mr-1 opacity-60" />Users</TableHead>
              <TableHead className="text-right"><HardDrive className="size-3.5 inline-block mr-1 opacity-60" />Storage</TableHead>
              <TableHead className="text-right"><Sparkles className="size-3.5 inline-block mr-1 opacity-60" />AI</TableHead>
              <TableHead className="text-right"><Activity className="size-3.5 inline-block mr-1 opacity-60" />Health</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skel className="h-4 w-4" /></TableCell>
                <TableCell><div className="flex items-center gap-3"><Skel className="size-8 rounded-md" /><Skel className="h-4 w-40" /></div></TableCell>
                <TableCell><Skel className="h-5 w-16" /></TableCell>
                <TableCell><Skel className="h-5 w-20" /></TableCell>
                <TableCell><Skel className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell><Skel className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell><Skel className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell><Skel className="h-4 w-16 ml-auto" /></TableCell>
                <TableCell><Skel className="h-4 w-20" /></TableCell>
                <TableCell><Skel className="h-4 w-24" /></TableCell>
                <TableCell><Skel className="h-6 w-6" /></TableCell>
              </TableRow>
            ))}
            {enriched.map(s => {
              const c = healthColor(s.healthScore);
              return (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleOne(s.id)} onClick={(e) => e.stopPropagation()} /></TableCell>
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
                <TableCell className="text-right tabular-nums text-sm">
                  <div className="font-medium">{formatCompact(s.students + s.teachers + s.parents)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatCompact(s.students)} students · {formatCompact(s.teachers)} staff</div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatBytes(s.storageBytes)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{formatCompact(s.aiTokens)}<div className="text-[10px] text-muted-foreground">tokens/mo</div></TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full", c.bg)} style={{ width: `${s.healthScore}%` }} />
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums", c.text)}>{s.healthScore}</span>
                  </div>
                </TableCell>
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
              );
            })}
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
