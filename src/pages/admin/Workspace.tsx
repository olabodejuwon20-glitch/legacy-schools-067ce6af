import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2, ShieldCheck, Copy, Settings2, Search, Plus, MoreHorizontal,
  Link2, Trash2, UserPlus, Users, Check, X, Mail, Phone, CalendarDays,
  MapPin, User, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/lib/adminPermissions";
import { Lock } from "lucide-react";

type Row = {
  user_id: string;
  admin_slot: number | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  address: string | null;
  photo_url: string | null;
  created_at: string | null;
};
type Slot = { slot: number; name: string; enabled: boolean };
type InviteRow = {
  id: string; code: string; admin_slot: number | null;
  uses: number; max_uses: number; created_at: string;
};

const TONE_PALETTE = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
];

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function Workspace() {
  const { school, user } = useSchool();
  const { isFullAdmin, can, canEdit } = useAdminPermissions();
  const mayView = isFullAdmin || can("workspace");
  const mayEdit = isFullAdmin || canEdit("workspace");
  const [rows, setRows] = useState<Row[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"members" | "invites">("members");

  // invite dialog
  const [open, setOpen] = useState(false);
  const [slotChoice, setSlotChoice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  // member drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Row | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data: mems } = await supabase
      .from("memberships")
      .select("user_id, admin_slot, created_at")
      .eq("school_id", school.id)
      .eq("role", "admin")
      .eq("status", "active");
    const ids = (mems ?? []).map((m: any) => m.user_id);
    const profiles: Record<string, {
      full_name: string | null; email: string | null;
      phone: string | null; gender: string | null;
      address: string | null; photo_url: string | null;
    }> = {};
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id,full_name,email,phone,gender,address,photo_url")
        .in("id", ids);
      (p ?? []).forEach((r: any) => {
        profiles[r.id] = {
          full_name: r.full_name, email: r.email,
          phone: r.phone, gender: r.gender,
          address: r.address, photo_url: r.photo_url,
        };
      });
    }
    setRows(((mems ?? []) as any).map((m: any) => ({
      user_id: m.user_id,
      admin_slot: m.admin_slot,
      full_name: profiles[m.user_id]?.full_name ?? null,
      email: profiles[m.user_id]?.email ?? null,
      phone: profiles[m.user_id]?.phone ?? null,
      gender: profiles[m.user_id]?.gender ?? null,
      address: profiles[m.user_id]?.address ?? null,
      photo_url: profiles[m.user_id]?.photo_url ?? null,
      created_at: m.created_at,
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

  async function createInvite() {
    if (!school || !user || busy) return;
    if (!mayEdit) { toast.error("You don't have permission to invite collaborators."); return; }
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
      setLastLink(url);
      toast.success("Invite link created and copied");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not create invite");
    } finally { setBusy(false); }
  }

  async function deleteInvite(id: string) {
    if (!mayEdit) { toast.error("You don't have permission to revoke invites."); return; }
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) return toast.error(error.message || "Could not revoke");
    toast.success("Invite revoked");
    load();
  }

  async function revoke(userId: string) {
    if (!school) return;
    if (!mayEdit) { toast.error("You don't have permission to remove collaborators."); return; }
    if (!confirm("Remove this collaborator from the workspace?")) return;
    const { error } = await supabase.from("memberships")
      .update({ status: "removed" }).eq("school_id", school.id).eq("user_id", userId);
    if (error) return toast.error(error.message || "Could not remove");
    toast.success("Collaborator removed");
    setDrawerOpen(false);
    setSelectedMember(null);
    load();
  }

  async function changeRole(userId: string, newSlot: number | null) {
    if (!school || roleBusy) return;
    if (!mayEdit) { toast.error("You don't have permission to change roles."); return; }
    setRoleBusy(true);
    const { error } = await supabase.from("memberships")
      .update({ admin_slot: newSlot })
      .eq("school_id", school.id)
      .eq("user_id", userId);
    setRoleBusy(false);
    if (error) return toast.error(error.message || "Could not update role");
    toast.success("Role updated");
    load();
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}${schoolPath(school?.slug, "/join")}?code=${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  const enabledSlots = slots.filter(s => s.enabled);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const pendingInvites = invites.filter(i => i.uses < i.max_uses);

  if (!mayView) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <SEO title="Workspace" description="Workspace access" path="/admin/workspace" />
        <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
          <Lock className="size-5 text-muted-foreground" />
        </div>
        <h1 className="font-display text-lg font-semibold">Workspace is restricted</h1>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view the workspace. Ask the school admin to grant you access on the Roles page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SEO title="Workspace" description="Manage admin collaborators." path="/admin/workspace" />

      {/* Airtable-style header */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-display font-semibold shrink-0">
            {(school?.name || "S").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {school?.name || "Workspace"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "member" : "members"} · {pendingInvites.length} pending invite{pendingInvites.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          {mayEdit && (
            <Button asChild variant="ghost" size="sm">
              <Link to={schoolPath(school?.slug, "/app/admin/roles")}>
                <Settings2 className="size-4 mr-1.5" /> Manage roles
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => { setOpen(true); setLastLink(null); }}
            disabled={!mayEdit || enabledSlots.length === 0}
            title={!mayEdit ? "You have view-only access to the workspace" : undefined}
          >
            {mayEdit ? <UserPlus className="size-4 mr-1.5" /> : <Lock className="size-4 mr-1.5" />}
            Invite
          </Button>
        </div>
      </header>

      {/* Tabs + search bar (toolbar) */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabBtn active={tab === "members"} onClick={() => setTab("members")}>
          <Users className="size-3.5" /> Members <Count>{rows.length}</Count>
        </TabBtn>
        <TabBtn active={tab === "invites"} onClick={() => setTab("invites")}>
          <Link2 className="size-3.5" /> Invite links <Count>{pendingInvites.length}</Count>
        </TabBtn>
      </div>

      {tab === "members" ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members"
                className="h-8 pl-8 text-sm bg-background"
              />
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filteredRows.length} shown</span>
          </div>

          {loading ? (
            <div className="py-16 grid place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center mb-3">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No members yet</p>
              <p className="text-xs text-muted-foreground mt-1">Invite collaborators to join this workspace.</p>
              {mayEdit && (
                <Button size="sm" className="mt-4" onClick={() => setOpen(true)} disabled={enabledSlots.length === 0}>
                  <Plus className="size-4 mr-1.5" /> Invite member
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">Email</th>
                  <th className="text-left font-medium px-4 py-2.5">Role</th>
                  <th className="px-2 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const slot = r.admin_slot
                    ? slots.find(s => s.slot === r.admin_slot)
                    : null;
                  const slotName = slot?.name || (r.admin_slot ? `Slot ${r.admin_slot}` : "Owner");
                  const tone = r.admin_slot
                    ? TONE_PALETTE[(r.admin_slot - 1) % TONE_PALETTE.length]
                    : "bg-primary/10 text-primary";
                  const isPrimary = !r.admin_slot;
                  return (
                    <tr
                      key={r.user_id}
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedMember(r); setDrawerOpen(true); }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.photo_url ? (
                            <img src={r.photo_url} alt="" className="size-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <span className={cn("size-7 rounded-full grid place-items-center text-[11px] font-semibold shrink-0", tone)}>
                              {initials(r.full_name, r.email)}
                            </span>
                          )}
                          <span className="font-medium truncate">{r.full_name || "—"}</span>
                          {isPrimary && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
                              <ShieldCheck className="size-3" /> Owner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[260px]">{r.email || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", tone)}>
                          {slotName}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {!isPrimary && mayEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button size="icon" variant="ghost" className="size-7">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem asChild>
                                <Link to={schoolPath(school?.slug, "/app/admin/roles")}>
                                  <Settings2 className="size-3.5 mr-2" /> Change role
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => revoke(r.user_id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-3.5 mr-2" /> Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="py-16 grid place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : invites.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center mb-3">
                <Link2 className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No invite links</p>
              <p className="text-xs text-muted-foreground mt-1">Create a link to bring a teammate onboard.</p>
              {mayEdit && (
                <Button size="sm" className="mt-4" onClick={() => setOpen(true)} disabled={enabledSlots.length === 0}>
                  <Plus className="size-4 mr-1.5" /> New invite link
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Code</th>
                  <th className="text-left font-medium px-4 py-2.5">Role</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">Created</th>
                  <th className="px-2 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const slot = slots.find(s => s.slot === i.admin_slot);
                  const exhausted = i.uses >= i.max_uses;
                  const tone = i.admin_slot ? TONE_PALETTE[(i.admin_slot - 1) % TONE_PALETTE.length] : "bg-muted text-foreground";
                  return (
                    <tr key={i.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <code className="px-2 py-0.5 rounded bg-muted font-mono text-xs">{i.code}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", tone)}>
                          {slot?.name || `Slot ${i.admin_slot}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {exhausted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <X className="size-3" /> Used
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" /> Active ({i.uses}/{i.max_uses})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {new Date(i.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => copyLink(i.code)} title="Copy link">
                            <Copy className="size-3.5" />
                          </Button>
                          {mayEdit && (
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => deleteInvite(i.id)} title="Revoke">
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSlotChoice(""); setLastLink(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a collaborator</DialogTitle>
            <DialogDescription>
              Generate a one-time link. Share it with the person you want to add — they'll join with the role you pick.
            </DialogDescription>
          </DialogHeader>

          {lastLink ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="size-4" /> Link copied to clipboard
                </div>
                <p className="text-xs text-muted-foreground mt-1">Send this to your teammate. It works once.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={lastLink} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(lastLink); toast.success("Copied"); }}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => { setLastLink(null); setSlotChoice(""); }}>
                  Create another
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={slotChoice} onValueChange={setSlotChoice}>
                  <SelectTrigger>
                    <SelectValue placeholder={enabledSlots.length ? "Choose a role…" : "Enable a role first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledSlots.map((s, idx) => (
                      <SelectItem key={s.slot} value={String(s.slot)}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", TONE_PALETTE[idx % TONE_PALETTE.length].split(" ")[0].replace("bg-", "bg-").replace("-100", "-500"))} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {enabledSlots.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No roles enabled yet.{" "}
                    <Link to={schoolPath(school?.slug, "/app/admin/roles")} className="text-primary hover:underline">
                      Enable roles
                    </Link>{" "}
                    to invite collaborators.
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                <Button onClick={createInvite} disabled={busy || !slotChoice}>
                  {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Link2 className="size-4 mr-2" />}
                  Create invite link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Member details drawer */}
      <Sheet open={drawerOpen} onOpenChange={(v) => { setDrawerOpen(v); if (!v) setSelectedMember(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedMember && (
            <>
              <SheetHeader className="text-left pb-4">
                <div className="flex items-start gap-4">
                  {selectedMember.photo_url ? (
                    <img
                      src={selectedMember.photo_url}
                      alt={selectedMember.full_name || ""}
                      className="size-16 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <span className={cn(
                      "size-16 rounded-full grid place-items-center text-lg font-bold border border-border",
                      selectedMember.admin_slot
                        ? TONE_PALETTE[(selectedMember.admin_slot - 1) % TONE_PALETTE.length]
                        : "bg-primary/10 text-primary",
                    )}>
                      {initials(selectedMember.full_name, selectedMember.email)}
                    </span>
                  )}
                  <div className="min-w-0 pt-1">
                    <SheetTitle className="text-xl truncate">
                      {selectedMember.full_name || "Unnamed member"}
                    </SheetTitle>
                    <SheetDescription className="truncate">
                      {selectedMember.email || "No email"}
                    </SheetDescription>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                        selectedMember.admin_slot
                          ? TONE_PALETTE[(selectedMember.admin_slot - 1) % TONE_PALETTE.length]
                          : "bg-primary/10 text-primary",
                      )}>
                        {selectedMember.admin_slot
                          ? (slots.find(s => s.slot === selectedMember.admin_slot)?.name || `Slot ${selectedMember.admin_slot}`)
                          : "Owner"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                      {!selectedMember.admin_slot && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary">
                          <ShieldCheck className="size-3" /> Primary admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <Separator className="my-4" />

              <div className="space-y-5">
                {/* Profile info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Profile</h3>
                  <div className="space-y-3">
                    <InfoRow icon={<Mail className="size-4" />} label="Email" value={selectedMember.email || "—"} />
                    <InfoRow icon={<Phone className="size-4" />} label="Phone" value={selectedMember.phone || "—"} />
                    <InfoRow icon={<User className="size-4" />} label="Gender" value={selectedMember.gender ? (selectedMember.gender[0].toUpperCase() + selectedMember.gender.slice(1)) : "—"} />
                    <InfoRow icon={<MapPin className="size-4" />} label="Address" value={selectedMember.address || "—"} />
                    <InfoRow icon={<CalendarDays className="size-4" />} label="Joined" value={selectedMember.created_at ? new Date(selectedMember.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"} />
                  </div>
                </div>

                {/* Role management */}
                {selectedMember.admin_slot !== null && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Role</h4>
                      <Select
                        value={String(selectedMember.admin_slot)}
                        onValueChange={(v) => changeRole(selectedMember.user_id, Number(v))}
                        disabled={roleBusy}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledSlots.map((s) => (
                            <SelectItem key={s.slot} value={String(s.slot)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Changing the role updates permissions immediately.
                      </p>
                    </div>
                  </>
                )}

                {/* Status actions */}
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Actions</h4>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start"
                      asChild
                    >
                      <Link to={schoolPath(school?.slug, "/app/admin/roles")}>
                        <Settings2 className="size-4 mr-2" /> Manage roles
                      </Link>
                    </Button>
                    {selectedMember.admin_slot !== null && (
                      <Button
                        variant="destructive"
                        className="justify-start"
                        onClick={() => revoke(selectedMember.user_id)}
                      >
                        <Trash2 className="size-4 mr-2" /> Remove from workspace
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] px-1 h-[18px] rounded-full bg-muted text-[10px] text-muted-foreground font-medium">
      {children}
    </span>
  );
}