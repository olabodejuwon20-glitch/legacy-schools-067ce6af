import { useEffect, useMemo, useState } from "react";
import { FileBarChart, TrendingUp, Award, Target, FileText, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { exportBrandedPDF } from "@/lib/exporters";
import { toast } from "sonner";
import { ResultSlipButton } from "@/components/results/ResultSlipButton";
import { SchoolResultCard } from "@/components/results/SchoolResultCard";
import { Link } from "react-router-dom";
import { schoolPath } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { necoGrade, necoDistribution, necoSummary, NECO_GRADE_REMARKS, NECO_GRADE_COLORS } from "@/lib/neco";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

export default function StudentResults() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [mocks, setMocks] = useState<any[]>([]);
  const [termFilter, setTermFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const [{ data: r }, { data: m }] = await Promise.all([
        supabase.from("results").select("*").eq("school_id", school.id).eq("student_id", user.id).order("created_at", { ascending: false }),
        supabase.from("mock_sessions").select("id,mode,total_score,total_questions,submitted_at,status").eq("student_id", user.id).eq("status", "submitted").order("submitted_at", { ascending: false }),
      ]);
      setRows(r ?? []); setMocks(m ?? []);
    })();
  }, [school, user]);

  const terms = useMemo(() => Array.from(new Set(rows.map(r => r.term).filter(Boolean))), [rows]);
  const subjects = useMemo(() => Array.from(new Set(rows.map(r => r.subject).filter(Boolean))), [rows]);
  const filtered = useMemo(() => rows.filter(r =>
    (termFilter === "all" || r.term === termFilter) &&
    (subjectFilter === "all" || r.subject === subjectFilter)
  ), [rows, termFilter, subjectFilter]);

  const scores = filtered.map(r => Number(r.score));
  const s = useMemo(() => necoSummary(scores), [filtered]);
  const dist = useMemo(() => necoDistribution(scores), [filtered]);
  const bySubj = useMemo(() => {
    const m: Record<string, number[]> = {};
    filtered.forEach(r => { (m[r.subject] ||= []).push(Number(r.score)); });
    return Object.entries(m).map(([subject, arr]) => ({
      subject,
      avg: Math.round(arr.reduce((a,b)=>a+b,0)/arr.length),
      grade: necoGrade(arr.reduce((a,b)=>a+b,0)/arr.length),
    }));
  }, [filtered]);

  // Key forces both charts (and the list) to remount + replay enter animation on every filter change.
  const animKey = `${termFilter}|${subjectFilter}|${filtered.length}`;

  const necoMocks = mocks.filter(m => m.mode === "neco_sim");
  const jambMocks = mocks.filter(m => m.mode === "jamb_sim");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">My results</h2>
          <p className="text-sm text-muted-foreground">School exams (published), plus your NECO &amp; JAMB mock attempts</p>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button size="sm" variant="outline" disabled={!filtered.length}
            onClick={() => exportBrandedPDF({
              title: "Academic Report",
              subtitle: "My results",
              schoolName: school?.name,
              schoolLogo: school?.logo_url,
              stats: [
                { label: "Overall", value: `${s.average}%`, hint: `Grade ${s.grade}` },
                { label: "Credit pass", value: `${s.credit}%` },
                { label: "Best", value: `${s.best}%` },
                { label: "Subjects", value: bySubj.length },
              ],
              sections: [{
                kind: "table",
                heading: "Result breakdown",
                headers: ["Subject", "Score", "NECO", "Term", "Date"],
                rows: filtered.map(r => [r.subject, Math.round(Number(r.score)) + "%", necoGrade(Number(r.score)), r.term, new Date(r.created_at).toLocaleDateString()]),
              }],
              footerNote: "Student academic report",
            })}>
            <FileText className="size-4" /> <span className="hidden sm:inline ml-1">PDF</span>
          </Button>
        </div>
      </div>

      {/* Prominent slip CTA — full width on mobile */}
      {rows.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-student/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base">Official Result Slip</div>
            <p className="text-xs text-muted-foreground">Generates a verified PDF with school logo, your profile, NECO grades and a verification QR code.</p>
          </div>
          <ResultSlipButton studentId={user?.id} size="default" />
        </div>
      )}

      <Tabs defaultValue="school" className="w-full">
        <TabsList className="grid grid-cols-3 sm:inline-grid sm:grid-flow-col w-full sm:w-auto">
          <TabsTrigger value="school" className="gap-1.5"><GraduationCap className="size-3.5" />School</TabsTrigger>
          <TabsTrigger value="neco" className="gap-1.5"><Award className="size-3.5" />NECO ({necoMocks.length})</TabsTrigger>
          <TabsTrigger value="jamb" className="gap-1.5"><GraduationCap className="size-3.5" />JAMB ({jambMocks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="school" className="space-y-6 mt-5">
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Term" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(termFilter !== "all" || subjectFilter !== "all") && (
            <Button size="sm" variant="ghost" onClick={() => { setTermFilter("all"); setSubjectFilter("all"); }}>Clear</Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {rows.length} records</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <SectionCard title="School exam results">
          <EmptyState icon={FileBarChart}
            title={rows.length === 0 ? "No results published yet" : "No results match these filters"}
            desc={rows.length === 0 ? "Your school exam results will appear here once your school approves and publishes them." : undefined} />
        </SectionCard>
      ) : (
        <div key={animKey} className="space-y-6 animate-fade-in">
          <SchoolResultCard results={filtered} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="NECO grade distribution" description="A1–F9 across all subjects">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="grade" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[6,6,0,0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
                      {dist.map((d,i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Subject mastery" description="Average per subject (NECO)">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={bySubj}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0,100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <Radar dataKey="avg" stroke="hsl(var(--student))" fill="hsl(var(--student))" fillOpacity={0.35} isAnimationActive animationDuration={700} animationEasing="ease-out" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="neco" className="mt-5">
          <MockList items={necoMocks} label="NECO" slug={school?.slug} />
        </TabsContent>
        <TabsContent value="jamb" className="mt-5">
          <MockList items={jambMocks} label="JAMB" slug={school?.slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MockList({ items, label, slug }: { items: any[]; label: string; slug?: string }) {
  if (items.length === 0) {
    return (
      <SectionCard title={`${label} mock attempts`}>
        <EmptyState icon={Award} title={`No ${label} mocks yet`} desc="Start a mock from the NECO/JAMB Mock page to see your detailed AI result here." />
      </SectionCard>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {items.map((m) => {
        const pct = m.total_questions ? Math.round((m.total_score / m.total_questions) * 100) : 0;
        return (
          <Link key={m.id} to={schoolPath(slug, `/app/student/mock/${m.id}/result`)}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition group">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary">{label} mock</Badge>
              <span className="text-xs text-muted-foreground">{new Date(m.submitted_at).toLocaleDateString()}</span>
            </div>
            <div className="font-display font-bold text-2xl">{pct}%</div>
            <div className="text-xs text-muted-foreground">{m.total_score}/{m.total_questions} correct</div>
            <div className="text-[11px] text-primary font-medium mt-3 group-hover:underline">View AI analysis →</div>
          </Link>
        );
      })}
    </div>
  );
}
