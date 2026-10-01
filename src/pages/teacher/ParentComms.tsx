import { useEffect, useState } from "react";
import { Mail, Plus, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TeacherParentComms() {
  const { school, user } = useSchool();
  const [students, setStudents] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", subject: "", body: "" });

  const load = async () => {
    if (!school || !user) return;
    const { data: cls } = await supabase.from("classes").select("id").eq("teacher_id", user.id);
    const cids = cls?.map(c => c.id) ?? [];
    const { data: enr } = cids.length ? await supabase.from("class_enrollments").select("student_id").in("class_id", cids) : { data: [] as any[] };
    const sids = Array.from(new Set((enr ?? []).map(e => e.student_id)));
    const [{ data: profs }, { data: pl }, { data: comms }] = await Promise.all([
      sids.length ? supabase.from("profiles").select("id,full_name,email").in("id", sids) : Promise.resolve({ data: [] }),
      sids.length ? supabase.from("parent_links").select("parent_user_id,student_user_id").eq("school_id", school.id).in("student_user_id", sids) : Promise.resolve({ data: [] as any[] }),
      supabase.from("parent_comms").select("*").eq("school_id", school.id).eq("teacher_id", user.id).order("created_at", { ascending: false }),
    ]);
    setStudents(profs ?? []); setLinks(pl ?? []); setRows(comms ?? []);
  };
  useEffect(() => { load(); }, [school, user]);

  async function send() {
    if (!school || !user || !form.student_id || !form.subject || !form.body) return toast.error("Fill all fields");
    const parents = links.filter(l => l.student_user_id === form.student_id).map(l => l.parent_user_id);
    if (!parents.length) return toast.error("No linked parent for this student");
    const inserts = parents.map(parent_id => ({
      school_id: school.id, teacher_id: user.id, parent_id,
      student_id: form.student_id, subject: form.subject, body: form.body,
    }));
    const { error } = await supabase.from("parent_comms").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success(`Sent to ${parents.length} parent${parents.length > 1 ? "s" : ""}`);
    setOpen(false); setForm({ student_id: "", subject: "", body: "" });
    await load();
  }

  const studentName = (id: string) => students.find(s => s.id === id)?.full_name || id.slice(0, 8);

  return (
    <SectionCard title="Parent Communications" description="Send updates to parents tied to a student"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" />New message</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Message a parent</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>About student</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a student" /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div><Label>Message</Label><Textarea rows={6} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={send}>Send</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      }>
      {rows.length === 0 ? <EmptyState icon={Mail} title="No parent messages sent yet" desc="Send your first update to keep parents informed about student progress and classroom activities." /> :
        <ul className="divide-y divide-border">
          {rows.map(m => (
            <li key={m.id} className="py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.subject}</span>
                <Badge variant="outline" className="text-[10px]">re: {studentName(m.student_id)}</Badge>
                {m.read_at ? <Badge className="bg-success/15 text-success text-[10px]"><CheckCheck className="size-3 mr-0.5" />Read</Badge> : <Badge variant="secondary" className="text-[10px]">Unread</Badge>}
                <span className="ml-auto">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>}
    </SectionCard>
  );
}