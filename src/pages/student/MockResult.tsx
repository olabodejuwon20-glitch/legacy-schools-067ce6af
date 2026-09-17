import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Award, GraduationCap, Loader2, Trophy, TrendingUp, Target, ArrowLeft, BookOpenCheck, Sparkles, ShieldCheck, ShieldAlert, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { AIMarkdown } from "@/components/ai/AIMarkdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getRetakePolicy, formatRetakeCountdown, MAX_STRIKES } from "@/lib/examRetake";

export default function MockResult() {
  const { sessionId, slug } = useParams<{ sessionId: string; slug: string }>();
  const { school } = useSchool();
  const nav = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [integrity, setIntegrity] = useState<{ strikes: number; lockdown: boolean; submitted_at: string | null } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data, error }, { data: sess }] = await Promise.all([
          supabase.functions.invoke("mock-result-summary", { body: { session_id: sessionId } }),
          supabase.from("mock_sessions")
            .select("integrity_events, lockdown, submitted_at")
            .eq("id", sessionId).maybeSingle(),
        ]);
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setSummary(data);
        setIntegrity({
          strikes: Array.isArray((sess as any)?.integrity_events) ? (sess as any).integrity_events.length : 0,
          lockdown: !!(sess as any)?.lockdown,
          submitted_at: (sess as any)?.submitted_at ?? null,
        });
      } catch (e: any) {
        toast.error(e?.message || "Failed to load result");
      } finally { setLoading(false); }
    })();
  }, [sessionId]);

  if (loading) {
    return <div className="min-h-[60vh] grid place-items-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (!summary) {
    return <div className="p-8 text-center text-muted-foreground">No result available.</div>;
  }

  const ModeIcon = summary.mode === "jamb_sim" ? GraduationCap : Award;
  const modeLabel = summary.mode === "jamb_sim" ? "JAMB CBT Mock" : "NECO CBT Mock";
  const pct = summary.percentage as number;
  const band = pct >= 70 ? { tone: "text-success", bar: "bg-success", soft: "bg-success/10", verdict: "Excellent" }
    : pct >= 50 ? { tone: "text-primary", bar: "bg-primary", soft: "bg-primary/10", verdict: "Good effort" }
    : pct >= 40 ? { tone: "text-warning", bar: "bg-warning", soft: "bg-warning/10", verdict: "Keep pushing" }
    : { tone: "text-destructive", bar: "bg-destructive", soft: "bg-destructive/10", verdict: "More practice needed" };

  const avgPerSubject = Math.round(
    summary.per_subject.reduce((a: number, b: any) => a + b.percentage, 0) / Math.max(1, summary.per_subject.length)
  );

  const policy = getRetakePolicy({
    strikes: integrity?.strikes ?? 0,
    submittedAt: integrity?.submitted_at ?? null,
    lockdown: !!integrity?.lockdown,
  });
  const PolicyIcon = policy.status === "locked" ? Lock : policy.status === "cooldown" ? Clock : ShieldCheck;
  const toneClasses = {
    success: { bg: "bg-success/5", border: "border-success/30", text: "text-success", fill: "bg-success" },
    warning: { bg: "bg-warning/5", border: "border-warning/30", text: "text-warning", fill: "bg-warning" },
    destructive: { bg: "bg-destructive/5", border: "border-destructive/30", text: "text-destructive", fill: "bg-destructive" },
  }[policy.tone];

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10 px-1">
      {/* Compact performance card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-primary/15 grid place-items-center shrink-0">
              <ModeIcon className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mock Result</div>
              <h1 className="font-display font-bold text-base sm:text-lg truncate">{modeLabel}</h1>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">Practice only</Badge>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className={cn("font-display text-3xl sm:text-4xl font-bold leading-none", band.tone)}>{pct}%</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-medium">{band.verdict}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Overall</div>
            <div className="text-sm font-semibold tabular-nums mt-0.5">{summary.total_score}/{summary.total_questions}</div>
          </div>
        </div>
        <div className={cn("h-2 rounded-full overflow-hidden", band.soft)}>
          <div className={cn("h-full rounded-full transition-all", band.bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Equal-sized stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile icon={Trophy} label="Score" value={`${summary.total_score}/${summary.total_questions}`} />
        <StatTile icon={Target} label="Subjects" value={String(summary.per_subject.length)} />
        {summary.jamb_projection != null
          ? <StatTile icon={TrendingUp} label="Projected JAMB" value={`${summary.jamb_projection}/400`} />
          : <StatTile icon={TrendingUp} label="Avg / Subject" value={`${avgPerSubject}%`} />}
      </div>

      {/* Exam-integrity & retake policy */}
      {integrity?.lockdown && (
        <div className={cn("rounded-2xl border p-4 sm:p-5", toneClasses.bg, toneClasses.border)}>
          <div className="flex items-start gap-3">
            <div className={cn("size-10 rounded-xl grid place-items-center shrink-0 bg-background border", toneClasses.border)}>
              {policy.status === "locked"
                ? <ShieldAlert className={cn("size-5", toneClasses.text)} />
                : <PolicyIcon className={cn("size-5", toneClasses.text)} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Exam integrity</div>
                  <div className={cn("font-display font-bold text-base sm:text-lg", toneClasses.text)}>{policy.headline}</div>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {policy.strikes}/{MAX_STRIKES} warnings used
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{policy.message}</p>
              <div className="flex items-center gap-1.5 mt-3">
                {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < policy.strikes ? toneClasses.fill : "bg-secondary")} />
                ))}
              </div>
              {policy.retakeAt && (
                <div className="mt-3 text-xs flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  Retake unlocks {formatRetakeCountdown(policy.retakeAt)}
                  {policy.requiresTeacherOverride && " — or sooner with a teacher's approval"}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-subject */}
      <SectionCard title="Subject breakdown" description="How you did in each paper">
        <div className="space-y-3">
          {summary.per_subject.map((s: any) => (
            <div key={s.id} className="rounded-xl border border-border bg-card shadow-sm p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="font-semibold text-sm truncate">{s.name}</div>
                </div>
                <span className="tabular-nums text-sm font-bold shrink-0">{s.score}/{s.total}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${s.percentage}%`, background: s.color }} />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                <span className="font-semibold tabular-nums">{s.percentage}%</span>
                <span>{s.answered} answered</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Per-topic accuracy */}
      {Array.isArray(summary.per_topic) && summary.per_topic.length > 0 && (
        <SectionCard title="Topic accuracy" description="Weakest topics first — start your revision at the top">
          <div className="space-y-3">
            {summary.per_topic.map((t: any) => {
              const tone = t.percentage >= 70 ? "bg-success" : t.percentage >= 40 ? "bg-warning" : "bg-destructive";
              return (
                <div key={`${t.subject}-${t.topic}`} className="rounded-xl border border-border bg-card shadow-sm p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{t.topic}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{t.subject}</div>
                    </div>
                    <span className="tabular-nums text-sm font-bold shrink-0">{t.correct}/{t.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                    <div className={cn("h-full", tone)} style={{ width: `${t.percentage}%` }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold tabular-nums">{t.percentage}%</span>
                    <span className="text-success">{t.correct} right</span>
                    <span className="text-destructive">{t.wrong} wrong</span>
                    {t.skipped > 0 && <span>{t.skipped} skipped</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* AI summary */}
      <SectionCard title="AI coach analysis" description="Personalised feedback to guide your next study session">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-student/15 grid place-items-center shrink-0">
            <Sparkles className="size-4 text-student" />
          </div>
          <div className="flex-1 min-w-0">
            <AIMarkdown content={summary.markdown} />
          </div>
        </div>
      </SectionCard>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => nav(schoolPath(slug, "/app/student/mock"))}>
          <ArrowLeft className="size-4 mr-1.5" /> Back to mocks
        </Button>
        <Button className="w-full sm:w-auto" onClick={() => nav(schoolPath(slug, `/app/student/review?session=${sessionId}`))}>
          <BookOpenCheck className="size-4 mr-1.5" /> Review every question with AI
        </Button>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-3 min-h-[88px] flex flex-col justify-between">
      <Icon className="size-4 text-muted-foreground" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{label}</div>
        <div className="font-display font-bold text-sm sm:text-base mt-0.5 tabular-nums">{value}</div>
      </div>
    </div>
  );
}