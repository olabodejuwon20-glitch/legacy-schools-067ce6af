import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Wallet, ClipboardCheck,
  BarChart3, MessagesSquare, CalendarDays, FileText, Bell, Search,
  CheckCircle2, Clock, TrendingUp, Award, Baby, UserCog, Menu, X,
  Play, ChevronLeft, ChevronRight, Timer, Send, Sparkles, ShieldCheck,
  Home, Settings, BellRing, Trophy, PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PortalKey = "admin" | "teacher" | "student" | "parent";

const PORTALS: { key: PortalKey; label: string; subtitle: string; color: string }[] = [
  { key: "admin",   label: "Admin",   subtitle: "School Management", color: "hsl(var(--admin))" },
  { key: "teacher", label: "Teacher", subtitle: "Classroom",         color: "hsl(var(--teacher))" },
  { key: "student", label: "Student", subtitle: "Learning",          color: "hsl(var(--student))" },
  { key: "parent",  label: "Parent",  subtitle: "Family Hub",        color: "hsl(var(--parent))" },
];

type NavItem = { icon: any; label: string; key: string };

function Frame({
  accent, sidebar, activeKey, onNavigate, children, title,
}: {
  accent: string;
  sidebar: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  children: React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl border border-white/10 overflow-hidden shadow-2xl relative backdrop-blur-md"
      style={{
        background: "rgba(255,255,255,0.03)",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-white/[0.04] backdrop-blur-sm relative z-10">
        <button
          type="button"
          className="md:hidden mr-1 size-6 grid place-items-center rounded hover:bg-white/10 transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
        </button>
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-warning/60" />
        <span className="size-2.5 rounded-full bg-success/60" />
        <div className="ml-3 flex-1 max-w-sm h-5 rounded-md bg-white/[0.06] border border-white/10 px-2 flex items-center text-[10px] text-muted-foreground">
          legacyskool.app{title ? `/${title.toLowerCase().replace(/\s+/g, "-")}` : "/demo"}
        </div>
      </div>
      <div className="grid md:grid-cols-[170px_1fr] min-h-[460px] relative z-10">
        {/* Sidebar */}
        <aside
          className={cn(
            "border-r border-white/10 bg-white/[0.03] backdrop-blur-sm p-3 text-xs",
            "md:block md:static",
            "absolute md:relative inset-y-0 left-0 z-20 w-44 transition-transform",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="size-7 rounded-md grid place-items-center text-white shadow-lg"
              style={{ background: accent, boxShadow: `0 0 12px ${accent.replace("hsl(", "hsla(").replace(")", " / 0.45)")}` }}
            >
              <GraduationCap className="size-4" />
            </div>
            <span className="font-semibold">LegacySKool</span>
          </div>
          <nav className="space-y-1">
            {sidebar.map((i) => {
              const isActive = i.key === activeKey;
              return (
                <button
                  type="button"
                  key={i.key}
                  onClick={() => { onNavigate(i.key); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all",
                    isActive
                      ? "text-foreground font-medium backdrop-blur-sm border border-white/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
                  )}
                  style={isActive ? {
                    background: accent.replace("hsl(", "hsla(").replace(")", " / 0.14)"),
                    boxShadow: `0 0 16px ${accent.replace("hsl(", "hsla(").replace(")", " / 0.12)")}`,
                  } : {}}
                >
                  <i.icon className="size-3.5" />
                  <span>{i.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
        {open && (
          <div
            className="md:hidden absolute inset-0 bg-foreground/20 z-10"
            onClick={() => setOpen(false)}
          />
        )}
        {/* Content */}
        <div className="p-4 sm:p-5 min-w-0 relative">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, trend, color, onClick }: { label: string; value: string; trend?: string; color: string; onClick?: () => void }) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn(
      "rounded-lg border border-white/10 p-3 text-left transition-all backdrop-blur-sm bg-white/[0.04]",
      onClick && "hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.06)] active:scale-[0.98]",
    )}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-1" style={{ color }}>{value}</div>
      {trend && <div className="text-[10px] text-success mt-0.5 flex items-center gap-1"><TrendingUp className="size-3" />{trend}</div>}
    </Comp>
  );
}

/* ============================ ADMIN ============================ */
const ADMIN_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { icon: Users, label: "Students", key: "students" },
  { icon: UserCog, label: "Teachers", key: "teachers" },
  { icon: BookOpen, label: "Classes", key: "classes" },
  { icon: Wallet, label: "Fees", key: "fees" },
  { icon: BarChart3, label: "Reports", key: "reports" },
];

function AdminDemo() {
  const [view, setView] = useState("dashboard");
  const titleMap: Record<string, string> = {
    dashboard: "School Overview", students: "Students", teachers: "Teachers",
    classes: "Classes", fees: "Fees", reports: "Reports",
  };
  return (
    <Frame accent="hsl(var(--admin))" sidebar={ADMIN_NAV} activeKey={view} onNavigate={setView} title={`admin/${view}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-muted-foreground">Admin · {titleMap[view]}</div>
          <h3 className="font-display font-bold text-lg">Greenfield Academy</h3>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bell className="size-4" /><Search className="size-4" />
        </div>
      </div>

      {view === "dashboard" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat onClick={() => setView("students")} label="Students" value="1,248" trend="+12 this week" color="hsl(var(--admin))" />
            <Stat onClick={() => setView("teachers")} label="Teachers" value="86" color="hsl(var(--admin))" />
            <Stat onClick={() => setView("classes")}  label="Classes" value="42" color="hsl(var(--admin))" />
            <Stat onClick={() => setView("fees")}     label="Fees paid" value="92%" trend="+4.1%" color="hsl(var(--admin))" />
          </div>
          <button onClick={() => setView("reports")} className="mt-3 w-full rounded-lg border border-border p-3 text-left hover:shadow-card transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Enrollment by class</div>
              <span className="text-[10px] text-muted-foreground">Last 30 days →</span>
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {[60, 75, 50, 85, 70, 90, 65, 80, 95, 72, 88, 78].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all hover:opacity-100" style={{ height: `${h}%`, background: "hsl(var(--admin) / 0.7)" }} />
              ))}
            </div>
          </button>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button onClick={() => setView("reports")} className="rounded-lg border border-border p-2 flex items-center gap-2 hover:bg-secondary/40"><CheckCircle2 className="size-4 text-success" />Term reports approved</button>
            <button onClick={() => setView("fees")} className="rounded-lg border border-border p-2 flex items-center gap-2 hover:bg-secondary/40"><Clock className="size-4 text-warning" />3 fee reminders pending</button>
          </div>
        </>
      )}

      {view === "students" && (
        <div className="rounded-lg border border-border overflow-hidden text-xs">
          {["Ada Obi · JSS 2A", "Bola Ade · JSS 2A", "Chika Eze · JSS 1B", "Dapo Ola · SSS 1A", "Femi Bello · JSS 3C"].map((s, i) => (
            <div key={s} className={cn("flex items-center justify-between px-3 py-2.5", i > 0 && "border-t border-border")}>
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full grid place-items-center text-white text-[10px] font-semibold" style={{ background: "hsl(var(--admin))" }}>{s[0]}</div>
                <span>{s}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Active</span>
            </div>
          ))}
        </div>
      )}

      {view === "teachers" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { n: "Mr. Okonkwo", s: "Mathematics · 4 classes" },
            { n: "Mrs. Adeyemi", s: "English · 3 classes" },
            { n: "Mr. Eze", s: "Physics · 2 classes" },
            { n: "Mrs. Bello", s: "Biology · 3 classes" },
          ].map((t) => (
            <div key={t.n} className="rounded-lg border border-border p-3">
              <div className="font-semibold">{t.n}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t.s}</div>
            </div>
          ))}
        </div>
      )}

      {view === "classes" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {["JSS 1A","JSS 1B","JSS 2A","JSS 2B","SSS 1A","SSS 2A"].map((c) => (
            <div key={c} className="rounded-lg border border-border p-3 text-center">
              <div className="font-display font-bold text-base">{c}</div>
              <div className="text-[10px] text-muted-foreground mt-1">28 students</div>
            </div>
          ))}
        </div>
      )}

      {view === "fees" && (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Paid" value="92%" color="hsl(var(--success))" />
            <Stat label="Pending" value="6%" color="hsl(var(--warning))" />
            <Stat label="Overdue" value="2%" color="hsl(var(--destructive))" />
          </div>
          <div className="rounded-lg border border-border p-3 mt-2">
            <div className="font-semibold mb-2">Recent payments</div>
            {["Ada Obi · ₦120,000","Bola Ade · ₦120,000","Chika Eze · ₦95,000"].map(p => (
              <div key={p} className="flex justify-between py-1 border-t border-border first:border-0">
                <span>{p}</span><span className="text-success">Paid</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "reports" && (
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-semibold mb-2">Average performance by class</div>
          <div className="space-y-2">
            {[{c:"JSS 1A",v:78},{c:"JSS 2A",v:84},{c:"JSS 3A",v:71},{c:"SSS 1A",v:88}].map(r => (
              <div key={r.c} className="flex items-center gap-2 text-xs">
                <span className="w-14">{r.c}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.v}%`, background: "hsl(var(--admin))" }} />
                </div>
                <span className="w-8 text-right">{r.v}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}

/* ============================ TEACHER ============================ */
const TEACHER_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { icon: BookOpen, label: "Classes", key: "classes" },
  { icon: ClipboardCheck, label: "Attendance", key: "attendance" },
  { icon: FileText, label: "Tests", key: "tests" },
  { icon: Award, label: "Gradebook", key: "gradebook" },
  { icon: MessagesSquare, label: "Messages", key: "messages" },
];

function TeacherDemo() {
  const [view, setView] = useState("dashboard");
  const [att, setAtt] = useState<Record<string, "P"|"L"|"A">>({
    "Ada Obi": "P", "Bola Ade": "P", "Chika Eze": "L", "Dapo Ola": "A", "Eze Uche": "P",
  });
  const cycle = (n: string) => setAtt(s => ({ ...s, [n]: s[n] === "P" ? "L" : s[n] === "L" ? "A" : "P" }));

  return (
    <Frame accent="hsl(var(--teacher))" sidebar={TEACHER_NAV} activeKey={view} onNavigate={setView} title={`teacher/${view}`}>
      <div className="mb-3">
        <div className="text-xs text-muted-foreground">Teacher · {view}</div>
        <h3 className="font-display font-bold text-lg">Mr. Okonkwo · JSS 2A</h3>
      </div>

      {view === "dashboard" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat onClick={() => setView("classes")} label="Classes" value="4" color="hsl(var(--teacher))" />
            <Stat onClick={() => setView("attendance")} label="Today present" value="26/28" color="hsl(var(--teacher))" />
            <Stat onClick={() => setView("gradebook")} label="To grade" value="12" color="hsl(var(--teacher))" />
          </div>
          <button onClick={() => setView("classes")} className="mt-3 w-full rounded-lg border border-border p-3 text-left hover:shadow-card">
            <div className="text-[10px] uppercase text-muted-foreground">Next class</div>
            <div className="text-sm font-semibold mt-1">Mathematics · JSS 2A</div>
            <div className="text-[10px] text-muted-foreground">10:30 AM · Room B12</div>
          </button>
        </>
      )}

      {view === "classes" && (
        <div className="space-y-2 text-xs">
          {[
            { c: "JSS 2A", s: "Mathematics · 28 students", t: "Mon/Wed 10:30" },
            { c: "JSS 2B", s: "Mathematics · 26 students", t: "Tue/Thu 09:00" },
            { c: "SSS 1A", s: "Further Maths · 22 students", t: "Mon/Fri 12:00" },
          ].map(c => (
            <div key={c.c} className="rounded-lg border border-border p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.c}</div>
                <div className="text-[10px] text-muted-foreground">{c.s}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">{c.t}</div>
            </div>
          ))}
        </div>
      )}

      {view === "attendance" && (
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold">Today's attendance · tap to toggle</div>
            <span className="text-[10px] text-muted-foreground">{Object.values(att).filter(v => v==="P").length}/{Object.keys(att).length} present</span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(att).map(([n, s]) => (
              <div key={n} className="flex items-center justify-between text-xs">
                <span>{n}</span>
                <button onClick={() => cycle(n)} className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                  s === "P" ? "bg-success/15 text-success" : s === "L" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive",
                )}>
                  {s === "P" ? "Present" : s === "L" ? "Late" : "Absent"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "tests" && (
        <div className="space-y-2 text-xs">
          {[
            { n: "Algebra Mid-term", c: "JSS 2A", q: "20 questions · 30 min" },
            { n: "Geometry Quiz", c: "JSS 2B", q: "10 questions · 15 min" },
          ].map(t => (
            <div key={t.n} className="rounded-lg border border-border p-3">
              <div className="font-semibold">{t.n}</div>
              <div className="text-[10px] text-muted-foreground">{t.c} · {t.q}</div>
            </div>
          ))}
        </div>
      )}

      {view === "gradebook" && (
        <div className="rounded-lg border border-border overflow-hidden text-xs">
          {[{n:"Ada Obi",s:92},{n:"Bola Ade",s:78},{n:"Chika Eze",s:85},{n:"Dapo Ola",s:64}].map((r,i) => (
            <div key={r.n} className={cn("flex justify-between px-3 py-2", i>0 && "border-t border-border")}>
              <span>{r.n}</span>
              <span className={cn("font-semibold", r.s >= 75 ? "text-success" : r.s >= 60 ? "text-warning" : "text-destructive")}>{r.s}%</span>
            </div>
          ))}
        </div>
      )}

      {view === "messages" && (
        <div className="space-y-2 text-xs">
          {[
            { f: "Mrs. Boateng (Parent)", m: "How is Ama doing in class?", t: "2h" },
            { f: "Admin", m: "Staff meeting tomorrow 4pm", t: "1d" },
          ].map(m => (
            <div key={m.f} className="rounded-lg border border-border p-3">
              <div className="flex justify-between"><span className="font-semibold">{m.f}</span><span className="text-[10px] text-muted-foreground">{m.t}</span></div>
              <div className="text-muted-foreground mt-1">{m.m}</div>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

/* ============================ STUDENT (with CBT) ============================ */
const STUDENT_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { icon: BookOpen, label: "Classes", key: "classes" },
  { icon: FileText, label: "Exams", key: "exams" },
  { icon: Award, label: "Results", key: "results" },
  { icon: CalendarDays, label: "Calendar", key: "calendar" },
  { icon: Sparkles, label: "AI Tutor", key: "tutor" },
];

const MOCK_QUESTIONS = [
  { q: "If 2x + 3 = 11, what is the value of x?", opts: ["2", "3", "4", "5"], a: 2 },
  { q: "The capital of Nigeria is …", opts: ["Lagos", "Abuja", "Kano", "Port Harcourt"], a: 1 },
  { q: "Which gas do plants absorb from the atmosphere for photosynthesis?", opts: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], a: 2 },
  { q: "Pick the synonym of 'rapid':", opts: ["Slow", "Quick", "Heavy", "Bright"], a: 1 },
  { q: "12 × 8 = ?", opts: ["86", "92", "96", "104"], a: 2 },
];

function ExamRunner({ onExit }: { onExit: () => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(MOCK_QUESTIONS.length).fill(null));
  const [remaining, setRemaining] = useState(5 * 60);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setRemaining(r => {
      if (r <= 1) { setDone(true); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [done]);

  const q = MOCK_QUESTIONS[idx];
  const score = useMemo(() => answers.reduce<number>((acc, a, i) => acc + (a === MOCK_QUESTIONS[i].a ? 1 : 0), 0), [answers]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const danger = remaining < 60;

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex size-14 rounded-full bg-success/15 text-success items-center justify-center mb-3">
          <Trophy className="size-7" />
        </div>
        <div className="font-display font-bold text-xl">Mock submitted</div>
        <div className="text-sm text-muted-foreground mt-1">Score: <b className="text-foreground">{score}/{MOCK_QUESTIONS.length}</b></div>
        <div className="mt-4 flex gap-2 justify-center">
          <Button size="sm" onClick={() => { setIdx(0); setAnswers(Array(MOCK_QUESTIONS.length).fill(null)); setRemaining(5*60); setDone(false); }}>
            <Play className="size-3.5" /> Retake
          </Button>
          <Button size="sm" variant="outline" onClick={onExit}>Back to portal</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-student" />
          <div className="text-xs">
            <div className="font-semibold">Mathematics CBT · Mock</div>
            <div className="text-[10px] text-muted-foreground">Question {idx + 1} of {MOCK_QUESTIONS.length}</div>
          </div>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-sm font-bold tabular-nums border",
          danger ? "border-destructive text-destructive bg-destructive/5" : "border-border",
        )}>
          <Timer className="size-3.5" /> {mm}:{ss}
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="text-sm font-medium mb-3">{q.q}</div>
        <div className="space-y-2">
          {q.opts.map((opt, oi) => {
            const chosen = answers[idx] === oi;
            return (
              <button key={oi} onClick={() => setAnswers(a => a.map((v, i) => i === idx ? oi : v))}
                className={cn(
                  "w-full text-left rounded-md border px-3 py-2 text-xs transition-all flex items-center gap-2",
                  chosen ? "border-student bg-student/10" : "border-border hover:bg-secondary/40",
                )}>
                <span className={cn("size-5 grid place-items-center rounded-full text-[10px] font-semibold border",
                  chosen ? "bg-student text-white border-student" : "bg-background border-border")}>
                  {String.fromCharCode(65 + oi)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {MOCK_QUESTIONS.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={cn(
              "h-7 rounded text-[10px] font-semibold border transition-colors",
              i === idx ? "border-student bg-student text-white" :
              answers[i] != null ? "border-success bg-success/15 text-success" :
              "border-border bg-background",
            )}>
            {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
          <ChevronLeft className="size-3.5" /> Previous
        </Button>
        {idx < MOCK_QUESTIONS.length - 1 ? (
          <Button size="sm" onClick={() => setIdx(i => i + 1)}>
            Next <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <Button size="sm" onClick={() => setDone(true)}>
            <CheckCircle2 className="size-3.5" /> Submit
          </Button>
        )}
      </div>
    </div>
  );
}

function StudentDemo() {
  const [view, setView] = useState("dashboard");
  const [examOpen, setExamOpen] = useState(false);

  if (examOpen) {
    return (
      <Frame accent="hsl(var(--student))" sidebar={STUDENT_NAV} activeKey="exams" onNavigate={(k) => { setExamOpen(false); setView(k); }} title="student/exam">
        <ExamRunner onExit={() => setExamOpen(false)} />
      </Frame>
    );
  }

  return (
    <Frame accent="hsl(var(--student))" sidebar={STUDENT_NAV} activeKey={view} onNavigate={setView} title={`student/${view}`}>
      <div className="mb-3">
        <div className="text-xs text-muted-foreground">Student · {view}</div>
        <h3 className="font-display font-bold text-lg">Ada Obi · JSS 2A</h3>
      </div>

      {view === "dashboard" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat onClick={() => setView("results")} label="Average" value="84%" trend="+3%" color="hsl(var(--student))" />
            <Stat label="Attendance" value="96%" color="hsl(var(--student))" />
            <Stat onClick={() => setView("results")} label="Rank" value="4/28" color="hsl(var(--student))" />
          </div>
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">Upcoming</div>
              <button onClick={() => setView("exams")} className="text-[10px] text-student">View all →</button>
            </div>
            <div className="space-y-2 text-xs">
              <button onClick={() => setView("exams")} className="w-full flex items-center justify-between hover:bg-secondary/40 rounded px-1 py-0.5">
                <div className="flex items-center gap-2"><FileText className="size-3.5 text-student" />Mathematics CBT</div>
                <span className="text-[10px] text-muted-foreground">Tomorrow · 10:00</span>
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><BookOpen className="size-3.5 text-student" />English assignment</div>
                <span className="text-[10px] text-muted-foreground">Fri</span>
              </div>
            </div>
          </div>
          <button onClick={() => setView("tutor")} className="mt-3 rounded-lg p-3 text-xs text-white w-full text-left hover:opacity-95" style={{ background: "linear-gradient(135deg, hsl(var(--student)), hsl(var(--admin)))" }}>
            <div className="font-semibold">Ask the AI tutor</div>
            <div className="opacity-90 mt-0.5">Stuck on quadratic equations? Get instant help.</div>
          </button>
        </>
      )}

      {view === "classes" && (
        <div className="space-y-2 text-xs">
          {[
            { s: "Mathematics", t: "Mr. Okonkwo", n: "Algebra · Chapter 4" },
            { s: "English", t: "Mrs. Adeyemi", n: "Comprehension drills" },
            { s: "Physics", t: "Mr. Eze", n: "Newton's laws" },
            { s: "Biology", t: "Mrs. Bello", n: "Cell structure" },
          ].map(c => (
            <div key={c.s} className="rounded-lg border border-border p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{c.s}</div>
                <div className="text-[10px] text-muted-foreground">{c.t} · {c.n}</div>
              </div>
              <BookOpen className="size-4 text-student" />
            </div>
          ))}
        </div>
      )}

      {view === "exams" && (
        <div>
          <div className="rounded-xl border border-student/30 bg-student/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-student">Live CBT Mock</div>
                <div className="font-display font-bold text-base mt-0.5">Mathematics · 5 questions</div>
                <div className="text-[10px] text-muted-foreground mt-1">Duration: 5 min · Auto-submit on timeout</div>
              </div>
              <Button size="sm" onClick={() => setExamOpen(true)} className="shrink-0">
                <Play className="size-3.5" /> Start exam
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {[
              { n: "English Mid-term", d: "Fri · 09:00", s: "Scheduled" },
              { n: "Physics Quiz", d: "Mon · 11:00", s: "Scheduled" },
            ].map(e => (
              <div key={e.n} className="rounded-lg border border-border p-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{e.n}</div>
                  <div className="text-[10px] text-muted-foreground">{e.d}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{e.s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "results" && (
        <div className="space-y-2 text-xs">
          {[{s:"Mathematics",v:92},{s:"English",v:78},{s:"Physics",v:85},{s:"Biology",v:88}].map(r => (
            <div key={r.s} className="rounded-lg border border-border p-3">
              <div className="flex justify-between"><span className="font-semibold">{r.s}</span><span className="text-student font-bold">{r.v}%</span></div>
              <div className="h-1.5 mt-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.v}%`, background: "hsl(var(--student))" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "calendar" && (
        <div className="grid grid-cols-7 gap-1 text-[10px] text-center">
          {["S","M","T","W","T","F","S"].map(d => <div key={d} className="font-semibold text-muted-foreground py-1">{d}</div>)}
          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
            <button key={d} className={cn(
              "aspect-square rounded grid place-items-center border border-border hover:bg-secondary/40",
              [6, 14, 22].includes(d) && "bg-student/15 text-student border-student/30 font-semibold",
            )}>{d}</button>
          ))}
        </div>
      )}

      {view === "tutor" && (
        <div className="space-y-2 text-xs">
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <div className="font-semibold text-student">AI Tutor</div>
            <div className="text-muted-foreground mt-1">Hi Ada! Ask me anything about today's lessons.</div>
          </div>
          <div className="rounded-lg p-3 bg-student/10 text-student ml-8">Explain quadratic equations simply</div>
          <div className="rounded-lg border border-border p-3">A quadratic equation has the form ax² + bx + c = 0. You can solve it by factoring, completing the square, or the quadratic formula…</div>
          <div className="flex gap-2 mt-2">
            <input className="flex-1 h-8 rounded-md border border-border px-2 text-xs bg-background" placeholder="Ask a question…" />
            <Button size="sm"><Send className="size-3.5" /></Button>
          </div>
        </div>
      )}
    </Frame>
  );
}

/* ============================ PARENT ============================ */
const PARENT_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { icon: Baby, label: "My Children", key: "children" },
  { icon: Award, label: "Results", key: "results" },
  { icon: ClipboardCheck, label: "Attendance", key: "attendance" },
  { icon: PiggyBank, label: "Fees", key: "fees" },
  { icon: MessagesSquare, label: "Messages", key: "messages" },
];

function ParentDemo() {
  const [view, setView] = useState("dashboard");
  return (
    <Frame accent="hsl(var(--parent))" sidebar={PARENT_NAV} activeKey={view} onNavigate={setView} title={`parent/${view}`}>
      <div className="mb-3">
        <div className="text-xs text-muted-foreground">Parent · {view}</div>
        <h3 className="font-display font-bold text-lg">Mrs. Boateng</h3>
      </div>

      {view === "dashboard" && (
        <>
          <button onClick={() => setView("children")} className="w-full rounded-lg border border-border p-3 mb-3 text-left hover:shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: "hsl(var(--parent))" }}>AO</div>
                <div>
                  <div className="text-sm font-semibold">Ama Obi</div>
                  <div className="text-[10px] text-muted-foreground">JSS 2A · Greenfield Academy</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success">Present today</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Stat label="Average" value="84%" color="hsl(var(--parent))" />
              <Stat label="Attendance" value="96%" color="hsl(var(--parent))" />
              <Stat label="Fees" value="Paid" color="hsl(var(--parent))" />
            </div>
          </button>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-semibold mb-2">Recent updates</div>
            <div className="space-y-2 text-xs">
              <button onClick={() => setView("results")} className="w-full flex items-start gap-2 hover:bg-secondary/40 rounded p-1 text-left"><Award className="size-3.5 text-parent mt-0.5" /><div><div>Maths test result: <b>92%</b></div><div className="text-[10px] text-muted-foreground">Posted by Mr. Okonkwo · 2h ago</div></div></button>
              <button onClick={() => setView("messages")} className="w-full flex items-start gap-2 hover:bg-secondary/40 rounded p-1 text-left"><BellRing className="size-3.5 text-parent mt-0.5" /><div><div>PTA meeting on Friday</div><div className="text-[10px] text-muted-foreground">School announcement · 1d ago</div></div></button>
            </div>
          </div>
        </>
      )}

      {view === "children" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[{n:"Ama Obi",c:"JSS 2A"},{n:"Kwame Obi",c:"SSS 1B"}].map(ch => (
            <div key={ch.n} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-9 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ background: "hsl(var(--parent))" }}>{ch.n.split(" ").map(p=>p[0]).join("")}</div>
                <div>
                  <div className="font-semibold">{ch.n}</div>
                  <div className="text-[10px] text-muted-foreground">{ch.c}</div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs">View details</Button>
            </div>
          ))}
        </div>
      )}

      {view === "results" && (
        <div className="space-y-2 text-xs">
          {[{s:"Mathematics",v:92,t:"Mr. Okonkwo"},{s:"English",v:78,t:"Mrs. Adeyemi"},{s:"Physics",v:85,t:"Mr. Eze"}].map(r => (
            <div key={r.s} className="rounded-lg border border-border p-3">
              <div className="flex justify-between"><span className="font-semibold">{r.s}</span><span className="text-parent font-bold">{r.v}%</span></div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Teacher: {r.t}</div>
            </div>
          ))}
        </div>
      )}

      {view === "attendance" && (
        <div className="grid grid-cols-7 gap-1 text-[10px] text-center">
          {["S","M","T","W","T","F","S"].map(d => <div key={d} className="font-semibold text-muted-foreground py-1">{d}</div>)}
          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => {
            const absent = d === 11;
            const weekend = (d % 7 === 0 || d % 7 === 6);
            return (
              <div key={d} className={cn(
                "aspect-square rounded grid place-items-center border",
                weekend ? "bg-muted/40 border-border text-muted-foreground" :
                absent ? "bg-destructive/15 border-destructive/30 text-destructive" :
                "bg-success/10 border-success/20 text-success",
              )}>{d}</div>
            );
          })}
        </div>
      )}

      {view === "fees" && (
        <div className="space-y-2 text-xs">
          <div className="rounded-lg border border-border p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">Term 2 · 2026</div>
              <div className="text-[10px] text-muted-foreground">Tuition + boarding</div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success">Paid · ₦240,000</span>
          </div>
          <div className="rounded-lg border border-border p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">Term 3 · 2026</div>
              <div className="text-[10px] text-muted-foreground">Due 15 Aug</div>
            </div>
            <Button size="sm" className="h-7 text-xs">Pay now</Button>
          </div>
        </div>
      )}

      {view === "messages" && (
        <div className="space-y-2 text-xs">
          {[
            { f: "Mr. Okonkwo", m: "Ama is excelling in algebra — keep it up!", t: "2h" },
            { f: "School Admin", m: "PTA meeting this Friday at 4pm.", t: "1d" },
          ].map(m => (
            <div key={m.f} className="rounded-lg border border-border p-3">
              <div className="flex justify-between"><span className="font-semibold">{m.f}</span><span className="text-[10px] text-muted-foreground">{m.t}</span></div>
              <div className="text-muted-foreground mt-1">{m.m}</div>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

const DEMOS: Record<PortalKey, () => JSX.Element> = {
  admin: AdminDemo,
  teacher: TeacherDemo,
  student: StudentDemo,
  parent: ParentDemo,
};

export default function PortalDemo() {
  const [active, setActive] = useState<PortalKey>("admin");
  const Demo = DEMOS[active];
  const activeMeta = PORTALS.find(p => p.key === active)!;

  return (
    <section id="demo" className="border-b border-border/60 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-background border border-border">
            <span className="size-1.5 rounded-full bg-success animate-pulse" /> Live interactive demo
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-4">See every portal in action</h2>
          <p className="text-muted-foreground mt-3">Click any tab, sidebar item, stat or card — every section is live and clickable.</p>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {PORTALS.map((p) => {
            const isActive = p.key === active;
            return (
              <button
                key={p.key}
                onClick={() => setActive(p.key)}
                className={cn(
                  "relative px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium border transition-all duration-300 overflow-hidden",
                  isActive
                    ? "text-white border-transparent shadow-lg"
                    : "bg-white/[0.04] text-muted-foreground border-white/10 hover:text-foreground hover:bg-white/[0.08] hover:border-white/20 backdrop-blur-md",
                )}
                style={isActive ? {
                  background: p.color,
                  boxShadow: `0 0 30px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.7)")}, 0 0 60px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.5)")}, 0 0 90px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.3)")}, 0 0 120px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.15)")}`,
                } : {
                  boxShadow: `0 0 16px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.35)")}, 0 0 32px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.15)")}, inset 0 0 12px ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.08)")}`,
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {!isActive && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-90" style={{ background: p.color }} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: p.color }} />
                    </span>
                  )}
                  {p.label}
                </span>
                <span className={cn(
                  "ml-2 text-[10px] hidden sm:inline relative z-10",
                  isActive ? "opacity-80" : "opacity-60",
                )}>{p.subtitle}</span>
                {isActive && (
                  <span className="absolute inset-0 opacity-20 rounded-md" style={{
                    background: `radial-gradient(circle at 50% 0%, ${p.color.replace("hsl(", "hsla(").replace(")", " / 0.8)")}, transparent 70%)`,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Demo frame */}
        <div className="mt-8 relative">
          <div className="relative max-w-4xl mx-auto">
            <Demo />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">Ready to set this up for your school?</p>
          <div className="mt-3 flex flex-wrap gap-3 justify-center">
            <Button asChild><a href="/register">Get started free</a></Button>
            <Button variant="outline" asChild><a href="/signin">Sign in</a></Button>
          </div>
        </div>
      </div>
    </section>
  );
}