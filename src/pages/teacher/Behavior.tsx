import { useEffect, useState } from "react";
import { Award, AlertTriangle, MessageSquare, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TYPES = [
  { v: "commendation", icon: Award, tone: "bg-success/15 text-success" },
  { v: "incident", icon: AlertTriangle, tone: "bg-destructive/15 text-destructive" },
  { v: "note", icon: MessageSquare, tone: "bg-info/15 text-info" },
];

export default function TeacherBehavior() {
  const { school, user } = useSchool();
  const [students, setStudents] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", type: "note", category: "", note: "", severity: "low", visible_to_parent: true });

  const load = async () => {
    if (!school || !user) return;
    const { data: cls } = await supabase.from("classes").select("id").eq("teacher_id", user.id);
    const cids = cls?.map(c => c.id) ?? [];
    const { data: enr } = cids.length ? await supabase.from("class_enrollments").select("student_id").in("class_id", cids) : { data: [] as any[] };
    const sids = Array.from(new Set((enr ?? []).map(e => e.student_id)));
    const { data: profs } = sids.length ? await supabase.from("profiles").select("id,full_name,email").in("id", sids) : { data: [] };
    setStudents(profs ?? []);
    const { data: notes } = await supabase.from("behavior_notes").select("*").eq("school_id", school.id).eq("teacher_id", user.id).order("created_at", { ascending: false });
    setRows(notes ?? []);
  };
  useEffect(() => { load(); }, [school, user]);

  async function add() {
    if (!school || !user || !form.student_id || !form.note) return toast.error("Pick a student and write a note");
    const { error } = await supabase.from("behavior_notes").insert({
      school_id: school.id, teacher_id: user.id,
      student_id: form.student_id, type: form.type, category: form.category || null,
      note: form.note, severity: form.severity, visible_to_parent: form.visible_to_parent,
    });
    if (error) return toast.error(error.message);
    toast.success("Note logged"); setOpen(false);
    setForm({ student_id: "", type: "note", category: "", note: "", severity: "low", visible_to_parent: true });
    await load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("behavior_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(r => r.filter(x => x.id !== id));
  }

  const view = rows.filter(r => filter === "all" || r.type === filter);
  const studentName = (id: string) => students.find(s => s.id === id)?.full_name || id.slice(0, 8);

  return (
    <SectionCard title="Behavior & Conduct" description="Log commendations and incidents — visible to parents by default"
      action={
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Log</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New behavior note</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Student</Label>
                  <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick a student" /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Severity</Label>
                    <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="optional" /></div>
                </div>
                <div><Label>Note</Label><Textarea rows={4} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
                <div className="flex items-center justify-between"><Label className="m-0">Visible to parent</Label><Switch checked={form.visible_to_parent} onCheckedChange={(v) => setForm({ ...form, visible_to_parent: v })} /></div>
              </div>
              <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }>
      {view.length === 0 ? <EmptyState icon={MessageSquare} title="No behavior notes yet" /> :
        <ul className="space-y-2">
          {view.map(r => {
            const meta = TYPES.find(t => t.v === r.type) ?? TYPES[2];
            const Icon = meta.icon;
            return (
              <li key={r.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className={`size-9 rounded-lg grid place-items-center ${meta.tone}`}><Icon className="size-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{studentName(r.student_id)}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{r.type}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{r.severity}</Badge>
                    {r.category && <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>}
                    {!r.visible_to_parent && <Badge variant="secondary" className="text-[10px]">Internal</Badge>}
                    <span className="ml-auto">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm mt-1">{r.note}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>×</Button>
              </li>
            );
          })}
        </ul>}
    </SectionCard>
  );
}