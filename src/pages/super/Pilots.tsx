import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skel } from "@/components/super/primitives";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { Calendar, CheckCircle2, Clock, Plus, Rocket, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { superAction } from "@/lib/super";

type PilotSchool = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  pilot_status: string;
  pilot_started_at: string | null;
  pilot_ends_at: string | null;
  pilot_notes: string | null;
  converted_at: string | null;
};

const PILOT_BADGE: Record<string, string> = {
  active: "bg-warning/15 text-warning border-warning/30",
  converted: "bg-success/15 text-success border-success/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
  none: "bg-muted text-muted-foreground border-border",
};

export default function SuperPilots() {
  const [rows, setRows] = useState<PilotSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [query, setQuery] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<PilotSchool | null>(null);
  const [targetPlan, setTargetPlan] = useState("standard");
  const [converting, setConverting] = useState(false);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("schools")
      .select("id,name,slug,plan,status,pilot_status,pilot_started_at,pilot_ends_at,pilot_notes,converted_at")
      .is("deleted_at", null)
      .order("pilot_ends_at", { ascending: true, nullsFirst: false });
    if (filter !== "all") q = q.eq("pilot_status", filter);
    const { data, error } = await q;
    if (error) toast.error("Could not load pilots");
    setRows((data as PilotSchool[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q));
  }, [rows, query]);

  const stats = useMemo(() => {
    const now = new Date();
    const active = rows.filter(r => r.pilot_status === "active");
    const expiringSoon = active.filter(r => r.pilot_ends_at && differenceInDays(new Date(r.pilot_ends_at), now) <= 7 && differenceInDays(new Date(r.pilot_ends_at), now) >= 0);
    const overdue = active.filter(r => r.pilot_ends_at && new Date(r.pilot_ends_at) < now);
    return { active: active.length, expiringSoon: expiringSoon.length, overdue: overdue.length };
  }, [rows]);

  async function extend(row: PilotSchool, days: number) {
    const base = row.pilot_ends_at && new Date(row.pilot_ends_at) > new Date() ? new Date(row.pilot_ends_at) : new Date();
    base.setDate(base.getDate() + days);
    const { error } = await supabase.from("schools").update({
      pilot_ends_at: base.toISOString(),
      pilot_status: "active",
    }).eq("id", row.id);
    if (error) { toast.error("Could not extend"); return; }
    toast.success(`Extended by ${days} days`);
    void load();
  }

  async function confirmConvert() {
    if (!convertTarget) return;
    setConverting(true);
    try {
      const expiresAt = new Date(Date.now() + 120 * 86400_000).toISOString();
      await superAction("set_plan", {
        school_id: convertTarget.id,
        plan: targetPlan,
        expires_at: expiresAt,
      });
      await supabase.from("schools").update({
        pilot_status: "converted",
        converted_at: new Date().toISOString(),
      }).eq("id", convertTarget.id);
      toast.success(`Converted ${convertTarget.name} to ${targetPlan} plan`);
      setConvertTarget(null);
      void load();
    } catch {
      /* toasted */
    } finally {
      setConverting(false);
    }
  }

  async function markExpired(row: PilotSchool) {
    const { error } = await supabase.from("schools").update({ pilot_status: "expired" }).eq("id", row.id);
    if (error) { toast.error("Could not update"); return; }
    toast.success("Marked expired");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pilot Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage free trials &amp; pilots across Nigerian schools. Convert winners into paid term plans.</p>
        </div>
        <Button size="sm" onClick={() => setStartOpen(true)}>
          <Plus className="size-4 mr-1.5" /> Start a Pilot
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active pilots</div>
          <div className="text-2xl font-semibold mt-1 text-foreground">{stats.active}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ending within 7 days</div>
          <div className="text-2xl font-semibold mt-1 text-warning">{stats.expiringSoon}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Past end date</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">{stats.overdue}</div>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search school…" className="pl-9 h-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active pilots</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="all">All schools</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Rocket className="size-8 mx-auto mb-2 text-muted-foreground" />
            No pilots in this view.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(r => {
              const daysLeft = r.pilot_ends_at ? differenceInDays(new Date(r.pilot_ends_at), new Date()) : null;
              return (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/super/schools/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      <Badge variant="outline" className={PILOT_BADGE[r.pilot_status] || PILOT_BADGE.none}>{r.pilot_status}</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{r.plan}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {r.pilot_started_at && (
                        <span><Calendar className="size-3 inline mr-1" />Started {formatDistanceToNow(new Date(r.pilot_started_at), { addSuffix: true })}</span>
                      )}
                      {r.pilot_ends_at && (
                        <span className={daysLeft !== null && daysLeft < 0 ? "text-destructive font-medium" : daysLeft !== null && daysLeft <= 7 ? "text-warning font-medium" : ""}>
                          <Clock className="size-3 inline mr-1" />
                          {daysLeft !== null && daysLeft < 0 ? `Ended ${Math.abs(daysLeft)}d ago` : `Ends ${formatDistanceToNow(new Date(r.pilot_ends_at), { addSuffix: true })}`}
                        </span>
                      )}
                      {r.pilot_notes && <span className="italic">“{r.pilot_notes}”</span>}
                    </div>
                  </div>
                  {r.pilot_status === "active" && (
                    <div className="flex gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => void extend(r, 14)}>+14d</Button>
                      <Button size="sm" variant="outline" onClick={() => void extend(r, 30)}>+30d</Button>
                      <Button
                        size="sm"
                        onClick={() => { setConvertTarget(r); setTargetPlan(r.plan === "trial" ? "standard" : r.plan); }}
                        className="bg-success hover:bg-success/90 text-primary-foreground"
                      >
                        <CheckCircle2 className="size-3.5 mr-1" /> Convert
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void markExpired(r)}>Expire</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <StartPilotDialog open={startOpen} onOpenChange={setStartOpen} onDone={() => void load()} />

      <Dialog open={!!convertTarget} onOpenChange={o => !o && setConvertTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-success" />
              Convert Pilot to Paid Tier
            </DialogTitle>
          </DialogHeader>
          {convertTarget && (
            <div className="space-y-3 py-1">
              <p className="text-xs text-muted-foreground">
                Converting <span className="font-semibold text-foreground">{convertTarget.name}</span> marks the pilot as won and activates a full term subscription.
              </p>
              <div>
                <Label>Target Paid Plan</Label>
                <Select value={targetPlan} onValueChange={setTargetPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>Cancel</Button>
            <Button onClick={confirmConvert} disabled={converting}>
              {converting ? "Converting…" : "Confirm Conversion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StartPilotDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [days, setDays] = useState("60");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("schools").select("id,name").is("deleted_at", null).eq("pilot_status", "none").order("name").then(({ data }) => {
      setSchools((data as { id: string; name: string }[]) ?? []);
    });
  }, [open]);

  async function submit() {
    if (!schoolId) { toast.error("Pick a school"); return; }
    setSaving(true);
    const ends = new Date();
    ends.setDate(ends.getDate() + Number(days || 60));
    const { error } = await supabase.from("schools").update({
      pilot_status: "active",
      pilot_started_at: new Date().toISOString(),
      pilot_ends_at: ends.toISOString(),
      pilot_notes: notes.trim() || null,
    }).eq("id", schoolId);
    setSaving(false);
    if (error) { toast.error("Could not start pilot"); return; }
    toast.success("Pilot started");
    onOpenChange(false);
    setSchoolId(""); setNotes("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Start a Pilot</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium mb-1">School</div>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue placeholder="Choose school…" /></SelectTrigger>
              <SelectContent>
                {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Duration (days)</div>
            <Input type="number" value={days} onChange={e => setDays(e.target.value)} min={7} max={365} />
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Notes (champion name, deal terms…)</div>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Principal Adeyemi — promised free Term 1 if they refer 2 schools" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Starting…" : "Start pilot"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}