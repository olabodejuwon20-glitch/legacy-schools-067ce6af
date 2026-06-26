import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FilePlus2, Library, Shuffle, Eye, Award, GraduationCap, Sparkles, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

interface Q { prompt: string; options: string[]; correct_index: number; from_bank_id?: string }

type ExamMode = "neco_sim" | "school" | "practice";
const MODES: { key: ExamMode; title: string; desc: string; icon: any }[] = [
  { key: "neco_sim", title: "NECO / WAEC Simulation", desc: "Strict, proctored mock with auto-submit on violations.", icon: Award },
  { key: "school",   title: "School Exam / Test",     desc: "Counts toward term results. Optional proctoring.",       icon: GraduationCap },
  { key: "practice", title: "CBT Practice",            desc: "No sanctions, no fullscreen, doesn't affect results.",    icon: Sparkles },
];

export default function TestBuilder() {
  const { school, user } = useSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState(60);
  const [randomize, setRandomize] = useState(true);
  const [proctored, setProctored] = useState(true);
  const [violationLimit, setViolationLimit] = useState(3);
  const [proctorAction, setProctorAction] = useState<"warn" | "auto_submit">("auto_submit");
  const [snapshotIntervalSec, setSnapshotIntervalSec] = useState(60);
  const [mode, setMode] = useState<ExamMode>("school");
  const [showAnswersAfterEach, setShowAnswersAfterEach] = useState(true);
  const [questions, setQuestions] = useState<Q[]>([{ prompt: "", options: ["", "", "", ""], correct_index: 0 }]);
  const [bankOpen, setBankOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!school || !user) return;
    supabase.from("classes").select("*").eq("school_id", school.id).eq("teacher_id", user.id).then(({ data }) => setClasses(data ?? []));
  }, [school, user]);

  // Apply mode-specific defaults when mode changes
  useEffect(() => {
    if (mode === "neco_sim") { setProctored(true); setRandomize(true); setViolationLimit(3); setProctorAction("auto_submit"); }
    else if (mode === "practice") { setProctored(false); setRandomize(false); }
  }, [mode]);

  function update(i: number, patch: Partial<Q>) { setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q)); }

  async function submitForApproval() {
    if (!school || !user || busy) return;
    if (!title || !questions.length) return toast.error("Title and at least one question required");
    const valid = questions.filter(q => q.prompt.trim() && q.options.filter(o => o.trim()).length >= 2);
    if (!valid.length) return toast.error("Add at least one complete question");
    setBusy(true);
    const { data: exam, error } = await supabase.from("exams").insert({
      school_id: school.id, class_id: classId || null, title, subject: subject || null,
      duration_minutes: duration, duration_min: duration,
      randomize: mode === "practice" ? false : randomize,
      proctored: mode === "practice" ? false : proctored,
      violation_limit: violationLimit,
      proctor_action: mode === "practice" ? "warn" : proctorAction,
      proctor_snapshot_interval_sec: snapshotIntervalSec,
      mode,
      counts_to_results: mode !== "practice",
      show_answers_after_each: mode === "practice" ? showAnswersAfterEach : false,
      status: "draft", created_by: user.id,
      submitted_at: new Date().toISOString(), submitted_by: user.id,
    }).select("id").single();
    if (error) { setBusy(false); return toast.error("Could not submit. Please try again."); }
    const rows = valid.map((q, i) => ({ exam_id: exam.id, school_id: school.id, position: i, prompt: q.prompt, options: q.options, correct_index: q.correct_index, points: 1 }));
    const { error: e2 } = await supabase.from("exam_questions").insert(rows);
    await supabase.from("exam_review_events").insert({
      school_id: school.id, exam_kind: "legacy", exam_id: exam.id,
      action: "submitted", actor_id: user.id,
    } as any);
    setBusy(false);
    if (e2) return toast.error("Could not save questions. Please try again.");
    toast.success("Submitted to the exam committee for approval");
    setTitle(""); setSubject("");
    setQuestions([{ prompt: "", options: ["", "", "", ""], correct_index: 0 }]);
  }

  function addFromBank(picked: any[]) {
    const additions: Q[] = picked.map(p => ({
      prompt: p.body,
      options: (p.options as string[]) ?? [],
      correct_index: typeof p.answer === "number" ? p.answer : Number(p.answer ?? 0),
      from_bank_id: p.id,
    }));
    setQuestions(qs => {
      const cleaned = qs.filter(q => q.prompt.trim().length > 0);
      return [...cleaned, ...additions];
    });
    toast.success(`Added ${additions.length} questions from bank`);
  }

  return (
    <SectionCard
      title="Build a test"
      description="Drafts are sent to the school's exam committee for approval. Admin publishes the paper and schedules the result release."
      action={
        <Button onClick={submitForApproval} disabled={busy}>
          {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Send className="size-4 mr-1.5" />}
          Submit for approval
        </Button>
      }
    >
      {!classes.length ? <EmptyState icon={FilePlus2} title="No classes" desc="Create a class first." /> :
      <div className="space-y-5">
        <div>
          <Label className="mb-2 block">Exam mode</Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {MODES.map(m => (
              <button key={m.key} type="button" onClick={() => setMode(m.key)}
                className={`text-left rounded-xl border p-3 transition-colors ${mode===m.key ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}>
                <div className="flex items-center gap-2 font-semibold text-sm"><m.icon className="size-4" /> {m.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mid-term exam" /></div>
          <div><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Mathematics" /></div>
          <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
          {mode !== "practice" && (
            <div><Label>Violation limit</Label><Input type="number" value={violationLimit} onChange={e => setViolationLimit(Number(e.target.value))} /></div>
          )}
          {mode !== "practice" && proctored && (
            <>
              <div>
                <Label>On threshold reached</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={proctorAction}
                  onChange={e => setProctorAction(e.target.value as "warn" | "auto_submit")}
                >
                  <option value="auto_submit">Auto-submit the exam</option>
                  <option value="warn">Warn student &amp; alert examiner</option>
                </select>
              </div>
              <div>
                <Label>Snapshot interval (sec)</Label>
                <Input type="number" min={10} max={600} value={snapshotIntervalSec} onChange={e => setSnapshotIntervalSec(Number(e.target.value))} />
              </div>
            </>
          )}
          <div className="flex items-end gap-3 sm:col-span-2 flex-wrap">
            {mode !== "practice" && (
              <>
                <label className="flex items-center gap-2 text-sm"><Switch checked={randomize} onCheckedChange={setRandomize} /> <Shuffle className="size-3.5" /> Randomize order</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={proctored} onCheckedChange={setProctored} /> <Eye className="size-3.5" /> Proctored</label>
              </>
            )}
            {mode === "practice" && (
              <label className="flex items-center gap-2 text-sm"><Switch checked={showAnswersAfterEach} onCheckedChange={setShowAnswersAfterEach} /> Show answer & explanation after each question</label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{questions.filter(q => q.prompt.trim()).length} question(s) staged</div>
          <Button variant="outline" size="sm" onClick={() => setBankOpen(true)}><Library className="size-3.5 mr-1.5" /> Add from Question Bank</Button>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Question {i + 1} {q.from_bank_id && <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-[10px]">from bank</span>}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setQuestions(qs => qs.filter((_, idx) => idx !== i))}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
              <Textarea placeholder="Question text" value={q.prompt} onChange={e => update(i, { prompt: e.target.value })} />
              <div className="grid sm:grid-cols-2 gap-2">
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" checked={q.correct_index === oi} onChange={() => update(i, { correct_index: oi })} />
                    <Input value={o} onChange={e => { const opts = [...q.options]; opts[oi] = e.target.value; update(i, { options: opts }); }} placeholder={`Option ${oi + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setQuestions(qs => [...qs, { prompt: "", options: ["","","",""], correct_index: 0 }])}><Plus className="size-4 mr-1.5" /> Add question</Button>
        </div>
      </div>}

      <BankPicker open={bankOpen} onOpenChange={setBankOpen} defaultSubject={subject} onPick={addFromBank} />
    </SectionCard>
  );
}

function BankPicker({ open, onOpenChange, defaultSubject, onPick }: {
  open: boolean; onOpenChange: (v: boolean) => void; defaultSubject: string;
  onPick: (rows: any[]) => void;
}) {
  const { school } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [subject, setSubject] = useState<string>(defaultSubject || "all");
  const [topic, setTopic] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [count, setCount] = useState<number>(10);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !school) return;
    supabase.from("question_bank").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => { setRows(data ?? []); setSelected({}); });
  }, [open, school]);

  useEffect(() => { setSubject(defaultSubject || "all"); }, [defaultSubject, open]);

  const subjects = useMemo(() => Array.from(new Set(rows.map(r => r.subject))).sort(), [rows]);
  const topics = useMemo(() => Array.from(new Set(rows.filter(r => subject === "all" || r.subject === subject).map(r => r.topic).filter(Boolean))).sort(), [rows, subject]);
  const filtered = rows.filter(r =>
    (subject === "all" || r.subject === subject) &&
    (topic === "all" || r.topic === topic) &&
    (difficulty === "all" || r.difficulty === difficulty)
  );

  function pickRandom() {
    const n = Math.min(count, filtered.length);
    const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, n);
    onPick(shuffled); onOpenChange(false);
  }
  function pickSelected() {
    const picked = filtered.filter(r => selected[r.id]);
    if (!picked.length) return toast.error("No questions selected");
    onPick(picked); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Pick from Question Bank</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics.map(t => <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="number" value={count} onChange={e => setCount(Number(e.target.value))} className="w-20" />
            <Button size="sm" onClick={pickRandom} disabled={!filtered.length}>Random</Button>
          </div>
        </div>
        <div className="mt-2 max-h-[400px] overflow-y-auto border border-border rounded-lg">
          {filtered.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">No matching questions in bank.</div> :
            <ul className="divide-y divide-border">
              {filtered.map(r => (
                <li key={r.id} className="p-2.5 flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={!!selected[r.id]} onChange={e => setSelected(s => ({ ...s, [r.id]: e.target.checked }))} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm line-clamp-2">{r.body}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-secondary">{r.subject}</span>
                      {r.topic && <span className="px-1.5 py-0.5 rounded bg-secondary">{r.topic}</span>}
                      <span className="px-1.5 py-0.5 rounded bg-secondary capitalize">{r.difficulty}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={pickSelected}>Add selected</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
