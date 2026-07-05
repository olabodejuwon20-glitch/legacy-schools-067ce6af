import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, KeyRound, Flag, Loader2, TrendingUp, Building2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const ModulesTab      = lazy(() => import("./Modules"));
const MarketplaceTab  = lazy(() => import("./Marketplace"));
const LicensingTab    = lazy(() => import("./Licensing"));
const FeatureFlagsTab = lazy(() => import("./FeatureFlags"));

type TabKey = "modules" | "marketplace" | "licensing" | "flags";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "modules",     label: "Modules",       icon: Package,     description: "Canonical registry of every module the platform ships." },
  { key: "marketplace", label: "Marketplace",   icon: ShoppingBag, description: "Per-tenant catalog and incoming module requests." },
  { key: "licensing",   label: "Licensing",     icon: KeyRound,    description: "Entitlement matrix — schools × modules." },
  { key: "flags",       label: "Feature Flags", icon: Flag,        description: "Global rollouts and per-school overrides." },
];

type Insights = {
  totalModules: number;
  activeInstalls: number;
  paidTermRevenueKobo: number;
  flagsInRollout: number;
  pendingRequests: number;
  schoolsCovered: number;
};

export default function SuperProducts() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const active: TabKey = (["modules","marketplace","licensing","flags"] as TabKey[]).includes(raw as TabKey) ? (raw as TabKey) : "modules";
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [mods, sm, flags, reqs] = await Promise.all([
        supabase.from("modules").select("id, term_price_kobo, pricing_model", { count: "exact" }),
        supabase.from("school_modules").select("id, school_id, module_id, enabled"),
        supabase.from("feature_flags").select("id, default_enabled, default_rollout_percent"),
        supabase.from("module_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (!alive) return;
      const modRows = (mods.data ?? []) as { id: string; term_price_kobo: number | null; pricing_model: string | null }[];
      const smRows  = (sm.data   ?? []) as { school_id: string; module_id: string; enabled: boolean }[];
      const flagRows= (flags.data?? []) as { default_enabled: boolean; default_rollout_percent: number | null }[];

      const priceByModule = new Map(modRows.map(m => [m.id, m.term_price_kobo ?? 0]));
      const activeInstalls = smRows.filter(x => x.enabled).length;
      const paidTermRevenueKobo = smRows.reduce((sum, x) => x.enabled ? sum + (priceByModule.get(x.module_id) ?? 0) : sum, 0);
      const flagsInRollout = flagRows.filter(f => f.default_enabled && (f.default_rollout_percent ?? 0) > 0 && (f.default_rollout_percent ?? 0) < 100).length;
      const schoolsCovered = new Set(smRows.filter(x => x.enabled).map(x => x.school_id)).size;

      setInsights({
        totalModules: mods.count ?? modRows.length,
        activeInstalls,
        paidTermRevenueKobo,
        flagsInRollout,
        pendingRequests: reqs.count ?? 0,
        schoolsCovered,
      });
    })();
    return () => { alive = false; };
  }, []);

  const activeMeta = TABS.find(t => t.key === active)!;

  return (
    <div className="space-y-5">
      {/* Executive header */}
      <div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Sparkles className="size-3" /><span>Products workspace</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">What you ship</h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">
          Every module, entitlement, price and experiment across Legacyskool — one workspace.
        </p>
      </div>

      {/* Insights strip */}
      <InsightStrip insights={insights} pendingRequests={insights?.pendingRequests ?? 0} onOpenRequests={() => setParams({ tab: "marketplace" })} />

      {/* Tabs */}
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

      {/* Tab body */}
      <Suspense fallback={<div className="min-h-[240px] grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}>
        {active === "modules"     && <ModulesTab />}
        {active === "marketplace" && <MarketplaceTab />}
        {active === "licensing"   && <LicensingTab />}
        {active === "flags"       && <FeatureFlagsTab />}
      </Suspense>
    </div>
  );
}

function InsightStrip({ insights, pendingRequests, onOpenRequests }: { insights: Insights | null; pendingRequests: number; onOpenRequests: () => void }) {
  const items = useMemo(() => ([
    { key: "modules",  label: "Modules registered", value: insights?.totalModules,           icon: <Package className="size-4" />,     tone: "info" as const },
    { key: "installs", label: "Active installs",    value: insights?.activeInstalls,         icon: <TrendingUp className="size-4" />,  tone: "success" as const },
    { key: "schools",  label: "Schools with paid modules", value: insights?.schoolsCovered,  icon: <Building2 className="size-4" />,   tone: "info" as const },
    { key: "revenue",  label: "Module revenue / term (est.)", value: insights ? `₦${Math.round(insights.paidTermRevenueKobo/100).toLocaleString("en-NG")}` : undefined, icon: <TrendingUp className="size-4" />, tone: "success" as const },
    { key: "flags",    label: "Flags in rollout",   value: insights?.flagsInRollout,          icon: <Flag className="size-4" />,        tone: "warning" as const },
    { key: "requests", label: "Pending requests",   value: pendingRequests,                   icon: <ShoppingBag className="size-4" />, tone: pendingRequests > 0 ? "danger" as const : "info" as const, onClick: pendingRequests > 0 ? onOpenRequests : undefined },
  ]), [insights, pendingRequests, onOpenRequests]);

  const TONES: Record<string, string> = {
    danger:  "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info:    "bg-info/10 text-info border-info/20",
    success: "bg-success/10 text-success border-success/20",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(i => (
        <button
          key={i.key}
          type="button"
          onClick={i.onClick}
          disabled={!i.onClick}
          className={cn(
            "text-left rounded-xl border p-3 flex flex-col justify-between min-h-[86px] transition-colors",
            TONES[i.tone],
            i.onClick && "hover:brightness-110 cursor-pointer",
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