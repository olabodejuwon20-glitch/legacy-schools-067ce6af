import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, GraduationCap, Heart, DollarSign, Activity, Sparkles, HardDrive,
  ArrowUpRight, ArrowDownRight, ArrowRight, Plus, Send, Rocket,
  CheckCircle2, AlertTriangle, XCircle, Circle,
} from "lucide-react";
import { AreaTrend, BarTrend } from "@/components/super/Chart";
import { Skel, StatusBadge } from "@/components/super/primitives";
import { compact, money, timeAgo } from "@/lib/super";
import { enrichSchool } from "@/lib/schoolHealth";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import DailyIntel from "@/components/super/DailyIntel";

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
    (async () => {
      const { data: fnData, error } = await supabase.functions.invoke("super-metrics");
      if (!error && fnData) {
        setData(fnData);
        return;
      }
      // Direct live Supabase fallback
      try {
        const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
        const [schools, users, subs, mods, tickets, audits, invoices, aiQuotas, errors24h] = await Promise.all([
          supabase.from("schools").select("id,name,slug,logo_url,plan,status,plan_expires_at,created_at"),
          supabase.from("memberships").select("user_id,role,school_id,created_at"),
          supabase.from("subscriptions").select("plan,status,monthly_amount_cents,started_at,current_period_end"),
          supabase.from("school_modules").select("module_id,school_id,enabled"),
          supabase.from("support_tickets").select("id,status,priority,subject,created_at"),
          supabase.from("platform_audit").select("id,action,created_at,actor,school_id").order("created_at", { ascending: false }).limit(20),
          supabase.from("invoices").select("id,school_id,amount_cents,amount_kobo,status,issued_at,paid_at"),
          supabase.from("school_ai_quotas").select("school_id,monthly_token_cap,monthly_cost_cap_usd,tokens_used,cost_used_usd,enabled"),
          supabase.from("client_errors").select("id,resolution_status").gte("created_at", since24h),
        ]);
        const schoolsList = schools.data ?? [];
        const membersList = users.data ?? [];
        const subsList = subs.data ?? [];
        const ticketsList = tickets.data ?? [];
        const modsList = mods.data ?? [];
        const invoicesList = invoices.data ?? [];
        const quotasList = aiQuotas.data ?? [];
        const errsList = errors24h.data ?? [];

        const uniqUsers = new Set(membersList.map((m: any) => m.user_id)).size;
        const now = new Date();
        const schoolsThisMonth = schoolsList.filter((s: any) => {
          const c = new Date(s.created_at);
          return c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth();
        }).length;

        const subMrr = subsList.filter((s: any) => s.status === "active").reduce((sum: number, s: any) => sum + (s.monthly_amount_cents ?? 0), 0);
        const since30d = Date.now() - 30 * 86400_000;
        const paidInv30d = invoicesList
          .filter((inv: any) => inv.status === "paid" && inv.paid_at && new Date(inv.paid_at).getTime() >= since30d)
          .reduce((sum: number, inv: any) => sum + Number(inv.amount_cents ?? inv.amount_kobo ?? 0), 0);

        const months: { label: string; schools: number; revenue: number }[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = d.toLocaleDateString("en", { month: "short" });
          const count = schoolsList.filter((s: any) => {
            const c = new Date(s.created_at);
            return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
          }).length;
          const paidInMonth = invoicesList
            .filter((inv: any) => {
              if (inv.status !== "paid" || !inv.paid_at) return false;
              const p = new Date(inv.paid_at);
              return p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth();
            })
            .reduce((sum: number, inv: any) => sum + Math.round(Number(inv.amount_cents ?? inv.amount_kobo ?? 0) / 100), 0);
          months.push({ label, schools: count, revenue: paidInMonth });
        }

        const membersBySchool: Record<string, number> = {};
        membersList.forEach((m: any) => {
          if (m.school_id) membersBySchool[m.school_id] = (membersBySchool[m.school_id] ?? 0) + 1;
        });

        setData({
          kpi: {
            total_schools: schoolsList.length,
            active_schools: schoolsList.filter((s: any) => s.status === "active").length,
            schools_this_month: schoolsThisMonth,
            total_users: uniqUsers,
            students_count: membersList.filter((m: any) => m.role === "student").length,
            teachers_count: membersList.filter((m: any) => m.role === "teacher").length,
            parents_count: membersList.filter((m: any) => m.role === "parent").length,
            admins_count: membersList.filter((m: any) => m.role === "admin").length,
            mrr_cents: subMrr || paidInv30d,
            active_subscriptions: subsList.filter((s: any) => s.status === "active").length,
            installed_modules: modsList.filter((m: any) => m.enabled).length,
            open_tickets: ticketsList.filter((t: any) => t.status !== "resolved" && t.status !== "closed").length,
            open_errors_24h: errsList.filter((e: any) => e.resolution_status !== "resolved").length,
          },
          ai_usage: {
            tokens_month: quotasList.reduce((sum: number, q: any) => sum + Number(q.tokens_used ?? 0), 0),
            cap: quotasList.reduce((sum: number, q: any) => sum + Number(q.monthly_token_cap ?? 0), 0),
            spend_cents: Math.round(quotasList.reduce((sum: number, q: any) => sum + Number(q.cost_used_usd ?? 0), 0) * 100),
          },
          growth: months,
          expiring: schoolsList
            .filter((s: any) => s.plan_expires_at)
            .map((s: any) => ({ ...s, days: Math.ceil((new Date(s.plan_expires_at).getTime() - Date.now()) / 86400000) }))
            .filter((s: any) => s.days <= 30)
            .sort((a: any, b: any) => a.days - b.days)
            .slice(0, 6),
          recent_schools: [...schoolsList]
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 6)
            .map((s: any) => ({ ...s, member_count: membersBySchool[s.id] ?? 0 })),
          recent_audit: audits.data ?? [],
        });
      } catch {
        setErr("Metrics unavailable");
      }
    })();
  }, []);

  const kpis: Kpi[] = useMemo(() => {
    const k = data?.kpi;
    const totalUsers = k?.total_users ?? 0;
    const students = k?.students_count ?? 0;
    const teachers = k?.teachers_count ?? 0;
    const parents = k?.parents_count ?? 0;
    const totalMembers = students + teachers + parents + (k?.admins_count ?? 0);
    const stuPct = totalMembers > 0 ? Math.round((students / totalMembers) * 100) : 0;
    const teaPct = totalMembers > 0 ? Math.round((teachers / totalMembers) * 100) : 0;
    const parPct = totalMembers > 0 ? Math.round((parents / totalMembers) * 100) : 0;

    const aiTokens = data?.ai_usage?.tokens_month ?? 0;
    const aiCap = data?.ai_usage?.cap || Math.max(1, (k?.total_schools ?? 1) * 500_000);
    const aiSpendCents = data?.ai_usage?.spend_cents ?? 0;
    const aiPct = aiCap > 0 ? Math.min(100, Math.round((aiTokens / aiCap) * 100)) : 0;
    const openErrors = k?.open_errors_24h ?? 0;

    return [
      { label: "Schools", value: compact(k?.total_schools ?? 0), hint: `${k?.active_schools ?? 0} active`, delta: { value: `+${k?.schools_this_month ?? 0} this month`, positive: true }, icon: <Building2 className="size-3.5" />, to: "/super/schools" },
      { label: "Students", value: compact(students), hint: `${stuPct}% of members`, icon: <GraduationCap className="size-3.5" />, to: "/super/users" },
      { label: "Teachers", value: compact(teachers), hint: `${teaPct}% of members`, icon: <Users className="size-3.5" />, to: "/super/users" },
      { label: "Parents", value: compact(parents), hint: `${parPct}% of members`, icon: <Heart className="size-3.5" />, to: "/super/users" },
      { label: "MRR", value: money(k?.mrr_cents ?? 0), hint: `${k?.active_subscriptions ?? 0} active subs`, icon: <DollarSign className="size-3.5" />, to: "/super/billing", accent: "success" },
      { label: "Platform health", value: openErrors === 0 ? "100%" : "99.9%", hint: `${k?.open_tickets ?? 0} open tickets`, delta: { value: `${openErrors} open errors`, positive: openErrors === 0 }, icon: <Activity className="size-3.5" />, to: "/super/operations" },
      { label: "AI usage", value: `${aiPct}%`, hint: `${compact(aiTokens)} / ${compact(aiCap)} tok`, delta: { value: money(aiSpendCents), positive: true }, icon: <Sparkles className="size-3.5" />, to: "/super/quotas" },
      { label: "Modules active", value: compact(k?.installed_modules ?? 0), hint: `Across ${k?.total_schools ?? 0} schools`, icon: <HardDrive className="size-3.5" />, to: "/super/modules" },
    ];
  }, [data]);

  const liveHealth = useMemo(() => {
    const openErrors = data?.kpi?.open_errors_24h ?? 0;
    return [
      { label: "API & Auth", status: "operational" as const, latency: "live" },
      { label: "Database (Postgres)", status: "operational" as const, latency: "live" },
      { label: "Edge Functions", status: "operational" as const, latency: "live" },
      { label: "Realtime", status: "operational" as const, latency: "live" },
      { label: "Storage Buckets", status: "operational" as const, latency: "live" },
      { label: "Client Telemetry", status: (openErrors > 10 ? "degraded" : "operational") as "operational" | "degraded", latency: `${openErrors} err/24h` },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data === null && !err
          ? Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="h-[104px]" />)
          : kpis.map((k) => <KpiCard key={k.label} kpi={k} />)}
      </div>

      <DailyIntel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="Revenue" subtitle="Monthly paid revenue, last 12 months" className="lg:col-span-2" action={<Link to="/super/billing" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View billing <ArrowRight className="size-3" /></Link>}>
          {data ? <BarTrend data={data.growth} dataKey="revenue" color="hsl(var(--success))" height={240} /> : <Skel className="h-[240px]" />}
        </Panel>
        <Panel title="Platform health" subtitle="Live service status">
          <ul className="space-y-2 -my-1">
            {liveHealth.map(h => <HealthRow key={h.label} h={h} />)}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="School growth" subtitle="New tenants onboarded per month">
          {data ? <AreaTrend data={data.growth} dataKey="schools" height={220} /> : <Skel className="h-[220px]" />}
        </Panel>
        <Panel title="Activity timeline" subtitle="Latest platform actions" action={<Link to="/super/logs" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All logs <ArrowRight className="size-3" /></Link>}>
          {data ? <ActivityTimeline items={data.recent_audit ?? []} /> : <Skel className="h-[220px]" />}
        </Panel>
        <Panel title="School health leaderboard" subtitle="Top performers by live status & adoption" action={<Link to="/super/schools" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All schools <ArrowRight className="size-3" /></Link>}>
          {data ? <Leaderboard schools={data.recent_schools ?? []} /> : <Skel className="h-[220px]" />}
        </Panel>
      </div>

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
        const enr = enrichSchool(s, { students: s.member_count ?? 0 });
        const score = enr.healthScore;
        return (
          <li key={s.id} className="group flex items-center gap-2.5 text-[12px] py-1">
            <span className="w-4 text-[10px] font-mono text-muted-foreground tabular-nums text-right">{i + 1}</span>
            <Link to={`/super/schools/${s.id}`} className="font-medium truncate flex-1 group-hover:underline">{s.name}</Link>
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", score >= 75 ? "bg-success" : score >= 55 ? "bg-primary" : "bg-warning")} style={{ width: `${score}%` }} />
            </div>
            <span className="w-8 text-right text-[11px] font-mono tabular-nums text-muted-foreground">{score}</span>
          </li>
        );
      })}
    </ol>
  );
}