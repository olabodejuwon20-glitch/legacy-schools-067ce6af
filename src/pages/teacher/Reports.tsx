import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Users, Target, TrendingUp, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV, printToPDF, tableHTML, safeHtml } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { necoDistribution, necoSummary, necoGrade, NECO_GRADE_COLORS } from "@/lib/neco";
import { ReportCommentDialog } from "@/components/ai/ReportCommentDialog";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";

export default function TeacherReports() {
  const { school, user } = useSchool();
  const [rs, setRs] = useState<any[]>([]);

  useEffect(() => {
    if (!school || !user) return;
    supabase.from("results").select("score,subject,student_id,term").eq("school_id", school.id).eq("teacher_id", user.id)
      .then(({ data }) => setRs(data ?? []));
  }, [school, user]);

  const scores = rs.map(r => Number(r.score));
  const s = useMemo(() => necoSummary(scores), [rs]);
  const bySubj = useMemo(() => {
    const m: Record<string, number[]> = {};
    rs.forEach(r => { (m[r.subject] ||= []).push(Number(r.score)); });
    return Object.entries(m).map(([subject, arr]) => ({
      subject,
      avg: Math.round(arr.reduce((a,b)=>a+b,0)/arr.length),
      credit: Math.round(arr.filter(x => x>=50).length/arr.length*100),
      grade: necoGrade(arr.reduce((a,b)=>a+b,0)/arr.length),
    }));
  }, [rs]);
  const dist = useMemo(() => necoDistribution(scores), [rs]);
  const students = new Set(rs.map(r => r.student_id)).size;

  if (rs.length === 0) {
    return <SectionCard title="Class performance"><EmptyState icon={FileBarChart} title="No results recorded yet" desc="Grade students to see NECO-aligned class analytics." /></SectionCard>;
  }

  const exportCSV = () => {
    downloadCSV(`${school?.slug || "school"}-class-report.csv`,
      bySubj.map(b => ({ Subject: b.subject, Average: b.avg + "%", "NECO Grade": b.grade, "Credit pass": b.credit + "%" })));
  };
  const exportPDF = () => {
    const html = `<h1>Class Performance Report</h1><div class="sub">${safeHtml(school?.name || "")}</div>
      <div class="grid">
        <div class="card"><div class="label">Students graded</div><div class="value">${students}</div></div>
        <div class="card"><div class="label">Class average</div><div class="value">${s.average}% (${s.grade})</div></div>
        <div class="card"><div class="label">Credit pass</div><div class="value">${s.credit}%</div></div>
        <div class="card"><div class="label">Entries</div><div class="value">${s.count}</div></div>
      </div>
      <h3>Per-subject breakdown</h3>
      ${tableHTML(["Subject","Average","NECO","Credit pass"], bySubj.map(b => [b.subject, b.avg+"%", b.grade, b.credit+"%"]))}`;
    printToPDF(`Class Report – ${school?.name || ""}`, html);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">Class performance</h2>
          <p className="text-sm text-muted-foreground">NECO-aligned analytics for your classes</p>
        </div>
        <div className="flex gap-2">
          {school && rs.length > 0 && <ReportCommentDialog schoolId={school.id} results={rs as any} />}
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="size-4" /> <span className="hidden sm:inline ml-1">CSV</span></Button>
          <Button size="sm" variant="outline" onClick={exportPDF}><FileText className="size-4" /> <span className="hidden sm:inline ml-1">PDF</span></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Students graded" value={String(students)} icon={Users} tone="teacher" sub="Unique" />
        <StatCard label="Class average" value={`${s.average}%`} icon={TrendingUp} tone="info" sub={`Grade ${s.grade}`} />
        <StatCard label="Credit pass rate" value={`${s.credit}%`} icon={Target} tone="success" sub="C6 or better" />
        <StatCard label="Entries" value={String(s.count)} icon={FileBarChart} tone="warning" sub="Across subjects" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="NECO grade distribution" description="A1–F9 across all entries">
          <div className="h-[300px]">
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
        <SectionCard title="Subject performance" description="Average score per subject">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubj}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0,100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="avg" radius={[6,6,0,0]}>
                  {bySubj.map((d,i) => <Cell key={i} fill={NECO_GRADE_COLORS[d.grade]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Per-subject NECO breakdown">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border"><tr>
            <th className="text-left py-2">Subject</th><th className="text-right">Average</th><th className="text-center">NECO Grade</th><th className="text-right">Credit pass</th>
          </tr></thead>
          <tbody>{bySubj.map(b => (
            <tr key={b.subject} className="border-b border-border last:border-0">
              <td className="py-3 font-medium">{b.subject}</td>
              <td className="text-right tabular-nums">{b.avg}%</td>
              <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: NECO_GRADE_COLORS[b.grade]+"22", color: NECO_GRADE_COLORS[b.grade] }}>{b.grade}</span></td>
              <td className="text-right tabular-nums">{b.credit}%</td>
            </tr>
          ))}</tbody>
        </table></div>
      </SectionCard>
    </div>
  );
}
