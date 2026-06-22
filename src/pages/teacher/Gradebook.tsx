import { useEffect, useMemo, useState } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIES = ["CA", "Quiz", "Project", "Mid-term", "Final"];
const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function TeacherGradebook() {
  const { school, user } = useSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [term, setTerm] = useState("Term 1");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", subject: "", title: "", category: "CA", score: 0, max_score: 10 });

  useEffect(() => {
    if (!school || !user) return;
    supabase.from("classes").select("id,code,name,subject").eq("school_id", school.id).eq("teacher_id", user.id)
      .then(({ data }) => { setClasses(data ?? []); if (data?.[0]) setClassId(data[0].id); });
  }, [school, user]);

  const load = async () => {
    if (!classId || !school) return;
    const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
    const ids = enr?.map(e => e.student_id) ?? [];
    if (!ids.length) { setStudents([]); setEntries([]); return; }
    const [{ data: profs }, { data: ents }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").in("id", ids),
      supabase.from("gradebook_entries").select("*").eq("school_id", school.id).eq("class_id", classId).eq("term", term).order("recorded_at", { ascending: false }),
    ]);
    setStudents(profs ?? []); setEntries(ents ?? []);
  };
  useEffect(() => { load(); }, [classId, term, school]);

  const byStudent = useMemo(() => {
    const m: Record<string, any[]> = {};
    entries.forEach(e => { (m[e.student_id] ||= []).push(e); });
    return m;
  }, [entries]);

  async function add() {
    if (!school || !user || !classId || !form.student_id || !form.subject || !form.title) return toast.error("Fill all fields");
    const { error } = await supabase.from("gradebook_entries").insert({
      school_id: school.id, class_id: classId, teacher_id: user.id, term,
      student_id: form.student_id, subject: form.subject, title: form.title,
      category: form.category, score: Number(form.score), max_score: Number(form.max_score),
    });
    if (error) return toast.error(error.message);
    toast.success("Score recorded"); setOpen(false);
    setForm({ student_id: "", subject: "", title: "", category: "CA", score: 0, max_score: 10 });
    await load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("gradebook_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEntries(e => e.filter(x => x.id !== id));
  }

  return (
    <SectionCard title="Gradebook" description="Continuous-assessment scores by class and term"
      action={
        <div className="flex gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record score · {term}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Student</Label>
                  <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick a student" /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name || "Student"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Algebra Quiz 1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Score</Label><Input type="number" value={form.score} onChange={e => setForm({ ...form, score: Number(e.target.value) })} /></div>
                  <div><Label>Max</Label><Input type="number" value={form.max_score} onChange={e => setForm({ ...form, max_score: Number(e.target.value) })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }>
      {students.length === 0 ? <EmptyState icon={BarChart3} title="No students enrolled" /> :
        <div className="overflow-x-auto">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs uppercase text-muted-foreground border-b border-border">
              <th className="text-left font-medium py-3">Student</th>
              <th className="text-left font-medium py-3">Entries</th>
              <th className="text-left font-medium py-3">Total</th>
              <th className="text-left font-medium py-3">Average</th>
              <th></th>
            </tr></thead>
            <tbody>
              {students.map(s => {
                const list = byStudent[s.id] ?? [];
                const sum = list.reduce((a, b) => a + Number(b.score), 0);
                const max = list.reduce((a, b) => a + Number(b.max_score), 0);
                const pct = max ? Math.round((sum / max) * 100) : 0;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-3 font-medium">{s.full_name || "Student"}</td>
                    <td className="py-3">
                      {list.length === 0 ? <span className="text-muted-foreground text-xs">—</span> :
                        <ul className="space-y-1">
                          {list.map(e => (
                            <li key={e.id} className="flex items-center gap-2 text-xs">
                              <span className="px-1.5 rounded bg-secondary">{e.category}</span>
                              <span>{e.subject} · {e.title}</span>
                              <span className="font-semibold">{e.score}/{e.max_score}</span>
                              <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive ml-auto"><Trash2 className="size-3" /></button>
                            </li>
                          ))}
                        </ul>}
                    </td>
                    <td className="py-3 tabular-nums">{sum}/{max || 0}</td>
                    <td className="py-3 font-semibold">{pct}%</td>
                    <td></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>}
    </SectionCard>
  );
}