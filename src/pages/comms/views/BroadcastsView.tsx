import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Radio, Plus, Loader2, Send, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Job {
  id: string; title: string; body: string; status: string;
  scheduled_for: string | null; sent_at: string | null;
  audience: any; channels: string[]; created_at: string; stats: any;
}
interface Tpl { id: string; name: string; subject: string | null; body: string; }

export default function BroadcastsView() {
  const { school, user } = useSchool();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [roles, setRoles] = useState<string>("admin,teacher,student,parent");
  const [scheduledFor, setScheduledFor] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const refresh = async () => {
    if (!school) return;
    setLoading(true);
    const [jobsR, tplR] = await Promise.all([
      supabase.from("broadcast_jobs")
        .select("id,title,body,status,scheduled_for,sent_at,audience,channels,created_at,stats")
        .eq("school_id", school.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("comms_templates")
        .select("id,name,subject,body").eq("school_id", school.id).order("name"),
    ]);
    setJobs((jobsR.data ?? []) as Job[]);
    setTpls((tplR.data ?? []) as Tpl[]);
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [school?.id]);

  const create = async () => {
    if (!school || !user || !title.trim() || !body.trim()) return;
    const audience = { roles: roles.split(",").map((r) => r.trim()).filter(Boolean) };
    const status = scheduledFor ? "scheduled" : "draft";
    const { error } = await supabase.from("broadcast_jobs").insert({
      school_id: school.id, created_by: user.id, title, body, audience, status,
      scheduled_for: scheduledFor || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(scheduledFor ? "Broadcast scheduled" : "Draft saved");
    setOpen(false); setTitle(""); setBody(""); setScheduledFor(""); refresh();
  };

  const sendNow = async (id: string) => {
    setSendingId(id);
    const { data, error } = await supabase.functions.invoke("broadcast-dispatch", { body: { job_id: id } });
    setSendingId(null);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    toast.success(`Sent to ${(data as any)?.recipients ?? 0} recipients`);
    refresh();
  };

  const applyTemplate = (id: string) => {
    const t = tpls.find((x) => x.id === id);
    if (!t) return;
    if (t.subject && !title) setTitle(t.subject);
    setBody((prev) => prev ? `${prev}\n\n${t.body}` : t.body);
  };

  const aiAssist = async (intent: "draft" | "improve") => {
    if (!school) return;
    if (intent === "improve" && !body.trim()) { toast.error("Write something first"); return; }
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("comms-ai-assist", {
      body: { school_id: school.id, intent, text: body || title, options: { purpose: title || "announcement" } },
    });
    setAiBusy(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    setBody((data as any).text ?? "");
  };

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2 min-w-0">
          <Radio className="size-5 sm:size-6 shrink-0"/>
          <span className="truncate">Broadcast Center</span>
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="shrink-0"><Plus className="size-4 mr-1"/> New Broadcast</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New broadcast</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {tpls.length > 0 && (
                <div>
                  <Label className="flex items-center gap-1"><FileText className="size-3.5"/> Insert template</Label>
                  <select className="w-full h-10 border rounded-md px-3 bg-background"
                    onChange={(e) => { applyTemplate(e.target.value); e.currentTarget.value = ""; }} defaultValue="">
                    <option value="">— pick a template —</option>
                    {tpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Holiday notice"/></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Message</Label>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => aiAssist("draft")} className="h-7 text-xs">
                      <Sparkles className="size-3 mr-1"/> Draft
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => aiAssist("improve")} className="h-7 text-xs">
                      <Sparkles className="size-3 mr-1"/> Improve
                    </Button>
                  </div>
                </div>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}/>
                {aiBusy && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="size-3 animate-spin"/> AI thinking…</div>}
              </div>
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
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="font-semibold min-w-0 truncate">{j.title}</div>
              <Badge variant="secondary" className="capitalize">{j.status}</Badge>
              {(j.status === "draft" || j.status === "scheduled") && (
                <Button size="sm" variant="outline" className="ml-auto" disabled={sendingId === j.id} onClick={() => sendNow(j.id)}>
                  {sendingId === j.id ? <Loader2 className="size-3.5 animate-spin"/> : <Send className="size-3.5"/>}
                  <span className="ml-1">Send now</span>
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{j.body}</p>
            <div className="text-[11px] text-muted-foreground mt-2 flex gap-3 flex-wrap">
              {j.scheduled_for && <span>Scheduled: {new Date(j.scheduled_for).toLocaleString()}</span>}
              {j.sent_at && <span>Sent: {new Date(j.sent_at).toLocaleString()}</span>}
              <span>Channels: {(j.channels || []).join(", ") || "in_app"}</span>
              {j.stats?.recipients != null && <span>Recipients: {j.stats.recipients}</span>}
              {j.stats?.delivered != null && <span>Delivered: {j.stats.delivered}</span>}
            </div>
          </div>
        ))}
        {!loading && jobs.length === 0 && <div className="text-sm text-muted-foreground py-12 text-center">No broadcasts yet.</div>}
      </div>
    </div>
  );
}
