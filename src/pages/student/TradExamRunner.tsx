import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Send, ShieldCheck, CheckCircle2, ListChecks, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { signedUrlForAsset } from "@/lib/tradExams";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExamCommandBar } from "@/components/exam/ExamCommandBar";
import { QuestionCanvas } from "@/components/exam/QuestionCanvas";
import { OptionList } from "@/components/exam/OptionList";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { SubmitSummaryDialog } from "@/components/exam/SubmitSummaryDialog";
import { cn } from "@/lib/utils";

type Q = {
  q_id: string; q_position: number; q_type: "mcq" | "theory"; q_prompt: string;
  q_options: string[] | null; q_marks: number; q_image_path: string | null;
  q_section_id: string | null; q_selected_index: number | null; q_text_answer: string | null;
};

const LS = (id: string) => `trad:attempt:${id}`;

export default function StudentTradExamRunner() {
  const { examId } = useParams<{ examId: string }>();
  const { school } = useSchool();
  const nav = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, { selected?: number | null; text?: string }>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const submittedRef = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const startTsRef = useRef<number | null>(null);
  const durMinRef = useRef<number>(60);

  const submit = useCallback(async (reason?: string) => {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    // Flush pending text answers
    const rows = Object.entries(answers).map(([qid, v]) => ({
      attempt_id: attemptId, question_id: qid,
      selected_index: v.selected ?? null, text_answer: v.text ?? null,
    }));
    if (rows.length) {
      const { data: sch } = await supabase.from("trad_exam_attempts" as any).select("school_id").eq("id", attemptId).maybeSingle();
      const schoolId = (sch as any)?.school_id;
      if (schoolId) {
        await supabase.from("trad_exam_answers" as any).upsert(
          rows.map(r => ({ ...r, school_id: schoolId })),
          { onConflict: "attempt_id,question_id" }
        );
      }
    }
    const { error } = await supabase.rpc("trad_submit_attempt", { _attempt_id: attemptId, _auto: !!reason });
    setSubmitting(false);
    if (error) {
      submittedRef.current = false;
      toast.error(error.message);
      return;
    }
    localStorage.removeItem(LS(attemptId));
    toast.success(reason ? `${reason} — submitted` : "Submitted");
    setDone(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [attemptId, answers]);

  // Start attempt
  useEffect(() => {
    if (!examId || !school) return;
    (async () => {
      const { data, error } = await supabase.rpc("trad_start_attempt", { _exam_id: examId });
      if (error) { toast.error(error.message); nav(schoolPath(school.slug, "/app/student/trad-exams")); return; }
      const aId = data as unknown as string;
      setAttemptId(aId);
      const { data: qs } = await supabase.rpc("trad_get_attempt_questions", { _attempt_id: aId });
      const list = ((qs as any) ?? []) as Q[];
      setQuestions(list);
      const init: Record<string, any> = {};
      list.forEach(q => init[q.q_id] = { selected: q.q_selected_index ?? null, text: q.q_text_answer ?? "" });
      // local restore
      try {
        const raw = localStorage.getItem(LS(aId));
        if (raw) {
          const local = JSON.parse(raw);
          Object.assign(init, local.answers ?? {});
        }
      } catch {}
      setAnswers(init);
      // fetch timetable timing
      const { data: meta } = await supabase.from("trad_exams" as any)
        .select("timetable_id, trad_exam_timetable:timetable_id(exam_date,start_time,duration_minutes)")
        .eq("id", examId).maybeSingle();
      const t = (meta as any)?.trad_exam_timetable;
      if (t) {
        const start = new Date(`${t.exam_date}T${t.start_time}`).getTime();
        startTsRef.current = start;
        durMinRef.current = t.duration_minutes;
        setRemaining(Math.max(0, Math.floor((start + t.duration_minutes * 60_000 - Date.now()) / 1000)));
      }
      setTimeout(() => shellRef.current?.requestFullscreen?.().catch(() => {}), 50);
    })();
  }, [examId, school?.id]);

  // Timer
  useEffect(() => {
    if (!attemptId || done) return;
    const id = setInterval(() => {
      if (!startTsRef.current) return;
      const left = Math.max(0, Math.floor((startTsRef.current + durMinRef.current * 60_000 - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) { clearInterval(id); submit("Time up"); }
    }, 1000);
    return () => clearInterval(id);
  }, [attemptId, done, submit]);

  // Persist local
  useEffect(() => {
    if (!attemptId) return;
    try { localStorage.setItem(LS(attemptId), JSON.stringify({ answers, current, savedAt: Date.now() })); } catch {}
  }, [attemptId, answers, current]);

  // Lockdown lite: warn on blur/visibility
  useEffect(() => {
    if (!attemptId || done) return;
    const onBlur = () => toast.warning("You left the exam window.");
    const onCtx = (e: Event) => e.preventDefault();
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onCtx);
    document.addEventListener("copy", onCtx);
    document.addEventListener("paste", onCtx);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onCtx);
      document.removeEventListener("copy", onCtx);
      document.removeEventListener("paste", onCtx);
    };
  }, [attemptId, done]);

  function setAnswer(qid: string, patch: { selected?: number | null; text?: string }) {
    setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
    // fire-and-forget persist
    if (!attemptId) return;
    (async () => {
      const { data: sch } = await supabase.from("trad_exam_attempts" as any).select("school_id").eq("id", attemptId).maybeSingle();
      const schoolId = (sch as any)?.school_id;
      if (!schoolId) return;
      await supabase.from("trad_exam_answers" as any).upsert({
        school_id: schoolId, attempt_id: attemptId, question_id: qid,
        selected_index: patch.selected !== undefined ? patch.selected : answers[qid]?.selected ?? null,
        text_answer: patch.text !== undefined ? patch.text : answers[qid]?.text ?? null,
      }, { onConflict: "attempt_id,question_id" });
    })();
  }

  const answered = useMemo(
    () => questions.filter(q => {
      const a = answers[q.q_id];
      return q.q_type === "mcq" ? a?.selected != null : !!(a?.text?.trim());
    }).length,
    [questions, answers]
  );
  const totalMarks = useMemo(() => questions.reduce((s, q) => s + q.q_marks, 0), [questions]);

  if (done) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center space-y-4">
        <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
        <h1 className="text-2xl font-display font-bold">Submitted</h1>
        <p className="text-muted-foreground text-sm">
          Your paper has been submitted. Theory answers will be graded by your teacher, then released by the school.
        </p>
        <Button asChild><Link to={schoolPath(school?.slug, "/app/student/trad-exams")}>Back to exams</Link></Button>
      </div>
    );
  }

  if (!attemptId || questions.length === 0) {
    return <div className="text-sm text-muted-foreground">Preparing exam…</div>;
  }

  const q = questions[current];

  const paletteItems = questions.map(qq => {
    const a = answers[qq.q_id];
    return {
      key: qq.q_id,
      answered: qq.q_type === "mcq" ? a?.selected != null : !!(a?.text?.trim()),
      flagged: !!flags[qq.q_id],
    };
  });
  const unanswered = paletteItems.map((p, i) => (p.answered ? -1 : i)).filter(i => i >= 0);
  const flaggedIdx = paletteItems.map((p, i) => (p.flagged ? i : -1)).filter(i => i >= 0);

  const palette = (
    <QuestionPalette items={paletteItems} activeIndex={current} onJump={setCurrent} />
  );

  return (
    <div ref={shellRef} className="min-h-screen bg-background select-none flex flex-col">
      <header className="sticky top-0 z-10 bg-card/85 backdrop-blur border-b border-border">
        <ExamCommandBar
          title={`Question ${current + 1} of ${questions.length}`}
          subtitle={`${answered}/${questions.length} answered · ${totalMarks} total marks`}
          icon={<div className="size-8 grid place-items-center rounded-md bg-primary/15 shrink-0"><ShieldCheck className="size-4 text-primary" /></div>}
          badges={<Badge variant="outline" className="ml-2 hidden sm:inline-flex"><ShieldCheck className="size-3 mr-1" />Proctored</Badge>}
          remaining={remaining}
          total={Math.max(1, durMinRef.current * 60)}
          actions={
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline" className="px-2.5 lg:hidden" aria-label="Question navigator">
                    <ListChecks className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl">
                  <SheetHeader><SheetTitle>Navigator</SheetTitle></SheetHeader>
                  <div className="mt-4">{palette}</div>
                </SheetContent>
              </Sheet>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting}>
                <Send className="size-3.5 sm:mr-1" /><span className="hidden sm:inline">Submit</span>
              </Button>
            </>
          }
        />
      </header>

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 overflow-y-auto px-4 py-8">
          <QuestionCanvas
            index={current}
            total={questions.length}
            prompt={q.q_prompt}
            meta={
              <>
                <Badge variant="secondary" className="text-[10px]">{q.q_type === "mcq" ? "MCQ" : "Theory"}</Badge>
                <Badge variant="outline" className="text-[10px]">{q.q_marks} marks</Badge>
              </>
            }
            actions={
              <button
                type="button"
                onClick={() => setFlags(f => ({ ...f, [q.q_id]: !f[q.q_id] }))}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                  flags[q.q_id] ? "border-warning/40 bg-warning/10 text-warning" : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                <Flag className="size-3.5" />{flags[q.q_id] ? "Flagged" : "Flag"}
              </button>
            }
          >
            {q.q_image_path && <DiagramImage path={q.q_image_path} />}

            {q.q_type === "mcq" ? (
              <OptionList
                options={q.q_options ?? []}
                selected={answers[q.q_id]?.selected}
                onSelect={(idx) => setAnswer(q.q_id, { selected: idx })}
              />
            ) : (
              <Textarea
                rows={10}
                className="text-base leading-relaxed"
                value={answers[q.q_id]?.text ?? ""}
                onChange={e => setAnswer(q.q_id, { text: e.target.value })}
                placeholder="Write your answer here…"
              />
            )}

            <div className="flex items-center justify-between mt-10 gap-2">
              <Button variant="outline" size="lg" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                <ArrowLeft className="size-4 mr-1" />Previous
              </Button>
              {current < questions.length - 1 ? (
                <Button size="lg" onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}>
                  Next<ArrowRight className="size-4 ml-1" />
                </Button>
              ) : (
                <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={submitting}>
                  <Send className="size-4 mr-1" />Submit
                </Button>
              )}
            </div>
          </QuestionCanvas>
        </main>

        <aside className="hidden lg:block w-72 shrink-0 border-l border-border bg-card/40 p-4 overflow-y-auto">
          {palette}
        </aside>
      </div>

      <SubmitSummaryDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        total={questions.length}
        answered={answered}
        unanswered={unanswered}
        flagged={flaggedIdx}
        onJump={setCurrent}
        onConfirm={() => submit()}
        submitting={submitting}
      />
    </div>
  );
}

function DiagramImage({ path }: { path: string }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { signedUrlForAsset(path).then(setU); }, [path]);
  if (!u) return null;
  return <img src={u} alt="Diagram" className="max-h-64 rounded-md border border-border my-3" />;
}