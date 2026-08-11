import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, GraduationCap, Loader2, Play, Sparkles, History, BookOpenCheck, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Maximize2, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getRetakePolicy, formatRetakeCountdown, MAX_STRIKES } from "@/lib/examRetake";
import { Lock, Clock } from "lucide-react";

type Mode = "neco_sim" | "jamb_sim";
const RULES: Record<Mode, { label: string; pick: number; minutes: number; icon: any; locked?: string }> = {
  neco_sim: { label: "NECO Mock", pick: 9, minutes: 150, icon: Award },
  jamb_sim: { label: "JAMB Mock", pick: 4, minutes: 120, icon: GraduationCap, locked: "english" },
};

export default function MockPicker() {
  const { school, user } = useSchool();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const initialMode: Mode = params.get("body") === "jamb" ? "jamb_sim" : "neco_sim";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);
  const [useReal, setUseReal] = useState(true);
  const [perSubject, setPerSubject] = useState<number>(20);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [lockdown, setLockdown] = useState<boolean>(false);

  // JAMB defaults to proctored lockdown; NECO defaults off
  useEffect(() => {
    setLockdown(mode === "jamb_sim");
    setFullscreen(mode === "jamb_sim");
  }, [mode]);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["mock-subjects", school?.id],
    enabled: !!school,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_subjects")
        .select("id, code, name, exam_body, color, sort")
        .eq("school_id", school!.id)
        .order("sort");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["mock-sessions", school?.id, user?.id],
    enabled: !!school && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_sessions")
        .select("id, mode, started_at, submitted_at, total_score, total_questions, status, lockdown, integrity_events")
        .eq("school_id", school!.id)
        .eq("student_id", user!.id)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Retake gate: look at the most recent submitted lockdown session in this mode
  const retakeGate = useMemo(() => {
    const last = (sessions ?? [])
      .filter((s: any) => s.mode === mode && s.status !== "in_progress" && s.lockdown && s.submitted_at)
      .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];
    if (!last) return null;
    const strikes = Array.isArray((last as any).integrity_events) ? (last as any).integrity_events.length : 0;
    return getRetakePolicy({ strikes, submittedAt: (last as any).submitted_at, lockdown: true });
  }, [sessions, mode]);

  const filtered = useMemo(() => {
    if (!subjects) return [];
    if (mode === "jamb_sim") return subjects.filter(s => ["english","math","physics","chemistry","biology","economics","government","literature"].includes(s.code));
    return subjects;
  }, [subjects, mode]);

  const rule = RULES[mode];
  const lockedId = useMemo(() => filtered.find(s => s.code === rule.locked)?.id, [filtered, rule.locked]);

  // Reset on mode change; pre-select locked subject for JAMB
  useEffect(() => {
    const init: Record<string, boolean> = {};
    if (lockedId) init[lockedId] = true;
    setSelected(init);
  }, [mode, lockedId]);

  const chosenCount = Object.values(selected).filter(Boolean).length;

  function toggle(id: string) {
    if (id === lockedId) return;
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) { delete next[id]; return next; }
      if (chosenCount >= rule.pick) {
        toast.error(`You can only pick ${rule.pick} subjects for ${rule.label}`);
        return prev;
      }
      next[id] = true;
      return next;
    });
  }

  async function start() {
    if (!school || !user) return;
    if (lockdown && retakeGate && !retakeGate.canRetakeNow) {
      toast.error(retakeGate.headline + " — retake unlocks " + formatRetakeCountdown(retakeGate.retakeAt));
      return;
    }
    if (chosenCount !== rule.pick) {
      toast.error(`Pick exactly ${rule.pick} subjects to begin.`);
      return;
    }
    setStarting(true);
    try {
      const selectedIds = Object.keys(selected).filter(id => selected[id]);
      if (useReal) {
        toast.loading("Loading real past questions…", { id: "aloc" });
        // Hard 25s timeout so a slow ALOC fetch can never freeze the Start button.
        const fetchWithTimeout = new Promise<any>((resolve) => {
          let done = false;
          const t = setTimeout(() => { if (!done) { done = true; resolve({ timeout: true }); } }, 25_000);
          supabase.functions
            .invoke("fetch-aloc-questions", { body: { school_id: school.id, mode, subject_ids: selectedIds } })
            .then((r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } })
            .catch((err) => { if (!done) { done = true; clearTimeout(t); resolve({ error: err }); } });
        });
        const fr: any = await fetchWithTimeout;
        toast.dismiss("aloc");
        if (fr?.timeout) {
          toast.warning("Real past questions took too long — using the practice bank instead.");
        } else if (fr?.error || fr?.data?.error) {
          toast.warning("Couldn't load real past questions — using practice bank.");
        } else {
          const n = fr?.data?.inserted ?? 0;
          if (n > 0) toast.success(`${n} real past questions loaded.`);
        }
      }

      // Safety check — make sure every selected subject actually has questions available.
      // Without this, the session opens to a blank "0/0" screen which feels broken.
      const { data: availability, error: availErr } = await supabase
        .from("mock_questions")
        .select("subject_id")
        .in("subject_id", selectedIds)
        .limit(2000);
      if (!availErr) {
        const counts = new Map<string, number>();
        for (const r of availability ?? []) {
          counts.set((r as any).subject_id, (counts.get((r as any).subject_id) ?? 0) + 1);
        }
        const empty = selectedIds.filter((id) => (counts.get(id) ?? 0) === 0);
        if (empty.length) {
          const names = (subjects ?? [])
            .filter((s: any) => empty.includes(s.id))
            .map((s: any) => s.name)
            .join(", ");
          toast.error(`No questions available yet for: ${names}. Please pick a different subject or try again in a moment.`);
          return;
        }
      }

      const { data: session, error } = await supabase
        .from("mock_sessions")
        .insert({
          school_id: school.id,
          student_id: user.id,
          mode,
          duration_minutes: rule.minutes,
          total_questions: chosenCount * perSubject,
          questions_per_subject: perSubject,
          fullscreen: fullscreen || lockdown,
          lockdown,
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = selectedIds.map((subject_id, idx) => ({ session_id: session.id, subject_id, sort: idx }));
      const { error: e2 } = await supabase.from("mock_session_subjects").insert(rows);
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["mock-sessions"] });
      nav(schoolPath(school.slug, `/app/student/mock/${session.id}`));
    } catch (e: any) {
      toast.error("Couldn't start the mock right now. Please check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="NECO / JAMB Mock"
        description="Practice real exam conditions. Choose your subjects, then sit a timed UTME-style session."
      />

      <Tabs value={mode} onValueChange={v => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="neco_sim"><Award className="size-3.5 mr-1.5" /> NECO (pick 9)</TabsTrigger>
          <TabsTrigger value="jamb_sim"><GraduationCap className="size-3.5 mr-1.5" /> JAMB (pick 4)</TabsTrigger>
        </TabsList>

        <TabsContent value={mode} className="mt-4">
          <SectionCard
            title={`Select your ${rule.pick} subjects`}
            description={mode === "jamb_sim"
              ? "English Language is compulsory. Choose 3 more electives."
              : "Choose any 9 NECO subjects. Each carries 20 questions."}
            action={
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wifi className="size-3.5" />
                  <span className="hidden sm:inline">Real past questions</span>
                  <Switch checked={useReal} onCheckedChange={setUseReal} />
                </label>
                <Button onClick={start} disabled={starting || chosenCount !== rule.pick || (lockdown && !!retakeGate && !retakeGate.canRetakeNow)}>
                  {starting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
                  Start ({chosenCount}/{rule.pick})
                </Button>
              </div>
            }
          >
            {lockdown && retakeGate && !retakeGate.canRetakeNow && (
              <div className={cn(
                "mb-4 rounded-xl border p-3 flex items-start gap-3",
                retakeGate.status === "locked" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5",
              )}>
                {retakeGate.status === "locked"
                  ? <Lock className="size-4 mt-0.5 text-destructive shrink-0" />
                  : <Clock className="size-4 mt-0.5 text-warning shrink-0" />}
                <div className="text-xs">
                  <div className="font-semibold">{retakeGate.headline}</div>
                  <div className="text-muted-foreground mt-0.5">{retakeGate.message}</div>
                  <div className="text-muted-foreground mt-1">Next attempt {formatRetakeCountdown(retakeGate.retakeAt)} ({retakeGate.strikes}/{MAX_STRIKES} warnings used).</div>
                </div>
              </div>
            )}

            {/* Exam controls */}
            <div className="mb-4 grid sm:grid-cols-2 gap-4 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questions per subject</label>
                  <span className="text-sm font-bold tabular-nums">{perSubject}</span>
                </div>
                <Slider value={[perSubject]} min={5} max={20} step={5} onValueChange={(v) => setPerSubject(v[0] ?? 20)} />
                <p className="text-[11px] text-muted-foreground mt-1.5">Total: {chosenCount * perSubject || rule.pick * perSubject} questions across {rule.pick} subjects.</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" /> Proctored lockdown
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      JAMB-style: full-screen enforced, copy/paste &amp; right-click blocked, tab-switches logged.
                      Strike rules: <strong>2</strong> = 1-hour cooldown, <strong>3</strong> = 24-hour cooldown,
                      <strong> 4</strong> = exam auto-submits and you&apos;re locked out for 7 days unless your teacher unlocks it.
                    </p>
                  </div>
                  <Switch checked={lockdown} onCheckedChange={setLockdown} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Maximize2 className="size-3.5" /> Start in full‑screen
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{lockdown ? "Always on in proctored mode." : "You decide when to go distraction‑free."}</p>
                  </div>
                  <Switch checked={fullscreen || lockdown} disabled={lockdown} onCheckedChange={setFullscreen} />
                </div>
              </div>
            </div>

            {/* Pre-flight readiness */}
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-flight check</div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="tabular-nums"><strong>{chosenCount || 0}</strong>/{rule.pick} subjects</span>
                  <span className="tabular-nums"><strong>{(chosenCount || rule.pick) * perSubject}</strong> questions</span>
                  <span className="tabular-nums"><strong>{rule.minutes}</strong> min</span>
                </div>
              </div>
              <ul className="mt-3 grid sm:grid-cols-3 gap-2 text-xs">
                <ReadyItem ok={chosenCount === rule.pick} label={chosenCount === rule.pick ? "Subjects selected" : `Pick ${rule.pick - chosenCount} more subject(s)`} />
                <ReadyItem ok={typeof navigator !== "undefined" ? navigator.onLine : true} label="Connection stable" />
                <ReadyItem ok={fullscreen || lockdown} label={fullscreen || lockdown ? "Full-screen enabled" : "Full-screen off (optional)"} />
              </ul>
            </div>

            {isLoading ? (
              <div className="py-10 grid place-items-center text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map(s => {
                  const on = !!selected[s.id];
                  const locked = s.id === lockedId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={cn(
                        "text-left rounded-xl border p-3 transition-all relative overflow-hidden",
                        on ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-secondary/40",
                        locked && "opacity-95",
                      )}
                    >
                      <div className="h-1 w-12 rounded-full mb-2" style={{ background: s.color }} />
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">20 questions</div>
                      {locked && <Badge variant="secondary" className="absolute top-2 right-2 text-[9px]">Compulsory</Badge>}
                      {on && !locked && <Badge className="absolute top-2 right-2 text-[9px]">Selected</Badge>}
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <SectionCard title="Recent sessions" description="Your past mock attempts.">
        {!sessions?.length ? (
          <EmptyState icon={History} title="No sessions yet" desc="Your past attempts will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map(s => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.mode === "neco_sim" ? "NECO Mock" : "JAMB Mock"}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(s.started_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  {s.status === "in_progress" ? (
                    <Badge variant="secondary">In progress</Badge>
                  ) : (
                    <span className="text-sm font-semibold">{s.total_score ?? 0}/{s.total_questions ?? "—"}</span>
                  )}
                  <Button size="sm" variant={s.status === "in_progress" ? "default" : "outline"}
                    onClick={() => nav(schoolPath(school?.slug, `/app/student/mock/${s.id}`))}>
                    {s.status === "in_progress" ? "Resume" : "Review"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Want low-pressure practice?" description="Use Practice Mode to study your library and your own uploads — no timer, no score." action={
        <Button variant="outline" onClick={() => nav(schoolPath(school?.slug, "/app/student/practice"))}>
          <Sparkles className="size-3.5 mr-1.5" /> Open Practice Mode
        </Button>
      }>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <BookOpenCheck className="size-4" /> Practice mode reads from your School Library and your personal uploads.
        </div>
      </SectionCard>
    </div>
  );
}

function ReadyItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2",
      ok ? "border-success/30 bg-success/5 text-success" : "border-border text-muted-foreground",
    )}>
      <span className={cn("size-1.5 rounded-full", ok ? "bg-success" : "bg-muted-foreground/50")} />
      {label}
    </li>
  );
}
