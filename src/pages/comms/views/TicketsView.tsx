import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { LifeBuoy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Cat { id: string; name: string; slug: string; }
interface Ticket { id: string; subject: string; status: string; priority: string | null; created_at: string; category: string | null; }

export default function TicketsView() {
  const { school, user } = useSchool();
  const [cats, setCats] = useState<Cat[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [body, setBody] = useState("");

  const refresh = async () => {
    if (!school || !user) return;
    const [c, t] = await Promise.all([
      (supabase as any).from("support_ticket_categories").select("id,name,slug").eq("school_id", school.id).eq("is_active", true),
      supabase.from("support_tickets").select("id,subject,status,priority,created_at,category").eq("created_by", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setCats((c.data ?? []) as Cat[]);
    setTickets((t.data ?? []) as Ticket[]);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [school?.id, user?.id]);

  const create = async () => {
    if (!user || !subject.trim() || !body.trim()) return;
    const { data: ticket, error } = await supabase.from("support_tickets")
      .insert({ subject, category, created_by: user.id, status: "open", priority: "normal" } as any)
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("support_messages").insert({ ticket_id: ticket!.id, sender_id: user.id, body } as any);
    toast.success("Ticket created");
    setOpen(false); setSubject(""); setBody(""); refresh();
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
          <div key={t.id} className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{t.subject}</div>
              <div className="text-xs text-muted-foreground">{t.category || "general"} • {new Date(t.created_at).toLocaleString()}</div>
            </div>
            <Badge variant="secondary" className="ml-auto capitalize">{t.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}