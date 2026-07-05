import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, GraduationCap, Heart, DollarSign, Activity, Sparkles, HardDrive,
  ArrowUpRight, ArrowDownRight, ArrowRight, Plus, Send, ShieldCheck, Rocket, Zap,
  CheckCircle2, AlertTriangle, XCircle, Circle,
} from "lucide-react";
import { AreaTrend, BarTrend } from "@/components/super/Chart";
import { Skel, StatusBadge } from "@/components/super/primitives";
import { compact, money, timeAgo } from "@/lib/super";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import DailyIntel from "@/components/super/DailyIntel";

// ---------- Mocked-but-realistic slices (per user choice: super-metrics + mock rest) ----------
const MOCK = {
  breakdown: { students: 0, teachers: 0, parents: 0 }, // derived from total_users below
  ai_usage: { tokens_month: 2_840_000, cap: 5_000_000, spend_cents: 84_200 },
  storage: { used_gb: 412, cap_gb: 1024 },
  health: [
    { label: "API", status: "operational", latency: "142ms" },
    { label: "Database", status: "operational", latency: "38ms" },
    { label: "Edge Functions", status: "operational", latency: "89ms" },
    { label: "Realtime", status: "operational", latency: "24ms" },
    { label: "Storage", status: "operational", latency: "61ms" },
    { label: "AI Gateway", status: "degraded", latency: "1.2s" },
  ] as { label: string; status: "operational" | "degraded" | "down"; latency: string }[],
};

type Kpi = {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: string; positive: boolean };
  icon: React.ReactNode;
  to?: string;
  accent?: string;
};

export default function SuperDashboard() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.functions.invoke("super-metrics").then(({ data, error }) => {
      if (error) setErr("Metrics unavailable"); else setData(data);
    });
  }, []);

  const kpis: Kpi[] = useMemo(() => {
    const k = data?.kpi;
    // Derived breakdown: rough split for viz until real query lands
    const totalUsers = k?.total_users ?? 0;
    const students = Math.round(totalUsers * 0.72);
    const teachers = Math.round(totalUsers * 0.11);
    const parents = Math.round(totalUsers * 0.15);
    const aiPct = Math.round((MOCK.ai_usage.tokens_month / MOCK.ai_usage.cap) * 100);
    const storagePct = Math.round((MOCK.storage.used_gb / MOCK.storage.cap_gb) * 100);
    return [
      { label: "Schools", value: compact(k?.total_schools ?? 0), hint: `${k?.active_schools ?? 0} active`, delta: { value: "+12 this month", positive: true }, icon: <Building2 className="size-3.5" />, to: "/super/schools" },
      { label: "Students", value: compact(students), hint: "72% of users", delta: { value: "+2.4%", positive: true }, icon: <GraduationCap className="size-3.5" /> },
      { label: "Teachers", value: compact(teachers), hint: "11% of users", delta: { value: "+1.1%", positive: true }, icon: <Users className="size-3.5" /> },
      { label: "Parents", value: compact(parents), hint: "15% of users", delta: { value: "+3.2%", positive: true }, icon: <Heart className="size-3.5" /> },
      { label: "MRR", value: money(k?.mrr_cents ?? 0), hint: `${k?.active_subscriptions ?? 0} subs`, delta: { value: "+8.1%", positive: true }, icon: <DollarSign className="size-3.5" />, to: "/super/billing", accent: "success" },
      { label: "Platform health", value: "99.98%", hint: "30-day uptime", delta: { value: "1 degraded", positive: false }, icon: <Activity className="size-3.5" /> },
      { label: "AI usage", value: `${aiPct}%`, hint: `${compact(MOCK.ai_usage.tokens_month)} / ${compact(MOCK.ai_usage.cap)} tok`, delta: { value: money(MOCK.ai_usage.spend_cents), positive: true }, icon: <Sparkles className="size-3.5" />, to: "/super/quotas" },
      { label: "Storage", value: `${storagePct}%`, hint: `${MOCK.storage.used_gb} / ${MOCK.storage.cap_gb} GB`, delta: { value: "+18 GB / 7d", positive: true }, icon: <HardDrive className="size-3.5" /> },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Executive header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
            <span className="size-1.5 rounded-full bg-success" />
            <span>Live · updated {timeAgo(new Date().toISOString())}</span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Platform command center</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Every school, dollar, and signal across Legacyskool — in one glance.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <QuickAction icon={<Plus className="size-3.5" />} label="Add school" to="/super/schools" />
          <QuickAction icon={<Send className="size-3.5" />} label="Announcement" to="/super/announcements" />
          <QuickAction icon={<Rocket className="size-3.5" />} label="Invite pilot" to="/super/pilots" />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data === null && !err
          ? Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="h-[104px]" />)
          : kpis.map((k) => <KpiCard key={k.label} kpi={k} />)}
      </div>

      {/* AI Daily Intelligence briefing */}
      <DailyIntel />

      {/* Revenue + growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Revenue" subtitle="Monthly recurring, last 12 months" className="lg:col-span-2" action={<Link to="/super/billing" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View billing <ArrowRight className="size-3" /></Link>}>
          {data ? <BarTrend data={data.growth} dataKey="revenue" color="hsl(var(--success))" height={240} /> : <Skel className="h-[240px]" />}
        </Panel>
        <Panel title="Platform health" subtitle="Service status">
          <ul className="space-y-2 -my-1">
            {MOCK.health.map(h => <HealthRow key={h.label} h={h} />)}
          </ul>
        </Panel>
      </div>

      {/* Growth + Activity + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="School growth" subtitle="New tenants onboarded per month">
          {data ? <AreaTrend data={data.growth} dataKey="schools" height={220} /> : <Skel className="h-[220px]" />}
        </Panel>
        <Panel title="Activity timeline" subtitle="Latest platform actions" action={<Link to="/super/logs" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All logs <ArrowRight className="size-3" /></Link>}>
          {data ? <ActivityTimeline items={data.recent_audit ?? []} /> : <Skel className="h-[220px]" />}
        </Panel>
        <Panel title="School health leaderboard" subtitle="Top performers by engagement" action={<Link to="/super/schools" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All schools <ArrowRight className="size-3" /></Link>}>
          {data ? <Leaderboard schools={data.recent_schools ?? []} /> : <Skel className="h-[220px]" />}
        </Panel>
      </div>

      {/* Expiring subs strip */}
      {data?.expiring?.length > 0 && (
        <Panel title="Expiring soon" subtitle="Subscriptions renewing in the next 30 days" action={<Link to="/super/subscriptions" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Manage <ArrowRight className="size-3" /></Link>}>
          <ul className="divide-y divide-border/60 -my-1">
            {data.expiring.slice(0, 6).map((s: any) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                <Link to={`/super/schools/${s.id}`} className="font-medium truncate hover:underline">{s.name}</Link>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status ?? "active"} />
                  <span className={cn("text-[11px] tabular-nums font-mono", s.days < 7 ? "text-destructive" : "text-muted-foreground")}>{s.days}d</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

// ---------- primitives ----------

function QuickAction({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border/70 bg-card/60 hover:bg-muted hover:border-border text-[12px] font-medium text-foreground/80 hover:text-foreground transition-colors">
      {icon}<span>{label}</span>
    </Link>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Wrap = kpi.to ? Link : "div";
  const props: any = kpi.to ? { to: kpi.to } : {};
  return (
    <Wrap {...props} className="group rounded-lg border border-border/70 bg-card/60 p-3.5 hover:bg-card hover:border-border transition-all block">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className={cn("size-5 rounded grid place-items-center", kpi.accent === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{kpi.icon}</span>
          {kpi.label}
        </div>
        {kpi.to && <ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <div className="text-[22px] font-semibold tabular-nums tracking-tight leading-none">{kpi.value}</div>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-muted-foreground truncate">{kpi.hint}</span>
        {kpi.delta && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", kpi.delta.positive ? "text-success" : "text-destructive")}>
            {kpi.delta.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {kpi.delta.value}
          </span>
        )}
      </div>
    </Wrap>
  );
}

function Panel({ title, subtitle, children, action, className }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border/70 bg-card/40 overflow-hidden flex flex-col", className)}>
      <header className="px-4 py-3 border-b border-border/70 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

function HealthRow({ h }: { h: { label: string; status: "operational" | "degraded" | "down"; latency: string } }) {
  const map = {
    operational: { icon: <CheckCircle2 className="size-3.5 text-success" />, tone: "text-success" },
    degraded: { icon: <AlertTriangle className="size-3.5 text-warning" />, tone: "text-warning" },
    down: { icon: <XCircle className="size-3.5 text-destructive" />, tone: "text-destructive" },
  }[h.status];
  return (
    <li className="flex items-center justify-between text-[12px] py-1.5">
      <span className="flex items-center gap-2">{map.icon}<span className="text-foreground">{h.label}</span></span>
      <span className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{h.latency}</span>
        <span className={cn("text-[10px] font-medium capitalize", map.tone)}>{h.status}</span>
      </span>
    </li>
  );
}

function ActivityTimeline({ items }: { items: any[] }) {
  if (!items.length) return <p className="text-[12px] text-muted-foreground py-8 text-center">No recent activity.</p>;
  return (
    <ul className="space-y-3 relative before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
      {items.slice(0, 8).map((a: any) => (
        <li key={a.id} className="relative pl-5 text-[12px]">
          <Circle className="absolute left-0 top-1 size-2.5 fill-background text-muted-foreground" />
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground truncate">{(a.action ?? "").replace(/_/g, " ")}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{timeAgo(a.created_at)}</span>
          </div>
          {a.actor_email && <div className="text-[11px] text-muted-foreground truncate">{a.actor_email}</div>}
        </li>
      ))}
    </ul>
  );
}

function Leaderboard({ schools }: { schools: any[] }) {
  if (!schools.length) return <p className="text-[12px] text-muted-foreground py-8 text-center">No schools yet.</p>;
  return (
    <ol className="space-y-1.5">
      {schools.slice(0, 6).map((s: any, i: number) => {
        // deterministic pseudo-score so viz feels alive until we compute real signal
        const score = 60 + ((s.id?.charCodeAt(0) ?? i * 13) % 40);
        return (
          <li key={s.id} className="group flex items-center gap-2.5 text-[12px] py-1">
            <span className="w-4 text-[10px] font-mono text-muted-foreground tabular-nums text-right">{i + 1}</span>
            <Link to={`/super/schools/${s.id}`} className="font-medium truncate flex-1 group-hover:underline">{s.name}</Link>
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", score > 85 ? "bg-success" : score > 70 ? "bg-primary" : "bg-warning")} style={{ width: `${score}%` }} />
            </div>
            <span className="w-8 text-right text-[11px] font-mono tabular-nums text-muted-foreground">{score}</span>
          </li>
        );
      })}
    </ol>
  );
}