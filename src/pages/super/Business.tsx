import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Receipt, KeyRound, Rocket, Sparkles, DollarSign, AlertCircle, UserPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RevenueTab   = lazy(() => import("./business/Revenue"));
const InvoicesTab  = lazy(() => import("./Billing"));
const PlansTab     = lazy(() => import("./business/Plans"));
const PilotsTab    = lazy(() => import("./Pilots"));
const GrowthTab    = lazy(() => import("./business/Growth"));

type TabKey = "revenue" | "invoices" | "plans" | "pilots" | "growth";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "revenue",  label: "Revenue",  icon: TrendingUp, description: "MRR, ARR, top-paying schools and revenue by plan." },
  { key: "invoices", label: "Invoices", icon: Receipt,    description: "Platform invoices — resend, mark paid, refund." },
  { key: "plans",    label: "Plans",    icon: KeyRound,   description: "Plan catalog with cohort revenue and students." },
  { key: "pilots",   label: "Pilots",   icon: Rocket,     description: "Founding-school pilots, extensions, conversions." },
  { key: "growth",   label: "Growth",   icon: UserPlus,   description: "Signup funnel, invite redemption, referral sources." },
];

type Insights = {
  mrrKobo: number;
  netNewPct: number | null;
  overdueCount: number;
  activePilots: number;
  conversionPct: number;
};

export default function SuperBusiness() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const active: TabKey = (["revenue","invoices","plans","pilots","growth"] as TabKey[]).includes(raw as TabKey) ? (raw as TabKey) : "revenue";
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [invRes, schoolRes] = await Promise.all([
        supabase.from("invoices").select("amount_cents, amount_kobo, status, paid_at, issued_at"),
        supabase.from("schools").select("id, pilot_status, plan"),
      ]);
      if (!alive) return;
      const inv = (invRes.data ?? []) as { amount_cents: number | null; amount_kobo: number | null; status: string; paid_at: string | null }[];
      const schools = (schoolRes.data ?? []) as { pilot_status: string | null; plan: string | null }[];
      const amt = (x: any) => (x.amount_kobo ?? x.amount_cents ?? 0);
      const now = Date.now();
      const d30 = now - 30 * 86400_000;
      const d60 = now - 60 * 86400_000;
      const paid = inv.filter(x => x.status === "paid" && x.paid_at);
      const mrr = paid.filter(x => new Date(x.paid_at!).getTime() >= d30).reduce((a, x) => a + amt(x), 0);
      const prev = paid.filter(x => { const t = new Date(x.paid_at!).getTime(); return t >= d60 && t < d30; }).reduce((a, x) => a + amt(x), 0);
      const netNewPct = prev > 0 ? Math.round(((mrr - prev) / prev) * 100) : null;
      const overdueCount = inv.filter(x => x.status === "open").length;
      const activePilots = schools.filter(s => s.pilot_status === "active").length;
      const converted = schools.filter(s => s.pilot_status === "converted").length;
      const cohort = activePilots + converted + schools.filter(s => s.pilot_status === "expired").length;
      const conversionPct = cohort > 0 ? Math.round((converted / cohort) * 100) : 0;
      setInsights({ mrrKobo: mrr, netNewPct, overdueCount, activePilots, conversionPct });
    })();
    return () => { alive = false; };
  }, []);

  const activeMeta = TABS.find(t => t.key === active)!;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Sparkles className="size-3" /><span>Business workspace</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Revenue &amp; growth</h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">
          Money in, money out, and pipeline — one workspace for finance and growth.
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
        {active === "revenue"  && <RevenueTab />}
        {active === "invoices" && <InvoicesTab />}
        {active === "plans"    && <PlansTab />}
        {active === "pilots"   && <PilotsTab />}
        {active === "growth"   && <GrowthTab />}
      </Suspense>
    </div>
  );
}

function InsightStrip({ insights, onOpen }: { insights: Insights | null; onOpen: (k: TabKey) => void }) {
  const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
  const items = useMemo(() => ([
    { key: "mrr",       label: "MRR (30d paid)",         value: insights ? naira(insights.mrrKobo) : undefined, icon: <DollarSign className="size-4" />,  tone: "success" as const, tab: "revenue" as TabKey },
    { key: "netnew",    label: "Net new MRR",            value: insights ? (insights.netNewPct === null ? "—" : `${insights.netNewPct >= 0 ? "+" : ""}${insights.netNewPct}%`) : undefined, icon: <TrendingUp className="size-4" />, tone: "info" as const, tab: "revenue" as TabKey },
    { key: "overdue",   label: "Overdue invoices",       value: insights?.overdueCount, icon: <AlertCircle className="size-4" />, tone: (insights?.overdueCount ?? 0) > 0 ? "danger" as const : "info" as const, tab: "invoices" as TabKey },
    { key: "pilots",    label: "Active pilots",          value: insights?.activePilots, icon: <Rocket className="size-4" />,      tone: "warning" as const, tab: "pilots" as TabKey },
    { key: "conv",      label: "Trial → paid conversion", value: insights ? `${insights.conversionPct}%` : undefined, icon: <TrendingUp className="size-4" />, tone: "success" as const, tab: "pilots" as TabKey },
  ]), [insights]);

  const TONES: Record<string, string> = {
    danger:  "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info:    "bg-info/10 text-info border-info/20",
    success: "bg-success/10 text-success border-success/20",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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