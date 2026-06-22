import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, EmptyState, StatusBadge } from "@/components/super/primitives";
import { AreaTrend } from "@/components/super/Chart";
import { Activity, AlertTriangle, Globe, ShieldAlert } from "lucide-react";
import { compact, timeAgo } from "@/lib/super";

type Evt = { id: string; type: string; ip: string | null; user_id: string | null; school_id: string | null; detail: any; created_at: string };

export default function SuperSecurity() {
  const [evts, setEvts] = useState<Evt[] | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data } = await supabase.from("security_events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      setEvts((data as Evt[]) ?? []);
    })();
  }, []);

  const kpis = useMemo(() => {
    if (!evts) return null;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const today = evts.filter(e => new Date(e.created_at) >= todayStart).length;
    const uniqueIps = new Set(evts.map(e => e.ip).filter(Boolean)).size;
    const escalations = evts.filter(e => e.type.includes("escalat") || e.type === "grant_super").length;
    const schoolCount = new Map<string, number>();
    evts.forEach(e => { if (e.school_id) schoolCount.set(e.school_id, (schoolCount.get(e.school_id) ?? 0) + 1); });
    const top = [...schoolCount.entries()].sort((a,b) => b[1]-a[1])[0];
    return { today, uniqueIps, escalations, topSchool: top?.[1] ?? 0 };
  }, [evts]);

  const trend = useMemo(() => {
    if (!evts) return [];
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      days[d.toISOString().slice(0,10)] = 0;
    }
    evts.forEach(e => { const k = e.created_at.slice(0,10); if (k in days) days[k]++; });
    return Object.entries(days).map(([k, v]) => ({ label: k.slice(5), events: v }));
  }, [evts]);

  return (
    <div>
      <PageHeader title="Security Center" description="Login anomalies, IP signals, role escalations and account events across the platform." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis === null
          ? Array.from({length:4}).map((_,i)=><Skel key={i} className="h-28" />)
          : (
            <>
              <MetricCard label="Events today" value={compact(kpis.today)} icon={<Activity className="size-4" />} />
              <MetricCard label="Unique IPs (30d)" value={compact(kpis.uniqueIps)} icon={<Globe className="size-4" />} />
              <MetricCard label="Escalations" value={compact(kpis.escalations)} icon={<ShieldAlert className="size-4" />} delta={kpis.escalations ? { value: "review", positive: false } : undefined} />
              <MetricCard label="Top school events" value={compact(kpis.topSchool)} icon={<AlertTriangle className="size-4" />} />
            </>
          )}
      </div>

      <div className="mb-6">
        <Section title="Events over the last 30 days" description="Volume of authentication, access and policy events.">
          {evts === null ? <Skel className="h-56" /> : <AreaTrend data={trend} dataKey="events" color="hsl(var(--destructive))" />}
        </Section>
      </div>

      <Section title="Recent events">
        {evts === null ? (
          <div className="space-y-2">{Array.from({length:6}).map((_,i)=><Skel key={i} className="h-10" />)}</div>
        ) : evts.length === 0 ? (
          <EmptyState icon={<ShieldAlert className="size-5 text-muted-foreground" />} title="No security events recorded"
            description="Anomalies will appear here when detected." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr><th className="text-left px-5 py-2 font-medium">Type</th><th className="text-left px-3 py-2 font-medium">IP</th><th className="text-left px-3 py-2 font-medium">User</th><th className="text-left px-3 py-2 font-medium">School</th><th className="text-right px-5 py-2 font-medium">When</th></tr>
              </thead>
              <tbody>
                {evts.slice(0, 100).map(e => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="px-5 py-2"><StatusBadge status={e.type.includes("fail") || e.type.includes("escalat") ? "critical" : "normal"} />{" "}<code className="text-[11px] text-muted-foreground">{e.type}</code></td>
                    <td className="px-3 py-2 font-mono text-xs">{e.ip ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[140px]">{e.user_id?.slice(0,8) ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[140px]">{e.school_id?.slice(0,8) ?? "—"}</td>
                    <td className="px-5 py-2 text-right text-xs text-muted-foreground">{timeAgo(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </Section>
    </div>
  );
}