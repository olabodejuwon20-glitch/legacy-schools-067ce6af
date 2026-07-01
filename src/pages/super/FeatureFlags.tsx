import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Plus, Flag, Building2, RotateCcw, Save, Trash2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Flag = {
  id: string; key: string; name: string; description: string | null; category: string;
  default_enabled: boolean; default_rollout_percent: number; is_kill_switch: boolean;
  overrides_count: number; created_at: string; updated_at: string;
};

type School = { id: string; name: string; slug: string };

type SchoolFlag = {
  flag_key: string; name: string; description: string | null; category: string;
  is_kill_switch: boolean; default_enabled: boolean; default_rollout_percent: number;
  override_enabled: boolean | null; override_rollout_percent: number | null;
  notes: string | null; updated_at: string | null;
};

const CAT_COLORS: Record<string, string> = {
  ai: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  modules: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  exams: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  billing: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rollout: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/30",
  general: "bg-muted text-foreground border-border",
};

export default function SuperFeatureFlags() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [openSchool, setOpenSchool] = useState<{ flag: Flag } | null>(null);
  const [editing, setEditing] = useState<Partial<Flag> | null>(null);

  async function load() {
    setLoading(true);
    const [f, s] = await Promise.all([
      supabase.rpc("super_list_feature_flags" as any),
      supabase.from("schools").select("id, name, slug").order("name"),
    ]);
    if (f.error) toast.error("Could not load flags");
    setFlags((f.data ?? []) as Flag[]);
    setSchools((s.data ?? []) as School[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const cats = useMemo(() => Array.from(new Set(flags.map(f => f.category))).sort(), [flags]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return flags.filter(f =>
      (cat === "all" || f.category === cat) &&
      (!s || f.name.toLowerCase().includes(s) || f.key.toLowerCase().includes(s))
    );
  }, [flags, q, cat]);

  async function toggleDefault(f: Flag, next: boolean) {
    const { error } = await supabase.rpc("super_upsert_feature_flag" as any, {
      _key: f.key, _name: f.name, _description: f.description, _category: f.category,
      _default_enabled: next, _default_rollout_percent: f.default_rollout_percent, _is_kill_switch: f.is_kill_switch,
    });
    if (error) return toast.error("Could not update");
    toast.success(next ? "Flag turned on by default" : "Flag turned off by default");
    load();
  }

  async function saveEdit() {
    if (!editing?.key || !editing?.name) { toast.error("Key and name are required"); return; }
    const { error } = await supabase.rpc("super_upsert_feature_flag" as any, {
      _key: editing.key, _name: editing.name, _description: editing.description ?? null,
      _category: editing.category || "general",
      _default_enabled: !!editing.default_enabled,
      _default_rollout_percent: Number(editing.default_rollout_percent ?? 0),
      _is_kill_switch: !!editing.is_kill_switch,
    });
    if (error) return toast.error("Could not save flag");
    toast.success("Flag saved");
    setEditing(null); load();
  }

  async function del(f: Flag) {
    if (!confirm(`Delete flag "${f.key}"? All per-school overrides will be removed.`)) return;
    const { error } = await supabase.rpc("super_delete_feature_flag" as any, { _key: f.key });
    if (error) return toast.error("Could not delete");
    toast.success("Flag deleted"); load();
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Flag className="size-6 text-primary" /> Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle modules and roll out new functionality per school. Kill switches let you instantly disable a feature for one school (or everyone) without a redeploy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="pl-8 w-56" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={"size-4 " + (loading ? "animate-spin" : "")} />
          </Button>
          <Button size="sm" onClick={() => setEditing({ category: "general", default_enabled: false, default_rollout_percent: 0, is_kill_switch: false })}>
            <Plus className="size-4 mr-1" /> New flag
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center h-64"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No flags match your filters.</Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(f => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{f.name}</span>
                    <Badge variant="outline" className={"text-[10px] " + (CAT_COLORS[f.category] ?? CAT_COLORS.general)}>{f.category}</Badge>
                    {f.is_kill_switch && <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 border-rose-500/30"><ShieldAlert className="size-3 mr-1" />kill switch</Badge>}
                    {f.overrides_count > 0 && <Badge variant="secondary" className="text-[10px]">{f.overrides_count} override{f.overrides_count === 1 ? "" : "s"}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{f.description || "No description"}</p>
                  <code className="text-[11px] text-muted-foreground font-mono">{f.key}</code>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">Default</div>
                    <div className="text-sm font-medium">
                      {f.default_enabled
                        ? (f.default_rollout_percent >= 100 ? "On" : `On · ${f.default_rollout_percent}% rollout`)
                        : "Off"}
                    </div>
                  </div>
                  <Switch checked={f.default_enabled} onCheckedChange={(v) => toggleDefault(f, v)} />
                  <Button size="sm" variant="outline" onClick={() => setOpenSchool({ flag: f })}>
                    <Building2 className="size-4 mr-1" /> Per-school
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(f)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FlagEditor value={editing} onClose={() => setEditing(null)} onSave={saveEdit} onChange={setEditing} />
      <PerSchoolSheet flag={openSchool?.flag ?? null} schools={schools} onClose={() => setOpenSchool(null)} onSaved={load} />
    </div>
  );
}

function FlagEditor({ value, onClose, onChange, onSave }: {
  value: Partial<Flag> | null;
  onClose: () => void;
  onChange: (v: Partial<Flag>) => void;
  onSave: () => void;
}) {
  if (!value) return null;
  const isNew = !value.id;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "New feature flag" : `Edit ${value.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Key</Label>
            <Input value={value.key ?? ""} disabled={!isNew}
              onChange={e => onChange({ ...value, key: e.target.value.trim() })}
              placeholder="ai.new_feature" />
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={value.name ?? ""} onChange={e => onChange({ ...value, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={value.description ?? ""} onChange={e => onChange({ ...value, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Input value={value.category ?? "general"} onChange={e => onChange({ ...value, category: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Default rollout %</Label>
              <Input type="number" min={0} max={100} value={value.default_rollout_percent ?? 0}
                onChange={e => onChange({ ...value, default_rollout_percent: Math.max(0, Math.min(100, Number(e.target.value))) })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enabled by default</div>
              <div className="text-xs text-muted-foreground">Off means every school is opted-out unless overridden.</div>
            </div>
            <Switch checked={!!value.default_enabled} onCheckedChange={v => onChange({ ...value, default_enabled: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Kill switch</div>
              <div className="text-xs text-muted-foreground">Mark features you may need to instantly disable for one school.</div>
            </div>
            <Switch checked={!!value.is_kill_switch} onCheckedChange={v => onChange({ ...value, is_kill_switch: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}><Save className="size-4 mr-1" /> Save flag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerSchoolSheet({ flag, schools, onClose, onSaved }: {
  flag: Flag | null; schools: School[]; onClose: () => void; onSaved: () => void;
}) {
  const [schoolId, setSchoolId] = useState<string>("");
  const [rows, setRows] = useState<SchoolFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { if (schools.length && !schoolId) setSchoolId(schools[0].id); }, [schools, schoolId]);

  async function load() {
    if (!schoolId) return;
    setLoading(true);
    const { data } = await supabase.rpc("super_list_school_flags" as any, { _school_id: schoolId });
    setRows((data ?? []) as SchoolFlag[]);
    setLoading(false);
  }
  useEffect(() => { if (flag) load(); }, [flag, schoolId]);

  const row = rows.find(r => r.flag_key === flag?.key);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pct, setPct] = useState<number>(100);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!row) return;
    setEnabled(row.override_enabled);
    setPct(row.override_rollout_percent ?? row.default_rollout_percent);
    setNotes(row.notes ?? "");
  }, [row?.flag_key, schoolId]);

  if (!flag) return null;

  const effEnabled = enabled ?? flag.default_enabled;
  const filteredSchools = schools.filter(s => !q.trim() || s.name.toLowerCase().includes(q.toLowerCase()));

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("super_set_school_flag" as any, {
      _school_id: schoolId, _key: flag!.key,
      _enabled: enabled, _rollout_percent: pct, _notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error("Could not save override");
    toast.success("Override saved"); onSaved(); load();
  }
  async function clearOverride() {
    setBusy(true);
    const { error } = await supabase.rpc("super_clear_school_flag" as any, {
      _school_id: schoolId, _key: flag!.key,
    });
    setBusy(false);
    if (error) return toast.error("Could not clear");
    toast.success("Reverted to default"); setEnabled(null); onSaved(); load();
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Per-school override</SheetTitle>
          <SheetDescription>
            Override the default for <span className="font-mono">{flag.key}</span> on a specific school.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-xs">School</Label>
            <div className="relative">
              <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="pl-7 mt-1 mb-2" />
            </div>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border p-3 text-xs space-y-1 bg-muted/30">
            <div className="flex justify-between"><span className="text-muted-foreground">Default</span><span>{flag.default_enabled ? "On" : "Off"} · {flag.default_rollout_percent}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Current override</span><span>{row?.override_enabled == null ? "— (uses default)" : `${row.override_enabled ? "On" : "Off"} · ${row.override_rollout_percent ?? flag.default_rollout_percent}%`}</span></div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Override state</div>
              <div className="text-xs text-muted-foreground">{enabled == null ? "No override — using default" : enabled ? "Force on for this school" : "Force off for this school"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={enabled === true ? "default" : "outline"} onClick={() => setEnabled(true)}>On</Button>
              <Button size="sm" variant={enabled === false ? "default" : "outline"} onClick={() => setEnabled(false)}>Off</Button>
              <Button size="sm" variant={enabled == null ? "default" : "outline"} onClick={() => setEnabled(null)}>Default</Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Rollout percent (when on)</Label>
              <span className="text-xs font-mono">{pct}%</span>
            </div>
            <Slider value={[pct]} min={0} max={100} step={5} onValueChange={([v]) => setPct(v)} />
            <p className="text-[11px] text-muted-foreground mt-1">Users are bucketed deterministically per school so the same users see the feature across sessions.</p>
          </div>

          <div>
            <Label className="text-xs">Notes (audit trail)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why was this override applied?" />
          </div>

          <div className="rounded-md border border-border p-3 text-sm">
            Effective for this school: <span className="font-semibold">{effEnabled ? "ON" : "OFF"}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={clearOverride} disabled={busy || !row?.override_enabled === null}>
              <RotateCcw className="size-4 mr-1" /> Clear override
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />} Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}