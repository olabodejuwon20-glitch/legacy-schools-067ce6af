import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Check, X, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "present" | "absent" | "late" | "excused";

const STATUSES: { value: Status; label: string; icon: any; cls: string }[] = [
  { value: "present", label: "Present", icon: Check,       cls: "bg-success/10 text-success border-success/30" },
  { value: "absent",  label: "Absent",  icon: X,           cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "late",    label: "Late",    icon: Clock,       cls: "bg-warning/10 text-warning border-warning/30" },
  { value: "excused", label: "Excused", icon: ShieldCheck, cls: "bg-muted text-muted-foreground border-border" },
];

export default function TeacherAttendance() {
  const { school, user } = useSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState<Record<string, { present: number; total: number }>>({});

  useEffect(() => {
    if (!school || !user) return;
    supabase.from("classes").select("*").eq("school_id", school.id).eq("teacher_id", user.id)
      .then(({ data }) => { setClasses(data ?? []); if (data?.[0]) setClassId(data[0].id); });
  }, [school, user]);

  useEffect(() => {
    if (!classId || !school) return;
    (async () => {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
      const ids = enr?.map(e => e.student_id) ?? [];
      if (!ids.length) { setStudents([]); setMarks({}); setHistory({}); return; }
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setStudents(profs ?? []);
      const { data: existing } = await supabase.from("attendance").select("student_id,status").eq("class_id", classId).eq("date", date);
      const init: Record<string, Status> = {}; existing?.forEach(r => init[r.student_id] = r.status as Status);
      setMarks(init);
      // Last 30-day rate per student
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

  const counts = useMemo(() => {
    const c: Record<Status | "unmarked", number> = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    students.forEach(s => { const m = marks[s.id]; if (m) c[m] += 1; else c.unmarked += 1; });
    return c;
  }, [marks, students]);

  function markAll(status: Status) {
    const next: Record<string, Status> = {};
    students.forEach(s => { next[s.id] = marks[s.id] ?? status; });
    // overwrite only unmarked, keep manual ones
    const merged = { ...marks };
    students.forEach(s => { if (!merged[s.id]) merged[s.id] = status; });
    setMarks(merged);
  }

  async function save() {
    if (!school || !classId) return;
    const rows = Object.entries(marks).map(([student_id, status]) => ({ school_id: school.id, class_id: classId, student_id, date, status, marked_by: user!.id }));
    if (!rows.length) return toast("Nothing to save");
    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "class_id,student_id,date" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(`Attendance saved (${rows.length})`);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Mark Attendance"
        description="Choose a class and date, tap a status for each student, then save."
        action={
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            <Input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e => setDate(e.target.value)} className="w-[150px]" />
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="flex-1 min-w-[160px] sm:w-[220px] sm:flex-none"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={save} disabled={!students.length || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        {!classes.length ? <EmptyState icon={ClipboardCheck} title="No classes assigned" /> :
          students.length === 0 ? <EmptyState icon={ClipboardCheck} title="No students enrolled" desc="Ask admin to enroll students in this class." /> :
          <div className="space-y-4">
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
                return (
                  <li key={s.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-medium">{s.full_name || s.email}</div>
                      {rate !== null && (
                        <div className={cn("text-xs", rate < 70 ? "text-destructive" : "text-muted-foreground")}>
                          30-day rate: {rate}% ({h.present}/{h.total})
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {STATUSES.map(st => {
                        const Icon = st.icon; const active = marks[s.id] === st.value;
                        return (
                          <button
                            key={st.value}
                            type="button"
                            onClick={() => setMarks({ ...marks, [s.id]: st.value })}
                            className={cn(
                              "px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1 transition",
                              active ? st.cls : "border-border text-muted-foreground hover:bg-muted",
                            )}
                            aria-pressed={active}
                            title={st.label}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{st.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>}
      </SectionCard>
    </div>
  );
}
