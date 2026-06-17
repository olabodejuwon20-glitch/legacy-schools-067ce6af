import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Radio, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Job { id: string; title: string; body: string; status: string; scheduled_for: string | null; sent_at: string | null; audience: any; channels: string[]; created_at: string; }

export default function BroadcastsView() {
  const { school, user } = useSchool();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [roles, setRoles] = useState<string>("admin,teacher,student,parent");
  const [scheduledFor, setScheduledFor] = useState("");

  const refresh = async () => {
    if (!school) return;
    setLoading(true);
    const { data } = await (supabase as any).from("broadcast_jobs")
      .select("id,title,body,status,scheduled_for,sent_at,audience,channels,created_at")
      .eq("school_id", school.id).order("created_at", { ascending: false }).limit(50);
    setJobs((data ?? []) as Job[]); setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [school?.id]);

  const create = async () => {
    if (!school || !user || !title.trim() || !body.trim()) return;
    const audience = { roles: roles.split(",").map((r) => r.trim()).filter(Boolean) };
    const status = scheduledFor ? "scheduled" : "draft";
    const { error } = await (supabase as any).from("broadcast_jobs").insert({
      school_id: school.id, created_by: user.id, title, body, audience, status,
      scheduled_for: scheduledFor || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(scheduledFor ? "Broadcast scheduled" : "Draft saved");
    setOpen(false); setTitle(""); setBody(""); setScheduledFor(""); refresh();
  };

  return (
    <div className="h-full overflow-auto p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Radio className="size-6"/> Broadcast Center</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1"/> New Broadcast</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New broadcast</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Holiday notice"/></div>
              <div><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}/></div>
              <div><Label>Audience (roles)</Label><Input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="admin,teacher,student,parent"/></div>
              <div><Label>Schedule for (optional)</Label><Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}/></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>{scheduledFor ? "Schedule" : "Save draft"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin"/> Loading…</div>}
      <div className="space-y-2">
        {jobs.map((j) => (
          <div key={j.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-semibold">{j.title}</div>
              <Badge variant="secondary" className="ml-auto capitalize">{j.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{j.body}</p>
            <div className="text-[11px] text-muted-foreground mt-2 flex gap-3">
              {j.scheduled_for && <span>Scheduled: {new Date(j.scheduled_for).toLocaleString()}</span>}
              {j.sent_at && <span>Sent: {new Date(j.sent_at).toLocaleString()}</span>}
              <span>Channels: {(j.channels || []).join(", ") || "in_app"}</span>
            </div>
          </div>
        ))}
        {!loading && jobs.length === 0 && <div className="text-sm text-muted-foreground py-12 text-center">No broadcasts yet.</div>}
      </div>
    </div>
  );
}