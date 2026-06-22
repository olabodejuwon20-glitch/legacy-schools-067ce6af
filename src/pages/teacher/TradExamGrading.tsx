import { useEffect, useState } from "react";
import { PenLine, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ResultReleaseBadge } from "@/components/exam/ResultReleaseBadge";

type Row = {
  answer_id: string;
  attempt_id?: string;
  text_answer: string | null;
  marks_awarded: number;
  graded_at: string | null;
  feedback: string | null;
  student_id: string;
  attempt_status: string;
  submitted_at: string | null;
  question_id: string;
  prompt: string;
  marks: number;
  model_answer: string | null;
  exam_id: string;
};

type ResultLite = {
  attempt_id: string;
  status: string | null;
  released_at: string | null;
  scheduled_release_at: string | null;
};

export default function TeacherTradExamGrading() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [resultByAttempt, setResultByAttempt] = useState<Record<string, ResultLite>>({});

  async function load() {
    if (!school || !user) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("trad_get_theory_grading_queue" as any, { _school_id: school.id });
    if (error) toast.error(error.message);
    const list = ((data as any) ?? []) as Row[];
    setRows(list);
    // Pull lightweight result row per attempt so teachers see release status.
    const attemptIds = Array.from(new Set(list.map((r: any) => r.attempt_id).filter(Boolean)));
    if (attemptIds.length) {
      const { data: results } = await supabase
        .from("trad_exam_results" as any)
        .select("attempt_id,status,released_at,scheduled_release_at")
        .in("attempt_id", attemptIds);
      const map: Record<string, ResultLite> = {};
      ((results as any) ?? []).forEach((r: ResultLite) => { map[r.attempt_id] = r; });
      setResultByAttempt(map);
    } else {
      setResultByAttempt({});
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [school?.id, user?.id]);

  async function grade(id: string, maxMarks: number) {
    const d = draft[id] ?? { marks: "0", feedback: "" };
    const m = Number(d.marks);
    if (isNaN(m) || m < 0 || m > maxMarks) return toast.error(`Marks must be 0–${maxMarks}`);
    const { error } = await supabase.rpc("trad_grade_theory", {
      _answer_id: id, _marks: m, _feedback: d.feedback || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Graded");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={schoolPath(school?.slug, "/app/teacher/trad-exams")}><ArrowLeft className="size-4 mr-1" />Back</Link>
        </Button>
      </div>
      <SectionCard title="Theory grading queue"
        description="Grade theory answers from students who have submitted your papers.">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
          : rows.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up" desc="No theory answers waiting for your grade." />
          ) : (
            <div className="space-y-4">
              {rows.map(r => {
                const max = r.marks ?? 0;
                const d = draft[r.answer_id] ?? { marks: "0", feedback: "" };
                return (
                  <div key={r.answer_id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{max} marks</Badge>
                      <span className="text-xs text-muted-foreground">Student: {r.student_id?.slice(0, 8)}…</span>
                      {(() => {
                        const res = resultByAttempt[(r as any).attempt_id];
                        return res ? (
                          <ResultReleaseBadge
                            status={res.status}
                            released_at={res.released_at}
                            scheduled_release_at={res.scheduled_release_at}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Question</div>
                      <div className="text-sm">{r.prompt}</div>
                    </div>
                    {r.model_answer && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Model answer (private)</summary>
                        <div className="mt-1 p-2 bg-muted rounded">{r.model_answer}</div>
                      </details>
                    )}
                    <div>
                      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Student answer</div>
                      <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-3 border border-border">
                        {r.text_answer || <span className="text-muted-foreground italic">(no answer submitted)</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-2 items-end">
                      <div>
                        <Label>Marks (/{max})</Label>
                        <Input type="number" min={0} max={max} value={d.marks}
                          onChange={e => setDraft(p => ({ ...p, [r.answer_id]: { ...d, marks: e.target.value } }))} />
                      </div>
                      <div>
                        <Label>Feedback (optional)</Label>
                        <Textarea rows={1} value={d.feedback}
                          onChange={e => setDraft(p => ({ ...p, [r.answer_id]: { ...d, feedback: e.target.value } }))} />
                      </div>
                      <Button onClick={() => grade(r.answer_id, max)}>
                        <PenLine className="size-3.5 mr-1" />Save grade
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </SectionCard>
    </div>
  );
}