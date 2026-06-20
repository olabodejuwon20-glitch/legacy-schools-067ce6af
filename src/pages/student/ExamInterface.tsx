import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ListChecks, AlertTriangle, Clock, Maximize2, Video, Award, GraduationCap, Sparkles,
  CheckCircle2, LogOut, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, ShieldCheck,
  User as UserIcon, BookOpen, Layers, Timer, Trophy, BookMarked, ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { countFaces, faceDetectorAvailable, speakWarning } from "@/lib/proctorVision";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useModuleConfig } from "@/modules/useModules";
import { Math as MathText } from "@/components/exam/Math";
import { TimerRing } from "@/components/exam/TimerRing";
import { cn } from "@/lib/utils";

const LS_KEY = (attemptId: string) => `cbt:attempt:${attemptId}`;

type LocalDraft = {
  answers: Record<string, number>;
  marked: Record<string, boolean>;
  spent: Record<string, number>; // seconds per question
  current: number;
  savedAt: number;
};

function loadLocalDraft(attemptId: string): LocalDraft | null {
  try { const raw = localStorage.getItem(LS_KEY(attemptId)); return raw ? JSON.parse(raw) as LocalDraft : null; }
  catch { return null; }
}
function saveLocalDraft(attemptId: string, draft: LocalDraft) {
  try { localStorage.setItem(LS_KEY(attemptId), JSON.stringify(draft)); } catch { /* quota */ }
}
function clearLocalDraft(attemptId: string) {
  try { localStorage.removeItem(LS_KEY(attemptId)); } catch { /* noop */ }
}

// Deterministic shuffle seeded by attempt_id so order is stable per student
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface CbtConfig {
  webcamProctoring?: boolean;
  randomizeQuestions?: boolean;
  violationLimit?: number;
  showAnswersAfterEach?: boolean;
  autoSubmitOnTimeout?: boolean;
}

export default function ExamInterface() {
  const { school, user, displayName } = useSchool();
  const cfg = useModuleConfig<CbtConfig>(school?.id, "cbt") ?? {};

  const [exams, setExams] = useState<any[]>([]);
  const [tab, setTab] = useState<"neco_sim" | "jamb_sim" | "school" | "practice">("school");
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [violations, setViolations] = useState<number>(0);
  const [violationLimit, setViolationLimit] = useState<number>(3);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const faceTimerRef = useRef<number | null>(null);
  const snapNowRef = useRef<(() => Promise<void>) | null>(null);
  const [proctorOn, setProctorOn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [summary, setSummary] = useState<{ score: number; answered: number; total: number; durationSec: number } | null>(null);
  const [breakdown, setBreakdown] = useState<{ id: string; prompt: string; pickedIdx: number | null; correctIdx: number; isCorrect: boolean; points: number }[]>([]);
  // Per-question time tracking
  const [spent, setSpent] = useState<Record<string, number>>({});
  const focusStartRef = useRef<number>(Date.now());
  const isPractice = activeExam?.mode === "practice";

  useEffect(() => {
    if (!school) return;
    supabase.from("exams").select("*").eq("school_id", school.id).in("status", ["scheduled", "active"]).then(({ data }) => setExams(data ?? []));
  }, [school]);

  async function start(exam: any) {
    if (!user || !school) return;
    const { data: a, error } = await supabase.from("exam_attempts").insert({ exam_id: exam.id, school_id: school.id, student_id: user.id }).select("id").single();
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    let attempt = a;
    if (!attempt) {
      const { data: existing } = await supabase.from("exam_attempts").select("id,started_at,submitted_at").eq("exam_id", exam.id).eq("student_id", user.id).single();
      if (existing?.submitted_at) { toast.error("You have already submitted this exam."); return; }
      attempt = existing!;
    }
    setAttemptId(attempt.id);
    const { data: qsRaw } = await supabase.rpc("get_exam_questions_for_attempt", { _attempt_id: attempt.id });
    let list = (qsRaw ?? []).map((r: any) => ({
      id: r.q_id, exam_id: r.q_exam_id, school_id: r.q_school_id,
      prompt: r.q_prompt, options: r.q_options, points: r.q_points, position: r.q_position,
    }));
    const shouldShuffle = exam.randomize ?? cfg.randomizeQuestions ?? false;
    if (shouldShuffle) list = seededShuffle(list, attempt.id);
    setQuestions(list);

    // Load any previously saved answers + review marks (resume)
    const { data: prior } = await supabase.from("exam_answers").select("question_id,selected_index,marked_for_review").eq("attempt_id", attempt.id);
    const restored: Record<string, number> = {};
    const markedRestored: Record<string, boolean> = {};
    (prior ?? []).forEach((r: any) => {
      if (r.selected_index !== null) restored[r.question_id] = r.selected_index;
      if (r.marked_for_review) markedRestored[r.question_id] = true;
    });

    // Merge with local draft (local wins if newer than what we got from the DB, since DB is eventual after refresh)
    const local = loadLocalDraft(attempt.id);
    const mergedAnswers = { ...restored, ...(local?.answers ?? {}) };
    const mergedMarked  = { ...markedRestored, ...(local?.marked ?? {}) };
    setAnswers(mergedAnswers);
    setMarked(mergedMarked);
    setSpent(local?.spent ?? {});
    if (local && typeof local.current === "number") setCurrent(local.current);
    else setCurrent(0);
    if (local) toast.info("Resumed from your last saved progress.");

    const { data: att } = await supabase.from("exam_attempts").select("started_at").eq("id", attempt.id).single();
    const startTs = att?.started_at ? new Date(att.started_at).getTime() : Date.now();
    setStartedAt(startTs);
    const dur = (exam.duration_min ?? exam.duration_minutes ?? 60) * 60;
    setRemaining(Math.max(0, Math.floor(startTs / 1000 + dur - Date.now() / 1000)));
    setViolationLimit(exam.violation_limit ?? cfg.violationLimit ?? 3);
    setViolations(0);
    setSummary(null);
    setBreakdown([]);
    focusStartRef.current = Date.now();
    setActiveExam(exam);
    // current already set above
    if (exam.mode !== "practice") {
      setTimeout(() => { containerRef.current?.requestFullscreen?.().catch(() => {}); }, 50);
      const proctorRequested = exam.proctored ?? cfg.webcamProctoring ?? false;
      if (proctorRequested) startProctor(exam.id, attempt.id, exam.proctor_snapshot_interval_sec ?? 60);
    }
  }

  async function startProctor(examId: string, attempt: string, intervalSec: number) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setProctorOn(true);
      const snap = async () => {
        try {
          const v = videoRef.current; if (!v || v.readyState < 2) return;
          const c = document.createElement("canvas");
          c.width = 320; c.height = 240;
          c.getContext("2d")!.drawImage(v, 0, 0, 320, 240);
          const blob: Blob | null = await new Promise(res => c.toBlob(res, "image/jpeg", 0.6));
          if (!blob) return;
          const path = `${examId}/${attempt}/${Date.now()}.jpg`;
          await supabase.storage.from("proctor-snapshots").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        } catch {/* ignore */}
      };
      snapNowRef.current = snap;
      snap();
      const ms = Math.max(10, intervalSec) * 1000;
      snapTimerRef.current = window.setInterval(snap, ms);

      // Face-presence monitor (Chromium browsers only — graceful no-op elsewhere)
      if (faceDetectorAvailable()) {
        let consecutiveBad = 0;
        faceTimerRef.current = window.setInterval(async () => {
          const v = videoRef.current;
          if (!v) return;
          const n = await countFaces(v);
          if (n === null) return;
          if (n === 0) {
            consecutiveBad += 1;
            if (consecutiveBad >= 2) { consecutiveBad = 0; logViolation("no_face_detected"); }
          } else if (n > 1) {
            consecutiveBad = 0;
            logViolation("multiple_faces_detected", `count=${n}`);
          } else {
            consecutiveBad = 0;
          }
        }, 10_000);
      }
    } catch {
      toast.error("Webcam access denied — this exam requires proctoring.");
      logViolation("webcam_denied");
    }
  }

  function stopProctor() {
    if (snapTimerRef.current) { clearInterval(snapTimerRef.current); snapTimerRef.current = null; }
    if (faceTimerRef.current) { clearInterval(faceTimerRef.current); faceTimerRef.current = null; }
    snapNowRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setProctorOn(false);
  }

  const submit = useCallback(async (reason?: string) => {
    if (!attemptId || !activeExam || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const rows = Object.entries(answers).map(([question_id, selected_index]) => ({
      attempt_id: attemptId, question_id, selected_index, marked_for_review: !!marked[question_id],
    }));
    try {
      if (rows.length) {
        const { error: upErr } = await supabase
          .from("exam_answers")
          .upsert(rows, { onConflict: "attempt_id,question_id" });
        if (upErr) throw upErr;
      }
      const { data: graded, error: gErr } = await supabase.functions.invoke("grade-exam-attempt", { body: { attempt_id: attemptId } });
      if (gErr) throw gErr;
    const score = graded?.score ?? 0;
    const serverBreakdown: Array<{ id: string; correctIdx: number; pickedIdx: number | null; points: number; isCorrect: boolean }> = graded?.breakdown ?? [];
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    stopProctor();
    toast.success(`${reason ? reason + " — " : ""}Submitted! Score: ${score}%`);
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    // Build per-question breakdown using server-provided correct indexes (students cannot read correct_index directly).
    const serverMap = new Map(serverBreakdown.map(b => [b.id, b]));
    const bd = questions.map(q => {
      const s = serverMap.get(q.id);
      const picked = answers[q.id];
      return {
        id: q.id, prompt: q.prompt, points: q.points ?? 1,
        correctIdx: s?.correctIdx ?? 0,
        pickedIdx: picked === undefined ? null : picked,
        isCorrect: s?.isCorrect ?? false,
      };
    });
    setBreakdown(bd);
    setSummary({ score, answered: Object.keys(answers).length, total: questions.length, durationSec });
    clearLocalDraft(attemptId);
    } catch (e: any) {
      toast.error(e?.message || "Submission failed. Please check your connection and try again.");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }
    submittingRef.current = false;
    setSubmitting(false);
  }, [attemptId, activeExam, answers, marked, questions, startedAt]);

  async function selectAnswer(questionId: string, idx: number) {
    setAnswers(prev => ({ ...prev, [questionId]: idx }));
    if (!attemptId) return;
    await supabase.from("exam_answers").upsert(
      { attempt_id: attemptId, question_id: questionId, selected_index: idx, marked_for_review: !!marked[questionId] },
      { onConflict: "attempt_id,question_id" }
    );
  }

  async function toggleMark(questionId: string) {
    const next = !marked[questionId];
    setMarked(prev => ({ ...prev, [questionId]: next }));
    if (!attemptId) return;
    await supabase.from("exam_answers").upsert(
      { attempt_id: attemptId, question_id: questionId, selected_index: answers[questionId] ?? null, marked_for_review: next },
      { onConflict: "attempt_id,question_id" }
    );
  }

  const logViolation = useCallback(async (type: string, detail?: string) => {
    if (!attemptId || !school || !activeExam || submittingRef.current) return;
    if (activeExam.mode === "practice") return;
    await supabase.from("exam_violations").insert({ attempt_id: attemptId, school_id: school.id, type, detail: detail ?? null });
    // Capture a snapshot tied to the violation moment (best-effort)
    snapNowRef.current?.().catch(() => {});
    setViolations(v => {
      const next = v + 1;
      const action = (activeExam.proctor_action as "warn" | "auto_submit") ?? "auto_submit";
      if (next >= violationLimit && action === "auto_submit") {
        speakWarning("You have exceeded the allowed violations. Your exam is being submitted.");
        submit(`Auto-submitted after ${next} violations`);
      } else if (next >= violationLimit) {
        speakWarning("Warning. You have exceeded the allowed violations. Your examiner has been notified.");
        toast.error(`Violation limit reached (${next}/${violationLimit}). Your examiner has been alerted.`);
      } else {
        const tail = action === "auto_submit" ? "Further violations will auto-submit your exam." : "Your examiner has been alerted.";
        speakWarning(`Warning ${next} of ${violationLimit}. ${type.replaceAll("_", " ")}.`);
        toast.warning(`Warning ${next}/${violationLimit}: ${type}. ${tail}`);
      }
      return next;
    });
  }, [attemptId, school, activeExam, violationLimit, submit]);

  // Timer
  useEffect(() => {
    if (!activeExam || !startedAt || summary) return;
    const dur = (activeExam.duration_min ?? activeExam.duration_minutes ?? 60) * 60;
    const id = setInterval(() => {
      const left = Math.max(0, Math.floor(startedAt / 1000 + dur - Date.now() / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        if (activeExam.mode === "practice") {
          toast.info("Time elapsed — practice mode, you can keep going.");
        } else if (cfg.autoSubmitOnTimeout !== false) {
          submit("Time up");
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [activeExam, startedAt, summary, submit, cfg.autoSubmitOnTimeout]);

  // Lockdown
  useEffect(() => {
    if (!activeExam || activeExam.mode === "practice" || summary) return;
    const onBlur = () => logViolation("window_blur");
    const onVisibility = () => { if (document.visibilityState === "hidden") logViolation("tab_hidden"); };
    const onFsChange = () => { if (!document.fullscreenElement) logViolation("fullscreen_exit"); };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); logViolation("copy_attempt"); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); logViolation("paste_attempt"); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "f12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k)) || (e.ctrlKey && ["u", "s", "p"].includes(k))) {
        e.preventDefault(); logViolation("devtools_shortcut", k);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeExam, logViolation, summary]);

  const totalSeconds = activeExam ? (activeExam.duration_min ?? activeExam.duration_minutes ?? 60) * 60 : 0;
  const answeredCount = useMemo(() => questions.filter(q => answers[q.id] !== undefined).length, [questions, answers]);
  const markedCount = useMemo(() => questions.filter(q => marked[q.id]).length, [questions, marked]);
  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (q.points ?? 1), 0), [questions]);
  const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  // tick state to refresh elapsed displays each second without remounting children
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeExam || summary) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeExam, summary]);
  const currentQ = questions[current];
  const currentSpent = currentQ
    ? (spent[currentQ.id] ?? 0) + Math.max(0, Math.floor((Date.now() - focusStartRef.current) / 1000))
    : 0;

  function jumpTo(i: number) {
    // Flush time on the question we're leaving
    const leaving = questions[current];
    if (leaving) {
      const delta = Math.max(0, Math.floor((Date.now() - focusStartRef.current) / 1000));
      if (delta > 0) setSpent(prev => ({ ...prev, [leaving.id]: (prev[leaving.id] ?? 0) + delta }));
    }
    focusStartRef.current = Date.now();
    setCurrent(Math.max(0, Math.min(questions.length - 1, i)));
  }
  function backToPicker() {
    setActiveExam(null); setQuestions([]); setAnswers({}); setMarked({});
    setAttemptId(null); setStartedAt(null); setSummary(null); setBreakdown([]); setSpent({}); setCurrent(0);
  }

  // Local autosave — debounced by simple state diff via interval
  useEffect(() => {
    if (!attemptId || summary) return;
    saveLocalDraft(attemptId, { answers, marked, spent, current, savedAt: Date.now() });
  }, [attemptId, summary, answers, marked, spent, current]);
  useEffect(() => {
    if (!attemptId || summary) return;
    const id = setInterval(() => {
      // Persist running clock for the active question too
      const q = questions[current];
      if (q) {
        const delta = Math.max(0, Math.floor((Date.now() - focusStartRef.current) / 1000));
        if (delta > 0) {
          const nextSpent = { ...spent, [q.id]: (spent[q.id] ?? 0) + delta };
          focusStartRef.current = Date.now();
          setSpent(nextSpent);
        }
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [attemptId, summary, questions, current, spent]);

  // ===================== SUMMARY VIEW =====================
  if (activeExam && summary) {
    const correctCount = breakdown.filter(b => b.isCorrect).length;
    return (
      <div className="min-h-[calc(100vh-120px)] px-4 py-8 animate-fade-in">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="text-center">
          <div className="size-14 rounded-full bg-success/15 text-success grid place-items-center mx-auto mb-4">
            <Trophy className="size-7" />
          </div>
          <h2 className="font-display text-2xl font-bold">Exam submitted</h2>
          <p className="text-sm text-muted-foreground mt-1">{activeExam.title}</p>
          </div>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Score" value={`${summary.score}%`} />
            <Stat label="Correct" value={`${correctCount}/${summary.total}`} />
            <Stat label="Answered" value={`${summary.answered}/${summary.total}`} />
            <Stat label="Time used" value={fmtDuration(summary.durationSec)} />
          </div>

          {breakdown.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Question-by-question</div>
                <div className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 mr-3"><span className="size-2.5 rounded-sm bg-success" /> Correct</span>
                  <span className="inline-flex items-center gap-1 mr-3"><span className="size-2.5 rounded-sm bg-destructive" /> Wrong</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-muted" /> Skipped</span>
                </div>
              </div>
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5 mb-5">
                {breakdown.map((b, i) => {
                  const tone = b.pickedIdx === null
                    ? "bg-muted text-muted-foreground border-border"
                    : b.isCorrect
                      ? "bg-success text-success-foreground border-success"
                      : "bg-destructive text-destructive-foreground border-destructive";
                  return (
                    <div key={b.id} title={`Q${i+1} • ${b.pickedIdx === null ? "Skipped" : b.isCorrect ? "Correct" : "Wrong"}`}
                      className={cn("aspect-square rounded text-[10px] font-semibold border grid place-items-center", tone)}>
                      {i+1}
                    </div>
                  );
                })}
              </div>
              <ul className="divide-y divide-border border border-border rounded-lg max-h-72 overflow-y-auto">
                {breakdown.map((b, i) => (
                  <li key={b.id} className="px-3 py-2 flex items-start gap-3 text-sm">
                    <span className="text-[11px] font-mono text-muted-foreground w-8 shrink-0 mt-0.5">Q{i+1}</span>
                    <span className="flex-1 min-w-0 line-clamp-2 text-foreground/90">{b.prompt}</span>
                    <span className="shrink-0 text-[11px] font-medium">
                      {b.pickedIdx === null
                        ? <span className="text-muted-foreground">— / {String.fromCharCode(65 + b.correctIdx)}</span>
                        : b.isCorrect
                          ? <span className="text-success">{String.fromCharCode(65 + b.pickedIdx)} ✓</span>
                          : <span className="text-destructive">{String.fromCharCode(65 + b.pickedIdx)} ✗ <span className="text-muted-foreground">/ {String.fromCharCode(65 + b.correctIdx)}</span></span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" asChild>
              <Link to={schoolPath(school?.slug, `/app/student/review?attempt=${attemptId}`)}>Review answers</Link>
            </Button>
            <Button onClick={backToPicker}>Back to exams</Button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== EXAM SHELL =====================
  if (activeExam) {
    const q = questions[current];
    const picked = q ? answers[q.id] : undefined;
    return (
      <div ref={containerRef} className="bg-background min-h-screen select-none" style={{ userSelect: "none" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] min-h-screen">
          {/* ---------------- LEFT RAIL ---------------- */}
          <aside className="hidden lg:flex flex-col border-r border-border bg-sidebar">
            <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
              {school?.logo_url
                ? <img src={school.logo_url} alt={school.name} className="size-10 rounded-lg object-cover" />
                : <div className="size-10 rounded-lg bg-primary/15 text-primary grid place-items-center font-display font-bold">{(school?.name?.[0] ?? "S").toUpperCase()}</div>}
              <div className="min-w-0 leading-tight">
                <div className="font-display font-bold truncate">{school?.name ?? "School"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{activeExam.mode === "neco_sim" ? "NECO CBT Mock" : activeExam.mode === "practice" ? "Practice" : "School Exam"}</div>
              </div>
            </div>

            <div className="p-5 border-b border-sidebar-border">
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                <div className="text-xs text-muted-foreground">Exam</div>
                <div className="font-display font-semibold leading-tight mt-0.5">{activeExam.title}</div>
                {activeExam.subject && <div className="text-xs text-muted-foreground mt-0.5">{activeExam.subject}</div>}
                <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground uppercase tracking-wide">
                  {activeExam.mode === "neco_sim" ? "NECO CBT Mode" : activeExam.mode === "practice" ? "Practice" : "Live"}
                </div>
              </div>
            </div>

            <div className="p-5 border-b border-sidebar-border space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Exam details</div>
              <Detail icon={Layers} label="Total Questions" value={String(questions.length)} />
              <Detail icon={Award} label="Total Marks" value={String(totalMarks)} />
              <Detail icon={Timer} label="Duration" value={fmtDurationCompact(totalSeconds)} />
              <Detail icon={Clock} label="Started" value={startedAt ? new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />
            </div>

            <div className="p-5 border-b border-sidebar-border">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Legend</div>
              <div className="space-y-2 text-xs">
                <Legend swatch="bg-card border-border" label="Not answered" />
                <Legend swatch="bg-success border-success" label="Answered" />
                <Legend swatch="bg-warning border-warning" label="Marked for review" />
                <Legend swatch="bg-primary border-primary" label="Current question" />
              </div>
            </div>

            <div className="mt-auto p-5">
              <Button variant="destructive" className="w-full" onClick={() => setEndOpen(true)}>
                <LogOut className="size-4 mr-2" /> End Exam
              </Button>
            </div>
          </aside>

          {/* ---------------- CENTER ---------------- */}
          <div className="flex flex-col min-w-0">
            {/* Top status bar */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
              <Pill icon={BookOpen} label="Subject" value={activeExam.subject || "—"} />
              <Pill icon={ShieldCheck} label="Mode" value={activeExam.mode === "neco_sim" ? "NECO CBT Mock" : activeExam.mode === "practice" ? "Practice" : "School"} />
              <Pill icon={UserIcon} label="Student" value={displayName || "Student"} />
              <div className="ml-auto flex items-center gap-3">
                {proctorOn && (
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-destructive animate-pulse" />
                    <Video className="size-3.5" /> Proctoring
                  </div>
                )}
                {!isPractice && violations > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" /> {violations}/{violationLimit}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block leading-tight">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Time Remaining</div>
                    <div className={cn("text-xs font-mono font-bold", remaining < 60 && "text-destructive")}>{fmtClock(remaining)}</div>
                  </div>
                  <TimerRing remaining={remaining} total={totalSeconds} />
                </div>
                {!isPractice && (
                  <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => containerRef.current?.requestFullscreen?.().catch(() => {})}>
                    <Maximize2 className="size-3.5 mr-1" /> Fullscreen
                  </Button>
                )}
                <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={submitting}>
                  <CheckCircle2 className="size-4 mr-1.5" /> {submitting ? "Submitting…" : "Submit Exam"}
                </Button>
              </div>
            </div>

            {/* Progress bar — full width, beneath the top status row */}
            <div className="border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-2.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span className="tabular-nums font-semibold text-foreground">{answeredCount} of {questions.length} answered · {progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-success transition-[width] duration-500 ease-out" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground">
                <div className="leading-tight text-right">
                  <div className="uppercase tracking-wider font-semibold">Elapsed</div>
                  <div className="font-mono text-foreground tabular-nums">{fmtClock(elapsed)}</div>
                </div>
                <div className="leading-tight text-right">
                  <div className="uppercase tracking-wider font-semibold">On this Q</div>
                  <div className="font-mono text-foreground tabular-nums">{fmtClock(currentSpent)}</div>
                </div>
              </div>
            </div>

            {/* Question */}
            <main className="flex-1 px-4 md:px-8 py-6 max-w-4xl w-full mx-auto">
              {isPractice && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <span className="font-semibold">Practice mode</span> — answers won't affect your results. No fullscreen, no warnings.
                </div>
              )}

              {q ? (
                <div className="rounded-xl border border-border bg-card shadow-card">
                  <div className="px-5 md:px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
                    <div className="font-semibold">Question {current + 1} of {questions.length}</div>
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                      {q.points ?? 1} Mark{(q.points ?? 1) > 1 ? "s" : ""}
                    </span>
                    <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                      <Checkbox checked={!!marked[q.id]} onCheckedChange={() => toggleMark(q.id)} />
                      {marked[q.id] ? <BookmarkCheck className="size-4 text-warning" /> : <Bookmark className="size-4" />}
                      Mark for Review
                    </label>
                  </div>
                  <div className="px-5 md:px-6 py-6">
                    <div className="text-base leading-relaxed">
                      <MathText>{q.prompt}</MathText>
                    </div>
                    <div className="mt-5 space-y-2">
                      {(q.options as string[]).map((o, oi) => {
                        const isPicked = picked === oi;
                        const letter = String.fromCharCode(65 + oi);
                        return (
                          <button
                            key={oi}
                            type="button"
                            onClick={() => selectAnswer(q.id, oi)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 md:p-4 rounded-lg border text-left transition group",
                              isPicked
                                ? "border-success bg-success/10 ring-2 ring-success/20"
                                : "border-border hover:border-primary/40 hover:bg-secondary/50",
                            )}
                          >
                            <span className={cn(
                              "size-8 shrink-0 rounded-full grid place-items-center font-semibold text-sm border transition",
                              isPicked ? "bg-success text-success-foreground border-success" : "bg-card border-border text-muted-foreground group-hover:border-primary/50",
                            )}>{letter}</span>
                            <span className="text-sm flex-1"><MathText>{o}</MathText></span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex items-center justify-between gap-2">
                      <Button variant="outline" disabled={current === 0} onClick={() => jumpTo(current - 1)}>
                        <ArrowLeft className="size-4 mr-1.5" /> Previous
                      </Button>
                      {current < questions.length - 1
                        ? <Button onClick={() => jumpTo(current + 1)}>Next <ArrowRight className="size-4 ml-1.5" /></Button>
                        : <Button onClick={() => setConfirmOpen(true)}>Review & finish <CheckCircle2 className="size-4 ml-1.5" /></Button>}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState icon={ListChecks} title="No questions in this exam" />
              )}
            </main>

            <div className="px-4 md:px-8 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                <span className="font-medium text-foreground">CBT Simulation</span>
                <span className="hidden sm:inline">— Interface may vary slightly in the real exam.</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success animate-pulse" /> Auto-save every 10 seconds
              </div>
            </div>
          </div>

          {/* ---------------- RIGHT NAVIGATOR ---------------- */}
          <aside className="hidden lg:flex flex-col border-l border-border bg-card/30 max-h-screen overflow-y-auto">
            <div className="p-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="font-display font-semibold">Question Navigator</div>
                <span className="text-xs text-muted-foreground">{questions.length}</span>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-1.5">
                {questions.map((qq, i) => {
                  const answered = answers[qq.id] !== undefined;
                  const isMarked = !!marked[qq.id];
                  const isCurrent = current === i;
                  return (
                    <button
                      key={qq.id}
                      onClick={() => jumpTo(i)}
                      className={cn(
                        "aspect-square rounded-md text-xs font-semibold border transition",
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : isMarked
                            ? "bg-warning text-warning-foreground border-warning"
                            : answered
                              ? "bg-success text-success-foreground border-success"
                              : "bg-card border-border text-muted-foreground hover:border-primary/40",
                      )}
                      title={isCurrent ? "Current" : isMarked ? "Marked for review" : answered ? "Answered" : "Unanswered"}
                    >{i + 1}</button>
                  );
                })}
              </div>
            </div>

            <div className="p-5 border-b border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{answeredCount} / {questions.length} Answered</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-success transition-all" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground text-right">
                {questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%
              </div>
              {markedCount > 0 && (
                <div className="mt-2 text-xs text-warning-foreground inline-flex items-center gap-1.5">
                  <BookmarkCheck className="size-3.5 text-warning" /> {markedCount} marked for review
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Timer className="size-4 text-primary" /> Time Guide
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  You are expected to complete this paper in <span className="font-semibold text-foreground">{fmtDurationCompact(totalSeconds)}</span>. Manage your time wisely.
                </p>
              </div>
              <Button className="w-full mt-4" onClick={() => setConfirmOpen(true)}>
                <CheckCircle2 className="size-4 mr-1.5" /> Finish exam
              </Button>
            </div>
          </aside>
        </div>

        <video ref={videoRef} muted playsInline className="fixed bottom-3 right-3 w-32 h-24 rounded-md border border-border bg-black/60 z-20" style={{ display: proctorOn ? "block" : "none" }} />

        {/* Submit confirm */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit your exam?</AlertDialogTitle>
              <AlertDialogDescription>
                You have answered <span className="font-semibold text-foreground">{answeredCount}</span> of <span className="font-semibold text-foreground">{questions.length}</span> questions.
                {answeredCount < questions.length && <> You still have <span className="font-semibold text-destructive">{questions.length - answeredCount}</span> unanswered.</>}
                {markedCount > 0 && <> {markedCount} marked for review.</>}
                {" "}This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Keep working</AlertDialogCancel>
              <AlertDialogAction disabled={submitting} onClick={() => { setConfirmOpen(false); submit(); }}>
                {submitting ? "Submitting…" : "Submit now"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* End exam (early exit) */}
        <AlertDialog open={endOpen} onOpenChange={setEndOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End the exam early?</AlertDialogTitle>
              <AlertDialogDescription>
                Ending now will submit your exam with the answers you've recorded so far. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep going</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { setEndOpen(false); submit("Ended early"); }}>End & submit</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ===================== PICKER =====================
  const grouped = {
    neco_sim: exams.filter(e => e.mode === "neco_sim"),
    school:   exams.filter(e => !e.mode || e.mode === "school"),
    practice: exams.filter(e => e.mode === "practice"),
  };

  const renderGrid = (list: any[]) => list.length === 0
    ? <EmptyState icon={ListChecks} title="No exams in this category" />
    : (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map(e => <ExamCard key={e.id} exam={e} onStart={() => start(e)} />)}
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Exam centre</h2>
        <p className="text-sm text-muted-foreground">Practice, school assessments, and full NECO CBT simulations.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="neco_sim"><Award className="size-3.5 mr-1.5" /> NECO Mock</TabsTrigger>
          <TabsTrigger value="jamb_sim"><BookMarked className="size-3.5 mr-1.5" /> JAMB Mock</TabsTrigger>
          <TabsTrigger value="school"><GraduationCap className="size-3.5 mr-1.5" /> School Exams ({grouped.school.length})</TabsTrigger>
          <TabsTrigger value="practice"><Sparkles className="size-3.5 mr-1.5" /> Practice</TabsTrigger>
        </TabsList>
        <TabsContent value="neco_sim" className="mt-4">
          <SimCallout
            icon={Award}
            title="NECO CBT Simulation"
            description="Pick 9 of 15 subjects. 20 questions each. UTME-style runner with subject tabs, navigator and timer."
            cta="Open NECO Mock"
            to="/app/student/mock?body=neco"
            tone="warning"
          />
        </TabsContent>
        <TabsContent value="jamb_sim" className="mt-4">
          <SimCallout
            icon={BookMarked}
            title="JAMB UTME Simulation"
            description="Pick 4 subjects (English compulsory). 20 questions per subject. Switch between subjects just like the real UTME."
            cta="Open JAMB Mock"
            to="/app/student/mock?body=jamb"
            tone="primary"
          />
        </TabsContent>
        <TabsContent value="school"   className="mt-4">{renderGrid(grouped.school)}</TabsContent>
        <TabsContent value="practice" className="mt-4">
          <SimCallout
            icon={Sparkles}
            title="Practice Mode"
            description="Study from your school library or upload your own materials. No timer, no scoring — just learn."
            cta="Open Practice"
            to="/app/student/practice"
            tone="success"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimCallout({ icon: Icon, title, description, cta, to, tone }: {
  icon: any; title: string; description: string; cta: string; to: string;
  tone: "primary" | "warning" | "success";
}) {
  const { school } = useSchool();
  const toneCls =
    tone === "warning" ? "from-warning/15 to-warning/5 border-warning/30" :
    tone === "success" ? "from-success/15 to-success/5 border-success/30" :
    "from-primary/15 to-primary/5 border-primary/30";
  const iconCls =
    tone === "warning" ? "bg-warning/20 text-warning-foreground" :
    tone === "success" ? "bg-success/20 text-success-foreground" :
    "bg-primary/20 text-primary";
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-6 shadow-card flex flex-col md:flex-row md:items-center gap-4", toneCls)}>
      <div className={cn("size-12 rounded-xl grid place-items-center shrink-0", iconCls)}>
        <Icon className="size-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-lg leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <Button asChild size="lg">
        <Link to={schoolPath(school?.slug, to)}>{cta}<ArrowUpRight className="size-4 ml-1.5" /></Link>
      </Button>
    </div>
  );
}

// ===================== Small components =====================

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-display font-bold mt-0.5">{value}</div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" />{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-block size-4 rounded border", swatch)} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Pill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
      <div className="size-7 rounded-md bg-secondary grid place-items-center"><Icon className="size-3.5 text-muted-foreground" /></div>
      <div className="leading-tight min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-xs font-semibold truncate max-w-[120px]">{value}</div>
      </div>
    </div>
  );
}

function ExamCard({ exam, onStart }: { exam: any; onStart: () => void }) {
  const mins = exam.duration_min ?? exam.duration_minutes ?? 60;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card flex flex-col gap-3 hover:border-primary/40 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {exam.subject && <span className="inline-flex text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{exam.subject}</span>}
          <h3 className="font-display font-semibold mt-2 leading-tight">{exam.title}</h3>
        </div>
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap",
          exam.mode === "practice" ? "bg-primary/10 text-primary" :
          exam.mode === "neco_sim" ? "bg-warning/15 text-warning-foreground" :
          "bg-secondary text-foreground",
        )}>{exam.mode === "neco_sim" ? "NECO" : exam.mode === "practice" ? "Practice" : "School"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Timer className="size-3.5" /> {mins} min</div>
        {exam.proctored && <div className="flex items-center gap-1.5 text-muted-foreground"><Video className="size-3.5" /> Proctored</div>}
        {exam.randomize && <div className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="size-3.5" /> Randomized</div>}
        {exam.scheduled_at && <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="size-3.5" /> {new Date(exam.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>}
      </div>
      <Button className="mt-auto" onClick={onStart}>
        {exam.mode === "practice" ? "Start practice" : "Start exam"}
      </Button>
    </div>
  );
}

// ===================== utils =====================
function fmtClock(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60).toString().padStart(2, "0");
  const s = (Math.max(0, sec) % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
function fmtDurationCompact(sec: number) {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}