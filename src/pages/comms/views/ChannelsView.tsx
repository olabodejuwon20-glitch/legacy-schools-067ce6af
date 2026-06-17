import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchMessages, sendMessage, markRead, relTime, type ConversationMessage } from "@/lib/comms";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Channel { id: string; title: string; channel_type: string; metadata: any; }

export default function ChannelsView() {
  const { school, user } = useSchool();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      setLoading(true);
      const { data: parts } = await supabase
        .from("conversation_participants").select("conversation_id").eq("user_id", user.id);
      const ids = (parts ?? []).map((p) => p.conversation_id);
      if (!ids.length) { setChannels([]); setLoading(false); return; }
      const { data: convs } = await supabase
        .from("conversations").select("id,title,channel_type,metadata")
        .eq("school_id", school.id).in("id", ids)
        .in("channel_type", ["class", "subject", "group"]).order("title");
      setChannels((convs ?? []) as Channel[]);
      setLoading(false);
    })();
  }, [school?.id, user?.id]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    fetchMessages(activeId).then(setMessages).catch(() => {});
    if (user) markRead(activeId, user.id);
    const nonce = Math.random().toString(36).slice(2, 10);
    const ch = supabase.channel(`channel:${activeId}:${nonce}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((m) => [...m, payload.new as ConversationMessage]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, user?.id]);

  const handleSend = async () => {
    if (!draft.trim() || !activeId || !school || !user) return;
    const body = draft; setDraft("");
    try { await sendMessage({ conversationId: activeId, schoolId: school.id, senderId: user.id, body }); }
    catch (e: any) { toast.error(e?.message || "Failed to send"); setDraft(body); }
  };

  const active = channels.find((c) => c.id === activeId);

  return (
    <div className="h-full grid grid-cols-[260px_1fr]">
      <aside className="border-r overflow-y-auto bg-card/30">
        <div className="px-3 py-3 text-xs font-semibold uppercase text-muted-foreground">Channels</div>
        {loading && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin"/> Loading…</div>}
        {!loading && channels.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No channels yet. They auto-create when classes are set up.</div>
        )}
        {channels.map((c) => (
          <button key={c.id} onClick={() => setActiveId(c.id)}
            className={cn("w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted",
              activeId === c.id && "bg-primary/10 text-primary font-medium")}>
            <Hash className="size-4 opacity-70"/>
            <span className="truncate">{c.title || "Untitled"}</span>
            <span className="ml-auto text-[10px] uppercase opacity-60">{c.channel_type}</span>
          </button>
        ))}
      </aside>
      <section className="flex flex-col min-h-0">
        {!active ? (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Select a channel</div>
        ) : (
          <>
            <header className="px-4 py-3 border-b flex items-center gap-2">
              <Hash className="size-4 opacity-70"/>
              <div className="font-semibold">{active.title}</div>
              <span className="ml-2 text-xs text-muted-foreground capitalize">{active.channel_type}</span>
            </header>
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-2">
                {messages.length === 0 && <div className="text-center text-xs text-muted-foreground py-10">No messages yet</div>}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine && "justify-end")}>
                      <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                        mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary rounded-bl-sm")}>
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className="text-[10px] mt-1 opacity-70">{relTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2 items-end">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message channel…" className="resize-none min-h-[44px] max-h-32" />
              <Button onClick={handleSend} disabled={!draft.trim()} className="h-11">Send</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}