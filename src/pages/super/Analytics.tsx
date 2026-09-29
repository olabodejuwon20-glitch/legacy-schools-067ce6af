import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, EmptyState, StatusBadge } from "@/components/super/primitives";
import { AreaTrend, BarTrend } from "@/components/super/Chart";
import { compact, fmtNgn, timeAgo } from "@/lib/super";
import { Building2, Users, ListChecks, Package, Wallet, Activity, Eye, LogIn, MousePointerClick, Smartphone, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Bucket = { label: string; value: number };
type Range = "hour" | "day" | "week" | "month";

const RANGE_META: Record<Range, { label: string; hours: number; buckets: number; bucketMs: number; fmt: (d: Date) => string }> = {
  hour:  { label: "Last hour",   hours: 1,        buckets: 12, bucketMs: 5 * 60_000,        fmt: d => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
  day:   { label: "Last 24h",    hours: 24,       buckets: 24, bucketMs: 60 * 60_000,       fmt: d => d.toLocaleTimeString([], { hour: "2-digit" }) },
  week:  { label: "Last 7 days", hours: 24 * 7,   buckets: 7,  bucketMs: 24 * 3_600_000,    fmt: d => d.toLocaleDateString([], { weekday: "short" }) },
  month: { label: "Last 30 days",hours: 24 * 30,  buckets: 30, bucketMs: 24 * 3_600_000,    fmt: d => d.toLocaleDateString([], { month: "short", day: "numeric" }) },
};

function bucketize<T extends { created_at: string }>(rows: T[], range: Range) {
  const meta = RANGE_META[range];
  const now = Date.now();
  const start = now - meta.hours * 3_600_000;
  const buckets = Array.from({ length: meta.buckets }, (_, i) => {
    const bStart = start + i * meta.bucketMs;
    return { label: meta.fmt(new Date(bStart + meta.bucketMs)), bStart, bEnd: bStart + meta.bucketMs, value: 0 };
  });
  rows.forEach(r => {
    const t = new Date(r.created_at).getTime();
    if (t < start || t > now) return;
    const idx = Math.min(meta.buckets - 1, Math.floor((t - start) / meta.bucketMs));
    buckets[idx].value += 1;
  });
  return buckets.map(({ label, value }) => ({ label, value }));
}

type PageViewRow = { id: string; path: string; session_id: string; user_id: string | null; device: string | null; created_at: string };
type AuthEventRow = { id: string; event: string; user_id: string | null; created_at: string };

export default function SuperAnalytics() {
  const [range, setRange] = useState<Range>("day");
  const [pageViews, setPageViews] = useState<PageViewRow[]>([]);
  const [authEvents, setAuthEvents] = useState<AuthEventRow[]>([]);
  const [liveDot, setLiveDot] = useState(false);
  const [loading, setLoading] = useState(true);

  const [kpi, setKpi] = useState({ schools: 0, users: 0, attempts: 0, modules: 0, termAddonKobo: 0, exams: 0 });
  const [planMix, setPlanMix] = useState<Bucket[]>([]);
  const [moduleAdoption, setModuleAdoption] = useState<Bucket[]>([]);
  const [recent, setRecent] = useState<{ id: string; name: string; created_at: string; plan: string; status: string }[]>([]);

  useEffect(() => {
    const since = new Date(Date.now() - RANGE_META[range].hours * 3_600_000).toISOString();
    (async () => {
      const [pv, ae] = await Promise.all([
        supabase.from("page_views").select("id, path, session_id, user_id, device, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
        supabase.from("auth_events").select("id, event, user_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      ]);
      setPageViews((pv.data as PageViewRow[]) ?? []);
      setAuthEvents((ae.data as AuthEventRow[]) ?? []);
    })();
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const since = new Date(Date.now() - RANGE_META[range].hours * 3_600_000).toISOString();
      const [pv, ae] = await Promise.all([
        supabase.from("page_views").select("id, path, session_id, user_id, device, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
        supabase.from("auth_events").select("id, event, user_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      ]);
      if (cancelled) return;
      setPageViews(prev => {
        const next = (pv.data as PageViewRow[]) ?? [];
        if (next.length && prev[0]?.id !== next[0]?.id) {
          setLiveDot(true); setTimeout(() => setLiveDot(false), 800);
        }
        return next;
      });
      setAuthEvents((ae.data as AuthEventRow[]) ?? []);
    };
    const id = setInterval(tick, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, [range]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(); since.setDate(since.getDate() - 29);
      const sinceISO = since.toISOString();

      const [schoolsRes, membershipsRes, attemptsRes, smRes, examsRes, recentRes, modulesRes] = await Promise.all([
        supabase.from("schools").select("id, name, plan, status, created_at").is("deleted_at", null),
        supabase.from("memberships").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("exam_attempts").select("id, started_at").gte("started_at", sinceISO),
        supabase.from("school_modules").select("module_id, enabled, term_price_kobo_override, modules!inner(name)").eq("enabled", true),
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("schools").select("id, name, plan, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
        supabase.from("modules").select("id, term_price_kobo, pricing_model, slug"),
      ]);

      const schools = (schoolsRes.data as { id: string; name: string; plan: string; status: string; created_at: string }[]) ?? [];
      const attempts = (attemptsRes.data as { id: string }[]) ?? [];
      const sm = (smRes.data as { module_id: string; term_price_kobo_override?: number | null; modules?: { name?: string } }[]) ?? [];
      const modules = (modulesRes.data as { id: string; term_price_kobo?: number | null; pricing_model?: string }[]) ?? [];

      const modById = new Map(modules.map(m => [m.id, m]));
      const termAddonKobo = sm.reduce((sum, r) => {
        const mod = modById.get(r.module_id);
        if (!mod || mod.pricing_model === "included") return sum;
        return sum + Number(r.term_price_kobo_override ?? mod.term_price_kobo ?? 0);
      }, 0);

      setKpi({
        schools: schools.length,
        users: membershipsRes.count ?? 0,
        attempts: attempts.length,
        modules: sm.length,
        termAddonKobo,
        exams: examsRes.count ?? 0,
      });

      const planCounts = new Map<string, number>();
      schools.forEach(s => planCounts.set(s.plan, (planCounts.get(s.plan) ?? 0) + 1));
      setPlanMix(Array.from(planCounts.entries()).map(([label, value]) => ({ label, value })));

      const modCounts = new Map<string, number>();
      sm.forEach(r => {
        const name = r.modules?.name ?? "Unknown";
        modCounts.set(name, (modCounts.get(name) ?? 0) + 1);
      });
      setModuleAdoption(
        Array.from(modCounts.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value).slice(0, 10),
      );

      setRecent((recentRes.data as { id: string; name: string; created_at: string; plan: string; status: string }[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const visitorsSeries = useMemo(() => bucketize(pageViews, range), [pageViews, range]);
  const signInSeries = useMemo(() => bucketize(authEvents.filter(e => e.event === "sign_in"), range), [authEvents, range]);

  const uniqueVisitors = useMemo(() => new Set(pageViews.map(p => p.session_id)).size, [pageViews]);
  const totalViews = pageViews.length;
  const signIns = useMemo(() => authEvents.filter(e => e.event === "sign_in").length, [authEvents]);
  const liveNow = useMemo(() => {
    const cutoff = Date.now() - 5 * 60_000;
    return new Set(pageViews.filter(p => new Date(p.created_at).getTime() >= cutoff).map(p => p.session_id)).size;
  }, [pageViews]);

  const topPages = useMemo(() => {
    const m = new Map<string, number>();
    pageViews.forEach(p => m.set(p.path, (m.get(p.path) ?? 0) + 1));
    return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [pageViews]);

  const deviceMix = useMemo(() => {
    const m = new Map<string, number>();
    pageViews.forEach(p => m.set(p.device ?? "unknown", (m.get(p.device ?? "unknown") ?? 0) + 1));
    return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [pageViews]);

  const recentVisits = pageViews.slice(0, 15);

  return (
    <div>
      <PageHeader
        title="Product Analytics"
        description="Real-time website traffic, sign-ins, page popularity, and module adoption."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(Object.keys(RANGE_META) as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                  range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r === "hour" ? "1H" : r === "day" ? "24H" : r === "week" ? "7D" : "30D"}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Live now (5m)"
          value={
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full bg-success", liveDot && "animate-ping")} />
              <span className={cn("size-2 rounded-full bg-success -ml-3.5")} />
              <span className="ml-1">{compact(liveNow)}</span>
            </div>
          }
          icon={<Activity className="size-4" />}
        />
        <MetricCard label={`Visitors · ${RANGE_META[range].label}`} value={compact(uniqueVisitors)} icon={<Users className="size-4" />} />
        <MetricCard label={`Page views · ${RANGE_META[range].label}`} value={compact(totalViews)} icon={<Eye className="size-4" />} />
        <MetricCard label={`Sign-ins · ${RANGE_META[range].label}`} value={compact(signIns)} icon={<LogIn className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Section title="Visitor traffic" description={`Unique sessions over ${RANGE_META[range].label.toLowerCase()}`}>
          {visitorsSeries.every(b => b.value === 0)
            ? <EmptyState title="No traffic yet" description="As visitors land on the site, you'll see live activity here." />
            : <AreaTrend data={visitorsSeries} dataKey="value" />}
        </Section>
        <Section title="Sign-ins" description="Successful authentications">
          {signInSeries.every(b => b.value === 0)
            ? <EmptyState title="No sign-ins in range" />
            : <BarTrend data={signInSeries} dataKey="value" color="hsl(var(--success))" />}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Section title="Top pages" description="Most-viewed paths in range" actions={<MousePointerClick className="size-4 text-muted-foreground" />}>
          {topPages.length === 0 ? <EmptyState title="No page views" /> : (
            <ul className="divide-y divide-border -my-2">
              {topPages.map(p => {
                const pct = topPages[0]?.value ? Math.round((p.value / topPages[0].value) * 100) : 0;
                return (
                  <li key={p.label} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-xs">{p.label}</span>
                      <span className="tabular-nums font-medium">{p.value}</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section title="Device mix" actions={<Smartphone className="size-4 text-muted-foreground" />}>
          {deviceMix.length === 0 ? <EmptyState title="No data" /> : (
            <ul className="divide-y divide-border -my-2">
              {deviceMix.map(d => (
                <li key={d.label} className="py-2.5 flex items-center justify-between text-sm capitalize">
                  <span>{d.label}</span>
                  <span className="tabular-nums font-medium">{d.value}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Live activity" description="Newest page views (auto-updating)">
          {recentVisits.length === 0 ? <EmptyState title="No activity" /> : (
            <ul className="divide-y divide-border -my-2 max-h-72 overflow-y-auto">
              {recentVisits.map(v => (
                <li key={v.id} className="py-2 text-xs flex items-center justify-between gap-2">
                  <span className="font-mono truncate">{v.path}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">{timeAgo(v.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <PageHeader title="Platform Adoption & Footprint" description="Tenant mix, module adoption, and add-on term run-rate in NGN." />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <MetricCard label="Schools" value={compact(kpi.schools)} icon={<Building2 className="size-4" />} />
          <MetricCard label="Users" value={compact(kpi.users)} icon={<Users className="size-4" />} />
          <MetricCard label="Exams" value={compact(kpi.exams)} icon={<ListChecks className="size-4" />} />
          <MetricCard label="Attempts (30d)" value={compact(kpi.attempts)} icon={<Activity className="size-4" />} />
          <MetricCard label="Installed modules" value={compact(kpi.modules)} icon={<Package className="size-4" />} />
          <MetricCard label="Add-on Run-Rate" value={fmtNgn(kpi.termAddonKobo)} icon={<Wallet className="size-4 text-success" />} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Section title="Module adoption" description="Schools with each module enabled">
          {loading ? <Skel className="h-56" /> : moduleAdoption.length === 0 ? <EmptyState title="No modules enabled yet" description="Seed the module registry and enable modules from the Marketplace." />
            : <BarTrend data={moduleAdoption} dataKey="value" color="hsl(var(--success))" />}
        </Section>
        <Section title="Plan mix" description="Schools by plan">
          {planMix.length === 0 ? <EmptyState title="No schools" /> : (
            <ul className="divide-y divide-border -my-2">
              {planMix.map(p => (
                <li key={p.label} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="capitalize">{p.label}</span>
                  <span className="tabular-nums font-medium">{p.value}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Recently onboarded" description="Newest tenants on the platform">
          {recent.length === 0 ? <EmptyState title="None yet" /> : (
            <ul className="divide-y divide-border -my-2">
              {recent.map(s => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                  <Link to={`/super/schools/${s.id}`} className="truncate font-medium hover:underline inline-flex items-center gap-1">
                    {s.name}
                    <ArrowUpRight className="size-3 text-muted-foreground" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    <span className="text-[11px] text-muted-foreground tabular-nums">{timeAgo(s.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Health summary" description="Quick read on platform state">
          <ul className="text-sm space-y-2">
            <li className="flex justify-between"><span className="text-muted-foreground">Modules per school (avg)</span><span className="tabular-nums font-medium">{kpi.schools ? (kpi.modules / kpi.schools).toFixed(1) : "0"}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Attempts per exam (avg)</span><span className="tabular-nums font-medium">{kpi.exams ? (kpi.attempts / kpi.exams).toFixed(1) : "0"}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Users per school (avg)</span><span className="tabular-nums font-medium">{kpi.schools ? (kpi.users / kpi.schools).toFixed(1) : "0"}</span></li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
