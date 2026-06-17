import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { LifeBuoy, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Cat { id: string; name: string; slug: string; }
interface Ticket { id: string; subject: string; status: string; priority: string | null; created_at: string; opened_by: string; }
interface Msg { id: string; author: string; body: string; internal: boolean; created_at: string; }

const STATUS = ["open", "in_progress", "waiting", "resolved", "closed"] as const;

export default function TicketsView() {
  const { school, user, activeRole } = useSchool();
  const isAdmin = activeRole === "admin";
  const [cats, setCats] = useState<Cat[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [body, setBody] = useState("");

  // detail dialog
  const [active, setActive] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const refresh = async () => {
    if (!school || !user) return;
    const baseSel = (supabase as any).from("support_tickets")
      .select("id,subject,status,priority,created_at,opened_by").eq("school_id", school.id);
    const filtered = isAdmin ? baseSel : baseSel.eq("opened_by", user.id);
    const [c, t] = await Promise.all([
      (supabase as any).from("support_ticket_categories").select("id,name,slug").eq("school_id", school.id).eq("is_active", true),
      filtered.order("created_at", { ascending: false }).limit(100),
    ]);
    setCats((c.data ?? []) as Cat[]);
    setTickets((t.data ?? []) as Ticket[]);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [school?.id, user?.id, isAdmin]);

  const openTicket = async (t: Ticket) => {
    setActive(t); setReply("");
    const { data } = await supabase.from("support_messages")
      .select("id,author,body,internal,created_at").eq("ticket_id", t.id)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
  };

  const create = async () => {
    if (!user || !school || !subject.trim() || !body.trim()) return;
    const { data: ticket, error } = await supabase.from("support_tickets")
      .insert({ subject, opened_by: user.id, school_id: school.id, status: "open", priority: "normal" } as any)
      .select("id,subject,status,priority,created_at,opened_by").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("support_messages").insert({ ticket_id: ticket!.id, author: user.id, body } as any);
    toast.success("Ticket created");
    setOpen(false); setSubject(""); setBody(""); refresh();
  };

  const sendReply = async () => {
    if (!active || !user || !reply.trim()) return;
    const { error } = await supabase.from("support_messages")
      .insert({ ticket_id: active.id, author: user.id, body: reply } as any);
    if (error) return toast.error(error.message);
    setReply("");
    openTicket(active);
  };

  const changeStatus = async (status: string) => {
    if (!active) return;
    const { error } = await supabase.from("support_tickets").update({ status } as any).eq("id", active.id);
    if (error) return toast.error(error.message);
    setActive({ ...active, status }); refresh();
  };

  return (
    <div className="h-full overflow-auto p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><LifeBuoy className="size-6"/> Support Tickets</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1"/> New Ticket</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create support ticket</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)}/></div>
              <div>
                <Label>Category</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background"
                  value={category} onChange={(e) => setCategory(e.target.value)}>
                  {cats.length === 0 && <option value="general">General</option>}
                  {cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div><Label>Describe the issue</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}/></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {tickets.length === 0 && <div className="text-sm text-muted-foreground py-12 text-center">No tickets yet.</div>}
        {tickets.map((t) => (
          <button key={t.id} onClick={() => openTicket(t)} className="w-full text-left rounded-xl border bg-card p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
            <div className="min-w-0">
              <div className="font-semibold truncate">{t.subject}</div>
              <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
            </div>
            <Badge variant="secondary" className="ml-auto capitalize">{t.status.replace("_", " ")}</Badge>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {active?.subject}
              <Badge variant="secondary" className="capitalize ml-2">{active?.status.replace("_", " ")}</Badge>
            </DialogTitle>
          </DialogHeader>
          {isAdmin && active && (
            <div className="flex items-center gap-2 text-sm">
              <Label className="m-0">Status</Label>
              <select className="h-8 border rounded-md px-2 bg-background text-sm"
                value={active.status} onChange={(e) => changeStatus(e.target.value)}>
                {STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          )}
          <div className="max-h-[50vh] overflow-y-auto space-y-2 border rounded-md p-3 bg-muted/30">
            {msgs.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No replies yet.</div>}
            {msgs.map((m) => (
              <div key={m.id} className={`rounded-lg p-2.5 text-sm ${m.author === user?.id ? "bg-primary/10 ml-8" : "bg-card mr-8"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Reply…" className="flex-1"/>
            <Button onClick={sendReply} disabled={!reply.trim()}><Send className="size-4"/></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
