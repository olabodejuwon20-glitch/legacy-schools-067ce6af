import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Workflow, Trash2, Loader2, ShieldCheck, UserSquare2, Copy, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import SEO from "@/components/SEO";

type Row = {
  user_id: string;
  admin_slot: number | null;
  full_name: string | null;
  email: string | null;
};

type Slot = { slot: number; name: string; enabled: boolean };

type InviteRow = {
  id: string; code: string; admin_slot: number | null;
  uses: number; max_uses: number; created_at: string;
};

export default function Workspace() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<Row[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [slotChoice, setSlotChoice] = useState<string>("");

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data: mems } = await supabase
      .from("memberships")
      .select("user_id, admin_slot")
      .eq("school_id", school.id)
      .eq("role", "admin")
      .eq("status", "active");

    const ids = (mems ?? []).map((m: any) => m.user_id);
    const profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      (p ?? []).forEach((r: any) => { profiles[r.id] = { full_name: r.full_name, email: r.email }; });
    }
    setRows(((mems ?? []) as any).map((m: any) => ({
      user_id: m.user_id,
      admin_slot: m.admin_slot,
      full_name: profiles[m.user_id]?.full_name ?? null,
      email: profiles[m.user_id]?.email ?? null,
    })));

    const { data: s } = await supabase
      .from("admin_role_slots")
      .select("slot,name,enabled")
      .eq("school_id", school.id)
      .order("slot");
    setSlots(((s ?? []) as any[]).map(r => ({
      slot: r.slot, name: r.name || `Role ${r.slot}`, enabled: !!r.enabled,
    })));

    const { data: inv } = await supabase
      .from("invite_codes")
      .select("id, code, admin_slot, uses, max_uses, created_at")
      .eq("school_id", school.id)
      .eq("role", "admin")
      .order("created_at", { ascending: false });
    setInvites((inv ?? []) as any);

    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !user || busy) return;
    if (!slotChoice) { toast.error("Pick a role for this collaborator"); return; }
    setBusy(true);
    try {
      const code = `ADM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const { error } = await supabase.from("invite_codes").insert({
        school_id: school.id,
        code,
        role: "admin" as any,
        admin_slot: Number(slotChoice),
        max_uses: 1,
        created_by: user.id,
      } as any);
      if (error) throw error;
      const url = `${window.location.origin}${schoolPath(school.slug, "/join")}?code=${code}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite link copied to clipboard");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not create invite");
    } finally { setBusy(false); }
  }

  async function deleteInvite(id: string) {
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) return toast.error(err_msg(error));
    toast.success("Invite revoked");
    load();
  }

  async function revoke(userId: string) {
    if (!school) return;
    if (!confirm("Remove this collaborator from the workspace?")) return;
    const { error } = await supabase.from("memberships")
      .update({ status: "removed" }).eq("school_id", school.id).eq("user_id", userId);
    if (error) return toast.error(err_msg(error));
    toast.success("Collaborator removed"); load();
  }

  const enabledSlots = slots.filter(s => s.enabled);

  return (
    <div className="space-y-6">
      <SEO title="Workspace" description="Manage admin collaborators." path="/admin/workspace" />

      <SectionCard
        title="Invite an admin collaborator"
        description="You are the school's primary Admin. Add collaborators (Vice Principal, HOD, Exam Committee, …) and decide what each can do."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={schoolPath(school?.slug, "/app/admin/roles")}>
              <Settings2 className="size-4 mr-1.5" /> Manage roles
            </Link>
          </Button>
        }
      >
        <form className="grid sm:grid-cols-[1fr_auto] gap-3 items-end" onSubmit={createInvite}>
          <div>
            <Label className="text-xs">Collaborator role</Label>
            <Select value={slotChoice} onValueChange={setSlotChoice}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={enabledSlots.length ? "Choose a role…" : "Enable a role in Manage roles first"} />
              </SelectTrigger>
              <SelectContent>
                {enabledSlots.map(s => (
                  <SelectItem key={s.slot} value={String(s.slot)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy || enabledSlots.length === 0}>
            {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Workflow className="size-4 mr-2" />}
            Create invite link
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-3">
          Share the copied link with the collaborator. They sign up, paste the code, and join with the role you picked.
          Up to 10 custom admin roles can be configured in <Link to={schoolPath(school?.slug, "/app/admin/roles")} className="text-primary hover:underline">Manage roles</Link>.
        </p>
      </SectionCard>

      <SectionCard title="Pending invite links" description="One-time links you've created for collaborators.">
        {invites.length === 0 ? (
          <p className="text-xs text-muted-foreground">No invite links yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(i => {
              const slot = slots.find(s => s.slot === i.admin_slot);
              const exhausted = i.uses >= i.max_uses;
              return (
                <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <code className="px-2.5 py-1 rounded bg-secondary font-mono text-xs">{i.code}</code>
                  <span className="text-xs">{slot?.name || `Slot ${i.admin_slot}`}</span>
                  <span className="text-xs text-muted-foreground">{i.uses}/{i.max_uses} used</span>
                  {exhausted && <span className="text-[10px] uppercase tracking-wider text-destructive">Exhausted</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => {
                      const url = `${window.location.origin}${schoolPath(school?.slug, "/join")}?code=${i.code}`;
                      navigator.clipboard.writeText(url); toast.success("Link copied");
                    }}><Copy className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteInvite(i.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Current collaborators" description="Admins who can sign in to this workspace.">
        {loading ? (
          <div className="py-8 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={UserSquare2} title="No collaborators yet" desc="Invite an admin to get started." />
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
                {rows.map(r => {
                  const slotName = r.admin_slot
                    ? (slots.find(s => s.slot === r.admin_slot)?.name || `Slot ${r.admin_slot}`)
                    : "Admin (Principal / Director)";
                  const isPrimary = !r.admin_slot;
                  return (
                    <tr key={r.user_id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{r.full_name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          {isPrimary && <ShieldCheck className="size-3.5 text-primary" />}
                          {slotName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isPrimary ? (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Owner</span>
                        ) : (
                          <Button size="icon" variant="ghost" onClick={() => revoke(r.user_id)} title="Remove collaborator">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function err_msg(e: any): string {
  return e?.message || "Something went wrong";
}
