import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert, Search } from "lucide-react";
import { toast } from "sonner";
import { startImpersonation } from "@/lib/impersonation";
import { buildSchoolUrl } from "@/lib/tenant";

type Member = { user_id: string; role: string; full_name: string | null; email: string | null };

export default function ImpersonateDialog({
  open, onOpenChange, school,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  school: { id: string; name: string; slug: string };
}) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setSelected(null); setReason(""); setQuery(""); setMembers(null); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: mships, error } = await supabase
        .from("memberships")
        .select("user_id, role")
        .eq("school_id", school.id)
        .limit(500);
      if (!alive) return;
      if (error) { toast.error("Could not load members"); setMembers([]); setLoading(false); return; }
      const ids = (mships ?? []).map(m => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const merged: Member[] = (mships ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: map.get(m.user_id)?.full_name ?? null,
        email: map.get(m.user_id)?.email ?? null,
      }));
      if (!alive) return;
      setMembers(merged);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, school.id]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 50);
    return members.filter(m =>
      (m.full_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [members, query]);

  async function submit() {
    if (!selected) { toast.error("Pick a user to impersonate"); return; }
    if (reason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
    const mins = parseInt(duration, 10);
    setBusy(true);
    try {
      await startImpersonation({
        targetUserId: selected.user_id,
        targetName: selected.full_name || selected.email || "user",
        targetRole: selected.role,
        schoolId: school.id,
        schoolName: school.name,
        schoolSlug: school.slug,
        reason: reason.trim(),
        durationMinutes: mins,
      });
      toast.success("Support session started");
      onOpenChange(false);
      window.open(buildSchoolUrl(school.slug, "/app"), "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Could not start session");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-4 text-red-600" />Start support session</DialogTitle>
          <DialogDescription>
            You'll open this school's portal in a new tab as the selected user. Every action is logged. Session auto-expires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">User</Label>
            <div className="relative mt-1">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, role…" className="pl-9 h-9" />
            </div>
            <div className="mt-2 max-h-52 overflow-auto rounded-md border border-border divide-y">
              {loading && <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" />Loading…</div>}
              {!loading && filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground">No members found</div>}
              {filtered.map(m => (
                <button
                  key={m.user_id + m.role}
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${selected?.user_id === m.user_id && selected.role === m.role ? "bg-primary/10" : ""}`}
                >
                  <div className="font-medium truncate">{m.full_name || m.email || "Unnamed user"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.role} · {m.email ?? "—"}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Reason (required, audited)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="e.g. Investigating dashboard blank screen reported in ticket #123" className="mt-1" />
          </div>

          <div>
            <Label className="text-xs">Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours (max)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !selected || reason.trim().length < 5} className="bg-red-600 hover:bg-red-700 text-white">
            {busy ? <><Loader2 className="size-3.5 mr-2 animate-spin" />Starting…</> : "Start session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}