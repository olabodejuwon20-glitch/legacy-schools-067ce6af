import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, GraduationCap, Loader2, ListChecks, Maximize2, Minimize2, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useExamLockdown } from "@/lib/examLockdown";
import { ExamCommandBar } from "@/components/exam/ExamCommandBar";
import { QuestionCanvas } from "@/components/exam/QuestionCanvas";
import { OptionList } from "@/components/exam/OptionList";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { SubmitSummaryDialog } from "@/components/exam/SubmitSummaryDialog";
import { ShieldCheck, AlertTriangle } from "lucide-react";

type Subject = { id: string; code: string; name: string; color: string; sort: number };
type Question = { id: string; subject_id: string; position: number; prompt: string; options: any };
type AnswerMap = Record<string, { selected_index: number | null; marked: boolean }>;

export default function MockRunner() {
  const { sessionId, slug } = useParams<{ sessionId: string; slug: string }>();
  const { school, user, displayName } = useSchool();
  const nav = useNavigate();
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [offline, setOffline] = useState(!navigator.onLine);
  const upsertQueue = useRef<Map<string, { selected_index: number | null; marked: boolean; subject_id: string }>>(new Map());
  const submittingRef = useRef(false);
  const autoSubmitFiredRef = useRef(false);
  const restoredRef = useRef(false);
  const qc = useQueryClient();
  const resumeKey = `mock-resume:${sessionId}`;

  const { data, isLoading } = useQuery({
    queryKey: ["mock-runner", sessionId],
    enabled: !!sessionId && !!school,
    queryFn: async () => {
      const { data: session, error } = await supabase.from("mock_sessions").select("*").eq("id", sessionId!).single();
      if (error) throw error;
      const { data: sessSubs, error: e2 } = await supabase
        .from("mock_session_subjects")
        .select("subject_id, sort")
        .eq("session_id", sessionId!)
        .order("sort");
      if (e2) throw e2;
      const subjectIds = sessSubs.map(s => s.subject_id);
      const [{ data: subjects }, qRes, { data: ans }] = await Promise.all([
        supabase.from("mock_subjects").select("id, code, name, color, sort").in("id", subjectIds),
        supabase.rpc("get_mock_questions_for_session", { _session_id: sessionId! }),
        supabase.from("mock_answers").select("question_id, subject_id, selected_index, marked_for_review").eq("session_id", sessionId!),
      ]);
      const questions = (qRes.data ?? []).map((r: any) => ({
        id: r.q_id, subject_id: r.q_subject_id, position: r.q_position,
        prompt: r.q_prompt, options: r.q_options,
      }));
      const orderedSubjects = (subjects ?? []).sort((a, b) => sessSubs.findIndex(x => x.subject_id === a.id) - sessSubs.findIndex(x => x.subject_id === b.id));
      return {
        session,
        subjects: orderedSubjects as Subject[],
        questions: questions as Question[],
        answers: ans ?? [],
      };
    },
  });

  // Seed answers + active subject when loaded
  useEffect(() => {
    if (!data) return;
    const init: AnswerMap = {};
    for (const a of data.answers) {
      init[a.question_id] = { selected_index: a.selected_index, marked: a.marked_for_review };
    }
    setAnswers(init);
    setActiveSubject(prev => prev ?? data.subjects[0]?.id ?? null);
  }, [data]);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const session = data?.session;
  const subjects = data?.subjects ?? [];
  const allQuestions = data?.questions ?? [];

  const subjectQuestions = useMemo(
    () => {
      const limit = (session as any)?.questions_per_subject ?? 20;
      return allQuestions
        .filter(q => q.subject_id === activeSubject)
        .sort((a, b) => a.position - b.position)
        .slice(0, limit);
    },
    [allQuestions, activeSubject, session],
  );
  const currentQ = subjectQuestions[activeIdx];

  const endsAt = session ? new Date(session.started_at).getTime() + session.duration_minutes * 60_000 : 0;
  const secondsLeft = Math.max(0, Math.floor((endsAt - now) / 1000));
  const isSubmitted = session?.status === "submitted";

  // Auto-submit on timeout (fires exactly once)
  useEffect(() => {
    if (session && !isSubmitted && secondsLeft === 0 && endsAt > 0 && !autoSubmitFiredRef.current) {
      autoSubmitFiredRef.current = true;
      submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, isSubmitted]);

  // Debounced flush of answers
  useEffect(() => {
    const id = setInterval(async () => {
      if (!sessionId || upsertQueue.current.size === 0) return;
      const batch = Array.from(upsertQueue.current.entries()).map(([question_id, v]) => ({
        session_id: sessionId,
        question_id,
        subject_id: v.subject_id,
        selected_index: v.selected_index,
        marked_for_review: v.marked,
      }));
      upsertQueue.current.clear();
      await supabase.from("mock_answers").upsert(batch, { onConflict: "session_id,question_id" });
    }, 1200);
    return () => clearInterval(id);
  }, [sessionId]);

  // Flush pending writes on tab hide / unload so progress is never lost.
  useEffect(() => {
    if (!sessionId) return;
    const flush = () => {
      if (upsertQueue.current.size === 0) return;
      const batch = Array.from(upsertQueue.current.entries()).map(([question_id, v]) => ({
        session_id: sessionId,
        question_id,
        subject_id: v.subject_id,
        selected_index: v.selected_index,
        marked_for_review: v.marked,
      }));
      upsertQueue.current.clear();
      // fire-and-forget — best effort
      supabase.from("mock_answers").upsert(batch, { onConflict: "session_id,question_id" }).then(() => {});
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sessionId]);

  function setAnswer(qId: string, subjectId: string, patch: Partial<{ selected_index: number | null; marked: boolean }>) {
    setAnswers(prev => {
      const cur = prev[qId] ?? { selected_index: null, marked: false };
      const next = { ...cur, ...patch };
      upsertQueue.current.set(qId, { selected_index: next.selected_index, marked: next.marked, subject_id: subjectId });
      return { ...prev, [qId]: next };
    });
  }

  async function submit(auto = false) {
    if (!session || isSubmitted) return;
    if (submittingRef.current) return; // guard against rapid double-clicks
    submittingRef.current = true;
    setSubmitting(true);
    const toastId = toast.loading(auto ? "Time up — submitting your answers…" : "Submitting your answers…");
    try {
      // Flush pending writes (best-effort; don't block submit if it fails)
      if (upsertQueue.current.size > 0) {
        const batch = Array.from(upsertQueue.current.entries()).map(([question_id, v]) => ({
          session_id: sessionId!, question_id, subject_id: v.subject_id,
          selected_index: v.selected_index, marked_for_review: v.marked,
        }));
        upsertQueue.current.clear();
        try {
          await supabase.from("mock_answers").upsert(batch, { onConflict: "session_id,question_id" });
        } catch { /* will retry inside grading */ }
      }

      // Retry grading up to 3 times with backoff so a flaky connection doesn't lose the attempt.
      let lastErr: any = null;
      let graded: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error: gErr } = await supabase.rpc("grade_mock_session", { _session_id: sessionId!, _auto: auto });
        if (!gErr) { graded = data; lastErr = null; break; }
        lastErr = gErr;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt));
      }
      if (lastErr) throw lastErr;

      const total = graded?.total_score ?? 0;
      const totalQ = graded?.total_questions ?? allQuestions.length;
      toast.dismiss(toastId);
      toast.success(auto ? "Time up — auto-submitted" : `Submitted. Score: ${total}/${totalQ}`);
      nav(schoolPath(slug, `/app/student/mock/${sessionId}/result`));
    } catch (e: any) {
      toast.dismiss(toastId);
      // Keep the button enabled so the student can retry. Don't surface raw RPC errors.
      toast.error("Couldn't submit yet. Your answers are saved — please tap Submit again.");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  if (isLoading || !data) {
    return <div className="min-h-[60vh] grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }
  if (!session) {
    return <div className="p-8 text-center text-muted-foreground">Session not found.</div>;
  }
  if (!allQuestions.length) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-lg font-semibold">Questions couldn't load</div>
          <p className="text-sm text-muted-foreground">
            We couldn't load any questions for this session. This usually means the question bank is still syncing or your connection dropped briefly.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            <Button onClick={() => nav(schoolPath(slug, "/app/student/mock"))}>Back to mocks</Button>
          </div>
        </div>
      </div>
    );
  }

  const ModeIcon = session.mode === "neco_sim" ? Award : GraduationCap;
  const modeLabel = session.mode === "neco_sim" ? "NECO CBT Mock" : "JAMB CBT Mock";
  const activeSubjectMeta = subjects.find(s => s.id === activeSubject);
  const answeredInSubject = subjectQuestions.filter(q => answers[q.id]?.selected_index != null).length;
  const totalAnswered = allQuestions.filter(q => answers[q.id]?.selected_index != null).length;

  return (
    <ExamShell
      modeLabel={modeLabel}
      ModeIcon={ModeIcon}
      preferFullscreen={!!(session as any)?.fullscreen}
      lockdown={!!(session as any)?.lockdown}
      sessionId={sessionId}
      subjects={subjects}
      activeSubject={activeSubject}
      setActiveSubject={(id) => { setActiveSubject(id); setActiveIdx(0); }}
      activeSubjectMeta={activeSubjectMeta}
      subjectQuestions={subjectQuestions}
      answers={answers}
      activeIdx={activeIdx}
      setActiveIdx={setActiveIdx}
      answeredInSubject={answeredInSubject}
      totalAnswered={totalAnswered}
      totalQuestions={allQuestions.length}
      secondsLeft={secondsLeft}
      durationMinutes={session.duration_minutes}
      isSubmitted={isSubmitted}
      submitting={submitting}
      onSubmit={() => submit(false)}
      onForceSubmit={() => submit(true)}
      currentQ={currentQ}
      onSelect={(oi) => currentQ && setAnswer(currentQ.id, currentQ.subject_id, { selected_index: oi })}
      onToggleMark={(v) => currentQ && setAnswer(currentQ.id, currentQ.subject_id, { marked: v })}
      onNextSubject={() => {
        const i = subjects.findIndex(s => s.id === activeSubject);
        const next = subjects[i + 1];
        if (next) { setActiveSubject(next.id); setActiveIdx(0); }
        else toast.info("That was the last subject. Review or submit.");
      }}
    />
  );
}

function ExamShell(props: any) {
  const {
    modeLabel, ModeIcon, preferFullscreen, lockdown, sessionId, subjects, activeSubject, setActiveSubject, activeSubjectMeta,
    subjectQuestions, answers, activeIdx, setActiveIdx, answeredInSubject,
    totalAnswered, totalQuestions, secondsLeft, isSubmitted, submitting, onSubmit, onForceSubmit,
    currentQ, onSelect, onToggleMark, onNextSubject, durationMinutes,
  } = props;
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    if (preferFullscreen || lockdown) shellRef.current?.requestFullscreen?.().catch(() => {});
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [preferFullscreen, lockdown]);

  const { violationCount, remaining, lastWarning } = useExamLockdown({
    enabled: !!lockdown && !isSubmitted,
    sessionId,
    shellRef,
    isSubmitted,
    onForceSubmit,
  });

  function toggleFs() {
    if (lockdown && document.fullscreenElement) {
      toast.warning("Full-screen is required during proctored mode.");
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else shellRef.current?.requestFullscreen?.().catch(() => {});
  }

  // Keyboard shortcuts: A–D answer, arrows navigate, F flags.
  useEffect(() => {
    if (isSubmitted || confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (!currentQ) return;
      const opts = (currentQ.options as string[]) ?? [];
      const k = e.key.toLowerCase();
      if (k >= "a" && k <= "z") {
        const idx = k.charCodeAt(0) - 97;
        if (idx < opts.length) { e.preventDefault(); onSelect(idx); return; }
        if (k === "f") { e.preventDefault(); onToggleMark(!answers[currentQ.id]?.marked); return; }
      }
      if (k === "f") { e.preventDefault(); onToggleMark(!answers[currentQ.id]?.marked); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); setActiveIdx(Math.min(subjectQuestions.length - 1, activeIdx + 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setActiveIdx(Math.max(0, activeIdx - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentQ, answers, activeIdx, subjectQuestions.length, isSubmitted, confirmOpen, onSelect, onToggleMark, setActiveIdx]);

  const paletteItems = subjectQuestions.map((q: Question) => ({
    key: q.id,
    answered: answers[q.id]?.selected_index != null,
    flagged: !!answers[q.id]?.marked,
  }));
  const unanswered = paletteItems.map((p, i) => (p.answered ? -1 : i)).filter((i) => i >= 0);
  const flaggedIdx = paletteItems.map((p, i) => (p.flagged ? i : -1)).filter((i) => i >= 0);

  const subjectSwitcher = (
    <div className="flex flex-wrap gap-1.5">
      {subjects.map((s: any) => (
        <button key={s.id} type="button"
          onClick={() => setActiveSubject(s.id)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
            s.id === activeSubject ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40"
          )}>
          {s.name}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={shellRef} className={cn(
      "bg-background flex flex-col",
      preferFullscreen || lockdown || isFs
        ? "fixed inset-0 z-50"
        : "-mx-4 sm:-mx-6 -my-4 sm:-my-6 min-h-[calc(100vh-4rem)]",
    )}>
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur">
        <ExamCommandBar
          title={activeSubjectMeta?.name ?? modeLabel}
          subtitle={`${modeLabel} · ${totalAnswered}/${totalQuestions} answered`}
          icon={<div className="size-8 grid place-items-center rounded-md bg-primary/15 shrink-0"><ModeIcon className="size-4 text-primary" /></div>}
          badges={lockdown && !isSubmitted ? (
            <span className="ml-2 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/30">
              <ShieldCheck className="size-3" /> Proctored
            </span>
          ) : null}
          remaining={secondsLeft}
          total={Math.max(1, (durationMinutes ?? 60) * 60)}
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
                  <div className="mt-4 space-y-4">
                    {subjectSwitcher}
                    <QuestionPalette items={paletteItems} activeIndex={activeIdx} onJump={setActiveIdx} compact />
                  </div>
                </SheetContent>
              </Sheet>
              <Button size="sm" variant="ghost" onClick={toggleFs} aria-label="Toggle fullscreen" className="px-2 hidden sm:inline-flex">
                {isFs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting || isSubmitted}>
                <CheckCircle2 className="size-4 sm:mr-1.5" /> <span className="hidden sm:inline">Submit</span>
              </Button>
            </>
          }
        />
        {lockdown && lastWarning && !isSubmitted && (
          <div className="px-4 sm:px-6 py-1.5 text-[11px] flex items-center gap-1.5 bg-warning/10 text-warning border-t border-warning/30">
            <AlertTriangle className="size-3.5" />
            <span className="truncate">{lastWarning}</span>
            <span className="ml-auto font-semibold tabular-nums">{remaining} warning{remaining === 1 ? "" : "s"} left</span>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-8 sm:py-12">
            {currentQ ? (
              <QuestionCanvas
                index={activeIdx}
                total={subjectQuestions.length}
                prompt={currentQ.prompt}
                actions={
                  <button
                    type="button"
                    onClick={() => onToggleMark(!answers[currentQ.id]?.marked)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                      answers[currentQ.id]?.marked
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <Flag className="size-3.5" />
                    {answers[currentQ.id]?.marked ? "Flagged" : "Flag"}
                  </button>
                }
              >
                <OptionList
                  options={(currentQ.options as string[]) ?? []}
                  selected={answers[currentQ.id]?.selected_index}
                  onSelect={onSelect}
                  disabled={isSubmitted}
                />

                <div className="flex items-center justify-between mt-10 gap-2">
                  <Button variant="outline" size="lg" disabled={activeIdx === 0}
                    onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}>
                    ← Previous
                  </Button>
                  {activeIdx < subjectQuestions.length - 1 ? (
                    <Button size="lg" onClick={() => setActiveIdx(Math.min(subjectQuestions.length - 1, activeIdx + 1))}>
                      Next →
                    </Button>
                  ) : (
                    <Button size="lg" onClick={onNextSubject}>Next subject →</Button>
                  )}
                </div>
              </QuestionCanvas>
            ) : (
              <div className="text-muted-foreground text-center">No questions in this subject.</div>
            )}
          </div>
        </main>

        {/* Desktop right rail */}
        <aside className="hidden lg:flex w-72 shrink-0 border-l border-border bg-card/40 p-4 flex-col gap-4 overflow-y-auto">
          {subjects.length > 1 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subjects</div>
              {subjectSwitcher}
            </div>
          )}
          <QuestionPalette items={paletteItems} activeIndex={activeIdx} onJump={setActiveIdx} />
          <div className="mt-auto text-[11px] text-muted-foreground">
            {answeredInSubject} answered in this subject · {totalAnswered}/{totalQuestions} overall
          </div>
        </aside>
      </div>

      <footer className="shrink-0 border-t border-border bg-card/80">
        <div className="h-1 bg-secondary">
          <div className="h-full bg-primary transition-all"
            style={{ width: `${(totalAnswered / Math.max(1, totalQuestions)) * 100}%` }} />
        </div>
      </footer>

      <SubmitSummaryDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        total={subjectQuestions.length}
        answered={subjectQuestions.length - unanswered.length}
        unanswered={unanswered}
        flagged={flaggedIdx}
        onJump={setActiveIdx}
        onConfirm={onSubmit}
        submitting={submitting}
      />
    </div>
  );
}
