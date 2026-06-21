import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload, Search, BookOpenCheck, History, ShieldCheck, Send, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type QRow = {
  id: string;
  subject: string;
  topic: string | null;
  difficulty: string;
  type: string;
  body: string;
  options: string[];
  answer: any;
  explanation: string | null;
  approval_status?: string | null;
  version?: number | null;
};

const DIFFICULTIES = ["easy", "medium", "hard"];
const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  pending_hod: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  pending_admin: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/15 text-destructive",
};
const NEXT_STAGE: Record<string, { next: string; label: string }> = {
  draft:         { next: "pending_hod",   label: "Submit to HOD" },
  pending_hod:   { next: "pending_admin", label: "HOD approve →" },
  pending_admin: { next: "approved",      label: "Admin approve ✓" },
};

export default function QuestionBank() {
  const { school, user } = useSchool();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<QRow | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<QRow>>({ subject: "", topic: "", difficulty: "medium", type: "mcq", body: "", options: ["", "", "", ""], answer: 0, explanation: "" });

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase.from("question_bank").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const subjects = useMemo(() => Array.from(new Set(rows.map(r => r.subject))).sort(), [rows]);
  const filtered = rows.filter(r =>
    (subject === "all" || r.subject === subject) &&
    (difficulty === "all" || r.difficulty === difficulty) &&
    (status === "all" || (r.approval_status ?? "draft") === status) &&
    (q === "" || r.body.toLowerCase().includes(q.toLowerCase()) || (r.topic ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  async function save() {
    if (!school || !user) return;
    if (!draft.subject || !draft.body) return toast.error("Subject and body are required");
    const payload = {
      school_id: school.id,
      subject: draft.subject!,
      topic: draft.topic || null,
      difficulty: draft.difficulty || "medium",
      type: draft.type || "mcq",
      body: draft.body!,
      options: draft.options ?? [],
      answer: draft.answer ?? 0,
      explanation: draft.explanation || null,
      created_by: user.id,
    };
    if (editingId) {
      const { error } = await supabase.from("question_bank").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Question updated · new version snapshotted");
    } else {
      const { error } = await supabase.from("question_bank").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Question added");
    }
    setOpen(false);
    setEditingId(null);
    setDraft({ subject: draft.subject, topic: "", difficulty: "medium", type: "mcq", body: "", options: ["", "", "", ""], answer: 0, explanation: "" });
    load();
  }

  function openEdit(r: QRow) {
    setEditingId(r.id);
    setDraft({ ...r, options: r.options ?? ["", "", "", ""] });
    setOpen(true);
  }

  async function advanceStatus(r: QRow) {
    const cur = (r.approval_status ?? "draft") as keyof typeof NEXT_STAGE;
    const step = NEXT_STAGE[cur];
    if (!step) return;
    const { error } = await supabase.from("question_bank").update({ approval_status: step.next } as any).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(`Moved to ${step.next.replace("_", " ")}`);
    load();
  }

  async function rejectQuestion(r: QRow) {
    const reason = prompt("Reason for rejection?");
    if (reason == null) return;
    const { error } = await supabase.from("question_bank").update({ approval_status: "rejected" } as any).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Question rejected and returned to author");
    load();
  }

  async function openHistory(r: QRow) {
    setHistoryFor(r);
    const { data } = await supabase.from("question_bank_versions" as any)
      .select("*").eq("question_id", r.id).order("version", { ascending: false });
    setHistory((data ?? []) as any);
  }

  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(rs => rs.filter(r => r.id !== id));
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !school || !user) return;
    try {
      const text = await file.text();
      let items: any[] = [];
      if (file.name.endsWith(".json")) {
        items = JSON.parse(text);
      } else {
        // CSV: subject,topic,difficulty,body,option1,option2,option3,option4,correct_index,explanation
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const header = lines.shift()!.split(",").map(s => s.trim().toLowerCase());
        items = lines.map(line => {
          const cells = parseCsvLine(line);
          const obj: any = {};
          header.forEach((h, i) => obj[h] = cells[i]);
          return {
            subject: obj.subject,
            topic: obj.topic || null,
            difficulty: obj.difficulty || "medium",
            type: "mcq",
            body: obj.body,
            options: [obj.option1, obj.option2, obj.option3, obj.option4].filter(Boolean),
            answer: Number(obj.correct_index ?? 0),
            explanation: obj.explanation || null,
          };
        });
      }
      const rowsIn = items.filter(x => x.subject && x.body).map(x => ({
        school_id: school.id, created_by: user.id,
        subject: x.subject, topic: x.topic ?? null,
        difficulty: x.difficulty ?? "medium", type: x.type ?? "mcq",
        body: x.body, options: x.options ?? [], answer: x.answer ?? 0,
        explanation: x.explanation ?? null,
      }));
      if (!rowsIn.length) return toast.error("No valid rows found");
      const { error } = await supabase.from("question_bank").insert(rowsIn);
      if (error) return toast.error(error.message);
      toast.success(`Imported ${rowsIn.length} questions`);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Question Bank"
        action={
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={onImport} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="size-3.5 mr-1.5" /> Import CSV / JSON</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5 mr-1.5" /> Add</Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search body or topic" className="pl-8" />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Approval status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_hod">Pending HOD</SelectItem>
              <SelectItem value="pending_admin">Pending Admin</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
         : filtered.length === 0 ? <EmptyState icon={BookOpenCheck} title="No questions yet" desc="Add manually or import a CSV." />
         : (
          <ul className="space-y-2">
            {filtered.map(r => (
              <li key={r.id} className="p-3 rounded-lg border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{r.body}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-secondary">{r.subject}</span>
                      {r.topic && <span className="px-1.5 py-0.5 rounded bg-secondary">{r.topic}</span>}
                      <span className="px-1.5 py-0.5 rounded bg-secondary capitalize">{r.difficulty}</span>
                      <span className="px-1.5 py-0.5 rounded bg-muted">{(r.options ?? []).length} options</span>
                      <Badge variant="outline" className={STATUS_TONE[r.approval_status ?? "draft"]}>
                        {(r.approval_status ?? "draft").replace("_", " ")}
                      </Badge>
                      {r.version && r.version > 1 && <span className="px-1.5 py-0.5 rounded bg-muted">v{r.version}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {NEXT_STAGE[r.approval_status ?? "draft"] && (
                      <Button variant="outline" size="sm" onClick={() => advanceStatus(r)}>
                        {(r.approval_status ?? "draft") === "draft" ? <Send className="size-3.5 mr-1" /> : <ShieldCheck className="size-3.5 mr-1" />}
                        {NEXT_STAGE[r.approval_status ?? "draft"].label}
                      </Button>
                    )}
                    {(r.approval_status === "pending_hod" || r.approval_status === "pending_admin") && (
                      <Button variant="ghost" size="sm" onClick={() => rejectQuestion(r)}>Reject</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openHistory(r)} title="Version history"><History className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground mt-4">
          CSV format: <code>subject,topic,difficulty,body,option1,option2,option3,option4,correct_index,explanation</code>
        </p>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit question (creates new version)" : "Add question"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Subject</Label><Input value={draft.subject ?? ""} onChange={e => setDraft({ ...draft, subject: e.target.value })} placeholder="Mathematics" /></div>
              <div><Label>Topic</Label><Input value={draft.topic ?? ""} onChange={e => setDraft({ ...draft, topic: e.target.value })} placeholder="Quadratic Equations" /></div>
              <div><Label>Difficulty</Label>
                <Select value={draft.difficulty} onValueChange={v => setDraft({ ...draft, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Question body</Label><Textarea rows={3} value={draft.body ?? ""} onChange={e => setDraft({ ...draft, body: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              {(draft.options ?? ["", "", "", ""]).map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" checked={Number(draft.answer) === oi} onChange={() => setDraft({ ...draft, answer: oi })} />
                  <Input value={o} onChange={e => {
                    const opts = [...(draft.options ?? [])]; opts[oi] = e.target.value;
                    setDraft({ ...draft, options: opts });
                  }} placeholder={`Option ${oi + 1}`} />
                </div>
              ))}
            </div>
            <div><Label>Explanation (optional)</Label><Textarea rows={2} value={draft.explanation ?? ""} onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setEditingId(null); }}>Cancel</Button>
            <Button onClick={save}>{editingId ? "Save new version" : "Save question"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Version history</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground">No prior versions yet. Every edit will snapshot here.</p>}
            {history.map((h: any) => (
              <div key={h.id} className="p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>v{h.version}</span>
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm font-medium line-clamp-2">{h.snapshot?.body}</div>
                <div className="mt-1 flex gap-1.5 text-[11px]">
                  <Badge variant="outline" className={STATUS_TONE[h.snapshot?.approval_status ?? "draft"]}>{(h.snapshot?.approval_status ?? "draft").replace("_"," ")}</Badge>
                  {h.snapshot?.difficulty && <span className="px-1.5 py-0.5 rounded bg-secondary capitalize">{h.snapshot.difficulty}</span>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}
