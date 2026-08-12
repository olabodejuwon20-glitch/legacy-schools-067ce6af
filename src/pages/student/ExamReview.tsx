import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, ChevronDown, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { schoolPath } from "@/lib/tenant";
import { toast } from "sonner";
import { AIMarkdown } from "@/components/ai/AIMarkdown";

interface Row {
  q_id: string; q_position: number; q_prompt: string; q_options: any;
  q_correct_index: number; q_selected_index: number | null; q_is_correct: boolean;
  q_explanation?: string | null;
}

export default function ExamReview() {
  const [params] = useSearchParams();
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { school } = useSchool();
  const attemptId = params.get("attempt");
  const sessionId = params.get("session");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "wrong" | "correct">("all");

  useEffect(() => {
    (async () => {
      try {
        if (attemptId) {
          const { data, error } = await supabase.rpc("get_exam_review", { _attempt_id: attemptId });
          if (error) throw error;
          setRows((data ?? []) as Row[]);
        } else if (sessionId) {
          const { data, error } = await supabase.rpc("get_mock_review", { _session_id: sessionId });
          if (error) throw error;
          setRows((data ?? []) as Row[]);
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to load review");
      } finally { setLoading(false); }
    })();
  }, [attemptId, sessionId]);

  async function explain(r: Row) {
    if (explanations[r.q_id] || !school) return;
    setPending(p => ({ ...p, [r.q_id]: true }));
    try {
      const opts = Array.isArray(r.q_options) ? r.q_options : [];
      const prompt = `Question: ${r.q_prompt}
Options: ${opts.map((o: any, i: number) => `${String.fromCharCode(65 + i)}) ${o}`).join("  ")}
Correct answer: ${String.fromCharCode(65 + r.q_correct_index)}
Student picked: ${r.q_selected_index == null ? "nothing" : String.fromCharCode(65 + r.q_selected_index)}
Explain in 3-5 sentences why the correct answer is right and (if wrong) why the student's choice is wrong. Be encouraging.`;
      // ensure a conversation exists for ad-hoc explanations
      const { data: conv } = await supabase.from("ai_conversations").insert({
        school_id: school.id, user_id: (await supabase.auth.getUser()).data.user!.id, title: "Exam review",
      }).select("id").single();
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: {
          conversation_id: conv!.id, school_id: school.id, role: "student",
          skill: "quiz", skill_input: { topic: "explanation" }, message: prompt,
        },
      });
      if (error) throw error;
      setExplanations(e => ({ ...e, [r.q_id]: data?.reply || "No explanation available." }));
    } catch (e: any) {
      toast.error(e?.message || "AI explanation failed");
    } finally {
      setPending(p => ({ ...p, [r.q_id]: false }));
    }
  }

  const correct = rows.filter(r => r.q_is_correct).length;
  const total = rows.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const visible = rows.filter(r => filter === "all" || (filter === "wrong" ? !r.q_is_correct : r.q_is_correct));

  if (loading) return <div className="py-20 grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => nav(schoolPath(slug, "/app/student"))}>
          <ArrowLeft className="size-4 mr-1.5" /> Back
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold">Answer review</h1>
          <p className="text-sm text-muted-foreground">{correct} of {total} correct ({pct}%)</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex items-center gap-5">
        <div className="relative size-20 shrink-0 grid place-items-center">
          <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round"
              stroke={pct >= 50 ? "hsl(var(--success))" : "hsl(var(--destructive))"}
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
          </svg>
          <span className="absolute text-lg font-bold tabular-nums">{pct}%</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-2">Performance</div>
          <div className="flex flex-wrap gap-2">
            {(["all", "wrong", "correct"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40",
                )}>
                {f === "all" ? `All (${total})` : f === "wrong" ? `Wrong (${total - correct})` : `Correct (${correct})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">No questions found.</p>}

      <ol className="space-y-4">
        {visible.map((r, i) => {
          const opts = Array.isArray(r.q_options) ? r.q_options : [];
          const open = openId === r.q_id;
          return (
            <li key={r.q_id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-mono text-muted-foreground pt-1">{i + 1}.</span>
                <p className="flex-1 text-sm font-medium">{r.q_prompt}</p>
                {r.q_is_correct
                  ? <CheckCircle2 className="size-5 text-success shrink-0" />
                  : <XCircle className="size-5 text-destructive shrink-0" />}
              </div>
              <ul className="space-y-1.5 ml-7">
                {opts.map((o: any, oi: number) => {
                  const isCorrect = oi === r.q_correct_index;
                  const isPicked = oi === r.q_selected_index;
                  return (
                    <li key={oi} className={cn(
                      "rounded-lg px-3 py-2 text-sm border flex items-center gap-2",
                      isCorrect && "border-success/40 bg-success/10",
                      !isCorrect && isPicked && "border-destructive/40 bg-destructive/10",
                      !isCorrect && !isPicked && "border-border",
                    )}>
                      <span className="font-mono text-xs opacity-70">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{String(o)}</span>
                      {isCorrect && <span className="text-[10px] uppercase font-semibold text-success">Correct</span>}
                      {!isCorrect && isPicked && <span className="text-[10px] uppercase font-semibold text-destructive">Your pick</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 ml-7">
                <button onClick={() => { setOpenId(open ? null : r.q_id); if (!open) explain(r); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <Sparkles className="size-3.5" />
                  {open ? "Hide explanation" : "Why?"}
                  <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="mt-2 rounded-lg bg-secondary/60 p-3 text-sm">
                    {r.q_explanation && !explanations[r.q_id] && (
                      <div className="mb-2"><AIMarkdown content={r.q_explanation} compact /></div>
                    )}
                    {pending[r.q_id] ? (
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Thinking…</div>
                    ) : explanations[r.q_id] ? (
                      <AIMarkdown content={explanations[r.q_id]} compact />
                    ) : !r.q_explanation && (
                      <div className="text-muted-foreground">Tap "Why?" again to get AI explanation.</div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}