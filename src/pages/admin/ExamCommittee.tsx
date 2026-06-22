import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, ClipboardList, Plus, ScrollText, Users2, MapPin, Clock,
  ChevronRight, AlertTriangle, FileCheck2, Trash2, Pencil, GripVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatStatus, type TradSession, type TradTimetableRow, type TradExam } from "@/lib/tradExams";

// Nigerian school presets.
const NG_TERMS = ["First Term", "Second Term", "Third Term"] as const;
const NG_SUBJECTS = [
  "Mathematics", "English Language", "Civic Education", "Basic Science",
  "Basic Technology", "Social Studies", "Agricultural Science",
  "Physics", "Chemistry", "Biology", "Further Mathematics",
  "Economics", "Government", "Literature in English", "Christian Religious Studies",
  "Islamic Religious Studies", "Geography", "Yoruba", "Igbo", "Hausa", "French",
  "Computer Studies", "Commerce", "Financial Accounting",
];
const NG_VENUES = ["Hall A", "Hall B", "Examination Hall", "Library", "Lab 1", "Lab 2"];

const STATUS_TONE: Record<string, string> = {
  planning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  locked: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

type ClassRow = { id: string; name: string; code: string | null; level: string | null };

function currentAcademicYear() {
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

export default function ExamCommittee() {
  const { school, user } = useSchool();
  const [sessions, setSessions] = useState<TradSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [rows, setRows] = useState<TradTimetableRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [exams, setExams] = useState<TradExam[]>([]);
  const [loading, setLoading] = useState(false);

  // Create-session dialog
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    name: "", term: "First Term", academic_year: currentAcademicYear(),
    start_date: "", end_date: "",
  });

  // Add-slot dialog
  const [slotOpen, setSlotOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState({
    class_id: "", subject_name: "", exam_date: "", start_time: "09:00",
    duration_minutes: 60, venue: "", invigilator_name: "", coordinator_name: "", notes: "",
  });
  // Multi-class scheduling (Nigerian batch flow — same paper for many arms)
  const [bulkClassIds, setBulkClassIds] = useState<string[]>([]);

  async function loadSessions() {
    if (!school) return;
    const { data } = await supabase.from("trad_exam_sessions" as any)
      .select("*").eq("school_id", school.id)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as any as TradSession[];
    setSessions(list);
    if (list.length && !activeSessionId) setActiveSessionId(list[0].id);
  }

  async function loadSession() {
    if (!school || !activeSessionId) return;
    setLoading(true);
    const [r, c, ex] = await Promise.all([
      supabase.from("trad_exam_timetable" as any).select("*")
        .eq("session_id", activeSessionId).order("exam_date").order("start_time"),
      supabase.from("classes").select("id,name,code,level")
        .eq("school_id", school.id).order("name"),
      supabase.from("trad_exams" as any).select("*").eq("school_id", school.id),
    ]);
    setRows(((r.data as any) ?? []) as TradTimetableRow[]);
    setClasses((c.data ?? []) as any);
    setExams(((ex.data as any) ?? []) as TradExam[]);
    setLoading(false);
  }

  useEffect(() => { loadSessions(); /* eslint-disable-next-line */ }, [school?.id]);
  useEffect(() => { loadSession(); /* eslint-disable-next-line */ }, [activeSessionId]);

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const classMap = useMemo(() => {
    const m = new Map<string, ClassRow>(); classes.forEach(c => m.set(c.id, c)); return m;
  }, [classes]);

  const examByTimetable = useMemo(() => {
    const m = new Map<string, TradExam>();
    exams.forEach(e => { if (e.timetable_id) m.set(e.timetable_id, e); });
    return m;
  }, [exams]);

  // Group by date for calendar view
  const grouped = useMemo(() => {
    const map = new Map<string, TradTimetableRow[]>();
    rows.forEach(r => {
      const k = r.exam_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // Conflict detection: same class, same date, overlapping time
  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (a.class_id !== b.class_id || a.exam_date !== b.exam_date) continue;
        const aStart = toMinutes(a.start_time), aEnd = aStart + a.duration_minutes;
        const bStart = toMinutes(b.start_time), bEnd = bStart + b.duration_minutes;
        if (aStart < bEnd && bStart < aEnd) { set.add(a.id); set.add(b.id); }
      }
    }
    return set;
  }, [rows]);

  // Coordinator coverage: rows without a coordinator name set
  const missingCoordinators = useMemo(
    () => rows.filter(r => !r.coordinator_name?.trim()),
    [rows],
  );

  const papersBuilt = useMemo(
    () => rows.filter(r => examByTimetable.has(r.id)).length,
    [rows, examByTimetable],
  );

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !user) return;
    const { data, error } = await (supabase.from("trad_exam_sessions" as any).insert({
      school_id: school.id,
      name: sessionForm.name,
      term: sessionForm.term || null,
      academic_year: sessionForm.academic_year || null,
      start_date: sessionForm.start_date || null,
      end_date: sessionForm.end_date || null,
      created_by: user.id,
    }).select().single() as any);
    if (error) return toast.error(error.message);
    toast.success("Exam session created");
    setSessionOpen(false);
    setSessionForm({ name: "", term: "First Term", academic_year: currentAcademicYear(), start_date: "", end_date: "" });
    await loadSessions();
    if (data?.id) setActiveSessionId(data.id);
  }

  function openAddSlot() {
    setEditingId(null);
    setSlotForm({
      class_id: "", subject_name: "", exam_date: "", start_time: "09:00",
      duration_minutes: 60, venue: "", invigilator_name: "", coordinator_name: "", notes: "",
    });
    setBulkClassIds([]);
    setSlotOpen(true);
  }

  function openEditSlot(r: TradTimetableRow) {
    setEditingId(r.id);
    setSlotForm({
      class_id: r.class_id,
      subject_name: r.subject_name ?? "",
      exam_date: r.exam_date,
      start_time: r.start_time?.slice(0, 5) ?? "09:00",
      duration_minutes: r.duration_minutes,
      venue: r.venue ?? "",
      invigilator_name: r.invigilator_name ?? "",
      coordinator_name: r.coordinator_name ?? "",
      notes: r.notes ?? "",
    });
    setBulkClassIds([]);
    setSlotOpen(true);
  }

  async function saveSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !user || !activeSessionId) return;
    const base = {
      school_id: school.id,
      session_id: activeSessionId,
      subject_name: slotForm.subject_name || null,
      exam_date: slotForm.exam_date,
      start_time: slotForm.start_time,
      duration_minutes: Number(slotForm.duration_minutes),
      venue: slotForm.venue || null,
      invigilator_name: slotForm.invigilator_name || null,
      coordinator_name: slotForm.coordinator_name || null,
      notes: slotForm.notes || null,
      created_by: user.id,
    };
    if (editingId) {
      const { error } = await supabase.from("trad_exam_timetable" as any)
        .update({ ...base, class_id: slotForm.class_id })
        .eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Slot updated");
    } else {
      const targets = bulkClassIds.length ? bulkClassIds : [slotForm.class_id];
      if (!targets[0]) return toast.error("Select at least one class");
      const payload = targets.map(class_id => ({ ...base, class_id }));
      const { error } = await supabase.from("trad_exam_timetable" as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success(`Scheduled ${targets.length} paper${targets.length > 1 ? "s" : ""}`);
    }
    setSlotOpen(false);
    loadSession();
  }

  async function deleteSlot(id: string) {
    if (!confirm("Remove this scheduled paper?")) return;
    const { error } = await supabase.from("trad_exam_timetable" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Slot removed"); loadSession();
  }

  async function setSessionStatus(status: "planning" | "published" | "locked") {
    if (!activeSessionId) return;
    const { error } = await supabase.from("trad_exam_sessions" as any)
      .update({ status }).eq("id", activeSessionId);
    if (error) return toast.error(error.message);
    toast.success(`Session ${status}`); loadSessions();
  }

  function toggleBulkClass(id: string) {
    setBulkClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <div className="space-y-6">
      {/* Header / session picker */}
      <SectionCard
        title="Exam Committee Workspace"
        description="Plan exam sessions, build the timetable, assign coordinators, and track paper readiness."
        action={
          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <Select value={activeSessionId} onValueChange={setActiveSessionId}>
                <SelectTrigger className="w-[260px]"><SelectValue placeholder="Choose session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.term ? ` · ${s.term}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="size-4 mr-1.5" />New session</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create exam session</DialogTitle></DialogHeader>
                <form onSubmit={createSession} className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={sessionForm.name}
                      onChange={e => setSessionForm({ ...sessionForm, name: e.target.value })}
                      placeholder="2026 First Term Examinations" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Term</Label>
                      <Select value={sessionForm.term} onValueChange={v => setSessionForm({ ...sessionForm, term: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{NG_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Academic year</Label>
                      <Input value={sessionForm.academic_year}
                        onChange={e => setSessionForm({ ...sessionForm, academic_year: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Start date</Label>
                      <Input type="date" value={sessionForm.start_date}
                        onChange={e => setSessionForm({ ...sessionForm, start_date: e.target.value })} /></div>
                    <div><Label>End date</Label>
                      <Input type="date" value={sessionForm.end_date}
                        onChange={e => setSessionForm({ ...sessionForm, end_date: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      >
        {sessions.length === 0 ? (
          <EmptyState icon={ScrollText} title="No exam sessions yet"
            desc="Create your first session to begin scheduling subjects and assigning coordinators." />
        ) : activeSession ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-display text-lg font-semibold">{activeSession.name}</div>
              <Badge variant="outline" className={STATUS_TONE[activeSession.status]}>{formatStatus(activeSession.status)}</Badge>
              <span className="text-sm text-muted-foreground">
                {activeSession.term ?? "—"} · {activeSession.academic_year ?? "—"}
              </span>
              {(activeSession.start_date || activeSession.end_date) && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {activeSession.start_date ?? "?"} → {activeSession.end_date ?? "?"}
                </span>
              )}
              <div className="ml-auto flex gap-2">
                {activeSession.status !== "published" && (
                  <Button size="sm" variant="outline" onClick={() => setSessionStatus("published")}>Publish to portal</Button>
                )}
                {activeSession.status !== "locked" && (
                  <Button size="sm" variant="outline" onClick={() => setSessionStatus("locked")}>Lock</Button>
                )}
                {activeSession.status !== "planning" && (
                  <Button size="sm" variant="ghost" onClick={() => setSessionStatus("planning")}>Return to planning</Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Scheduled papers" value={rows.length} icon={ClipboardList} />
              <StatCard label="Papers built" value={`${papersBuilt}/${rows.length}`} icon={FileCheck2} />
              <StatCard label="Coordinator gaps" value={missingCoordinators.length} icon={Users2}
                tone={missingCoordinators.length ? "warning" : "info"} />
              <StatCard label="Scheduling conflicts" value={conflicts.size} icon={AlertTriangle}
                tone={conflicts.size ? "warning" : "info"} />
            </div>
          </div>
        ) : null}
      </SectionCard>

      {activeSession && (
        <Tabs defaultValue="timetable" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            <TabsTrigger value="board">Schedule board</TabsTrigger>
            <TabsTrigger value="coordinators">Coordinators</TabsTrigger>
            <TabsTrigger value="papers">Papers</TabsTrigger>
            <TabsTrigger value="all-sessions">All sessions</TabsTrigger>
          </TabsList>

          {/* Timetable */}
          <TabsContent value="timetable">
            <SectionCard
              title="Subject schedule"
              description="Group papers by date. Use Schedule paper for one or many class arms at once."
              action={
                <Button size="sm" disabled={classes.length === 0} onClick={openAddSlot}>
                  <Plus className="size-4 mr-1.5" />Schedule paper
                </Button>
              }
            >
              {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
                : grouped.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No papers scheduled"
                  desc={classes.length === 0 ? "Create a class first." : "Schedule the first paper for this session."} />
              ) : (
                <div className="space-y-5">
                  {grouped.map(([date, items]) => (
                    <div key={date}>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="size-4 text-primary" />
                        <span className="font-semibold">{new Date(date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                        <Badge variant="outline" className="ml-1">{items.length} paper{items.length > 1 ? "s" : ""}</Badge>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <div className="overflow-x-auto"><table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground bg-muted/30">
                            <tr>
                              <th className="text-left px-3 py-2">Time</th>
                              <th className="text-left px-3 py-2">Class</th>
                              <th className="text-left px-3 py-2">Subject</th>
                              <th className="text-left px-3 py-2">Venue</th>
                              <th className="text-left px-3 py-2">Invigilator</th>
                              <th className="text-left px-3 py-2">Coordinator</th>
                              <th className="text-left px-3 py-2">Paper</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(r => {
                              const ex = examByTimetable.get(r.id);
                              const isConflict = conflicts.has(r.id);
                              return (
                                <tr key={r.id} className={"border-t border-border " + (isConflict ? "bg-destructive/5" : "")}>
                                  <td className="px-3 py-2 tabular-nums">
                                    <div className="inline-flex items-center gap-1.5">
                                      <Clock className="size-3.5 text-muted-foreground" />
                                      {r.start_time?.slice(0, 5)} · {r.duration_minutes}m
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">{classMap.get(r.class_id)?.name ?? "—"}</td>
                                  <td className="px-3 py-2 font-medium">{r.subject_name ?? "—"}</td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {r.venue ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{r.venue}</span> : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{r.invigilator_name ?? "—"}</td>
                                  <td className="px-3 py-2">
                                    {r.coordinator_name ?? <span className="text-amber-600 dark:text-amber-400 text-xs">Unassigned</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {ex ? (
                                      <Link to={schoolPath(school?.slug, `/app/admin/trad-exams/paper/${ex.id}`)}
                                        className="text-primary hover:underline inline-flex items-center gap-1">
                                        {formatStatus(ex.draft_status)} <ChevronRight className="size-3.5" />
                                      </Link>
                                    ) : (
                                      <Link to={schoolPath(school?.slug, `/app/admin/trad-exams/${activeSessionId}`)}
                                        className="text-xs text-muted-foreground hover:text-primary">
                                        Build paper →
                                      </Link>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    {activeSession?.status === "planning" ? (
                                      <>
                                        <Button size="icon" variant="ghost" onClick={() => openEditSlot(r)} title="Edit or reschedule"><Pencil className="size-4" /></Button>
                                        <Button size="icon" variant="ghost" onClick={() => deleteSlot(r.id)} title="Delete"><Trash2 className="size-4 text-destructive" /></Button>
                                      </>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">Locked</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="board">
            <SectionCard
              title="Drag-and-drop schedule board"
              description="Drag any paper onto a venue + time-slot cell to reschedule. Red cells indicate class-time conflicts."
            >
              {rows.length === 0 ? (
                <EmptyState icon={MapPin} title="Nothing to drag yet" desc="Schedule papers on the Timetable tab first." />
              ) : (
                <ScheduleBoard
                  rows={rows}
                  classMap={classMap}
                  conflicts={conflicts}
                  venues={Array.from(new Set([...NG_VENUES, ...rows.map(r => r.venue).filter(Boolean) as string[]]))}
                  onMove={async (id, patch) => {
                    // Optimistic update
                    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } as TradTimetableRow : r));
                    const { error } = await supabase.from("trad_exam_timetable" as any)
                      .update(patch).eq("id", id);
                    if (error) { toast.error(error.message); loadSession(); }
                  }}
                />
              )}
            </SectionCard>
          </TabsContent>
          <TabsContent value="coordinators">
            <SectionCard title="Coordination roster"
              description="Every scheduled paper needs a coordinator and invigilator before the session is published.">
              {rows.length === 0 ? (
                <EmptyState icon={Users2} title="No papers scheduled" desc="Add papers to the timetable first." />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground bg-muted/30">
                      <tr>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Class · Subject</th>
                        <th className="text-left px-3 py-2">Venue</th>
                        <th className="text-left px-3 py-2">Coordinator</th>
                        <th className="text-left px-3 py-2">Invigilator</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-3 py-2 tabular-nums">{r.exam_date} · {r.start_time?.slice(0, 5)}</td>
                          <td className="px-3 py-2"><span className="font-medium">{classMap.get(r.class_id)?.name ?? "—"}</span> · {r.subject_name ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.venue ?? "—"}</td>
                          <td className="px-3 py-2">
                            {r.coordinator_name
                              ? <span>{r.coordinator_name}</span>
                              : <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Assign</Badge>}
                          </td>
                          <td className="px-3 py-2">
                            {r.invigilator_name
                              ? <span>{r.invigilator_name}</span>
                              : <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Assign</Badge>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => openEditSlot(r)}>
                              <Pencil className="size-3.5 mr-1.5" />Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* Papers */}
          <TabsContent value="papers">
            <SectionCard title="Paper readiness"
              description="Track which scheduled papers already have a draft, are submitted for approval, or are still pending.">
              {rows.length === 0 ? (
                <EmptyState icon={FileCheck2} title="Nothing to track yet" desc="Schedule papers on the Timetable tab." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rows.map(r => {
                    const ex = examByTimetable.get(r.id);
                    return (
                      <div key={r.id} className="rounded-lg border border-border p-4 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{r.subject_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{classMap.get(r.class_id)?.name ?? "—"} · {r.exam_date}</div>
                          </div>
                          {ex
                            ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{formatStatus(ex.draft_status)}</Badge>
                            : <Badge variant="outline" className="bg-muted">No paper</Badge>}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Link to={schoolPath(school?.slug, `/app/admin/trad-exams/${activeSessionId}`)}
                            className="text-xs text-primary hover:underline">
                            Open session →
                          </Link>
                          {ex && (
                            <Link to={schoolPath(school?.slug, `/app/admin/trad-exams/paper/${ex.id}`)}
                              className="text-xs text-primary hover:underline ml-auto">
                              Edit paper →
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* All sessions */}
          <TabsContent value="all-sessions">
            <SectionCard title="All exam sessions" description="Switch to any planning, published, or locked session.">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.map(s => (
                  <button key={s.id} type="button" onClick={() => setActiveSessionId(s.id)}
                    className={"text-left rounded-xl bg-card border p-4 transition hover:border-primary/40 " +
                      (s.id === activeSessionId ? "border-primary" : "border-border")}>
                    <div className="flex items-start justify-between">
                      <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary">
                        <ScrollText className="size-4" />
                      </div>
                      <Badge variant="outline" className={STATUS_TONE[s.status]}>{formatStatus(s.status)}</Badge>
                    </div>
                    <div className="mt-3 font-medium leading-tight">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.term ? `${s.term} · ` : ""}{s.academic_year ?? "—"}
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}

      {/* Schedule / edit slot dialog */}
      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit paper" : "Schedule paper"}</DialogTitle></DialogHeader>
          <form onSubmit={saveSlot} className="space-y-4">
            {!editingId ? (
              <div>
                <Label>Classes (select one or many)</Label>
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-lg border border-border">
                  {classes.length === 0 && <span className="text-xs text-muted-foreground">No classes yet.</span>}
                  {classes.map(c => {
                    const active = bulkClassIds.includes(c.id);
                    return (
                      <button type="button" key={c.id} onClick={() => toggleBulkClass(c.id)}
                        className={"px-2.5 py-1 rounded-full text-xs border transition " +
                          (active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40")}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Same date, time, subject, and coordinator will apply to every selected class.
                </div>
              </div>
            ) : (
              <div>
                <Label>Class</Label>
                <Select value={slotForm.class_id} onValueChange={v => setSlotForm({ ...slotForm, class_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Subject</Label>
              <Input list="ng-subjects" required value={slotForm.subject_name}
                onChange={e => setSlotForm({ ...slotForm, subject_name: e.target.value })}
                placeholder="e.g. Mathematics" />
              <datalist id="ng-subjects">{NG_SUBJECTS.map(s => <option key={s} value={s} />)}</datalist>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><Label>Date</Label>
                <Input type="date" required value={slotForm.exam_date}
                  onChange={e => setSlotForm({ ...slotForm, exam_date: e.target.value })} /></div>
              <div><Label>Start time</Label>
                <Input type="time" required value={slotForm.start_time}
                  onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })} /></div>
              <div><Label>Duration (mins)</Label>
                <Input type="number" min={15} step={5} required value={slotForm.duration_minutes}
                  onChange={e => setSlotForm({ ...slotForm, duration_minutes: +e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Venue</Label>
                <Input list="ng-venues" value={slotForm.venue}
                  onChange={e => setSlotForm({ ...slotForm, venue: e.target.value })}
                  placeholder="e.g. Hall A" />
                <datalist id="ng-venues">{NG_VENUES.map(v => <option key={v} value={v} />)}</datalist>
              </div>
              <div><Label>Invigilator</Label>
                <Input value={slotForm.invigilator_name}
                  onChange={e => setSlotForm({ ...slotForm, invigilator_name: e.target.value })}
                  placeholder="Staff name" /></div>
              <div><Label>Coordinator</Label>
                <Input value={slotForm.coordinator_name}
                  onChange={e => setSlotForm({ ...slotForm, coordinator_name: e.target.value })}
                  placeholder="e.g. HOD Science" /></div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={slotForm.notes}
                onChange={e => setSlotForm({ ...slotForm, notes: e.target.value })}
                placeholder="Materials allowed, seating arrangement, etc." />
            </div>

            <DialogFooter>
              <Button type="submit">{editingId ? "Save changes" : "Schedule paper"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toMinutes(t: string) {
  const [h, m] = (t ?? "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-and-drop schedule board: rows = time slots, columns = venues, grouped by date.
const BOARD_SLOTS = ["08:00", "10:00", "12:00", "14:00"];
function ScheduleBoard({
  rows, classMap, conflicts, venues, onMove,
}: {
  rows: TradTimetableRow[];
  classMap: Map<string, ClassRow>;
  conflicts: Set<string>;
  venues: string[];
  onMove: (id: string, patch: Partial<TradTimetableRow>) => void;
}) {
  const dates = Array.from(new Set(rows.map(r => r.exam_date))).sort();
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e: React.DragEvent, date: string, time: string, venue: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null); setHover(null);
    if (!id) return;
    onMove(id, { exam_date: date, start_time: `${time}:00`, venue });
  }
  return (
    <div className="space-y-6">
      {dates.map(date => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="size-4 text-primary" />
            <span className="font-semibold">{new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left p-2 w-20">Time</th>
                  {venues.map(v => <th key={v} className="text-left p-2 border-l border-border">{v}</th>)}
                </tr>
              </thead>
              <tbody>
                {BOARD_SLOTS.map(time => (
                  <tr key={time} className="border-t border-border align-top">
                    <td className="p-2 tabular-nums text-muted-foreground">{time}</td>
                    {venues.map(venue => {
                      const cellKey = `${date}|${time}|${venue}`;
                      const items = rows.filter(r =>
                        r.exam_date === date && (r.start_time?.slice(0, 5) === time) && (r.venue ?? "") === venue
                      );
                      const isHover = hover === cellKey;
                      const hasConflict = items.some(r => conflicts.has(r.id));
                      return (
                        <td key={venue}
                          onDragOver={e => { e.preventDefault(); setHover(cellKey); }}
                          onDragLeave={() => setHover(h => h === cellKey ? null : h)}
                          onDrop={e => onDrop(e, date, time, venue)}
                          className={"p-2 border-l border-border min-h-[60px] transition " +
                            (isHover ? "bg-primary/10 ring-1 ring-primary/40 " : "") +
                            (hasConflict ? "bg-destructive/5" : "")}>
                          <div className="space-y-1.5">
                            {items.map(r => (
                              <div key={r.id}
                                draggable
                                onDragStart={e => onDragStart(e, r.id)}
                                className={"cursor-grab active:cursor-grabbing rounded-md border bg-card p-2 hover:border-primary/40 " +
                                  (conflicts.has(r.id) ? "border-destructive/50" : "border-border")}>
                                <div className="flex items-start gap-1.5">
                                  <GripVertical className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{r.subject_name ?? "—"}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {classMap.get(r.class_id)?.name ?? "—"} · {r.duration_minutes}m
                                    </div>
                                    {conflicts.has(r.id) && (
                                      <span className="text-[10px] text-destructive inline-flex items-center gap-1 mt-1">
                                        <AlertTriangle className="size-3" /> Conflict
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Tip: drag a card to a different time-slot or venue cell to reschedule. The system instantly recomputes class-time conflicts.
      </p>
    </div>
  );
}