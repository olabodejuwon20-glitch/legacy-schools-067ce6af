import { useRef, useState } from "react";
import { Sparkles, Send, Loader2, Wrench, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AIMarkdown } from "@/components/ai/AIMarkdown";

type Msg = { role: "user" | "assistant"; content: string; trace?: any[] };

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  admin: [
    "Which students are at risk this term?",
    "What's our fee collection rate this term?",
    "Where do I invite new teachers?",
    "How do I link a parent to their child?",
    "Show me the weakest 5 topics across all classes",
  ],
  teacher: [
    "Where do I take attendance?",
    "How do I create a test in the Test Builder?",
    "Where can I see my class gradebook?",
    "How do I message a parent?",
    "How do I publish a lesson note?",
  ],
  student: [
    "Where do I see my upcoming exams?",
    "How do I use the AI Tutor?",
    "How do I pay school fees?",
    "Where do I register my subjects?",
    "How do I review my last exam?",
  ],
  parent: [
    "Where do I see my child's results?",
    "How do I pay school fees for my child?",
    "Where do I message a teacher?",
    "How do I check attendance and behavior?",
    "Where is the academic calendar?",
  ],
};

export default function Copilot() {
  const { school, activeRole } = useSchool();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const role = activeRole ?? "admin";
  const suggestions = SUGGESTIONS_BY_ROLE[role] ?? SUGGESTIONS_BY_ROLE.admin;
  const title = role === "admin" ? "Principal Copilot" : "Portal Copilot";
  const description =
    role === "admin"
      ? "Ask anything about your school — attendance, fees, results, weak topics, approvals. I can also help you find any feature."
      : "Ask me where to find any feature on your portal, how to use it, and I'll send you straight there.";

  async function fallbackCopilot(query: string): Promise<{ reply: string; trace: any[] }> {
    const q = query.toLowerCase();
    const slug = school!.slug;
    const sid = school!.id;

    if (role === "admin" && /at risk|struggling|below|failing|low score/i.test(q)) {
      const { data } = await supabase
        .from("assessment_results")
        .select("student_id, percentage")
        .eq("school_id", sid)
        .lt("percentage", 50)
        .order("graded_at", { ascending: false })
        .limit(60);
      const rows = data ?? [];
      if (rows.length === 0) {
        return {
          reply: `No students currently have recorded assessment scores below **50%** this term.\n\n- View all learners in [Students](/${slug}/app/admin/students)\n- Check continuous assessment in [Assessments](/${slug}/app/admin/assessments-hub)`,
          trace: [{ tool: "students_at_risk" }],
        };
      }
      const byStudent = new Map<string, { sum: number; count: number }>();
      for (const r of rows) {
        const cur = byStudent.get(r.student_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(r.percentage);
        cur.count += 1;
        byStudent.set(r.student_id, cur);
      }
      const lines = [...byStudent.entries()]
        .slice(0, 10)
        .map(([id, v], i) => `${i + 1}. Student \`${id.slice(0, 8)}\` — **${Math.round(v.sum / v.count)}%** avg (${v.count} assessment${v.count > 1 ? "s" : ""} < 50%)`);
      return {
        reply: `Found **${byStudent.size}** student(s) averaging below 50%:\n\n${lines.join("\n")}\n\nOpen [Students](/${slug}/app/admin/students) or [Parent Alerts](/${slug}/app/admin/parent-alerts) to follow up.`,
        trace: [{ tool: "students_at_risk" }],
      };
    }

    if (role === "admin" && /fee|collection|invoice|payment|revenue|paid/i.test(q)) {
      const { data } = await supabase
        .from("school_invoices")
        .select("status, amount_due_kobo, amount_paid_kobo")
        .eq("school_id", sid);
      const rows = data ?? [];
      const due = rows.reduce((s, r: any) => s + Number(r.amount_due_kobo || 0), 0);
      const paid = rows.reduce((s, r: any) => s + Number(r.amount_paid_kobo || 0), 0);
      const rate = due ? Math.round((paid / due) * 100) : 0;
      return {
        reply: `### Fee Collection Summary\n- **Invoices issued:** ${rows.length}\n- **Total due:** ₦${Math.round(due / 100).toLocaleString()}\n- **Total collected:** ₦${Math.round(paid / 100).toLocaleString()}\n- **Collection rate:** **${rate}%**\n\nManage invoices and payments in [Fees & Payments](/${slug}/app/admin/fees).`,
        trace: [{ tool: "fee_collection_rate" }],
      };
    }

    if (role === "admin" && /weak.*topic|topic.*weak|mastery/i.test(q)) {
      const { data } = await supabase
        .from("student_topic_mastery")
        .select("topic, subject_code, ema_mastery")
        .eq("school_id", sid)
        .order("ema_mastery", { ascending: true })
        .limit(10);
      const rows = data ?? [];
      if (rows.length === 0) {
        return {
          reply: `No topic mastery data recorded yet. Once students complete practice or mock sessions, weak topics will appear here.\n\n- Set up questions in [Question Bank](/${slug}/app/admin/question-bank)`,
          trace: [{ tool: "top_weak_topics" }],
        };
      }
      const list = rows.slice(0, 5).map((r: any, i: number) => `${i + 1}. **${r.topic}** (${r.subject_code || "General"}) — ${Math.round(Number(r.ema_mastery) * 100)}% mastery`);
      return {
        reply: `### Weakest Topics Across Classes\n${list.join("\n")}`,
        trace: [{ tool: "top_weak_topics" }],
      };
    }

    if (/invite|onboarding code|add teacher|new teacher|new student/i.test(q)) {
      return {
        reply: `You can generate activation codes for teachers, students, and parents in **[Invites](/${slug}/app/admin/invites)** or **[Onboarding Center](/${slug}/app/admin/onboarding-center)**:\n\n1. Open [Invites](/${slug}/app/admin/invites)\n2. Select the role (**Teacher**, **Student**, or **Parent**) and click **Generate code**\n3. Share the 6-character code or join link \`/${slug}/join\` with your staff or students.`,
        trace: [],
      };
    }

    if (/link.*parent|parent.*child/i.test(q)) {
      return {
        reply: `To link a parent to their child:\n\n1. Go to **[Parents](/${slug}/app/admin/parents)**\n2. Select the parent account and choose the student(s) to link\n3. Save — the parent will immediately see their child's attendance, fees, and results.`,
        trace: [],
      };
    }

    return {
      reply: `Here are the key sections for your **${role}** portal:\n\n- [Dashboard](/${slug}/app/${role}) — Overview & quick actions\n- [Students](/${slug}/app/admin/students) & [Teachers](/${slug}/app/admin/teachers) — Manage people\n- [Invites](/${slug}/app/admin/invites) — Generate 6-character onboarding codes\n- [Fees & Payments](/${slug}/app/admin/fees) — Invoices & fee tracking\n- [Settings](/${slug}/app/admin/settings) — School profile, grading & branding`,
      trace: [],
    };
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !school || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("principal-copilot", {
        body: {
          school_id: school.id,
          school_slug: school.slug,
          role,
          message: content,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (!error && !data?.error && data?.reply) {
        setMessages([...next, { role: "assistant", content: data.reply, trace: data.tool_trace ?? [] }]);
      } else {
        const fb = await fallbackCopilot(content);
        setMessages([...next, { role: "assistant", content: fb.reply, trace: fb.trace }]);
      }
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
    } catch (e: any) {
      try {
        const fb = await fallbackCopilot(content);
        setMessages([...next, { role: "assistant", content: fb.reply, trace: fb.trace }]);
      } catch {
        toast.error(e?.message ?? "Copilot failed");
        setMessages(next);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={title}
      description={description}
      action={<Badge variant="secondary" className="gap-1"><Compass className="size-3" /> {role[0].toUpperCase() + role.slice(1)} portal</Badge>}
    >
      <div ref={scrollRef} className="h-[60vh] sm:h-[55vh] overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 sm:p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                : "bg-background border border-border"
            }`}>
              {m.role === "assistant" ? (
                <AIMarkdown content={m.content} compact />
              ) : m.content}
              {m.role === "assistant" && m.trace && m.trace.length > 0 && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer flex items-center gap-1">
                    <Wrench className="size-3" /> Tools used ({m.trace.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {m.trace.map((t, j) => (
                      <li key={j}><code className="text-[10px]">{t.tool}</code></li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask your school anything…"
          className="min-h-[60px] resize-none"
          disabled={busy}
        />
        <Button onClick={() => send()} disabled={busy || !input.trim()} className="self-end">
          <Send className="size-4" />
        </Button>
      </div>
    </SectionCard>
  );
}