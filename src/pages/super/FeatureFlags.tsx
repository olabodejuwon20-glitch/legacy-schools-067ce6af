import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, Skel, EmptyState } from "@/components/super/primitives";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2, RefreshCw, Plus, Flag, Building2, RotateCcw, Save, Trash2,
  Search, ShieldAlert, Zap, Gauge, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { superAction } from "@/lib/super";
import ConfirmDeleteDialog from "@/components/super/ConfirmDeleteDialog";

type FlagRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  default_enabled: boolean;
  default_rollout_percent: number;
  is_kill_switch: boolean;
  overrides_count: number;
  created_at: string;
  updated_at: string;
};

type School = { id: string; name: string; slug: string };

type SchoolFlag = {
  flag_key: string;
  name: string;
  description: string | null;
  category: string;
  is_kill_switch: boolean;
  default_enabled: boolean;
  default_rollout_percent: number;
  override_enabled: boolean | null;
  override_rollout_percent: number | null;
  notes: string | null;
  updated_at: string | null;
};

const CAT_COLORS: Record<string, string> = {
  ai: "bg-primary/10 text-primary border-primary/25",
  modules: "bg-info/10 text-info border-info/25",
  exams: "bg-warning/10 text-warning border-warning/25",
  billing: "bg-success/10 text-success border-success/25",
  rollout: "bg-accent text-accent-foreground border-border",
  general: "bg-muted text-foreground border-border",
};

const ROLLOUT_PRESETS = [10, 25, 50, 100];

export default function SuperFeatureFlags() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [openSchool, setOpenSchool] = useState<{ flag: FlagRow } | null>(null);
  const [editing, setEditing] = useState<Partial<FlagRow> | null>(null);
  const [deleting, setDeleting] = useState<FlagRow | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [f, s] = await Promise.all([
      supabase.rpc("super_list_feature_flags" as any),
      supabase.from("schools").select("id, name, slug").is("deleted_at", null).order("name"),
    ]);
    if (f.error) toast.error("Could not load flags");
    setFlags((f.data ?? []) as FlagRow[]);
    setSchools((s.data ?? []) as School[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const cats = useMemo(() => Array.from(new Set(flags.map(f => f.category))).sort(), [flags]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return flags.filter(f =>
      (cat === "all" || f.category === cat) &&
      (!s || f.name.toLowerCase().includes(s) || f.key.toLowerCase().includes(s) || (f.description ?? "").toLowerCase().includes(s))
    );
  }, [flags, q, cat]);

  const kpis = useMemo(() => {
    const activeDefault = flags.filter(f => f.default_enabled).length;
    const gradual = flags.filter(f => f.default_enabled && f.default_rollout_percent > 0 && f.default_rollout_percent < 100).length;
    const killSwitches = flags.filter(f => f.is_kill_switch).length;
    const totalOverrides = flags.reduce((sum, f) => sum + (f.overrides_count ?? 0), 0);
    return { activeDefault, gradual, killSwitches, totalOverrides };
  }, [flags]);

  async function updateFlagRollout(f: FlagRow, enabled: boolean, pct: number) {
    setBusyKey(f.key);
    try {
      const { error } = await supabase.rpc("super_upsert_feature_flag" as any, {
        _key: f.key,
        _name: f.name,
        _description: f.description,
        _category: f.category,
        _default_enabled: enabled,
        _default_rollout_percent: pct,
        _is_kill_switch: f.is_kill_switch,
      });
      if (error) throw error;
      toast.success(`${f.name}: ${enabled ? `On (${pct}% rollout)` : "Off"}`);
      await load();
    } catch {
      toast.error("Could not update flag");
    } finally {
      setBusyKey(null);
    }
  }

  async function tripKillSwitch(f: FlagRow) {
    setBusyKey(f.key);
    try {
      await superAction("trip_kill_switch", { flag_key: f.key });
      toast.success(`Kill switch tripped for ${f.key} — disabled globally and across all school overrides`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to trip kill switch");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveEdit() {
    if (!editing?.key || !editing?.name) { toast.error("Key and name are required"); return; }
    const { error } = await supabase.rpc("super_upsert_feature_flag" as any, {
      _key: editing.key,
      _name: editing.name,
      _description: editing.description ?? null,
      _category: editing.category || "general",
      _default_enabled: !!editing.default_enabled,
      _default_rollout_percent: Number(editing.default_rollout_percent ?? 100),
      _is_kill_switch: !!editing.is_kill_switch,
    });
    if (error) return toast.error("Could not save flag");
    toast.success("Flag saved");
    setEditing(null);
    void load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Feature Flags & Kill Switches"
        description="Roll out new functionality gradually per school or globally. Kill switches let you instantly disable a feature across every tenant without redeploying."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={"size-3.5 mr-1.5 " + (loading ? "animate-spin" : "")} />Refresh
            </Button>
            <Button size="sm" onClick={() => setEditing({ category: "general", default_enabled: false, default_rollout_percent: 100, is_kill_switch: false })}>
              <Plus className="size-3.5 mr-1.5" />New flag
            </Button>
          </>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Default ON" value={loading ? <Skel className="h-6 w-10" /> : kpis.activeDefault} icon={<CheckCircle2 className="size-4" />} />
        <MetricCard label="Gradual rollout (<100%)" value={loading ? <Skel className="h-6 w-10" /> : kpis.gradual} icon={<Gauge className="size-4" />} />
        <MetricCard label="Kill switches" value={loading ? <Skel className="h-6 w-10" /> : kpis.killSwitches} icon={<ShieldAlert className="size-4" />} />
        <MetricCard label="Per-school overrides" value={loading ? <Skel className="h-6 w-10" /> : kpis.totalOverrides} icon={<Building2 className="size-4" />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search flag name, key, or description…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-40 capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-5 text-muted-foreground" />}
          title="No flags match your filters"
          description="Create a new feature flag or clear your search filter."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map(f => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground truncate">{f.name}</span>
                    <Badge variant="outline" className={"text-[10px] capitalize " + (CAT_COLORS[f.category] ?? CAT_COLORS.general)}>
                      {f.category}
                    </Badge>
                    {f.is_kill_switch && (
                      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                        <ShieldAlert className="size-3 mr-1" />kill switch
                      </Badge>
                    )}
                    {f.overrides_count > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {f.overrides_count} school override{f.overrides_count === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{f.description || "No description"}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <code className="text-[11px] text-muted-foreground font-mono">{f.key}</code>
                    {f.default_enabled && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground mr-1">Rollout:</span>
                        {ROLLOUT_PRESETS.map(p => (
                          <button
                            key={p}
                            type="button"
                            disabled={busyKey === f.key}
                            onClick={() => updateFlagRollout(f, true, p)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                              f.default_rollout_percent === p
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {f.is_kill_switch && f.default_enabled && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busyKey === f.key}
                      onClick={() => tripKillSwitch(f)}
                      title="Immediately disable globally and across all schools"
                    >
                      <Zap className="size-3.5 mr-1" />Trip Kill Switch
                    </Button>
                  )}
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">Default</div>
                    <div className="text-sm font-medium text-foreground">
                      {f.default_enabled
                        ? (f.default_rollout_percent >= 100 ? "On (100%)" : `On · ${f.default_rollout_percent}%`)
                        : "Off"}
                    </div>
                  </div>
                  <Switch
                    checked={f.default_enabled}
                    disabled={busyKey === f.key}
                    onCheckedChange={(v) => updateFlagRollout(f, v, v && f.default_rollout_percent === 0 ? 100 : f.default_rollout_percent)}
                  />
                  <Button size="sm" variant="outline" onClick={() => setOpenSchool({ flag: f })}>
                    <Building2 className="size-3.5 mr-1.5" />Per-school
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(f)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FlagEditor value={editing} onClose={() => setEditing(null)} onSave={saveEdit} onChange={setEditing} />
      <PerSchoolSheet flag={openSchool?.flag ?? null} schools={schools} onClose={() => setOpenSchool(null)} onSaved={load} />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={v => !v && setDeleting(null)}
        title={`Delete feature flag "${deleting?.key ?? ""}"`}
        description="This removes the feature flag and all per-school overrides permanently."
        destructive="delete"
        itemName={deleting?.key}
        onConfirm={async () => {
          if (!deleting) return;
          const { error } = await supabase.rpc("super_delete_feature_flag" as any, { _key: deleting.key });
          if (error) {
            toast.error("Could not delete flag");
            return;
          }
          toast.success("Flag deleted");
          setDeleting(null);
          await load();
        }}
      />
    </div>
  );
}

function FlagEditor({ value, onClose, onChange, onSave }: {
  value: Partial<FlagRow> | null;
  onClose: () => void;
  onChange: (v: Partial<FlagRow>) => void;
  onSave: () => void;
}) {
  if (!value) return null;
  const isNew = !value.id;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{isNew ? "New feature flag" : `Edit ${value.name}`}</DialogTitle>
          <DialogDescription>
            Configure rollout defaults and kill-switch behavior across all tenants.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Key</Label>
            <Input
              value={value.key ?? ""}
              disabled={!isNew}
              onChange={e => onChange({ ...value, key: e.target.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_") })}
              placeholder="ai.new_feature"
              className="font-mono text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={value.name ?? ""} onChange={e => onChange({ ...value, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={value.description ?? ""} onChange={e => onChange({ ...value, description: e.target.value })} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={value.category ?? "general"} onValueChange={v => onChange({ ...value, category: v })}>
                <SelectTrigger className="mt-1 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["general", "ai", "modules", "exams", "billing", "rollout"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Default rollout %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={value.default_rollout_percent ?? 100}
                onChange={e => onChange({ ...value, default_rollout_percent: Math.max(0, Math.min(100, Number(e.target.value))) })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Enabled by default</div>
              <div className="text-xs text-muted-foreground">Off means every school is opted-out unless overridden.</div>
            </div>
            <Switch checked={!!value.default_enabled} onCheckedChange={v => onChange({ ...value, default_enabled: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Kill switch</div>
              <div className="text-xs text-muted-foreground">Mark features you may need to instantly disable across the platform.</div>
            </div>
            <Switch checked={!!value.is_kill_switch} onCheckedChange={v => onChange({ ...value, is_kill_switch: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave}><Save className="size-4 mr-1.5" />Save flag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PerSchoolSheet({ flag, schools, onClose, onSaved }: {
  flag: FlagRow | null;
  schools: School[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [schoolId, setSchoolId] = useState<string>("");
  const [rows, setRows] = useState<SchoolFlag[]>([]);
  const [activeOverrides, setActiveOverrides] = useState<{ school_id: string; enabled: boolean; rollout_percent: number | null; notes: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { if (schools.length && !schoolId) setSchoolId(schools[0].id); }, [schools, schoolId]);

  async function load() {
    if (!schoolId || !flag) return;
    const [sfRes, ovRes] = await Promise.all([
      supabase.rpc("super_list_school_flags" as any, { _school_id: schoolId }),
      supabase.from("school_feature_flags").select("school_id, enabled, rollout_percent, notes").eq("flag_id", flag.id),
    ]);
    setRows((sfRes.data ?? []) as SchoolFlag[]);
    setActiveOverrides((ovRes.data ?? []) as any[]);
  }
  useEffect(() => { if (flag) void load(); }, [flag, schoolId]);

  const row = rows.find(r => r.flag_key === flag?.key);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pct, setPct] = useState<number>(100);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!row) return;
    setEnabled(row.override_enabled);
    setPct(row.override_rollout_percent ?? row.default_rollout_percent);
    setNotes(row.notes ?? "");
  }, [row?.flag_key, row?.override_enabled, row?.override_rollout_percent, schoolId]);

  if (!flag) return null;

  const effEnabled = enabled ?? flag.default_enabled;
  const filteredSchools = schools.filter(s => !q.trim() || s.name.toLowerCase().includes(q.toLowerCase()));

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("super_set_school_flag" as any, {
      _school_id: schoolId,
      _key: flag!.key,
      _enabled: enabled,
      _rollout_percent: pct,
      _notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error("Could not save override");
    toast.success("Override saved");
    onSaved();
    void load();
  }

  async function clearOverride() {
    setBusy(true);
    const { error } = await supabase.rpc("super_clear_school_flag" as any, {
      _school_id: schoolId,
      _key: flag!.key,
    });
    setBusy(false);
    if (error) return toast.error("Could not clear");
    toast.success("Reverted to default");
    setEnabled(null);
    onSaved();
    void load();
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Per-school override</SheetTitle>
          <SheetDescription>
            Override the default for <span className="font-mono text-foreground">{flag.key}</span> on a specific school.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {activeOverrides.length > 0 && (
            <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
              <div className="text-xs font-semibold text-foreground">
                Schools with active overrides ({activeOverrides.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeOverrides.map(ov => {
                  const sch = schools.find(s => s.id === ov.school_id);
                  return (
                    <button
                      key={ov.school_id}
                      type="button"
                      onClick={() => setSchoolId(ov.school_id)}
                      className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                        schoolId === ov.school_id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {sch?.name ?? ov.school_id.slice(0, 8)} · {ov.enabled ? "ON" : "OFF"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">School</Label>
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search schools…" className="pl-8 mt-1 mb-2" />
            </div>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border p-3 text-xs space-y-1 bg-muted/30">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Default</span>
              <span>{flag.default_enabled ? "On" : "Off"} · {flag.default_rollout_percent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current override</span>
              <span>
                {row?.override_enabled == null
                  ? "— (uses default)"
                  : `${row.override_enabled ? "On" : "Off"} · ${row.override_rollout_percent ?? flag.default_rollout_percent}%`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium text-foreground">Override state</div>
              <div className="text-xs text-muted-foreground">
                {enabled == null ? "No override — using default" : enabled ? "Force on for this school" : "Force off for this school"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
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
            <p className="text-[11px] text-muted-foreground mt-1">
              Users are bucketed deterministically per school so the same users see the feature across sessions.
            </p>
          </div>

          <div>
            <Label className="text-xs">Notes (audit trail)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why was this override applied?" className="mt-1" />
          </div>

          <div className="rounded-md border border-border p-3 text-sm">
            Effective for this school: <span className="font-semibold text-foreground">{effEnabled ? "ON" : "OFF"}</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={clearOverride} disabled={busy || row?.override_enabled == null}>
              <RotateCcw className="size-4 mr-1" />Clear override
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}