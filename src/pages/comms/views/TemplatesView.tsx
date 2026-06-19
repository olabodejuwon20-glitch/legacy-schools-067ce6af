import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { FileText, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Tpl { id: string; name: string; category: string; subject: string | null; body: string; }

export default function TemplatesView() {
  const { school, user } = useSchool();
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const refresh = async () => {
    if (!school) return;
    const { data } = await supabase.from("comms_templates")
      .select("id,name,category,subject,body").eq("school_id", school.id).order("name");
    setTpls((data ?? []) as Tpl[]);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [school?.id]);

  const create = async () => {
    if (!school || !user || !name.trim() || !body.trim()) return;
    const { error } = await supabase.from("comms_templates").insert({
      school_id: school.id, created_by: user.id, name, category, body,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setName(""); setBody(""); refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("comms_templates").delete().eq("id", id);
    refresh();
  };

  const aiAssist = async (intent: "draft" | "improve") => {
    if (!school) return;
    if (intent === "improve" && !body.trim()) { toast.error("Write something first"); return; }
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("comms-ai-assist", {
      body: { school_id: school.id, intent, text: body || name, options: { purpose: name || category } },
    });
    setAiBusy(false);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error ?? "AI failed");
    setBody((data as any).text ?? "");
  };

  return (
    <div className="h-full overflow-auto p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="size-6"/> Message Templates</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1"/> New Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)}/></div>
              <div>
                <Label>Category</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background"
                  value={category} onChange={(e) => setCategory(e.target.value)}>
                  {["general","fee_reminder","attendance_alert","exam_notice","result_notice","behavior_report"].map((c) => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Body</Label>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => aiAssist("draft")} className="h-7 text-xs"><Sparkles className="size-3 mr-1"/> Draft</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={aiBusy} onClick={() => aiAssist("improve")} className="h-7 text-xs"><Sparkles className="size-3 mr-1"/> Improve</Button>
                  </div>
                </div>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Hi {{parent_name}}, this is to inform you..."/>
                {aiBusy && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="size-3 animate-spin"/> AI thinking…</div>}
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tpls.length === 0 && <div className="col-span-full text-sm text-muted-foreground py-12 text-center">No templates yet.</div>}
        {tpls.map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-semibold">{t.name}</div>
              <span className="text-[10px] uppercase ml-auto text-muted-foreground">{t.category}</span>
              <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4"/></button>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}