import { useEffect, useMemo, useState } from "react";
import { FileBarChart, TrendingUp, Target, Award, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ExportMenu";
import type { BrandedPDFOptions } from "@/lib/exporters";
import { downloadResultSlip } from "@/lib/slip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { necoGrade, necoDistribution, necoSummary, NECO_GRADE_COLORS } from "@/lib/neco";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TermBreakdownBar } from "@/components/results/TermBreakdownBar";

export default function ParentResults() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [kids, setKids] = useState<{ id: string; name: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [slipLoading, setSlipLoading] = useState(false);

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const { data: links } = await supabase.from("parent_links").select("student_user_id").eq("school_id", school.id).eq("parent_user_id", user.id);
      const ids = (links ?? []).map(l => l.student_user_id);
      if (!ids.length) return;
      const [{ data: profs }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").in("id", ids),
        supabase.from("results").select("*").eq("school_id", school.id).in("student_id", ids).order("created_at", { ascending: false }),
      ]);
      const kidsArr = (profs ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || "Child" }));
      setKids(kidsArr);
      setActive(kidsArr[0]?.id ?? null);
      setRows(rs ?? []);
    })();
  }, [school, user]);

  const childRows = useMemo(() => active ? rows.filter(r => r.student_id === active) : rows, [rows, active]);
  const scores = childRows.map(r => Number(r.score));
  const s = useMemo(() => necoSummary(scores), [childRows]);
  const dist = useMemo(() => necoDistribution(scores), [childRows]);

  if (!kids.length) {
    return <SectionCard title="Academic records"><EmptyState icon={FileBarChart} title="No children linked yet" desc="Ask the school admin to link your account." /></SectionCard>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-semibold text-lg">Academic records</h2>
          <p className="text-sm text-muted-foreground">Your child's NECO-aligned performance</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu disabled={!childRows.length} data={(): BrandedPDFOptions => {
              const childName = kids.find(k => k.id === active)?.name || "Child";
              return {
                title: "Academic Report",
                subtitle: childName,
                schoolName: school?.name,
                schoolLogo: school?.logo_url,
                stats: [
                  { label: "Overall", value: `${s.average}%`, hint: `Grade ${s.grade}` },
                  { label: "Credit pass", value: `${s.credit}%` },
                  { label: "Best", value: `${s.best}%` },
                  { label: "Records", value: s.count },
                ],
                sections: [{
                  kind: "table",
                  heading: "Result breakdown",
                  headers: ["Subject", "Score", "NECO", "Term", "Date"],
                  rows: childRows.map(r => [r.subject, Math.round(Number(r.score)) + "%", necoGrade(Number(r.score)), r.term, new Date(r.created_at).toLocaleDateString()]),
                }],
                footerNote: `Academic report · ${childName}`,
              };
          }} />
          <Button size="sm" disabled={!childRows.length || slipLoading || !active}
            onClick={async () => {
              if (!active) return;
              setSlipLoading(true);
              try { await downloadResultSlip(active); toast.success("Result slip downloaded"); }
              catch (e: any) { toast.error(e.message ?? "Failed to generate slip"); }
              finally { setSlipLoading(false); }
            }}>
            <FileDown className="size-4" /> <span className="hidden sm:inline ml-1">{slipLoading ? "Generating…" : "Result slip"}</span>
          </Button>
        </div>
      </div>

      {kids.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {kids.map(k => (
            <button key={k.id} onClick={() => setActive(k.id)}
              className={`px-3 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${active===k.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-muted"}`}>
              {k.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall" value={s.count ? `${s.average}%` : "—"} icon={TrendingUp} tone="parent" sub={`Grade ${s.grade}`} />
        <StatCard label="Credit pass" value={`${s.credit}%`} icon={Target} tone="success" sub="C6 or better" />
        <StatCard label="Best" value={s.count ? `${s.best}%` : "—"} icon={Award} tone="warning" sub="Top score" />
        <StatCard label="Records" value={String(s.count)} icon={FileBarChart} tone="info" sub="Total" />
      </div>

      {childRows.length === 0 ? (
        <SectionCard title="Academic records"><EmptyState icon={FileBarChart} title="No results yet" /></SectionCard>
      ) : (
        <>
          <SectionCard title="NECO grade distribution" description="A1–F9 across subjects">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="grade" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[6,6,0,0]}>
                    {dist.map((d,i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Academic records">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2">Subject</th><th className="text-right">Score</th><th className="text-center">NECO</th><th className="text-left">Term</th><th className="text-left">Date</th></tr>
              </thead>
              <tbody>{childRows.map(r => {
                const g = necoGrade(Number(r.score));
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium">
                      <div>{r.subject}</div>
                      <TermBreakdownBar breakdown={r.breakdown} />
                    </td>
                    <td className="text-right tabular-nums font-semibold">{Math.round(Number(r.score))}%</td>
                    <td className="text-center"><Badge variant="outline" style={{ background: NECO_GRADE_COLORS[g]+"22", color: NECO_GRADE_COLORS[g], borderColor: NECO_GRADE_COLORS[g]+"55" }}>{g}</Badge></td>
                    <td className="text-muted-foreground">{r.term}</td>
                    <td className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
