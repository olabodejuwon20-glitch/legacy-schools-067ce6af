import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, MetricCard, StatusBadge } from "@/components/super/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, ShieldAlert, Gavel, Flag } from "lucide-react";

type QB = { id: string; subject: string; approval_status: string; difficulty: string; created_at: string };
type Viol = { id: string; type: string; created_at: string };
type Appeal = { id: string; status: string; exam_kind: string; created_at: string };

export default function IntelligenceContentQuality() {
  const [qb, setQb] = useState<QB[] | null>(null);
  const [violations, setViolations] = useState<Viol[] | null>(null);
  const [appeals, setAppeals] = useState<Appeal[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [q, v, a] = await Promise.all([
        supabase.from("question_bank").select("id, subject, approval_status, difficulty, created_at").limit(3000),
        supabase.from("assessment_violations_v2").select("id, type, created_at").gte("created_at", since).limit(2000),
        supabase.from("exam_appeals").select("id, status, exam_kind, created_at").gte("created_at", since).limit(500),
      ]);
      if (!alive) return;
      setQb((q.data as QB[]) ?? []);
      setViolations((v.data as Viol[]) ?? []);
      setAppeals((a.data as Appeal[]) ?? []);
    })();
    return () => { alive = false; };
  }, []);

  const bySubject = useMemo(() => {
    if (!qb) return [];
    const map = new Map<string, { total: number; approved: number; flagged: number }>();
    qb.forEach(r => {
      const cur = map.get(r.subject) ?? { total: 0, approved: 0, flagged: 0 };
      cur.total += 1;
      if (r.approval_status === "approved") cur.approved += 1;
      if (r.approval_status === "flagged" || r.approval_status === "rejected") cur.flagged += 1;
      map.set(r.subject, cur);
    });
    return [...map.entries()].map(([subject, s]) => ({ subject, ...s })).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [qb]);

  const violByType = useMemo(() => {
    if (!violations) return [];
    const map = new Map<string, number>();
    violations.forEach(v => map.set(v.type, (map.get(v.type) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [violations]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Questions in bank" value={qb?.length ?? "—"} icon={<BookOpen className="size-4" />} />
        <MetricCard label="Approved" value={qb ? qb.filter(x => x.approval_status === "approved").length : "—"} icon={<Flag className="size-4" />} />
        <MetricCard label="Violations 30d" value={violations?.length ?? "—"} icon={<ShieldAlert className="size-4" />} />
        <MetricCard label="Open appeals" value={appeals ? appeals.filter(a => a.status !== "resolved" && a.status !== "closed").length : "—"} icon={<Gavel className="size-4" />} />
      </div>

      <Section title="Coverage by subject" description="Top subjects by question count and their approval health.">
        {!qb ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
        ) : bySubject.length === 0 ? (
          <EmptyState icon={<BookOpen className="size-5 text-muted-foreground" />} title="No questions yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right w-24">Total</TableHead>
                <TableHead className="text-right w-24">Approved</TableHead>
                <TableHead className="text-right w-24">Flagged</TableHead>
                <TableHead className="text-right w-24">Approval %</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bySubject.map(row => (
                  <TableRow key={row.subject}>
                    <TableCell className="font-medium">{row.subject}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{row.approved}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{row.flagged}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.total > 0 ? Math.round((row.approved / row.total) * 100) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Violations by type (30d)" description="What proctoring is catching most.">
          {!violations ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
          ) : violByType.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="size-5 text-muted-foreground" />} title="No violations logged" />
          ) : (
            <ul className="space-y-2">
              {violByType.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <code className="text-[12px]">{type}</code>
                  <span className="tabular-nums font-medium">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent appeals" description="Latest 30 days of grade appeals.">
          {!appeals ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-8" />)}</div>
          ) : appeals.length === 0 ? (
            <EmptyState icon={<Gavel className="size-5 text-muted-foreground" />} title="No appeals" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Filed</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {appeals.slice(0, 15).map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-[12px]">{a.exam_kind}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}