import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Search, ArrowLeft, Check, CheckCheck, WifiOff, Sparkles, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Composer } from "@/components/tutor/Composer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentView } from "@/components/tutor/MessageBubble";
import { Attachment } from "@/lib/uploads";
import { useOnlineStatus } from "@/lib/realtime-status";

/** Messaging UI — peer list (school members) + thread view + composer with
 *  realtime updates, typing indicators, read receipts, and offline awareness. */
export function MessagesPanel() {
  const { school, user } = useSchool();
  const online = useOnlineStatus();
  const [peers, setPeers] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const peerTypingTimerRef = useRef<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [seedText, setSeedText] = useState<string | undefined>(undefined);
  const [seedNonce, setSeedNonce] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  async function summarizeThread() {
    if (!school || !thread.length) { toast.error("Nothing to summarize yet"); return; }
    setSummarizing(true);
    setSummary(null);
    const transcript = thread.slice(-50).map((m: any) => {
      const who = m.sender_id === user!.id ? "Me" : (active?.profile?.full_name || "Them");
      return `${who}: ${m.body ?? ""}`;
    }).join("\n");
    const { data, error } = await supabase.functions.invoke("comms-ai-assist", {
      body: { school_id: school.id, intent: "summarize", text: transcript },
    });
    setSummarizing(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    setSummary((data as any).text ?? "");
  }

  async function aiAssist(intent: "draft" | "improve") {
    if (!school) return;
    const source = intent === "improve" ? aiNotes : aiNotes;
    if (!source.trim()) { toast.error("Type a few notes first"); return; }
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("comms-ai-assist", {
      body: {
        school_id: school.id, intent, text: source,
        options: { purpose: `direct message to ${active?.profile?.full_name ?? "a colleague"}` },
      },
    });
    setAiBusy(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    setSeedText((data as any).text ?? "");
    setSeedNonce((n) => n + 1);
    setAiOpen(false);
    setAiNotes("");
  }

  // Load school members
  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const { data: ms } = await supabase.from("memberships")
        .select("user_id,role").eq("school_id", school.id).eq("status", "active").neq("user_id", user.id);
      const ids = (ms ?? []).map(m => m.user_id);
      if (!ids.length) return setPeers([]);
      const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: ids });
      const map = new Map((profs ?? []).map(p => [p.id, p]));
      setPeers((ms ?? []).map(m => ({ ...m, profile: map.get(m.user_id) })));
    })();
  }, [school?.id, user?.id]);

  const markThreadRead = useCallback(async () => {
    if (!active || !user || !school) return;
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("school_id", school.id).eq("sender_id", active.user_id).eq("recipient_id", user.id).is("read_at", null);
  }, [active?.user_id, user?.id, school?.id]);

  // Load thread + subscribe to realtime INSERT and UPDATE (for read receipts)
  useEffect(() => {
    if (!active || !user || !school) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("messages").select("*")
        .eq("school_id", school.id)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${active.user_id}),and(sender_id.eq.${active.user_id},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setThread(data ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      await markThreadRead();
    };
    load();

    const nonce1 = Math.random().toString(36).slice(2, 10);
    const ch = supabase.channel(`msg-thread:${user.id}:${active.user_id}:${nonce1}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const m = payload.new;
        if (!m) return;
        const inThread = (m.sender_id === user.id && m.recipient_id === active.user_id)
                      || (m.sender_id === active.user_id && m.recipient_id === user.id);
        if (!inThread) return;
        setThread(t => t.some(x => x.id === m.id) ? t : [...t, m]);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        if (m.recipient_id === user.id) markThreadRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload: any) => {
        const m = payload.new;
        if (!m) return;
        setThread(t => t.map(x => x.id === m.id ? { ...x, ...m } : x));
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setReconnecting(true);
        if (status === "SUBSCRIBED") setReconnecting(false);
      });

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [active?.user_id, user?.id, school?.id, markThreadRead]);

  // Typing-indicator channel (broadcast — no DB writes)
  useEffect(() => {
    if (!active || !user) return;
    const ids = [user.id, active.user_id].sort();
    const nonce2 = Math.random().toString(36).slice(2, 10);
    const ch = supabase.channel(`typing:${ids[0]}:${ids[1]}:${nonce2}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload: any) => {
        if (payload?.payload?.user_id !== active.user_id) return;
        setPeerTyping(true);
        if (peerTypingTimerRef.current) window.clearTimeout(peerTypingTimerRef.current);
        peerTypingTimerRef.current = window.setTimeout(() => setPeerTyping(false), 2500);
      })
      .subscribe();
    typingChannelRef.current = ch;
    return () => {
      if (peerTypingTimerRef.current) window.clearTimeout(peerTypingTimerRef.current);
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
      setPeerTyping(false);
    };
  }, [active?.user_id, user?.id]);

  function notifyTyping(text: string) {
    if (!text.trim() || !typingChannelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return; // throttle
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
  }

  async function sendComposer(body: string, attachments: Attachment[]) {
    if (!active || !user || !school) return;
    if (!body.trim() && !attachments.length) return;
    if (!online) { toast.error("You're offline — message not sent"); return; }
    const { error } = await supabase.from("messages").insert({
      school_id: school.id, sender_id: user.id, recipient_id: active.user_id,
      body: body || "(attachment)", attachments: attachments as any,
    });
    if (error) toast.error(error.message);
  }

  const filtered = peers.filter(p =>
    !filter || (p.profile?.full_name || p.profile?.email || "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[500px]">
      <SectionCard title="Conversations" className={`flex-col ${active ? "hidden md:flex" : "flex"}`}>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search" value={filter} onChange={e => setFilter(e.target.value)} className="pl-9" />
        </div>
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {filtered.length === 0 ? <EmptyState icon={MessagesSquare} title="No people" /> :
            <ul className="space-y-1">{filtered.map(p => (
              <li key={p.user_id}>
                <button onClick={() => setActive(p)} className={`w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-muted ${active?.user_id === p.user_id ? "bg-muted" : ""}`}>
                  <Avatar className="size-9">{p.profile?.photo_url && <AvatarImage src={p.profile.photo_url} />}<AvatarFallback className="text-xs">{(p.profile?.full_name || p.profile?.email || "?")[0].toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{p.profile?.full_name || p.profile?.email}</div><div className="text-[11px] text-muted-foreground capitalize">{p.role}</div></div>
                </button>
              </li>
            ))}</ul>}
        </div>
      </SectionCard>

      <SectionCard
        title={
          active ? (
            <span className="flex items-center gap-2">
              <button onClick={() => setActive(null)} className="md:hidden -ml-1 p-1 rounded-md hover:bg-muted" aria-label="Back">
                <ArrowLeft className="size-4" />
              </button>
              <span className="truncate">{active.profile?.full_name || active.profile?.email}</span>
              {peerTyping && <span className="text-[11px] font-normal text-muted-foreground italic">typing…</span>}
              {(!online || reconnecting) && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-amber-600">
                  <WifiOff className="size-3" /> {!online ? "Offline" : "Reconnecting"}
                </span>
              )}
            </span>
          ) : "Select a conversation"
        }
        className={`flex-col ${active ? "flex" : "hidden md:flex"}`}
      >
        {!active ? <EmptyState icon={MessagesSquare} title="Pick a conversation" desc="Choose someone on the left to start chatting." /> :
          <>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {thread.length === 0 ? <div className="text-sm text-muted-foreground text-center py-10">Say hi 👋</div> :
                thread.map(m => {
                  const mine = m.sender_id === user!.id;
                  const atts = (m.attachments as Attachment[]) ?? [];
                  return (
                    <div key={m.id} className={`max-w-[80%] ${mine ? "ml-auto" : ""} space-y-1.5`}>
                      {atts.map((a, i) => <AttachmentView key={i} a={a} mine={mine} />)}
                      {m.body && m.body !== "(attachment)" && (
                        <div className={`rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {m.body}
                          <div className="flex items-center gap-1 justify-end text-[10px] opacity-70 mt-0.5">
                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {mine && (
                              m.read_at
                                ? <CheckCheck className="size-3" />
                                : <Check className="size-3" />
                            )}
                          </div>
                        </div>
                      )}
                      {mine && !m.body?.trim() && atts.length > 0 && (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                          {m.read_at ? <CheckCheck className="size-3" /> : <Check className="size-3" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              {peerTyping && (
                <div className="max-w-[80%]">
                  <div className="inline-flex items-center gap-1 rounded-lg px-3 py-2 bg-muted text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-current animate-bounce" />
                    <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
                    <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="-mx-4 -mb-4">
              <div className="px-3 pt-2 flex justify-end">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs mr-1"
                  disabled={summarizing} onClick={summarizeThread}>
                  {summarizing ? <Loader2 className="size-3 mr-1 animate-spin"/> : <FileText className="size-3 mr-1"/>}
                  Summarize
                </Button>
                <Popover open={aiOpen} onOpenChange={setAiOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs">
                      <Sparkles className="size-3 mr-1"/> AI assist
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="space-y-2">
                      <div className="text-xs font-medium">Notes for the AI</div>
                      <Textarea rows={4} value={aiNotes} onChange={(e) => setAiNotes(e.target.value)}
                        placeholder="e.g. Remind parent about PTM on Friday 4pm, polite tone"/>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => aiAssist("improve")}>
                          {aiBusy ? <Loader2 className="size-3 animate-spin"/> : <Sparkles className="size-3"/>}
                          <span className="ml-1">Improve</span>
                        </Button>
                        <Button size="sm" disabled={aiBusy} onClick={() => aiAssist("draft")}>
                          {aiBusy ? <Loader2 className="size-3 animate-spin"/> : <Sparkles className="size-3"/>}
                          <span className="ml-1">Draft</span>
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Composer
                bucket="message-attachments"
                userId={user!.id}
                prefix={`dm-${active.user_id}`}
                placeholder={online ? "Type a message…" : "Offline — reconnect to send"}
                disabled={!online}
                transcribeVoice={false}
                onSubmit={sendComposer}
                onTextChange={notifyTyping}
                seedText={seedText}
                seedNonce={seedNonce}
              />
            </div>
          </>}
      </SectionCard>
    </div>
  );
}
