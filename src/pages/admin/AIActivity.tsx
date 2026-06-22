import { useEffect, useMemo, useState } from "react";
import { Activity, Zap, DollarSign, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Job = {
  id: string;
  kind: string;
  status: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
  user_id: string | null;
  error: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  done: "secondary",
  running: "default",
  queued: "outline",
  error: "destructive",
};

export default function AIActivity() {
  const { school } = useSchool();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<string>("all");

  async function load() {
    if (!school) return;
    setLoading(true);
    let q = supabase
      .from("ai_jobs")
      .select("id, kind, status, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, created_at, user_id, error")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (kindFilter !== "all") q = q.eq("kind", kindFilter);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setJobs((data as Job[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id, kindFilter]);

  const totals = useMemo(() => {
    const t = { tokens: 0, cost: 0, count: jobs.length, errors: 0, latency: 0 };
    for (const j of jobs) {
      t.tokens += j.total_tokens ?? 0;
      t.cost += Number(j.cost_usd ?? 0);
      t.latency += j.latency_ms ?? 0;
      if (j.status === "error") t.errors++;
    }
    return t;
  }, [jobs]);

  const byKind = useMemo(() => {
    const m: Record<string, { count: number; cost: number; tokens: number }> = {};
    for (const j of jobs) {
      const k = j.kind || "unknown";
      m[k] = m[k] ?? { count: 0, cost: 0, tokens: 0 };
      m[k].count++;
      m[k].cost += Number(j.cost_usd ?? 0);
      m[k].tokens += j.total_tokens ?? 0;
    }
    return Object.entries(m).sort((a, b) => b[1].cost - a[1].cost);
  }, [jobs]);

  const kinds = useMemo(
    () => Array.from(new Set(jobs.map(j => j.kind))).sort(),
    [jobs],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Activity"
        description="Every AI call your school made — model, tokens, cost, and latency."
        actions={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Calls (last 200)" value={String(totals.count)} icon={Activity} />
        <StatCard label="Total tokens" value={totals.tokens.toLocaleString()} icon={Zap} tone="info" />
        <StatCard label="Total cost" value={`$${totals.cost.toFixed(4)}`} icon={DollarSign} tone="success" />
        <StatCard label="Avg latency" value={`${totals.count ? Math.round(totals.latency / totals.count) : 0} ms`} icon={Clock} sub={`${totals.errors} errors`} tone={totals.errors ? "warning" : "info"} />
      </div>

      <SectionCard title="Spend by feature" description="Where your AI budget is going.">
        {byKind.length === 0 ? (
          <EmptyState icon={Activity} title="No AI calls yet" desc="Once teachers use AI features they'll show up here." />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {byKind.map(([k, v]) => (
              <li key={k} className="py-2 flex items-center justify-between gap-2">
                <span className="font-medium capitalize">{k.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground text-xs">
                  {v.count} call{v.count === 1 ? "" : "s"} · {v.tokens.toLocaleString()} tok · ${v.cost.toFixed(4)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Recent calls"
        action={
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value)}
            className="text-xs rounded-md border border-border bg-background px-2 py-1"
          >
            <option value="all">All features</option>
            {kinds.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        }
      >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : jobs.length === 0 ? (
          <EmptyState icon={Activity} title="No activity" />
        ) : (
          <div className="overflow-x-auto">
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Feature</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3 text-right">Tokens</th>
                  <th className="py-2 pr-3 text-right">Cost</th>
                  <th className="py-2 pr-3 text-right">Latency</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-t border-border">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(j.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 capitalize">{j.kind.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3 font-mono text-[10px]">{j.model ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{(j.total_tokens ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right">${Number(j.cost_usd ?? 0).toFixed(5)}</td>
                    <td className="py-2 pr-3 text-right">{j.latency_ms ?? 0} ms</td>
                    <td className="py-2">
                      <Badge variant={STATUS_VARIANT[j.status] ?? "outline"} className="text-[10px] capitalize">{j.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}