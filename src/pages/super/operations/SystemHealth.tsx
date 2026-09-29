import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, MetricCard } from "@/components/super/primitives";
import { Activity, AlertCircle, ShieldAlert, Gauge, Server, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { superAction } from "@/lib/super";

type Err = { id: string; created_at: string; resolution_status: string };
type AuthEv = { id: string; event: string; created_at: string };
type Limit = { id: string; key: string; count: number; school_id: string | null; window_start: string };

export default function OperationsSystemHealth() {
  const [errors, setErrors] = useState<Err[] | null>(null);
  const [auth, setAuth] = useState<AuthEv[] | null>(null);
  const [limits, setLimits] = useState<Limit[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [e, a, r] = await Promise.all([
      supabase.from("client_errors").select("id, created_at, resolution_status").is("deleted_at", null).gte("created_at", since).limit(2000),
      supabase.from("auth_events").select("id, event, created_at").gte("created_at", since).limit(2000),
      supabase.from("rate_limits").select("id, key, count, school_id, window_start").order("count", { ascending: false }).limit(20),
    ]);
    setErrors((e.data as Err[]) ?? []);
    setAuth((a.data as AuthEv[]) ?? []);
    setLimits((r.data as Limit[]) ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function clearLimit(id?: string, all?: boolean) {
    setBusyId(all ? "all" : (id ?? null));
    try {
      await superAction("clear_rate_limit", { id, all });
      toast.success(all ? "Cleared all rate-limit counters" : "Rate-limit counter reset");
      await load();
    } catch {
      /* toasted */
    } finally {
      setBusyId(null);
    }
  }

  const errorRate = useMemo(() => {
    if (!errors) return null;
    return errors.length;
  }, [errors]);

  const authFailures = useMemo(() => {
    if (!auth) return null;
    return auth.filter(x => /fail|denied|invalid|error/i.test(x.event)).length;
  }, [auth]);

  const authTotal = auth?.length ?? 0;
  const failurePct = authTotal > 0 && authFailures !== null ? Math.round((authFailures / authTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Errors 24h" value={errorRate ?? "—"} icon={<AlertCircle className="size-4" />} />
        <MetricCard label="Auth failures 24h" value={authFailures ?? "—"} icon={<ShieldAlert className="size-4" />}
          delta={authTotal > 0 ? { value: `${failurePct}% of ${authTotal}`, positive: failurePct < 5 } : undefined} />
        <MetricCard label="Hot rate-limit keys" value={limits?.length ?? "—"} icon={<Gauge className="size-4" />} />
        <MetricCard label="Edge functions" value={<span className="text-success">Online</span>} icon={<Server className="size-4" />} />
      </div>

      <Section
        title="Top rate-limit hits"
        description="Highest-count keys across all tenants — a spike here usually means abuse or a runaway client. Reset individual keys to unblock legitimate users."
        actions={
          limits && limits.length > 0 ? (
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busyId === "all"} onClick={() => void clearLimit(undefined, true)}>
              <RotateCcw className="size-3.5 mr-1.5" />Reset all throttles
            </Button>
          ) : undefined
        }
      >
        {!limits ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
        ) : limits.length === 0 ? (
          <EmptyState icon={<Gauge className="size-5 text-muted-foreground" />} title="No throttled keys" description="Nothing has crossed a limit recently." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead className="w-28 text-right">Count</TableHead>
                  <TableHead className="w-64">Window start</TableHead>
                  <TableHead className="w-40">School</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limits.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-[12px]">{l.key}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{l.count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.window_start).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{l.school_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={busyId === l.id}
                        onClick={() => void clearLimit(l.id)}
                      >
                        <RotateCcw className="size-3 mr-1" />Reset
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Recent auth events" description="Last 24h of authentication activity — spikes in failures precede lockouts.">
        {!auth ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
        ) : auth.length === 0 ? (
          <EmptyState icon={<Activity className="size-5 text-muted-foreground" />} title="Quiet" description="No auth activity in the last 24 hours." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-64 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auth.slice(0, 25).map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-[12px]">{e.event}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}