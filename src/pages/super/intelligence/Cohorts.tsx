import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, MetricCard, StatusBadge } from "@/components/super/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, TrendingDown, Layers, ArrowUpRight } from "lucide-react";

type School = { id: string; name: string; plan: string | null; status: string; created_at: string };
type View = { school_id: string | null; session_id: string; created_at: string };

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function IntelligenceCohorts() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [views, setViews] = useState<View[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [s, v] = await Promise.all([
        supabase.from("schools").select("id, name, plan, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }),
        supabase.from("page_views").select("school_id, session_id, created_at").gte("created_at", since).limit(20000),
      ]);
      if (!alive) return;
      setSchools((s.data as School[]) ?? []);
      setViews((v.data as View[]) ?? []);
    })();
    return () => { alive = false; };
  }, []);

  const cohorts = useMemo(() => {
    if (!schools) return [];
    const map = new Map<string, School[]>();
    schools.forEach(s => {
      const k = monthKey(s.created_at);
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([month, list]) => ({
      month,
      total: list.length,
      activeCount: list.filter(s => s.status === "active").length,
      byPlan: list.reduce<Record<string, number>>((acc, s) => { const p = s.plan ?? "trial"; acc[p] = (acc[p] ?? 0) + 1; return acc; }, {}),
    }));
  }, [schools]);

  const activityBySchool = useMemo(() => {
    if (!views || !schools) return new Map<string, number>();
    const map = new Map<string, Set<string>>();
    views.forEach(v => {
      if (!v.school_id) return;
      const set = map.get(v.school_id) ?? new Set();
      set.add(v.session_id);
      map.set(v.school_id, set);
    });
    return new Map([...map.entries()].map(([k, v]) => [k, v.size]));
  }, [views, schools]);

  const atRisk = useMemo(() => {
    if (!schools) return [];
    const active = schools.filter(s => (s.plan ?? "trial") !== "trial" && s.status === "active");
    return active
      .map(s => ({ ...s, sessions: activityBySchool.get(s.id) ?? 0 }))
      .filter(s => s.sessions < 3)
      .sort((a, b) => a.sessions - b.sessions)
      .slice(0, 20);
  }, [schools, activityBySchool]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Active / Total Schools" value={schools ? `${schools.filter(s => s.status === "active").length} / ${schools.length}` : "—"} icon={<Users className="size-4" />} />
        <MetricCard label="Cohort Months" value={cohorts.length || "—"} icon={<Layers className="size-4" />} />
        <MetricCard label="At-Risk Paying Schools (30d)" value={atRisk.length} icon={<TrendingDown className="size-4 text-destructive" />} />
      </div>

      <Section title="Signup cohorts" description="New schools per month, active retention, and current plan mix.">
        {!schools ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
        ) : cohorts.length === 0 ? (
          <EmptyState icon={<Layers className="size-5 text-muted-foreground" />} title="No cohorts yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cohort</TableHead>
                <TableHead className="text-right w-24">Signups</TableHead>
                <TableHead className="text-right w-28">Active Now</TableHead>
                <TableHead>Plan mix</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {cohorts.map(c => (
                  <TableRow key={c.month}>
                    <TableCell className="font-mono text-[12px]">{c.month}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{c.total}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{c.activeCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Object.entries(c.byPlan).map(([p, n]) => `${p}: ${n}`).join("  ·  ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="At-risk schools" description="Paying schools with fewer than 3 sessions in the last 30 days — click any school to inspect or reach out.">
        {!schools || !views ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
        ) : atRisk.length === 0 ? (
          <EmptyState icon={<TrendingDown className="size-5 text-muted-foreground" />} title="All quiet" description="No paying school is under the activity threshold." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>School</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right w-32">Sessions 30d</TableHead>
                <TableHead className="text-right w-36">Joined</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {atRisk.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link to={`/super/schools/${s.id}`} className="inline-flex items-center gap-1 hover:underline text-foreground">
                        {s.name}
                        <ArrowUpRight className="size-3 text-muted-foreground" />
                      </Link>
                    </TableCell>
                    <TableCell><StatusBadge status={s.plan ?? "trial"} /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-warning">{s.sessions}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
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