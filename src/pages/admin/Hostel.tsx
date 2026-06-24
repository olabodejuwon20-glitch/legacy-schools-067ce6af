import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminHostel() {
  const { school } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", capacity: 0, occupied: 0, warden: "", gender: "" });

  async function load() {
    if (!school) return;
    const { data } = await supabase.from("hostels").select("*").eq("school_id", school.id).order("name");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [school]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    const { error } = await supabase.from("hostels").insert({ ...form, school_id: school.id });
    if (error) return toast.error(error.message);
    toast.success("Hostel added"); setOpen(false); setForm({ name: "", capacity: 0, occupied: 0, warden: "", gender: "" }); load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("hostels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <SectionCard title="Hostels" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> Add hostel</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add hostel</DialogTitle></DialogHeader>
          <form onSubmit={add} className="space-y-3">
            <div><Label>Name</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Capacity</Label><Input type="number" min={0} value={form.capacity} onChange={e => setForm({ ...form, capacity: +e.target.value })} /></div>
              <div><Label>Occupied</Label><Input type="number" min={0} value={form.occupied} onChange={e => setForm({ ...form, occupied: +e.target.value })} /></div>
            </div>
            <div><Label>Warden</Label><Input value={form.warden} onChange={e => setForm({ ...form, warden: e.target.value })} /></div>
            <div><Label>Gender</Label><Input placeholder="Male / Female / Mixed" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} /></div>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    }>
      {rows.length === 0
        ? <EmptyState icon={Building2} title="No hostels yet" desc="Add a hostel to start managing accommodation." />
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-border">
              <th className="text-left py-2">Name{"\u00a0 \u00a0\u00a0"}</th><th className="text-left">Warden</th><th className="text-left">Gender</th>
              <th className="text-right">Occupancy</th><th></th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="py-3 font-medium">{r.name}</td>
                <td className="text-muted-foreground">{r.warden || "—"}</td>
                <td className="text-muted-foreground">{r.gender || "—"}</td>
                <td className="text-right tabular-nums">{r.occupied} / {r.capacity}</td>
                <td className="text-right"><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>
            ))}</tbody>
          </table></div>}
    </SectionCard>
  );
}
