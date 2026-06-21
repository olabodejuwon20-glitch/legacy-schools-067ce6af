import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Workflow, Mail, Trash2, Loader2, ShieldCheck, GraduationCap, UserSquare2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import SEO from "@/components/SEO";

type Row = {
  user_id: string;
  role: "admin" | "teacher" | "student" | "parent";
  admin_slot: number | null;
  full_name: string | null;
  email: string | null;
};

const COLLAB_ROLES = [
  { value: "admin",   label: "Admin",   icon: ShieldCheck,   desc: "Full access to the entire school." },
  { value: "teacher", label: "Teacher", icon: GraduationCap, desc: "Manage classes, attendance, grading." },
] as const;

export default function Workspace() {
  const { school } = useSchool();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ email: string; role: "admin" | "teacher" }>({ email: "", role: "admin" });

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data: mems } = await supabase
      .from("memberships")
      .select("user_id, role, admin_slot")
      .eq("school_id", school.id)
      .in("role", ["admin", "teacher"])
      .eq("status", "active");
    const ids = (mems ?? []).map((m: any) => m.user_id);
    let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      (p ?? []).forEach((row: any) => { profiles[row.id] = { full_name: row.full_name, email: row.email }; });
    }
    setRows(((mems ?? []) as any).map((m: any) => ({
      ...m,
      full_name: profiles[m.user_id]?.full_name ?? null,
      email: profiles[m.user_id]?.email ?? null,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !form.email.trim()) return;
    setBusy(true);
    try {
      // Create a workspace invite as a single-use code; the existing /join flow consumes it.
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { error } = await supabase.from("school_invites" as any).insert({
        school_id: school.id,
        code,
        role: form.role,
        email: form.email.trim().toLowerCase(),
      });
      if (error) throw error;
      const url = `${window.location.origin}${schoolPath(school.slug, "/join")}?code=${code}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite created — link copied to clipboard");
      setForm({ email: "", role: form.role });
    } catch (err: any) {
      toast.error(err.message || "Could not create invite");
    } finally { setBusy(false); }
  }

  async function revoke(userId: string) {
    if (!school) return;
    if (!confirm("Remove this collaborator from the workspace?")) return;
    const { error } = await supabase.from("memberships")
      .update({ status: "removed" }).eq("school_id", school.id).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Collaborator removed"); load();
  }

  return (
    <div className="space-y-6">
      <SEO title="Workspace" description="Manage admin and teacher collaborators." path="/admin/workspace" />

      <SectionCard
        title="Invite a collaborator"
        description="Use this for staff who will help run the school — not for student or parent onboarding."
      >
        <form className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end" onSubmit={sendInvite}>
          <div>
            <Label className="text-xs">Email address</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input className="pl-9" type="email" required placeholder="name@school.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLLAB_ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Workflow className="size-4 mr-2" />}
            Create invite
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-3">
          For onboarding students or parents in bulk, use{" "}
          <Link to={schoolPath(school?.slug, "/app/admin/admission")} className="text-primary hover:underline">Admission</Link>.
        </p>
      </SectionCard>

      <SectionCard title="Current collaborators" description="Admins and teachers who can sign in to this workspace.">
        {loading ? (
          <div className="py-8 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={UserSquare2} title="No collaborators yet" desc="Invite an admin or teacher to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.user_id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.full_name || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                    <td className="px-3 py-2 capitalize">{r.role}{r.admin_slot ? ` · slot ${r.admin_slot}` : ""}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => revoke(r.user_id)} title="Remove collaborator">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}