import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Check, X, Clock, ShieldCheck, Percent, BellRing, CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Row = { id?: string; class_id: string; student_id: string; status: string; date: string; excuse_note?: string | null; excuse_status?: string | null };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function AdminAttendance() {
  const { school, user } = useSchool();
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [windowDays, setWindowDays] = useState<number>(7);
  const [threshold, setThreshold] = useState<number>(70);
  const [classes, setClasses] = useState<any[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [alerting, setAlerting] = useState(false);

  useEffect(() => {
    if (!school) return;
    supabase.from("classes").select("id,code,name").eq("school_id", school.id).then(({ data }) => setClasses(data ?? []));
  }, [school]);

  const loadAttendance = async () => {
    if (!school) return;
    setLoading(true);
    const since = new Date(new Date(date).getTime() - (windowDays - 1) * 86400_000).toISOString().slice(0, 10);
    const { data } = await supabase.from("attendance").select("*").eq("school_id", school.id).gte("date", since).lte("date", date);
    setRows((data ?? []) as Row[]);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.student_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setProfiles(Object.fromEntries((profs ?? []).map(p => [p.id, p.full_name || p.email || "?"])));
    } else setProfiles({});
    setLoading(false);
  };

  useEffect(() => { void loadAttendance(); }, [school, date, windowDays]);

  const totals = useMemo(() => {
    const t = { total: rows.length, present: 0, absent: 0, late: 0, excused: 0 };
    rows.forEach(r => { (t as any)[r.status] = ((t as any)[r.status] ?? 0) + 1; });
    return t;
  }, [rows]);

  const rate = totals.total ? Math.round(((totals.present + totals.late) / totals.total) * 100) : 0;

  const byClass = useMemo(() => {
    const m: Record<string, { total: number; present: number }> = {};
    rows.forEach(r => {
      const c = (m[r.class_id] ||= { total: 0, present: 0 });
      c.total += 1; if (r.status === "present" || r.status === "late") c.present += 1;
    });
    return Object.entries(m).map(([class_id, v]) => {
      const cls = classes.find(c => c.id === class_id);
      return { class_id, name: cls ? `${cls.code} · ${cls.name}` : "—", ...v, rate: v.total ? Math.round((v.present / v.total) * 100) : 0 };
    }).sort((a, b) => a.rate - b.rate);
  }, [rows, classes]);

  const lowStudents = useMemo(() => {
    const m: Record<string, { total: number; present: number; consecutiveAbsent: number }> = {};
    rows.forEach(r => {
      const c = (m[r.student_id] ||= { total: 0, present: 0, consecutiveAbsent: 0 });
      c.total += 1;
      if (r.status === "present" || r.status === "late") c.present += 1;
      else if (r.status === "absent") c.consecutiveAbsent += 1;
    });
    return Object.entries(m)
      .map(([id, v]) => ({ id, name: profiles[id] || "?", ...v, rate: v.total ? Math.round((v.present / v.total) * 100) : 0 }))
      .filter(s => s.total >= 2 && (s.rate < threshold || s.consecutiveAbsent >= 3))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 20);
  }, [rows, profiles, threshold]);

  const weekdayStats = useMemo(() => {
    const stats = WEEKDAYS.map(day => ({ day, total: 0, present: 0, absent: 0, late: 0 }));
    rows.forEach(r => {
      const d = new Date(r.date).getDay();
      if (d >= 1 && d <= 5) {
        const b = stats[d - 1]; b.total += 1;
        if (r.status === "present") b.present += 1;
        else if (r.status === "absent") b.absent += 1;
        else if (r.status === "late") b.late += 1;
      }
    });
    return stats.map(s => ({ ...s, rate: s.total ? Math.round(((s.present + s.late) / s.total) * 100) : null }));
  }, [rows]);

  const pendingExcuses = useMemo(() => rows.filter(r => r.excuse_note && (!r.excuse_status || r.excuse_status === "pending")), [rows]);

  async function resolveExcuse(row: Row, approve: boolean) {
    const { error } = await supabase.from("attendance").update({ status: approve ? "excused" : "absent", excuse_status: approve ? "approved" : "rejected" } as any).eq("class_id", row.class_id).eq("student_id", row.student_id).eq("date", row.date);
    if (error) toast.error(friendlyError(error, "We couldn't update the attendance excuse. Please try again."));
    else { toast.success(approve ? "Absence excused successfully." : "Absence marked as unexcused."); void loadAttendance(); }
  }

  async function sendLowAttendanceAlerts() {
    if (!school || !user || !lowStudents.length) return;
    setAlerting(true);
    try {
      const studentIds = lowStudents.map(s => s.id);
      const { data: links } = await supabase.from("parent_links").select("parent_user_id,student_user_id").eq("school_id", school.id).in("student_user_id", studentIds);
      const alerts = (links ?? []).map(l => {
        const st = lowStudents.find(s => s.id === l.student_user_id);
        return { school_id: school.id, student_id: l.student_user_id, parent_user_id: l.parent_user_id, created_by: user.id, category: "attendance", severity: "high", title: `Low Attendance Alert: ${st?.name || "Student"} (${st?.rate ?? 0}%)`, message: `${st?.name || "Your child"}'s attendance is ${st?.rate ?? 0}% (${st?.present}/${st?.total} days).` };
      });
      if (alerts.length > 0) await supabase.from("parent_alerts" as any).insert(alerts);
      toast.success(alerts.length > 0 ? `Sent low-attendance alerts to ${alerts.length} parent(s).` : `Flagged ${lowStudents.length} student(s) for review.`);
    } catch (e: any) { toast.error(friendlyError(e, "We couldn't send parent notifications right now. Please try again.")); } finally { setAlerting(false); }
  }

  function exportCsv() {
    const lines = ["date,class,student,status,excuse_status,excuse_note"];
    const cls = Object.fromEntries(classes.map(c => [c.id, `${c.code} · ${c.name}`]));
    rows.forEach(r => lines.push(`${r.date},"${cls[r.class_id] ?? ""}","${(profiles[r.student_id] ?? "").replace(/"/g, "'")}",${r.status},${r.excuse_status ?? ""},"${(r.excuse_note ?? "").replace(/"/g, "'")}"`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${date}-${windowDays}d.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Attendance Overview"
        description={`Showing last ${windowDays} day(s) up to ${date}`}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e => setDate(e.target.value)} className="w-[160px]" />
            <Select value={String(windowDays)} onValueChange={v => setWindowDays(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Single day</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last term (90d)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Overall rate" value={`${rate}%`} icon={Percent} tone="info" sub={`${totals.present + totals.late}/${totals.total} attended`} />
          <StatCard label="Present" value={totals.present} icon={Check} tone="success" />
          <StatCard label="Absent" value={totals.absent} icon={X} tone="warning" />
          <StatCard label="Late" value={totals.late} icon={Clock} tone="warning" />
          <StatCard label="Excused" value={totals.excused} icon={ShieldCheck} tone="info" />
        </div>
      </SectionCard>

      {pendingExcuses.length > 0 && (
        <SectionCard title="Pending Parent Absence Excuses" description="Approve to automatically update student status from Absent to Excused" action={<Badge variant="outline">{pendingExcuses.length} pending</Badge>}>
          <ul className="divide-y divide-border">
            {pendingExcuses.map((r, idx) => {
              const cls = classes.find(c => c.id === r.class_id);
              return (
                <li key={`${r.student_id}-${r.date}-${idx}`} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{profiles[r.student_id] || "Student"} · <span className="text-muted-foreground">{cls ? `${cls.code} · ${cls.name}` : ""}</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">Date: <strong>{r.date}</strong> — Reason: &ldquo;{r.excuse_note}&rdquo;</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="text-success border-success/30" onClick={() => resolveExcuse(r, true)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve &amp; Excuse</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => resolveExcuse(r, false)}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Truancy & Day-of-Week Heatmap" description="Spot weekday absence and lateness patterns across the school">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {weekdayStats.map(w => (
            <div key={w.day} className={cn("rounded-xl border p-3.5 transition", w.rate === null ? "border-border bg-muted/20" : w.rate < 75 ? "border-destructive/40 bg-destructive/5" : w.rate < 90 ? "border-warning/40 bg-warning/5" : "border-success/30 bg-success/5")}>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-semibold uppercase tracking-wider text-foreground">{w.day}</span><CalendarDays className="h-3.5 w-3.5" /></div>
              <div className="mt-2 text-2xl font-bold">{w.rate !== null ? `${w.rate}%` : "—"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between"><span>Absent: {w.absent}</span><span>Late: {w.late}</span></div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="By class" description="Sorted by lowest attendance rate first">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
          byClass.length === 0 ? <EmptyState icon={ClipboardCheck} title="No attendance recorded" desc="Teachers will see classes here once they start marking attendance." /> :
          <ul className="divide-y divide-border">
            {byClass.map(c => (
              <li key={c.class_id} className="py-2 flex items-center gap-3">
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.present}/{c.total}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", c.rate < 70 ? "bg-destructive/10 text-destructive" : c.rate < 90 ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>{c.rate}%</span>
              </li>
            ))}
          </ul>}
      </SectionCard>

      <SectionCard
        title="At-risk students & Parent Alerts"
        description={`Students below ${threshold}% attendance or with 3+ absences in the selected window`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(threshold)} onValueChange={v => setThreshold(Number(v))}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="60">Below 60%</SelectItem>
                <SelectItem value="70">Below 70%</SelectItem>
                <SelectItem value="75">Below 75%</SelectItem>
                <SelectItem value="85">Below 85%</SelectItem>
              </SelectContent>
            </Select>
            {lowStudents.length > 0 && (
              <Button size="sm" variant="default" onClick={sendLowAttendanceAlerts} disabled={alerting} className="gap-1.5">
                <BellRing className="h-3.5 w-3.5" /> {alerting ? "Sending…" : `Alert Parents (${lowStudents.length})`}
              </Button>
            )}
          </div>
        }
      >
        {lowStudents.length === 0 ? <EmptyState icon={ClipboardCheck} title={`Excellent attendance! All students are above ${threshold}%`} desc="No students currently require attendance follow-up or parent intervention." /> :
          <ul className="divide-y divide-border">
            {lowStudents.map(s => (
              <li key={s.id} className="py-2 flex items-center gap-3">
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.present}/{s.total} days</span>
                {s.consecutiveAbsent >= 3 && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">{s.consecutiveAbsent} absences</Badge>}
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{s.rate}%</span>
              </li>
            ))}
          </ul>}
      </SectionCard>
    </div>
  );
}