import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, BookOpen, CalendarDays, Brain, PanelLeftOpen, PanelLeftClose, ListChecks, Compass, GraduationCap, Zap, Menu, Plus } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { ConversationList, ConvItem } from "./ConversationList";
import { Attachment } from "@/lib/uploads";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; attachments?: Attachment[] }

const SUGGESTIONS_STUDENT = [
  { icon: Brain, label: "Quiz me on photosynthesis", skill: "quiz", input: { topic: "photosynthesis" } },
  { icon: ListChecks, label: "Walk me through quadratic equations step by step", skill: "explain_steps", input: { topic: "quadratic equations" } },
  { icon: Compass, label: "What should I study next?", skill: "recommend" },
  { icon: BookOpen, label: "Explain my last exam", skill: "explain_exam" },
  { icon: CalendarDays, label: "Plan my study week", skill: "plan_week" },
  { icon: Sparkles, label: "Summarize the note I uploaded", skill: "summarize" },
];
const SUGGESTIONS_TEACHER = [
  { icon: BookOpen, label: "Draft a lesson plan for Algebra Y9" },
  { icon: Brain, label: "Generate 10 MCQ on cell division" },
  { icon: Sparkles, label: "Write a parent note about late homework" },
  { icon: CalendarDays, label: "Build a weekly scheme of work" },
];

export function TutorChat({ portalRole }: { portalRole: "student" | "teacher" }) {
  const { school, user } = useSchool();
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stepsMode, setStepsMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const { data } = await supabase.from("ai_conversations")
        .select("id,title,pinned,last_message_at")
        .eq("user_id", user.id).eq("school_id", school.id).eq("archived", false)
        .order("pinned", { ascending: false })
        .order("last_message_at", { ascending: false }).limit(80);
      setConversations((data ?? []) as ConvItem[]);
      if (!activeId && data && data.length) setActiveId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school, user]);

  // Load messages for active
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      const { data } = await supabase.from("ai_chats")
        .select("role,content,attachments")
        .eq("conversation_id", activeId).order("created_at", { ascending: true }).limit(200);
      setMessages((data ?? []).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        attachments: (m.attachments as any[]) ?? [],
      })));
    })();
  }, [activeId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }); }, [messages, streamText]);

  async function newConversation(): Promise<string | null> {
    if (!school || !user) return null;
    const { data, error } = await supabase.from("ai_conversations").insert({
      school_id: school.id, user_id: user.id, title: "New chat",
    }).select("id,title,pinned,last_message_at").single();
    if (error) { toast.error(error.message); return null; }
    setConversations(c => [data as ConvItem, ...c]);
    setActiveId(data.id);
    setMessages([]);
    return data.id;
  }

  async function rename(id: string, title: string) {
    await supabase.from("ai_conversations").update({ title }).eq("id", id);
    setConversations(cs => cs.map(c => c.id === id ? { ...c, title } : c));
  }
  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("ai_conversations").update({ pinned }).eq("id", id);
    setConversations(cs => cs.map(c => c.id === id ? { ...c, pinned } : c));
  }
  async function remove(id: string) {
    await supabase.from("ai_conversations").delete().eq("id", id);
    setConversations(cs => cs.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function runSkill(skill: string, input: any = {}) {
    if (!school || !user) return;
    let convId = activeId;
    if (!convId) { convId = await newConversation(); if (!convId) return; }
    setStreaming(true); setStreamText("");
    setMessages(m => [...m, { role: "user", content: input.topic ? `Quiz me on ${input.topic}` : skillLabel(skill) }]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: { conversation_id: convId, school_id: school.id, role: portalRole, skill, skill_input: input },
      });
      if (error) throw error;
      setMessages(m => [...m, { role: "assistant", content: data?.reply ?? "" }]);
      bumpConv(convId);
    } catch (e: any) {
      toast.error(e?.message || "Tutor failed");
    } finally {
      setStreaming(false); setStreamText("");
    }
  }

  function skillLabel(s: string) {
    return s === "explain_exam" ? "Explain my last exam"
      : s === "plan_week" ? "Plan my study week"
      : s === "summarize" ? "Summarize my notes"
      : s === "explain_steps" ? "Break this down step-by-step"
      : s === "recommend" ? "What should I study next?"
      : "Quiz me";
  }

  function bumpConv(id: string) {
    setConversations(cs => {
      const i = cs.findIndex(c => c.id === id);
      if (i < 0) return cs;
      const updated = { ...cs[i], last_message_at: new Date().toISOString() };
      return [updated, ...cs.filter(c => c.id !== id)];
    });
  }

  async function send(text: string, attachments: Attachment[]) {
    if (!school || !user) return;
    let convId = activeId;
    if (!convId) { convId = await newConversation(); if (!convId) return; }
    // Route through explain_steps skill when toggle is on (student only).
    if (stepsMode && portalRole === "student" && text.trim()) {
      setStepsMode(false);
      await runSkill("explain_steps", { topic: text.trim() });
      return;
    }
    setMessages(m => [...m, { role: "user", content: text, attachments }]);
    setStreaming(true); setStreamText("");
    abortRef.current = new AbortController();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          conversation_id: convId, school_id: school.id, role: portalRole,
          message: text, attachments,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        let msg = "Tutor failed";
        try { msg = JSON.parse(txt).error || msg; } catch {}
        toast.error(msg);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (typeof c === "string") { acc += c; setStreamText(acc); }
          } catch { /* partial chunk */ }
        }
      }
      setMessages(m => [...m, { role: "assistant", content: acc }]);
      setStreamText("");
      bumpConv(convId);
      // refresh title if it was new
      const { data: convFresh } = await supabase.from("ai_conversations").select("title").eq("id", convId).maybeSingle();
      if (convFresh) setConversations(cs => cs.map(c => c.id === convId ? { ...c, title: convFresh.title } : c));
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message || "Stream failed");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() { abortRef.current?.abort(); }

  // Compute follow-up actions for the latest assistant message only.
  function lastAssistantActions(): { label: string; onClick: () => void; icon?: any }[] {
    if (portalRole !== "student") return [];
    if (streaming) return [];
    const lastIdx = messages.length - 1;
    if (lastIdx < 0 || messages[lastIdx].role !== "assistant") return [];
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const topic = (lastUser?.content || "").slice(0, 120).trim() || "this topic";
    return [
      { icon: Brain, label: "Quiz me on this", onClick: () => runSkill("quiz", { topic }) },
      { icon: Zap, label: "Try a harder one", onClick: () => runSkill("quiz", { topic, difficulty: "hard" }) },
      { icon: GraduationCap, label: "Explain like I'm 12", onClick: () => runSkill("explain_steps", { topic, level: "simple, like I'm 12" }) },
    ];
  }

  const suggestions = portalRole === "student" ? SUGGESTIONS_STUDENT : SUGGESTIONS_TEACHER;
  const intro = portalRole === "student"
    ? "Your study companion. Ask anything, upload notes, record a question."
    : "Your teaching co-pilot. Plan lessons, draft messages, generate questions.";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex h-[calc(100dvh-140px)] sm:h-[calc(100vh-180px)] min-h-[500px]">
      {/* Sidebar */}
      <aside className={cn(
        "border-r border-border bg-background/50 transition-all duration-200 shrink-0",
        sidebarOpen ? "w-[260px]" : "w-0 -ml-px overflow-hidden",
        "hidden md:block",
      )}>
        <ConversationList
          items={conversations}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setMobileNavOpen(false); }}
          onNew={() => newConversation()}
          onRename={rename}
          onDelete={remove}
          onTogglePin={togglePin}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border">
          {/* Mobile drawer trigger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="size-9 md:hidden" aria-label="Conversations">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[85vw] max-w-[300px]">
              <ConversationList
                items={conversations}
                activeId={activeId}
                onSelect={(id) => { setActiveId(id); setMobileNavOpen(false); }}
                onNew={async () => { await newConversation(); setMobileNavOpen(false); }}
                onRename={rename}
                onDelete={remove}
                onTogglePin={togglePin}
              />
            </SheetContent>
          </Sheet>
          <Button size="icon" variant="ghost" className="size-8 hidden md:inline-flex" onClick={() => setSidebarOpen(s => !s)}>
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <Sparkles className="size-4 sm:size-5 text-primary" />
          <div className="font-semibold text-sm sm:text-base truncate">{portalRole === "teacher" ? "Legacy Co-Teacher" : "Legacy Tutor"}</div>
          <div className="ml-auto md:hidden">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => newConversation()}>
              <Plus className="size-3.5" /> New
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 sm:py-6 space-y-5 sm:space-y-6">
          {messages.length === 0 && !streaming ? (
            <div className="px-4 max-w-2xl mx-auto text-center py-8 sm:py-20">
              <div className="mx-auto size-11 sm:size-12 rounded-2xl bg-primary/10 grid place-items-center mb-3 sm:mb-4">
                <Sparkles className="size-5 sm:size-6 text-primary" />
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold mb-2">How can I help you today?</h2>
              <p className="text-[13px] sm:text-sm text-muted-foreground mb-5 sm:mb-6">{intro}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {suggestions.map((s: any, i) => (
                  <button key={i}
                    onClick={() => s.skill ? runSkill(s.skill, s.input) : send(s.label, [])}
                    className="rounded-xl border border-border bg-background hover:bg-secondary/60 active:bg-secondary p-3 flex items-start gap-3 text-[13px] sm:text-sm transition-colors text-left">
                    <s.icon className="size-4 text-primary mt-0.5 shrink-0" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const actions = lastAssistantActions();
                const lastIdx = messages.length - 1;
                return messages.map((m, i) => (
                  <MessageBubble key={i} role={m.role} content={m.content} attachments={m.attachments}
                    actions={i === lastIdx && m.role === "assistant" ? actions : undefined} />
                ));
              })()}
              {streaming && (
                <MessageBubble role="assistant" content={streamText} streaming />
              )}
            </>
          )}
        </div>

        {user && (
          <>
          {portalRole === "student" && (
            <div className="px-3 sm:px-4 pt-2 -mb-1 flex justify-center">
              <button
                type="button"
                onClick={() => setStepsMode(s => !s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                  stepsMode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                )}
                title="Next message will be answered as a numbered, scaffolded breakdown"
              >
                <ListChecks className="size-3.5" />
                {stepsMode ? "Step-by-step mode on" : "Step-by-step mode"}
              </button>
            </div>
          )}
          <Composer
            bucket="tutor-uploads"
            userId={user.id}
            prefix={activeId ?? "new"}
            busy={streaming}
            onStop={stop}
            placeholder={portalRole === "teacher" ? "Ask your co-teacher anything…" : "Ask anything — I'll help you learn"}
            onSubmit={send}
            schoolId={school.id}
          />
          </>
        )}
      </div>
    </div>
  );
}