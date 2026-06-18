import { useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminClasses() {
  const { school } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", subject: "", grade_level: "", teacher_id: "" });

  async function load() {
    if (!school) return;
    const { data } = await supabase.from("classes").select("*").eq("school_id", school.id).order("created_at", { ascending: false });
    setRows(data ?? []);
    const { data: m } = await supabase.from("memberships").select("user_id").eq("school_id", school.id).eq("role", "teacher");
    if (m?.length) {
      const { data: p } = await supabase.from("profiles").select("id,full_name,email").in("id", m.map(x => x.user_id));
      setTeachers(p ?? []);
    }
  }
  useEffect(() => { load(); }, [school]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const name = form.name.trim();
      const { data: existing } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", school.id)
        .ilike("name", name)
        .maybeSingle();
      if (existing) {
        toast.info("A class with that name already exists in your school.");
        return;
      }
      const payload = { ...form, name, teacher_id: form.teacher_id || null, school_id: school.id };
      const { error } = await supabase.from("classes").insert(payload);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique")) {
          toast.info("A class with that name already exists in your school.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Class created");
      setOpen(false);
      setForm({ code: "", name: "", subject: "", grade_level: "", teacher_id: "" });
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Classes" description={`${rows.length} classes`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />New class</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create class</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="MATH-101" /></div>
                <div><Label>Grade level</Label><Input value={form.grade_level} onChange={e => setForm({ ...form, grade_level: e.target.value })} placeholder="SS2" /></div>
              </div>
              <div><Label>Name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" /></div>
              <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Math" /></div>
              <div><Label>Teacher</Label>
                <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Assign teacher (optional)" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }>
      {rows.length === 0
        ? <EmptyState icon={BookOpen} title="No classes yet" desc="Create your first class to get started." />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(c => (
              <div key={c.id} className="rounded-xl bg-card border border-border p-5 shadow-card">
                <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary"><BookOpen className="size-5" /></div>
                <div className="mt-4 font-display font-semibold">{c.code}</div>
                <div className="text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.subject} · {c.grade_level || "—"}</div>
              </div>
            ))}
          </div>}
    </SectionCard>
  );
}
