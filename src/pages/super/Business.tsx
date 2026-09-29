import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Receipt, Layers, Rocket, LineChart, Sparkles, Wallet, AlertTriangle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNgn } from "@/lib/super";
import { Skel } from "@/components/super/primitives";

const RevenueTab       = lazy(() => import("./business/Revenue"));
const InvoicesTab      = lazy(() => import("./Billing"));
const SubscriptionsTab = lazy(() => import("./Subscriptions"));
const PlansTab         = lazy(() => import("./business/Plans"));
const PilotsTab        = lazy(() => import("./Pilots"));
const GrowthTab        = lazy(() => import("./business/Growth"));

type TabKey = "revenue" | "invoices" | "subscriptions" | "plans" | "pilots" | "growth";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "revenue",       label: "Revenue",       icon: TrendingUp, description: "Collections, run-rate, and top paying schools." },
  { key: "invoices",      label: "Invoices",      icon: Receipt,    description: "Platform invoices in NGN — issue, mark paid, void, or print receipts." },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard, description: "Active tenant plans, term renewals, and billing history." },
  { key: "plans",         label: "Plans",         icon: Layers,     description: "Live NGN tier pricing, student caps, and overage rates." },
  { key: "pilots",        label: "Pilots",        icon: Rocket,     description: "Trial & pilot pipeline — extend, convert to paid, or expire." },
  { key: "growth",        label: "Growth",        icon: LineChart,  description: "Cohort signups, conversions, and net tenant retention." },
];

type Insights = {
  revenue30dKobo: number;
  openInvoices: number;
  openKobo: number;
  activePilots: number;
  paidSchools: number;
};

export default function SuperBusiness() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const active: TabKey = (["revenue", "invoices", "subscriptions", "plans", "pilots", "growth"] as TabKey[]).includes(raw as TabKey)
    ? (raw as TabKey)
    : "revenue";
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [invPaid, invOpen, pilots, paid] = await Promise.all([
        supabase.from("invoices").select("amount_kobo, amount_cents, paid_at, status").eq("status", "paid").gte("paid_at", since),
        supabase.from("invoices").select("amount_kobo, amount_cents, status").eq("status", "open"),
        supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("pilot_status", "active"),
        supabase.from("schools").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "active").neq("plan", "trial"),
      ]);
      if (!alive) return;
      const sum = (rows: { amount_kobo?: number | null; amount_cents?: number | null }[] | null | undefined) =>
        (rows ?? []).reduce((a, r) => a + Number(r.amount_kobo ?? r.amount_cents ?? 0), 0);
      setInsights({
        revenue30dKobo: sum(invPaid.data as { amount_kobo?: number | null; amount_cents?: number | null }[]),
        openInvoices: (invOpen.data ?? []).length,
        openKobo: sum(invOpen.data as { amount_kobo?: number | null; amount_cents?: number | null }[]),
        activePilots: pilots.count ?? 0,
        paidSchools: paid.count ?? 0,
      });
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
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Revenue, billing &amp; growth</h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">
          Every naira collected, every open invoice, every active subscription, and every pilot in flight — unified in one ledger.
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

      <Suspense fallback={<div className="space-y-3"><Skel className="h-24" /><Skel className="h-64" /></div>}>
        {active === "revenue"       && <RevenueTab />}
        {active === "invoices"      && <InvoicesTab />}
        {active === "subscriptions" && <SubscriptionsTab />}
        {active === "plans"         && <PlansTab />}
        {active === "pilots"        && <PilotsTab />}
        {active === "growth"        && <GrowthTab />}
      </Suspense>
    </div>
  );
}

function InsightStrip({ insights, onOpen }: { insights: Insights | null; onOpen: (k: TabKey) => void }) {
  const items = useMemo(() => ([
    { key: "rev",    label: "Revenue · 30d",         value: insights ? fmtNgn(insights.revenue30dKobo) : undefined, icon: <Wallet className="size-4" />,        tone: "success" as const, tab: "revenue" as TabKey },
    { key: "open",   label: `Open invoices${insights ? ` (${fmtNgn(insights.openKobo)})` : ""}`, value: insights?.openInvoices, icon: <AlertTriangle className="size-4" />, tone: (insights?.openInvoices ?? 0) > 0 ? "warning" as const : "info" as const, tab: "invoices" as TabKey },
    { key: "pilots", label: "Active pilots",         value: insights?.activePilots, icon: <Rocket className="size-4" />,    tone: "info" as const,    tab: "pilots" as TabKey },
    { key: "paid",   label: "Paid / active schools", value: insights?.paidSchools,  icon: <Layers className="size-4" />,    tone: "info" as const,    tab: "subscriptions" as TabKey },
  ]), [insights]);

  const TONES: Record<string, string> = {
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
            <span className="text-xl font-bold tabular-nums">
              {i.value === undefined ? <span className="inline-block w-12 h-6 rounded bg-current/10 animate-pulse" /> : i.value}
            </span>
          </div>
          <div className="text-[11px] font-medium mt-1 leading-snug">{i.label}</div>
        </button>
      ))}
    </div>
  );
}