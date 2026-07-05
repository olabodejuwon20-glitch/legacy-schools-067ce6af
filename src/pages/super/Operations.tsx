import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LifeBuoy, AlertCircle, Megaphone, Activity, ScrollText, Sparkles, Loader2, Bug, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const TicketsTab       = lazy(() => import("./Tickets"));
const IncidentsTab     = lazy(() => import("./Errors"));
const AnnouncementsTab = lazy(() => import("./Announcements"));
const SystemHealthTab  = lazy(() => import("./operations/SystemHealth"));
const LogsTab          = lazy(() => import("./Logs"));

type TabKey = "tickets" | "incidents" | "announcements" | "health" | "logs";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "tickets",       label: "Tickets",       icon: LifeBuoy,    description: "Support inbox — assign, reply, close." },
  { key: "incidents",     label: "Incidents",     icon: AlertCircle, description: "Runtime errors grouped by fingerprint." },
  { key: "announcements", label: "Announcements", icon: Megaphone,   description: "Platform-wide notices, scheduled and live." },
  { key: "health",        label: "System Health", icon: Activity,    description: "Auth, rate limits, and edge status at a glance." },
  { key: "logs",          label: "Logs",          icon: ScrollText,  description: "Filtered platform audit trail." },
];

type Insights = {
  openTickets: number;
  p1Incidents: number;
  errors24h: number;
  announcementsLive: number;
};

export default function SuperOperations() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const active: TabKey = (["tickets","incidents","announcements","health","logs"] as TabKey[]).includes(raw as TabKey) ? (raw as TabKey) : "tickets";
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [t, iOpen, e24, ann] = await Promise.all([
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase.from("client_errors").select("id", { count: "exact", head: true }).eq("resolution_status", "open"),
        supabase.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("platform_announcements").select("id, scheduled_for, deleted_at"),
      ]);
      if (!alive) return;
      const now = Date.now();
      const live = ((ann.data as { scheduled_for: string | null; deleted_at: string | null }[]) ?? [])
        .filter(a => !a.deleted_at && (!a.scheduled_for || new Date(a.scheduled_for).getTime() <= now)).length;
      setInsights({
        openTickets: t.count ?? 0,
        p1Incidents: iOpen.count ?? 0,
        errors24h: e24.count ?? 0,
        announcementsLive: live,
      });
    })();
    return () => { alive = false; };
  }, []);

  const activeMeta = TABS.find(t => t.key === active)!;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Sparkles className="size-3" /><span>Operations workspace</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Support &amp; system health</h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">
          The queue our support and on-call staff live in — tickets, incidents, announcements, and platform vitals in one place.
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
        {active === "tickets"       && <TicketsTab />}
        {active === "incidents"     && <IncidentsTab />}
        {active === "announcements" && <AnnouncementsTab />}
        {active === "health"        && <SystemHealthTab />}
        {active === "logs"          && <LogsTab />}
      </Suspense>
    </div>
  );
}

function InsightStrip({ insights, onOpen }: { insights: Insights | null; onOpen: (k: TabKey) => void }) {
  const items = useMemo(() => ([
    { key: "tickets",  label: "Open tickets",       value: insights?.openTickets,       icon: <LifeBuoy className="size-4" />,    tone: (insights?.openTickets ?? 0) > 0 ? "warning" as const : "info" as const, tab: "tickets" as TabKey },
    { key: "p1",       label: "Open incidents",     value: insights?.p1Incidents,       icon: <Bug className="size-4" />,          tone: (insights?.p1Incidents ?? 0) > 0 ? "danger" as const : "success" as const, tab: "incidents" as TabKey },
    { key: "err24h",   label: "Errors 24h",         value: insights?.errors24h,         icon: <AlertCircle className="size-4" />,  tone: (insights?.errors24h ?? 0) > 50 ? "danger" as const : "info" as const, tab: "incidents" as TabKey },
    { key: "live",     label: "Announcements live", value: insights?.announcementsLive, icon: <Radio className="size-4" />,        tone: "info" as const, tab: "announcements" as TabKey },
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