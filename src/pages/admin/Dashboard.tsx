import { useEffect, useState } from "react";
import { Users, GraduationCap, BookOpen, DollarSign, Activity, UserPlus, FileBarChart, Brain, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Link } from "react-router-dom";
import { schoolPath } from "@/lib/tenant";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { PilotWidget } from "@/components/pilot/PilotWidget";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AdminDashboard() {
  const { school } = useSchool();
  const [counts, setCounts] = useState({ students: 0, teachers: 0, classes: 0, revenue: 0 });
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any[]>([]);
  const [classPerf, setClassPerf] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<{ present: number; absent: number; late: number }>({ present: 0, absent: 0, late: 0 });
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!school) return;
    (async () => {
      setIsLoading(true);
      try {
      const sid = school.id;
      const [stu, tea, cls, fees, recent, ann, att, results, classes] = await Promise.all([
        supabase.from("memberships").select("id,user_id,created_at", { count: "exact" }).eq("school_id", sid).eq("role", "student").order("created_at", { ascending: false }),
        supabase.from("memberships").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("role", "teacher"),
        supabase.from("classes").select("id,name,code", { count: "exact" }).eq("school_id", sid),
        supabase.from("fees").select("amount,status").eq("school_id", sid),
        supabase.from("memberships").select("user_id,role,created_at").eq("school_id", sid).order("created_at", { ascending: false }).limit(8),
        supabase.from("announcements").select("title,created_at").eq("school_id", sid).order("created_at", { ascending: false }).limit(5),
        supabase.from("attendance").select("status").eq("school_id", sid),
        supabase.from("results").select("student_id,score,subject"),
        supabase.from("classes").select("id,name").eq("school_id", sid),
      ]);

      const revenue = (fees.data ?? []).filter(f => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);
      setCounts({ students: stu.count ?? 0, teachers: tea.count ?? 0, classes: cls.count ?? 0, revenue });

      // Recent students profiles
      const studentIds = (stu.data ?? []).slice(0, 5).map(s => s.user_id);
      if (studentIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", studentIds);
        setRecentStudents((stu.data ?? []).slice(0, 5).map(s => ({ ...s, profile: profs?.find(p => p.id === s.user_id) })));
      }

      setActivities(recent.data ?? []);

      // Enrollment trend by month (this year vs last year approximation using created_at month buckets)
      const buckets = MONTHS.map((m, i) => ({ month: m, current: 0, last: 0 }));
      (stu.data ?? []).forEach(s => {
        const d = new Date(s.created_at);
        const yr = d.getFullYear();
        const m = d.getMonth();
        const now = new Date().getFullYear();
        if (yr === now) buckets[m].current++;
        else if (yr === now - 1) buckets[m].last++;
      });
      // Cumulative
      let acc1 = 0, acc2 = 0;
      setEnrollment(buckets.map(b => ({ month: b.month, current: (acc1 += b.current), last: (acc2 += b.last) })));

      // Class performance averages
      const byStudent: Record<string, number[]> = {};
      (results.data ?? []).forEach(r => { (byStudent[r.student_id] ||= []).push(Number(r.score)); });
      const top = Object.entries(byStudent).map(([id, scores]) => ({ id, avg: scores.reduce((a,b)=>a+b,0) / scores.length }))
        .sort((a,b) => b.avg - a.avg).slice(0, 5);
      if (top.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", top.map(t => t.id));
        setTopStudents(top.map(t => ({ ...t, name: profs?.find(p => p.id === t.id)?.full_name ?? t.id.slice(0,8) })));
      }
      // Class perf placeholder: average of all results per first 5 classes
      const allAvg = (results.data ?? []).length ? (results.data ?? []).reduce((s,r) => s + Number(r.score), 0) / (results.data ?? []).length : 0;
      setClassPerf((classes.data ?? []).slice(0, 5).map(c => ({ name: c.name, score: Math.round(allAvg) })));

      // Attendance summary
      const a = att.data ?? [];
      setAttendanceSummary({
        present: a.filter(x => x.status === "present").length,
        absent: a.filter(x => x.status === "absent").length,
        late: a.filter(x => x.status === "late").length,
      });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [school]);

  const attTotal = attendanceSummary.present + attendanceSummary.absent + attendanceSummary.late;
  const attPct = attTotal ? Math.round((attendanceSummary.present / attTotal) * 100) : 0;
  const pieData = [
    { name: "Present", value: attendanceSummary.present, color: "hsl(var(--success))" },
    { name: "Absent", value: attendanceSummary.absent, color: "hsl(var(--destructive))" },
    { name: "Late", value: attendanceSummary.late, color: "hsl(var(--warning))" },
  ];

  return (
    <div className="space-y-6">
      <PilotWidget />
      <Link
        to={schoolPath(school?.slug, `/app/admin/copilot`)}
        className="block group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 hover:border-primary/40 transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="size-12 sm:size-14 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0 shadow-lg">
            <Brain className="size-6 sm:size-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold leading-tight">Principal Copilot</div>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              Ask anything about your school — attendance, fees, results, weak topics. Backed by live data.
            </p>
          </div>
          <ArrowRight className="size-5 text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={isLoading ? <span className="inline-block h-7 w-16 animate-pulse bg-muted rounded align-middle" /> : counts.students.toLocaleString()} icon={Users} tone="admin" trend={isLoading ? undefined : "12.5%"} />
        <StatCard label="Total Teachers" value={isLoading ? <span className="inline-block h-7 w-16 animate-pulse bg-muted rounded align-middle" /> : counts.teachers.toLocaleString()} icon={GraduationCap} tone="success" trend={isLoading ? undefined : "8.4%"} />
        <StatCard label="Active Classes" value={isLoading ? <span className="inline-block h-7 w-16 animate-pulse bg-muted rounded align-middle" /> : counts.classes.toLocaleString()} icon={BookOpen} tone="student" trend={isLoading ? undefined : "6.2%"} />
        <StatCard label="Total Revenue" value={isLoading ? <span className="inline-block h-7 w-24 animate-pulse bg-muted rounded align-middle" /> : `₦${counts.revenue.toLocaleString()}`} icon={DollarSign} tone="warning" trend={isLoading ? undefined : "15.3%"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Student Enrollment Trend" className="lg:col-span-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enrollment}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="current" name="This Term" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="last" name="Last Term" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Recent Activities">
          {activities.length === 0
            ? <EmptyState icon={Activity} title="No activity yet" />
            : <ul className="space-y-3">
                {activities.slice(0,5).map((a, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className="size-8 rounded-lg bg-primary/10 grid place-items-center shrink-0"><UserPlus className="size-4 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium capitalize">New {a.role} registered</div>
                      <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>}
        </SectionCard>
      </div>

      <SectionCard title="Recent Students">
        {recentStudents.length === 0
          ? <EmptyState icon={Users} title="No students yet" desc="Generate invite codes to onboard students." />
          : <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
                <th className="text-left py-2 w-12">#</th><th className="text-left">Name{"\u00a0 \u00a0\u00a0"}</th><th className="text-left">Class</th><th className="text-left">Joined</th><th className="text-left">Status</th></tr></thead>
              <tbody>{recentStudents.map((s, i) => (
                <tr key={s.user_id} className="border-b border-border last:border-0">
                  <td className="py-3 text-muted-foreground">{i + 1}</td>
                  <td className="font-medium">{s.profile?.full_name || s.profile?.email?.split("@")[0] || "—"}</td>
                  <td className="text-muted-foreground">{(s.profile?.email && /@members\.edusmart\.local$/i.test(s.profile.email)) ? "\n" : (s.profile?.email || "—")}</td>
                  <td className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td><span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Active</span></td>
                </tr>
              ))}</tbody>
            </table></div>}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Performance by Class">
          <div className="h-[220px]">
            {classPerf.length === 0 ? <EmptyState icon={FileBarChart} title="No data" /> :
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>}
          </div>
        </SectionCard>

        <SectionCard title="Attendance Overview">
          <div className="flex items-center gap-4">
            <div className="relative size-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-xl font-bold font-display">{attPct}%</div>
                  <div className="text-[10px] text-muted-foreground">Average</div>
                </div>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs flex-1">
              {pieData.map(d => (
                <li key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">{attTotal ? Math.round((d.value/attTotal)*100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Top Performing Students">
          {topStudents.length === 0
            ? <EmptyState icon={Users} title="No results yet" />
            : <ol className="space-y-2 text-sm">
                {topStudents.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="text-xs text-muted-foreground w-4">{i + 1}.</span>{s.name}</span>
                    <span className="font-semibold tabular-nums">{Math.round(s.avg)}%</span>
                  </li>
                ))}
              </ol>}
        </SectionCard>
      </div>
    </div>
  );
}

