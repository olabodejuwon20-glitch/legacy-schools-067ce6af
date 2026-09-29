import { useEffect, useState } from "react";
import { ListChecks, ClipboardCheck, Star, FileText, Megaphone, Calendar, BookOpen, Library, Sparkles, NotebookPen } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function StudentDashboard() {
  const { school, user, displayName, activeRole } = useSchool();
  const [exams, setExams] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [attPct, setAttPct] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [mockStats, setMockStats] = useState<{ count: number; avg: number; last: any }>({ count: 0, avg: 0, last: null });

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const [{ data: ex }, { data: rs }, { data: att }, { data: ann }, { data: mocks }] = await Promise.all([
        supabase.from("exams").select("id,title,subject,scheduled_at,status").eq("school_id", school.id).in("status", ["scheduled","active"]).order("scheduled_at", { ascending: true }).limit(5),
        supabase.from("results").select("subject,score,created_at").eq("school_id", school.id).eq("student_id", user.id).order("created_at", { ascending: true }),
        supabase.from("attendance").select("status").eq("school_id", school.id).eq("student_id", user.id),
        supabase.from("announcements").select("title,body,created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("mock_sessions").select("mode,total_score,total_questions,submitted_at").eq("student_id", user.id).eq("status", "submitted").order("submitted_at", { ascending: false }),
      ]);
      setExams(ex ?? []); setResults(rs ?? []); setAnnouncements(ann ?? []);
      setRecentResults((rs ?? []).slice(-5).reverse());
      const t = att?.length ?? 0;
      setAttPct(t ? Math.round(((att!.filter(a => a.status === "present").length) / t) * 100) : 0);
      const ms = mocks ?? [];
      const pcts = ms.map((m: any) => (m.total_questions ? (m.total_score / m.total_questions) * 100 : 0));
      setMockStats({
        count: ms.length,
        avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
        last: ms[0] ?? null,
      });
    })();
  }, [school, user]);

  const latest = results.length ? Math.round(Number(results[results.length - 1].score)) : 0;
  const overall = results.length ? Math.round(results.reduce((s,r)=>s+Number(r.score),0)/results.length) : 0;
  const chart = results.slice(-8).map(r => ({ subject: r.subject, score: Number(r.score) }));
  const base = school && activeRole ? schoolPath(school.slug, `/app/${activeRole}`) : "";
  const QUICK = [
    { label: "My Classes", icon: BookOpen, to: `${base}/classes`, tone: "bg-info/10 text-info" },
    { label: "Past Exams", icon: FileText, to: `${base}/exams`, tone: "bg-warning/10 text-warning" },
    { label: "Library",    icon: Library,  to: `${base}/library`, tone: "bg-success/10 text-success" },
    { label: "AI Tutor",   icon: Sparkles, to: `${base}/ai-tutor`, tone: "bg-student/10 text-student" },
    { label: "Calendar",   icon: NotebookPen, to: `${base}/calendar`, tone: "bg-parent/10 text-parent" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold">Welcome back, {displayName?.split(" ")[0] || "Student"}! 👋</h2>
          <p className="text-sm text-muted-foreground">Here's what's happening today.</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-card"><Calendar className="size-3.5 text-muted-foreground" />{new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="School Exam Avg" value={overall ? `${overall}%` : "—"} icon={Star} tone="success" sub={`${results.length} subjects · published`} />
        <StatCard label="NECO / JAMB Mock Avg" value={mockStats.count ? `${mockStats.avg}%` : "—"} icon={ListChecks} tone="student" sub={mockStats.count ? `${mockStats.count} mock attempt${mockStats.count > 1 ? "s" : ""}` : "No mocks yet"} />
        <StatCard label="Attendance" value={`${attPct}%`} icon={ClipboardCheck} tone="success" sub="This term" />
        <StatCard label="Upcoming Exams" value={String(exams.length)} icon={FileText} tone="warning" sub={exams[0] ? `Next: ${exams[0].title}` : "No upcoming"} />
      </div>

      <SectionCard title="Quick access">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {QUICK.map(q => (
            <Link key={q.label} to={q.to} className="rounded-xl border border-border p-3 sm:p-4 bg-card hover:shadow-soft transition flex flex-col items-center text-center gap-2">
              <div className={`size-10 rounded-lg grid place-items-center ${q.tone}`}><q.icon className="size-5" /></div>
              <div className="text-xs font-medium">{q.label}</div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Upcoming Exams">
          {exams.length === 0 ? <EmptyState icon={ListChecks} title="No upcoming exams" /> :
            <ul className="space-y-2">{exams.map(e => {
              const days = e.scheduled_at ? Math.max(0, Math.round((new Date(e.scheduled_at).getTime() - Date.now()) / 86400000)) : null;
              return (
                <li key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3"><div className="size-9 rounded-lg bg-student/10 grid place-items-center"><FileText className="size-4 text-student" /></div>
                    <div><div className="font-medium">{e.title}</div><div className="text-xs text-muted-foreground">{e.scheduled_at ? new Date(e.scheduled_at).toLocaleDateString() : "TBD"}</div></div>
                  </div>
                  {days !== null && <span className="text-xs text-warning font-medium">{days} days left</span>}
                </li>
              );
            })}</ul>}
        </SectionCard>

        <SectionCard title="Performance Overview">
          {chart.length === 0 ? <EmptyState icon={Star} title="No results yet" /> :
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--student))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>}
        </SectionCard>
      </div>

      <SectionCard title="Announcements">
        {announcements.length === 0
          ? <EmptyState icon={Megaphone} title="No announcements" />
          : <div className="grid sm:grid-cols-3 gap-3">{announcements.map((a, i) => (
              <div key={i} className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="font-semibold text-sm">{a.title}</div>
                {a.body && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</div>}
                <div className="text-[11px] text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString()}</div>
              </div>
            ))}</div>}
      </SectionCard>

      <SectionCard title="Recent results" action={<Link to={`${base}/results`} className="text-xs text-primary font-medium">View all</Link>}>
        {recentResults.length === 0 ? <EmptyState icon={Star} title="No results yet" /> :
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border"><tr><th className="text-left py-2">Subject</th><th className="text-right">Score</th><th className="text-left">Date</th></tr></thead>
            <tbody>{recentResults.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-3">{r.subject}</td>
                <td className="text-right tabular-nums font-semibold">{Math.round(Number(r.score))}%</td>
                <td className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      </SectionCard>
    </div>
  );
}

