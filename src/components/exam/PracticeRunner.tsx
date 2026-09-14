import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Flag, Infinity as InfinityIcon, Loader2, ListChecks, RotateCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { QuestionCanvas } from "@/components/exam/QuestionCanvas";
import { QuestionPalette } from "@/components/exam/QuestionPalette";
import { Math as MathText } from "@/components/exam/Math";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PQ = { id: string; prompt: string; options: string[]; topic: string | null; position: number };
type Feedback = { selected: number; isCorrect: boolean; correctIndex: number; explanation: string | null };

interface Props {
  subject: { id: string; name: string; color?: string | null };
  limit?: number;
  onExit: () => void;
}

/** Untimed study runner: same question canvas as the CBT, no countdown, instant feedback. */
export function PracticeRunner({ subject, limit = 20, onExit }: Props) {
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["practice-questions", subject.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_mock_practice_questions", {
        _subject_id: subject.id,
        _limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.q_id,
        prompt: r.q_prompt,
        options: Array.isArray(r.q_options) ? r.q_options : [],
        topic: r.q_topic ?? null,
        position: r.q_position,
      })) as PQ[];
    },
  });

  const current = questions[idx];

  const paletteItems = useMemo(
    () => questions.map(q => ({ key: q.id, answered: !!feedback[q.id], flagged: !!flagged[q.id] })),
    [questions, feedback, flagged],
  );
  const attempted = Object.keys(feedback).length;
  const correct = Object.values(feedback).filter(f => f.isCorrect).length;

  async function answer(optionIndex: number) {
    if (!current || feedback[current.id] || checking) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc("check_mock_answer", {
        _question_id: current.id,
        _selected: optionIndex,
      });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      setFeedback(prev => ({
        ...prev,
        [current.id]: {
          selected: optionIndex,
          isCorrect: !!row?.is_correct,
          correctIndex: row?.correct_index ?? -1,
          explanation: row?.explanation ?? null,
        },
      }));
    } catch {
      toast.error("Couldn't check that answer — try again.");
    } finally {
      setChecking(false);
    }
  }

  // Keyboard: A–D to answer, arrows to move, F to flag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (!current) return;
      const k = e.key.toLowerCase();
      if (k === "f") { e.preventDefault(); setFlagged(p => ({ ...p, [current.id]: !p[current.id] })); return; }
      if (k >= "a" && k <= "z") {
        const i = k.charCodeAt(0) - 97;
        if (i < current.options.length) { e.preventDefault(); answer(i); return; }
      }
      if (e.key === "ArrowRight") { e.preventDefault(); setIdx(i => Math.min(questions.length - 1, i + 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, questions.length, checking, feedback]);

  if (isLoading) {
    return <div className="min-h-[40vh] grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }

  if (!questions.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
        <div className="font-semibold">No practice questions yet for {subject.name}</div>
        <p className="text-sm text-muted-foreground">Your school hasn't loaded a question bank for this subject yet.</p>
        <Button variant="outline" onClick={onExit}><ArrowLeft className="size-4 mr-1.5" /> Back to subjects</Button>
      </div>
    );
  }

  const fb = current ? feedback[current.id] : undefined;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 h-14 border-b border-border bg-card/80">
        <Button size="sm" variant="ghost" className="px-2" onClick={onExit} aria-label="Back to subjects">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 leading-tight">
          <div className="font-semibold text-sm truncate flex items-center gap-2">
            {subject.color && <span className="size-2.5 rounded-full shrink-0" style={{ background: subject.color }} />}
            {subject.name}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <InfinityIcon className="size-3" /> No timer · {correct}/{attempted || 0} correct so far
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="px-2.5 lg:hidden" aria-label="Question navigator">
                <ListChecks className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader><SheetTitle>Questions</SheetTitle></SheetHeader>
              <div className="mt-4">
                <QuestionPalette items={paletteItems} activeIndex={idx} onJump={setIdx} compact />
              </div>
            </SheetContent>
          </Sheet>
          <Button size="sm" variant="outline" onClick={() => { setFeedback({}); setFlagged({}); setIdx(0); }}>
            <RotateCcw className="size-4 sm:mr-1.5" /><span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </div>

      <div className="flex">
        <div className="flex-1 min-w-0 px-4 py-7 sm:py-10">
          {current && (
            <QuestionCanvas
              index={idx}
              total={questions.length}
              prompt={current.prompt}
              meta={current.topic ? <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium">{current.topic}</span> : null}
              actions={
                <button
                  type="button"
                  onClick={() => setFlagged(p => ({ ...p, [current.id]: !p[current.id] }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                    flagged[current.id] ? "border-warning/40 bg-warning/10 text-warning" : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <Flag className="size-3.5" /> {flagged[current.id] ? "Flagged" : "Flag"}
                </button>
              }
            >
              <div className="space-y-3">
                {current.options.map((opt, oi) => {
                  const chosen = fb?.selected === oi;
                  const isAnswer = fb && fb.correctIndex === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!!fb || checking}
                      onClick={() => answer(oi)}
                      className={cn(
                        "w-full text-left rounded-xl border px-4 py-4 transition-all flex items-center gap-3.5",
                        isAnswer && "border-success bg-success/10",
                        chosen && !fb?.isCorrect && "border-destructive bg-destructive/10",
                        !fb && "border-border hover:border-primary/40 hover:bg-secondary/40",
                        fb && !isAnswer && !chosen && "border-border opacity-70",
                      )}
                    >
                      <span className={cn(
                        "size-9 grid place-items-center rounded-full text-sm font-semibold border shrink-0",
                        isAnswer ? "bg-success text-success-foreground border-success"
                          : chosen ? "bg-destructive text-destructive-foreground border-destructive"
                          : "bg-background border-border text-muted-foreground",
                      )}>
                        {isAnswer ? <Check className="size-4" /> : chosen ? <X className="size-4" /> : String.fromCharCode(65 + oi)}
                      </span>
                      <MathText className="text-sm sm:text-base break-words flex-1">{opt}</MathText>
                    </button>
                  );
                })}
              </div>

              {fb && (
                <div className={cn(
                  "mt-5 rounded-xl border p-4",
                  fb.isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
                )}>
                  <div className={cn("text-sm font-semibold", fb.isCorrect ? "text-success" : "text-destructive")}>
                    {fb.isCorrect ? "Correct" : "Not quite"}
                  </div>
                  {fb.explanation && (
                    <MathText className="block mt-1.5 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {fb.explanation}
                    </MathText>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-8 gap-2">
                <Button variant="outline" size="lg" disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))}>
                  ← Previous
                </Button>
                <Button size="lg" disabled={idx >= questions.length - 1}
                  onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}>
                  Next →
                </Button>
              </div>
            </QuestionCanvas>
          )}
        </div>

        <aside className="hidden lg:block w-64 shrink-0 border-l border-border bg-card/40 p-4">
          <QuestionPalette items={paletteItems} activeIndex={idx} onJump={setIdx} />
          <div className="mt-4 text-[11px] text-muted-foreground">
            {attempted} attempted · {correct} correct
          </div>
        </aside>
      </div>
    </div>
  );
}
