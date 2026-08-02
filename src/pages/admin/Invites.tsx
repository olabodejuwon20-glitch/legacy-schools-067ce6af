import { useEffect, useState } from "react";
import { Plus, Copy, Ticket, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool, Role } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { buildSchoolUrl } from "@/lib/tenant";

const ROLES: Role[] = ["student", "teacher", "parent"];
const PREFIX: Record<string, string> = { student: "STU", teacher: "TCH", parent: "PRT" };
const CODE_LEN = 6;
const rand = (n: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
  return out;
};

export default function AdminInvites() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [maxUses, setMaxUses] = useState(50);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!school) return;
    const { data } = await supabase.from("invite_codes").select("*").eq("school_id", school.id).order("created_at", { ascending: false });
    setRows((data ?? []).filter((r: any) => r.role !== "admin"));
  }
  useEffect(() => { load(); }, [school]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !user || busy) return;
    setBusy(true);
    try {
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = `${PREFIX[role]}-${rand(CODE_LEN)}`;
        const payload: any = { school_id: school.id, code, role, max_uses: maxUses, created_by: user.id };
        const { error } = await supabase.from("invite_codes").insert(payload);
        if (!error) { lastError = null; break; }
        lastError = error;
        // 23505 = unique violation -> regenerate and retry
        if ((error as any).code !== "23505") break;
      }
      if (lastError) throw lastError;
      toast.success("Code generated");
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not generate code");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  return (
    <SectionCard title="Invite codes" description="Share these with people to let them join your school"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />Generate code</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate invite</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Max uses</Label><Input type="number" min={1} value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} /></div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }>
      {school && (
        <div className="mb-4 p-3 rounded-lg border border-border bg-muted/40 text-xs">
          <div className="font-semibold text-foreground mb-1">Codes only work on your school's portal:</div>
          <code className="font-mono break-all">{buildSchoolUrl(school.slug, "/join")}</code>
        </div>
      )}
      {rows.length === 0
        ? <EmptyState icon={Ticket} title="No codes yet" desc="Generate one to invite teachers, students or parents." />
        : <div className="space-y-2">
            {rows.map(r => {
              const exhausted = r.uses >= r.max_uses;
              return (
                <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${exhausted ? "border-destructive/40 bg-destructive/5 opacity-80" : "border-border"}`}>
                  <code className={`px-3 py-1.5 rounded-md font-mono text-sm ${exhausted ? "bg-muted line-through" : "bg-secondary"}`}>{r.code}</code>
                  <Badge variant="outline" className="capitalize">{r.role}</Badge>
                  <span className="text-xs text-muted-foreground">{r.uses}/{r.max_uses} uses</span>
                  {exhausted && <Badge variant="destructive">Exhausted</Badge>}
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={exhausted}
                      onClick={() => { navigator.clipboard.writeText(r.code); toast.success("Copied"); }}><Copy className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </div>}
    </SectionCard>
  );
}
