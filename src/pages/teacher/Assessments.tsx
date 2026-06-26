import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import {
  Sparkles, Plus, FilePlus2, Trash2, CheckCircle2, ClipboardCheck, Wand2, Loader2,
  ArrowLeft, Edit3, Send, BookOpenCheck,
} from "lucide-react";
import { schoolPath } from "@/lib/tenant";

type AssessmentRow = {
  id: string; title: string; type: string; status: string; source: string;
  scheduled_at: string | null; created_at: string; config: any;
};

const TYPES: { value: string; label: string; desc: string }[] = [
  { value: "school_test", label: "School Test", desc: "Counts toward results, classroom-scoped." },
  { value: "school_exam", label: "School Exam", desc: "Term exam with full weighting." },
  { value: "jamb_mock", label: "JAMB Mock", desc: "UTME-style timed simulation." },
  { value: "neco_mock", label: "NECO Mock", desc: "NECO format practice." },
  { value: "waec_mock", label: "WAEC Mock", desc: "WAEC format practice." },
  { value: "ai_assessment", label: "AI Assessment", desc: "Generated end-to-end by AI." },
];

export default function Assessments() {
  const { school, user } = useSchool();
  const [params, setParams] = useSearchParams();
  const editId = params.get("id");
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  async function refresh() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase
      .from("assessments").select("*").eq("school_id", school.id)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [school?.id]);

  if (editId) {
    return (
      <AssessmentEditor
        id={editId}
        onBack={() => { setParams({}); refresh(); }}
      />
    );
  }

  return (
    <SectionCard
      title="Assessments"
      action={
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" /> New assessment
        </Button>
      }
    >
      {loading ? (
        <div className="py-10 text-sm text-muted-foreground text-center">Loading…</div>
      ) : !rows.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No assessments yet"
          desc="Create a school test, exam, or an AI-generated assessment."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4 mr-1.5" />New assessment</Button>}
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.id} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setParams({ id: r.id })}
                    className="font-semibold text-sm hover:underline truncate text-left"
                  >
                    {r.title}
                  </button>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {TYPES.find(t => t.value === r.type)?.label ?? r.type}
                  </Badge>
                  <StatusBadge status={r.status} />
                  {r.source === "ai_generated" && (
                    <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                      <Sparkles className="size-3 mr-1" /> AI
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Created {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setParams({ id: r.id })}>
                <Edit3 className="size-3.5 mr-1.5" /> Open
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateAssessmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => { setCreateOpen(false); setParams({ id }); }}
      />
    </SectionCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    in_review: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    scheduled: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    published: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    archived: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`text-[10px] capitalize ${m[status] ?? ""}`}>{status.replace("_"," ")}</Badge>;
}

function CreateAssessmentDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { school, user } = useSchool();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("school_test");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!school || !user) return;
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    const { data, error } = await supabase.from("assessments").insert({
      school_id: school.id, created_by: user.id, title: title.trim(), type: type as any,
      delivery_mode: type === "ai_assessment" ? "open" : type.includes("mock") ? "proctored" : "open",
      source: type === "ai_assessment" ? "ai_generated" : "manual",
      config: { duration_minutes: duration, randomize: type.includes("mock") },
      status: "draft",
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle(""); setType("school_test"); setDuration(60);
    onCreated((data as any).id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New assessment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mid-term Physics test" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" value={duration} min={5} onChange={e => setDuration(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <FilePlus2 className="size-4 mr-1.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   Editor
   ========================================================= */

type QuestionRow = {
  id: string; prompt: string; options: any; correct: any; points: number;
  topic: string | null; subject_code: string | null; difficulty: string;
  ai_generated: boolean; approved_at: string | null; approved_by: string | null;
  explanation: string | null;
};

function AssessmentEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const { school, user } = useSchool();
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data: a } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
    setAssessment(a);
    const { data: qs } = await supabase
      .from("questions_v2").select("*").eq("assessment_id", id).order("created_at");
    setQuestions((qs as any) ?? []);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);

  const pending = useMemo(() => questions.filter(q => q.ai_generated && !q.approved_at), [questions]);
  const approved = useMemo(() => questions.filter(q => !q.ai_generated || q.approved_at), [questions]);

  async function addBlank() {
    if (!school || !user || !assessment) return;
    const { error } = await supabase.from("questions_v2").insert({
      school_id: school.id, assessment_id: id, type: "mcq",
      prompt: "New question", options: ["", "", "", ""], correct: 0, points: 1,
      difficulty: "medium", created_by: user.id,
    });
    if (error) return toast.error(error.message);
    refresh();
  }

  async function approve(qid: string) {
    if (!user) return;
    const { error } = await supabase.from("questions_v2")
      .update({ approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", qid);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function remove(qid: string) {
    const { error } = await supabase.from("questions_v2").delete().eq("id", qid);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function updateQ(qid: string, patch: Partial<QuestionRow>) {
    setQuestions(qs => qs.map(q => q.id === qid ? { ...q, ...patch } : q));
  }
  async function saveQ(q: QuestionRow) {
    const { error } = await supabase.from("questions_v2").update({
      prompt: q.prompt, options: q.options, correct: q.correct,
      points: q.points, topic: q.topic, difficulty: q.difficulty as any,
      explanation: q.explanation,
    }).eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  async function submitForApproval() {
    if (!questions.length) return toast.error("Add questions first");
    if (pending.length) return toast.error(`${pending.length} AI question(s) still need your approval`);
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("assessments")
      .update({ status: "in_review" as any })
      .eq("id", id);
    if (!error && school && user) {
      await supabase.from("exam_review_events").insert({
        school_id: school.id, exam_kind: "legacy", exam_id: id,
        action: "submitted", actor_id: user.id,
      } as any);
    }
    setBusy(false);
    if (error) return toast.error("Could not submit. Please try again.");
    toast.success("Submitted to the exam committee for approval");
    refresh();
  }

  if (!assessment) return <div className="py-10 text-sm text-muted-foreground text-center">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4 mr-1.5" /> Back</Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display font-semibold text-lg truncate">{assessment.title}</h2>
            <StatusBadge status={assessment.status} />
            <Badge variant="secondary" className="text-[10px]">
              {TYPES.find(t => t.value === assessment.type)?.label ?? assessment.type}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {questions.length} question(s) · {approved.length} approved · {pending.length} pending review
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}>
          <Wand2 className="size-3.5 mr-1.5" /> Generate with AI
        </Button>
        <Button variant="outline" size="sm" onClick={addBlank}>
          <Plus className="size-3.5 mr-1.5" /> Add question
        </Button>
        {assessment.status === "draft" && (
          <Button size="sm" onClick={submitForApproval} disabled={busy || !questions.length}>
            {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Send className="size-3.5 mr-1.5" />}
            Submit for approval
          </Button>
        )}
        {assessment.status === "in_review" && (
          <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
            Awaiting committee approval
          </Badge>
        )}
        {assessment.status === "scheduled" && (
          <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30">
            Approved · scheduled by admin
          </Badge>
        )}
        {assessment.status === "published" && (
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
            Published to students
          </Badge>
        )}
      </div>

      {assessment.review_notes && assessment.status === "draft" && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm">
          <div className="font-semibold text-amber-700 dark:text-amber-300">Changes requested by the exam committee</div>
          <div className="text-amber-900 dark:text-amber-100 mt-1 whitespace-pre-line">{assessment.review_notes}</div>
        </div>
      )}

      {pending.length > 0 && (
        <SectionCard title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI review queue ({pending.length})
          </span>
        }>
          <p className="text-xs text-muted-foreground mb-3">
            Review each AI-generated question. The assessment can only be published once every question is approved.
          </p>
          <ul className="space-y-3">
            {pending.map(q => (
              <QuestionCard key={q.id} q={q} onChange={p => updateQ(q.id, p)} onSave={() => saveQ(q)} onDelete={() => remove(q.id)} onApprove={() => approve(q.id)} />
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title={
        <span className="flex items-center gap-2">
          <BookOpenCheck className="size-4" /> Approved questions ({approved.length})
        </span>
      }>
        {!approved.length ? (
          <EmptyState icon={FilePlus2} title="No approved questions yet" desc="Add or generate, then approve." />
        ) : (
          <ul className="space-y-3">
            {approved.map(q => (
              <QuestionCard key={q.id} q={q} onChange={p => updateQ(q.id, p)} onSave={() => saveQ(q)} onDelete={() => remove(q.id)} />
            ))}
          </ul>
        )}
      </SectionCard>

      <AIGenerateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        assessmentId={id}
        onDone={() => { setAiOpen(false); refresh(); }}
      />
    </div>
  );
}

function QuestionCard({
  q, onChange, onSave, onDelete, onApprove,
}: {
  q: QuestionRow;
  onChange: (patch: Partial<QuestionRow>) => void;
  onSave: () => void;
  onDelete: () => void;
  onApprove?: () => void;
}) {
  const options: string[] = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correct === "number" ? q.correct : Number(q.correct ?? 0);
  return (
    <li className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {q.ai_generated && (
          <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30"><Sparkles className="size-3 mr-1" /> AI</Badge>
        )}
        {q.approved_at && (
          <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="size-3 mr-1" /> Approved</Badge>
        )}
        <Badge variant="outline" className="text-[10px] capitalize">{q.difficulty}</Badge>
        {q.topic && <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onSave}>Save</Button>
          {onApprove && <Button size="sm" onClick={onApprove}><CheckCircle2 className="size-3.5 mr-1.5" /> Approve</Button>}
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </div>
      <Textarea
        value={q.prompt}
        onChange={e => onChange({ prompt: e.target.value })}
        placeholder="Question text"
      />
      <div className="grid sm:grid-cols-2 gap-2">
        {options.map((o, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <input
              type="radio"
              checked={correctIndex === oi}
              onChange={() => onChange({ correct: oi })}
            />
            <Input
              value={o}
              onChange={e => {
                const next = [...options];
                next[oi] = e.target.value;
                onChange({ options: next });
              }}
              placeholder={`Option ${oi + 1}`}
            />
          </div>
        ))}
      </div>
      {q.explanation !== null && (
        <Textarea
          value={q.explanation ?? ""}
          onChange={e => onChange({ explanation: e.target.value })}
          placeholder="Explanation (shown after submission)"
          className="text-xs"
        />
      )}
    </li>
  );
}

function AIGenerateDialog({
  open, onOpenChange, assessmentId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; assessmentId: string; onDone: () => void }) {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy"|"medium"|"hard">("medium");
  const [examBody, setExamBody] = useState("school");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!subject.trim()) return toast.error("Subject is required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("generate-questions", {
      body: { assessment_id: assessmentId, subject, topic, count, difficulty, exam_body: examBody },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "AI generation failed");
    }
    toast.success(`Generated ${(data as any).inserted} question(s) — review and approve`);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wand2 className="size-4 text-primary" /> Generate questions with AI</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Mathematics" /></div>
            <div>
              <Label>Exam body</Label>
              <Select value={examBody} onValueChange={setExamBody}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="jamb">JAMB</SelectItem>
                  <SelectItem value="waec">WAEC</SelectItem>
                  <SelectItem value="neco">NECO</SelectItem>
                  <SelectItem value="generic">Generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Topic (optional)</Label><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Quadratic equations" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Count</Label><Input type="number" min={1} max={40} value={count} onChange={e => setCount(Number(e.target.value))} /></div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={v => setDifficulty(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Generated questions land in the AI review queue. You must approve each one before publishing.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={go} disabled={busy}>
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}