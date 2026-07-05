import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Zap, BookOpen, Users, Sparkles, Loader2, DollarSign, Database, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ProductAnalyticsTab = lazy(() => import("./Analytics"));
const AIUsageTab          = lazy(() => import("./Quotas"));
const ContentQualityTab   = lazy(() => import("./intelligence/ContentQuality"));
const CohortsTab          = lazy(() => import("./intelligence/Cohorts"));

type TabKey = "analytics" | "ai" | "content" | "cohorts";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "analytics", label: "Product Analytics", icon: BarChart3, description: "Page views, DAU/WAU/MAU, feature adoption." },
  { key: "ai",        label: "AI Usage",          icon: Zap,       description: "Spend, cache hit-rate and per-school quotas." },
  { key: "content",   label: "Content Quality",   icon: BookOpen,  description: "Question bank coverage, violations, appeals." },
  { key: "cohorts",   label: "Cohorts",           icon: Users,     description: "Signup cohorts and at-risk schools." },
];

type Insights = {
  dau: number;
  aiCostCents: number;
  cacheHitPct: number | null;
  atRisk: number;
};

export default function SuperIntelligence() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const active: TabKey = (["analytics","ai","content","cohorts"] as TabKey[]).includes(raw as TabKey) ? (raw as TabKey) : "analytics";
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const dayAgo = new Date(Date.now() - 86400_000).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [pv, jobs, cache, schools, views30] = await Promise.all([
        supabase.from("page_views").select("user_id, session_id, school_id").gte("created_at", dayAgo).limit(10000),
        supabase.from("ai_jobs").select("cost_usd").gte("created_at", weekAgo).limit(10000),
        supabase.from("ai_cache").select("hits, cost_saved_usd").limit(5000),
        supabase.from("schools").select("id, plan").not("plan", "is", null).neq("plan", "trial"),
        supabase.from("page_views").select("school_id, session_id").gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()).limit(20000),
      ]);
      if (!alive) return;
      const uniques = new Set<string>();
      ((pv.data ?? []) as { user_id: string | null; session_id: string }[]).forEach(v => uniques.add(v.user_id ?? v.session_id));
      const dau = uniques.size;
      const aiCostCents = Math.round((((jobs.data ?? []) as { cost_usd: number | null }[]).reduce((a, x) => a + (x.cost_usd ?? 0), 0)) * 100);
      const cacheRows = (cache.data ?? []) as { hits: number }[];
      const totalHits = cacheRows.reduce((a, x) => a + (x.hits ?? 0), 0);
      const cacheEntries = cacheRows.length;
      const cacheHitPct = cacheEntries > 0 ? Math.round((totalHits / (totalHits + cacheEntries)) * 100) : null;
      const paidSchools = (schools.data ?? []) as { id: string }[];
      const sessionsBySchool = new Map<string, Set<string>>();
      ((views30.data ?? []) as { school_id: string | null; session_id: string }[]).forEach(v => {
        if (!v.school_id) return;
        const set = sessionsBySchool.get(v.school_id) ?? new Set();
        set.add(v.session_id);
        sessionsBySchool.set(v.school_id, set);
      });
      const atRisk = paidSchools.filter(s => (sessionsBySchool.get(s.id)?.size ?? 0) < 3).length;
      setInsights({ dau, aiCostCents, cacheHitPct, atRisk });
    })();
    return () => { alive = false; };
  }, []);

  const activeMeta = TABS.find(t => t.key === active)!;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Sparkles className="size-3" /><span>Intelligence workspace</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Analytics &amp; AI</h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">
          How the product is being used, what AI is costing us, and which schools need attention.
        </p>
      </div>

      <InsightStrip insights={insights} onOpen={(k) => setParams({ tab: k })} />

      <div className="border-b border-border/70 sticky top-12 z-20 bg-background/85 backdrop-blur -mx-6 px-6">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="tablist">
          {TABS.map(t => {
            const isActive = t.key === active;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setParams({ tab: t.key })}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
                {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-foreground rounded-full" />}
              </button>
            );
          })}
          <div className="ml-auto pl-4 text-[11px] text-muted-foreground hidden md:block">{activeMeta.description}</div>
        </nav>
      </div>

      <Suspense fallback={<div className="min-h-[240px] grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}>
        {active === "analytics" && <ProductAnalyticsTab />}
        {active === "ai"        && <AIUsageTab />}
        {active === "content"   && <ContentQualityTab />}
        {active === "cohorts"   && <CohortsTab />}
      </Suspense>
    </div>
  );
}

function InsightStrip({ insights, onOpen }: { insights: Insights | null; onOpen: (k: TabKey) => void }) {
  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const items = useMemo(() => ([
    { key: "dau",    label: "DAU (24h)",         value: insights?.dau,           icon: <Users className="size-4" />,        tone: "info" as const,     tab: "analytics" as TabKey },
    { key: "cost",   label: "AI cost 7d",        value: insights ? dollars(insights.aiCostCents) : undefined, icon: <DollarSign className="size-4" />, tone: "warning" as const, tab: "ai" as TabKey },
    { key: "cache",  label: "Cache hit-rate",    value: insights ? (insights.cacheHitPct === null ? "—" : `${insights.cacheHitPct}%`) : undefined, icon: <Database className="size-4" />, tone: "success" as const, tab: "ai" as TabKey },
    { key: "risk",   label: "At-risk schools",   value: insights?.atRisk,        icon: <TrendingDown className="size-4" />, tone: (insights?.atRisk ?? 0) > 0 ? "danger" as const : "success" as const, tab: "cohorts" as TabKey },
  ]), [insights]);

  const TONES: Record<string, string> = {
    danger:  "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info:    "bg-info/10 text-info border-info/20",
    success: "bg-success/10 text-success border-success/20",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(i => (
        <button
          key={i.key}
          type="button"
          onClick={() => onOpen(i.tab)}
          className={cn(
            "text-left rounded-xl border p-3 flex flex-col justify-between min-h-[86px] transition-colors hover:brightness-110 cursor-pointer",
            TONES[i.tone],
          )}
        >
          <div className="flex items-center justify-between">
            <span className="opacity-80">{i.icon}</span>
            <span className="text-2xl font-bold tabular-nums">
              {i.value === undefined ? <span className="inline-block w-8 h-6 rounded bg-current/10 animate-pulse" /> : i.value}
            </span>
          </div>
          <div className="text-[11px] font-medium mt-1 leading-snug">{i.label}</div>
        </button>
      ))}
    </div>
  );
}