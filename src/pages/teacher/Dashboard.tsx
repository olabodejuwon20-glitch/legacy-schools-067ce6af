import { useEffect, useState } from "react";
import { BookOpen, Calendar, ClipboardCheck, PencilRuler, FileText, Activity, Users, MessagesSquare, FilePlus2, Upload, FileBarChart } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { StatCard } from "@/components/dashboard/StatCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function TeacherDashboard() {
  const { school, user, displayName, activeRole } = useSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [today, setToday] = useState<any[]>([]);
  const [examCount, setExamCount] = useState(0);
  const [attPct, setAttPct] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [pendingGrading, setPendingGrading] = useState(0);
  const [attBreakdown, setAttBreakdown] = useState({ present: 0, absent: 0, late: 0 });
  const [pendingExams, setPendingExams] = useState<any[]>([]);

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const dow = new Date().getDay() || 7;
      const [{ data: cls }, { count: ec }, { data: tt }, { data: att }] = await Promise.all([
        supabase.from("classes").select("*").eq("school_id", school.id).eq("teacher_id", user.id),
        supabase.from("exams").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("created_by", user.id),
        supabase.from("timetable").select("*").eq("school_id", school.id).eq("teacher_id", user.id).eq("day_of_week", dow).order("start_time"),
        supabase.from("attendance").select("status").eq("school_id", school.id).eq("marked_by", user.id),
      ]);
      setClasses(cls ?? []); setExamCount(ec ?? 0); setToday(tt ?? []);
      const total = att?.length ?? 0;
      setAttPct(total ? Math.round(((att!.filter(a => a.status === "present").length) / total) * 100) : 0);
      setAttBreakdown({
        present: att?.filter(a => a.status === "present").length ?? 0,
        absent: att?.filter(a => a.status === "absent").length ?? 0,
        late: att?.filter(a => a.status === "late").length ?? 0,
      });
      // students enrolled in my classes
      if (cls?.length) {
        const { data: enr } = await supabase.from("class_enrollments").select("student_id").in("class_id", cls.map(c => c.id));
        setStudentCount(new Set((enr ?? []).map(e => e.student_id)).size);
      }
      // pending grading: attempts submitted with no score
      const { count: pg } = await supabase.from("exam_attempts").select("id", { count: "exact", head: true }).eq("school_id", school.id).is("score", null).not("submitted_at", "is", null);
      setPendingGrading(pg ?? 0);
      const { data: px } = await supabase.from("exams").select("id,title,subject,scheduled_at").eq("school_id", school.id).eq("created_by", user.id).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(4);
      setPendingExams(px ?? []);
    })();
  }, [school, user]);

  const base = school && activeRole ? schoolPath(school.slug, `/app/${activeRole}`) : "";
  const totalAtt = attBreakdown.present + attBreakdown.absent + attBreakdown.late;
  const pieData = [
    { name: "Present", value: attBreakdown.present, color: "hsl(var(--success))" },
    { name: "Absent", value: attBreakdown.absent, color: "hsl(var(--destructive))" },
    { name: "Late", value: attBreakdown.late, color: "hsl(var(--warning))" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold">Good morning, {displayName?.split(" ")[0] || "Teacher"}!&nbsp;</h2>
          <p className="text-sm text-muted-foreground">Here's what's happening in your classes today.</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-card"><Calendar className="size-3.5 text-muted-foreground" />{new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard label="My Classes" value={String(classes.length)} icon={BookOpen} tone="teacher" />
        <StatCard label="Total Students" value={String(studentCount)} icon={Users} tone="info" />
        <StatCard label="Today's Classes" value={String(today.length)} icon={Calendar} tone="info" />
        <StatCard label="Pending Grading" value={String(pendingGrading)} icon={PencilRuler} tone="warning" />
        <StatCard label="Exams Created" value={String(examCount)} icon={PencilRuler} tone="warning" />
        <StatCard label="Attendance Today" value={`${attPct}%`} icon={ClipboardCheck} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Today's Schedule">
          {today.length === 0
            ? <EmptyState icon={Calendar} title="Nothing scheduled today" />
            : <ul className="space-y-2">{today.map(t => (
                <li key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="text-xs font-mono w-16 tabular-nums text-muted-foreground">{t.start_time?.slice(0,5)}</div>
                  <div className="flex-1 min-w-0"><div className="font-medium">{t.subject}</div><div className="text-xs text-muted-foreground">Room {t.room || "—"}</div></div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success">Today</span>
                </li>
              ))}</ul>}
        </SectionCard>

        <SectionCard title="Attendance Overview" description="Across all classes you've marked">
          {totalAtt === 0 ? <EmptyState icon={Activity} title="Nothing marked yet" /> :
            <div className="flex items-center gap-4">
              <div className="relative size-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={pieData} dataKey="value" innerRadius={56} outerRadius={76} paddingAngle={2}>{pieData.map((d,i) => <Cell key={i} fill={d.color} />)}</Pie></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none text-center"><div><div className="text-2xl font-bold">{attPct}%</div><div className="text-[10px] text-muted-foreground">Average</div></div></div>
              </div>
              <ul className="space-y-2 text-sm flex-1">
                {pieData.map(d => (
                  <li key={d.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span><span className="tabular-nums text-muted-foreground">{Math.round((d.value/totalAtt)*100)}%</span></li>
                ))}
              </ul>
            </div>}
        </SectionCard>
      </div>

      <SectionCard title="My Classes">
        {classes.length === 0
          ? <EmptyState icon={BookOpen} title="No classes assigned" desc="Ask your admin to assign classes to you." />
          : <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {classes.map(c => (
                <div key={c.id} className="rounded-xl border border-border p-4 bg-card">
                  <div className="text-xs text-muted-foreground">{c.code}</div>
                  <div className="font-semibold mt-1">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.subject || "—"}</div>
                  <div className="mt-3 text-xs">
                    <span className="text-success font-semibold">90%</span> <span className="text-muted-foreground">Attendance</span>
                  </div>
                </div>
              ))}
            </div>}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Upcoming tests" action={<Link to={`${base}/tests`} className="text-xs text-primary font-medium">Manage</Link>}>
          {pendingExams.length === 0 ? <EmptyState icon={FileText} title="No upcoming tests" /> :
            <ul className="space-y-2">{pendingExams.map(e => (
              <li key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div><div className="font-medium">{e.title}</div><div className="text-xs text-muted-foreground">{e.subject || "—"}</div></div>
                <div className="text-xs text-muted-foreground">{new Date(e.scheduled_at).toLocaleDateString()}</div>
              </li>
            ))}</ul>}
        </SectionCard>

        <SectionCard title="Quick actions">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Take Attendance", icon: ClipboardCheck, to: `${base}/attendance`, tone: "bg-success/10 text-success" },
              { label: "Create Test", icon: FilePlus2, to: `${base}/tests`, tone: "bg-warning/10 text-warning" },
              { label: "Upload Material", icon: Upload, to: `${base}/resources`, tone: "bg-info/10 text-info" },
              { label: "View Reports", icon: FileBarChart, to: `${base}/reports`, tone: "bg-teacher/10 text-teacher" },
            ].map(q => (
              <Link key={q.label} to={q.to} className="rounded-xl border border-border p-3 bg-card hover:shadow-soft transition flex flex-col items-center text-center gap-2">
                <div className={`size-10 rounded-lg grid place-items-center ${q.tone}`}><q.icon className="size-5" /></div>
                <div className="text-xs font-medium">{q.label}</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

