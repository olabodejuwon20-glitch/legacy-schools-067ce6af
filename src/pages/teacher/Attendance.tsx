import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Check, X, Clock, ShieldCheck, QrCode, WifiOff, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "present" | "absent" | "late" | "excused";
type AttendanceMode = "daily" | "period" | "kiosk";
const OFFLINE_QUEUE_KEY = "ls_offline_attendance_queue_v1";

const STATUSES: { value: Status; label: string; icon: any; cls: string }[] = [
  { value: "present", label: "Present", icon: Check,       cls: "bg-success/10 text-success border-success/30" },
  { value: "absent",  label: "Absent",  icon: X,           cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "late",    label: "Late",    icon: Clock,       cls: "bg-warning/10 text-warning border-warning/30" },
  { value: "excused", label: "Excused", icon: ShieldCheck, cls: "bg-muted text-muted-foreground border-border" },
];

const StudentAttendanceRow = memo(function StudentAttendanceRow({
  student, currentStatus, rate, presentCount, totalCount, excuseNote, excuseStatus, onSelectStatus, onResolveExcuse,
}: any) {
  return (
    <li className="py-3 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[180px]">
        <div className="font-medium flex items-center gap-2">
          <span>{student.full_name || student.email}</span>
          {excuseStatus === "pending" && <Badge variant="outline" className="text-[10px] border-warning/40 bg-warning/10 text-warning">Excuse Pending</Badge>}
        </div>
        {rate !== null && (
          <div className={cn("text-xs", rate < 70 ? "text-destructive font-medium" : "text-muted-foreground")}>
            30-day rate: {rate}% ({presentCount}/{totalCount})
          </div>
        )}
        {excuseNote && (
          <div className="mt-1 text-xs bg-muted/60 border border-border rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span className="text-muted-foreground"><strong className="text-foreground">Parent excuse:</strong> {excuseNote}</span>
            {excuseStatus === "pending" && onResolveExcuse && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] text-success border-success/30" onClick={() => onResolveExcuse(student.id, true)}><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive" onClick={() => onResolveExcuse(student.id, false)}><XCircle className="h-3 w-3 mr-1" /> Reject</Button>
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        {STATUSES.map(st => {
          const Icon = st.icon; const active = currentStatus === st.value;
          return (
            <button key={st.value} type="button" onClick={() => onSelectStatus(student.id, st.value)}
              className={cn("px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1 transition", active ? st.cls : "border-border text-muted-foreground hover:bg-muted")}
              aria-pressed={active} title={st.label}>
              <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{st.label}</span>
            </button>
          );
        })}
      </div>
    </li>
  );
});

export default function TeacherAttendance() {
  const { school, user } = useSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [mode, setMode] = useState<AttendanceMode>("daily");
  const [periods, setPeriods] = useState<Array<{ id: string; label: string; subject: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("daily");
  const [kioskInput, setKioskInput] = useState<string>("");
  const [kioskRecent, setKioskRecent] = useState<Array<{ name: string; time: string }>>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [excuses, setExcuses] = useState<Record<string, { note?: string | null; status?: string | null }>>({});
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState<Record<string, { present: number; total: number }>>({});
  const [offlineCount, setOfflineCount] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]").length; } catch { return 0; }
  });

  useEffect(() => {
    if (!school || !user) return;
    supabase.from("classes").select("*").eq("school_id", school.id).eq("teacher_id", user.id)
      .then(({ data }) => { setClasses(data ?? []); if (data?.[0]) setClassId(data[0].id); });
  }, [school, user]);

  useEffect(() => {
    if (!classId || !school) return;
    const dayOfWeek = new Date(date).getDay() || 7;
    supabase.from("timetable").select("id,start_time,end_time,subject").eq("school_id", school.id).eq("class_id", classId).eq("day_of_week", dayOfWeek).order("start_time", { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []).map((p: any) => ({ id: `${p.start_time}-${p.subject}`, label: `${String(p.start_time).slice(0, 5)} – ${String(p.end_time).slice(0, 5)} · ${p.subject}`, subject: p.subject }));
        setPeriods(list);
      });
  }, [classId, school, date]);

  useEffect(() => {
    if (!classId || !school) return;
    (async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const ids = enr?.map(e => e.student_id) ?? [];
      if (!ids.length) { setStudents([]); setMarks({}); setHistory({}); setExcuses({}); return; }
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setStudents(profs ?? []);
      const { data: existing } = await supabase.from("attendance").select("*").eq("class_id", classId).eq("date", date);
      const init: Record<string, Status> = {};
      const exc: Record<string, { note?: string | null; status?: string | null }> = {};
      existing?.forEach((r: any) => {
        init[r.student_id] = r.status as Status;
        if (r.excuse_note || r.excuse_status) exc[r.student_id] = { note: r.excuse_note, status: r.excuse_status };
      });
      setMarks(init); setExcuses(exc);
      const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
      const { data: rows } = await supabase.from("attendance").select("student_id,status").eq("class_id", classId).gte("date", since);
      const h: Record<string, { present: number; total: number }> = {};
      (rows ?? []).forEach(r => {
        const s = (h[r.student_id] ||= { present: 0, total: 0 });
        s.total += 1; if (r.status === "present" || r.status === "late") s.present += 1;
      });
      setHistory(h);
    })();
  }, [classId, school, date]);

  const handleSelectStatus = useCallback((studentId: string, status: Status) => {
    setMarks(prev => ({ ...prev, [studentId]: status }));
  }, []);

  const handleResolveExcuse = useCallback(async (studentId: string, approve: boolean) => {
    if (!school || !classId) return;
    const newStatus: Status = approve ? "excused" : (marks[studentId] || "absent");
    setMarks(prev => ({ ...prev, [studentId]: newStatus }));
    setExcuses(prev => ({ ...prev, [studentId]: { ...prev[studentId], status: approve ? "approved" : "rejected" } }));
    const { error } = await supabase.from("attendance").update({ status: newStatus, excuse_status: approve ? "approved" : "rejected" } as any).eq("class_id", classId).eq("student_id", studentId).eq("date", date);
    if (error) toast.error(error.message); else toast.success(approve ? "Excuse approved — marked Excused" : "Excuse rejected");
  }, [school, classId, date, marks]);

  const counts = useMemo(() => {
    const c: Record<Status | "unmarked", number> = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    students.forEach(s => { const m = marks[s.id]; if (m) c[m] += 1; else c.unmarked += 1; });
    return c;
  }, [marks, students]);

  function markAll(status: Status) {
    const merged = { ...marks };
    students.forEach(s => { if (!merged[s.id]) merged[s.id] = status; });
    setMarks(merged);
  }

  function handleKioskScan(e: React.FormEvent) {
    e.preventDefault();
    const q = kioskInput.trim().toLowerCase();
    if (!q) return;
    const match = students.find(s => s.id.toLowerCase().startsWith(q) || (s.full_name && s.full_name.toLowerCase().includes(q)) || (s.email && s.email.toLowerCase().includes(q)));
    if (!match) return toast.error(`No student matched "${kioskInput}"`);
    setMarks(prev => ({ ...prev, [match.id]: "present" }));
    setKioskRecent(prev => [{ name: match.full_name || match.email, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
    setKioskInput("");
    toast.success(`Checked in: ${match.full_name || match.email}`);
  }

  async function flushOfflineQueue() {
    try {
      const queued = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
      if (!queued.length) return;
      const { error } = await supabase.from("attendance").upsert(queued, { onConflict: "class_id,student_id,date" });
      if (!error) { localStorage.removeItem(OFFLINE_QUEUE_KEY); setOfflineCount(0); toast.success(`Synced ${queued.length} queued record(s)`); }
    } catch {}
  }

  async function save() {
    if (!school || !classId) return;
    const rows = Object.entries(marks).map(([student_id, status]) => ({ school_id: school.id, class_id: classId, student_id, date, status, marked_by: user!.id }));
    if (!rows.length) return toast("Nothing to save");
    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "class_id,student_id,date" });
    setSaving(false);
    if (error) {
      const updated = [...JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"), ...rows];
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
      setOfflineCount(updated.length);
      toast.warning(`Offline queue: saved ${rows.length} marks locally.`);
    } else toast.success(`Attendance saved (${rows.length})`);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Mark Attendance"
        description="Daily roll, per-period subject tracking, or QR/ID classroom kiosk check-in."
        action={
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
              <button type="button" onClick={() => setMode("daily")} className={cn("px-2.5 py-1 rounded-md font-medium transition", mode === "daily" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Daily Roll</button>
              <button type="button" onClick={() => setMode("period")} className={cn("px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1", mode === "period" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><BookOpen className="h-3 w-3" /> Per-Period</button>
              <button type="button" onClick={() => setMode("kiosk")} className={cn("px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1", mode === "kiosk" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><QrCode className="h-3 w-3" /> QR Kiosk</button>
            </div>
            <Input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e => setDate(e.target.value)} className="w-[145px]" />
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="flex-1 min-w-[150px] sm:w-[200px] sm:flex-none"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
            </Select>
            {mode === "period" && (
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select subject/period" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">General Homeroom</SelectItem>
                  {periods.map(p => <SelectItem key={p.id} value={p.subject}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {offlineCount > 0 && <Button size="sm" variant="outline" onClick={flushOfflineQueue} className="gap-1.5 text-warning border-warning/40"><WifiOff className="h-3.5 w-3.5" /> Sync ({offlineCount})</Button>}
            <Button onClick={save} disabled={!students.length || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        {!classes.length ? <EmptyState icon={ClipboardCheck} title="No classes assigned" /> :
          students.length === 0 ? <EmptyState icon={ClipboardCheck} title="No students enrolled" desc="Ask admin to enroll students in this class." /> :
          <div className="space-y-4">
            {mode === "kiosk" && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /><div className="text-sm font-semibold">Classroom QR / ID Kiosk Scanner</div></div>
                  <Badge variant="secondary">{counts.present} Checked In</Badge>
                </div>
                <form onSubmit={handleKioskScan} className="flex gap-2">
                  <Input autoFocus value={kioskInput} onChange={e => setKioskInput(e.target.value)} placeholder="Scan QR badge or type student name / ID…" className="bg-background" />
                  <Button type="submit">Check In</Button>
                </form>
                {kioskRecent.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {kioskRecent.map((item, idx) => <span key={idx} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20"><Check className="h-3 w-3" /> {item.name} · {item.time}</span>)}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="px-2 py-1 rounded-md bg-success/10 text-success">Present {counts.present}</span>
              <span className="px-2 py-1 rounded-md bg-destructive/10 text-destructive">Absent {counts.absent}</span>
              <span className="px-2 py-1 rounded-md bg-warning/10 text-warning">Late {counts.late}</span>
              <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">Excused {counts.excused}</span>
              <span className="px-2 py-1 rounded-md border border-dashed">Unmarked {counts.unmarked}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => markAll("present")}>Mark all present</Button>
                <Button size="sm" variant="ghost" onClick={() => setMarks({})}>Reset</Button>
              </span>
            </div>
            <ul className="divide-y divide-border">
              {students.map(s => {
                const h = history[s.id]; const rate = h && h.total ? Math.round((h.present / h.total) * 100) : null;
                const exc = excuses[s.id];
                return (
                  <StudentAttendanceRow key={s.id} student={s} currentStatus={marks[s.id]} rate={rate} presentCount={h?.present ?? 0} totalCount={h?.total ?? 0} excuseNote={exc?.note} excuseStatus={exc?.status} onSelectStatus={handleSelectStatus} onResolveExcuse={handleResolveExcuse} />
                );
              })}
            </ul>
          </div>}
      </SectionCard>
    </div>
  );
}