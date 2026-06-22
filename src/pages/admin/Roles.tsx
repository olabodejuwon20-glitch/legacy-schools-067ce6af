import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Save, ShieldCheck, ShieldOff, Search, Sparkles, Users,
  KeyRound, ChevronRight, Check, Copy, RotateCcw, Plus, Lock,
} from "lucide-react";
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/adminPermissions";
import { schoolPath } from "@/lib/tenant";
import { cn } from "@/lib/utils";

type SlotRow = {
  slot: number;
  name: string;
  enabled: boolean;
  permissions: string[];
};

const EMPTY_SLOT = (slot: number): SlotRow => ({ slot, name: "", enabled: false, permissions: [] });
const MAX_SLOTS = 10;
const SLOT_NUMS = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1);
const DEFAULT_SLOT_NAMES: Record<number, string> = {
  1: "Vice Principal",
  2: "HOD",
  3: "Exam Committee",
};
const EMPTY_SLOTS: SlotRow[] = SLOT_NUMS.map(s => ({
  slot: s, name: DEFAULT_SLOT_NAMES[s] || "", enabled: false, permissions: [],
}));

const TONE_CYCLE = [
  { ring: "ring-[hsl(var(--admin))]/30",   chip: "bg-[hsl(var(--admin))]/10 text-[hsl(var(--admin))]",     glow: "from-[hsl(var(--admin))]/20" },
  { ring: "ring-[hsl(var(--teacher))]/30", chip: "bg-[hsl(var(--teacher))]/10 text-[hsl(var(--teacher))]", glow: "from-[hsl(var(--teacher))]/20" },
  { ring: "ring-[hsl(var(--student))]/30", chip: "bg-[hsl(var(--student))]/10 text-[hsl(var(--student))]", glow: "from-[hsl(var(--student))]/20" },
  { ring: "ring-[hsl(var(--parent))]/30",  chip: "bg-[hsl(var(--parent))]/10 text-[hsl(var(--parent))]",   glow: "from-[hsl(var(--parent))]/20" },
];
const SLOT_TONES: Record<number, { ring: string; chip: string; glow: string; label: string }> =
  Object.fromEntries(SLOT_NUMS.map(s => {
    const t = TONE_CYCLE[(s - 1) % TONE_CYCLE.length];
    return [s, { ...t, label: `Slot ${String(s).padStart(2, "0")}` }];
  }));

const PRESETS: Array<{ id: string; name: string; description: string; keys: PermissionKey[] }> = [
  {
    id: "bursar", name: "Bursar / Finance",
    description: "Fees, payments, invoices and subscription only.",
    keys: ["fees", "subscription", "action:edit_fees", "reports"],
  },
  {
    id: "academics", name: "Academic Lead",
    description: "Classes, timetable, lesson notes and question bank.",
    keys: ["classes", "timetable", "lesson-notes", "question-bank", "library", "reports", "attendance"],
  },
  {
    id: "registrar", name: "Registrar",
    description: "Admissions, students, teachers and bulk onboarding.",
    keys: ["students", "teachers", "parents", "invites", "bulk", "enrollments"],
  },
  {
    id: "comms", name: "Communications",
    description: "Announcements, inbox and parent alerts.",
    keys: ["announcements", "inbox", "parent-alerts", "action:send_announcement"],
  },
];

export default function AdminRoles() {
  const { school } = useSchool();
  const [slots, setSlots] = useState<SlotRow[]>(EMPTY_SLOTS);
  const [original, setOriginal] = useState<SlotRow[]>(EMPTY_SLOTS);
  const [active, setActive] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_role_slots")
      .select("slot,name,enabled,permissions")
      .eq("school_id", school.id)
      .order("slot");
    if (error) toast.error(error.message);
    const map = new Map<number, SlotRow>();
    (data ?? []).forEach((row: any) => {
      map.set(row.slot, {
        slot: row.slot,
        name: row.name ?? "",
        enabled: !!row.enabled,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
      });
    });
    const next = SLOT_NUMS.map((s) => map.get(s) ?? ({
      slot: s, name: DEFAULT_SLOT_NAMES[s] || "", enabled: false, permissions: [],
    }));
    setSlots(next);
    setOriginal(next.map((r) => ({ ...r, permissions: [...r.permissions] })));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const current = slots.find((s) => s.slot === active)!;
  const baseline = original.find((s) => s.slot === active)!;
  const dirty = useMemo(() => {
    return current.name !== baseline.name
      || current.enabled !== baseline.enabled
      || current.permissions.length !== baseline.permissions.length
      || current.permissions.some((k) => !baseline.permissions.includes(k));
  }, [current, baseline]);

  function update(slot: number, patch: Partial<SlotRow>) {
    setSlots((s) => s.map((r) => (r.slot === slot ? { ...r, ...patch } : r)));
  }
  function toggleKey(slot: number, key: string, on: boolean) {
    setSlots((s) =>
      s.map((r) => {
        if (r.slot !== slot) return r;
        const set = new Set(r.permissions);
        if (on) set.add(key); else set.delete(key);
        return { ...r, permissions: Array.from(set) };
      }),
    );
  }
  function setGroup(slot: number, groupKeys: string[], on: boolean) {
    setSlots((s) =>
      s.map((r) => {
        if (r.slot !== slot) return r;
        const set = new Set(r.permissions);
        groupKeys.forEach((k) => (on ? set.add(k) : set.delete(k)));
        return { ...r, permissions: Array.from(set) };
      }),
    );
  }
  function applyPreset(slot: number, keys: PermissionKey[]) {
    update(slot, { permissions: Array.from(new Set(keys)) });
    toast.success("Preset applied — review and save.");
  }
  function reset(slot: number) {
    const o = original.find((r) => r.slot === slot)!;
    setSlots((s) => s.map((r) => (r.slot === slot ? { ...o, permissions: [...o.permissions] } : r)));
  }
  async function save(slot: number) {
    if (!school) return;
    const row = slots.find((r) => r.slot === slot)!;
    const cleaned = row.name.trim();
    if (row.enabled && !cleaned) {
      toast.error("Give this role a name before enabling it.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("admin_role_slots")
      .upsert(
        { school_id: school.id, slot, name: cleaned, enabled: row.enabled, permissions: row.permissions },
        { onConflict: "school_id,slot" },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Role saved`);
    load();
  }

  const totalEnabled = slots.filter((s) => s.enabled).length;
  const totalPermissions = ALL_PERMISSION_KEYS.length;

  return (
    <div className="space-y-6 pb-24">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 sm:p-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5">
                <Sparkles className="size-3" />
                Workspace · Access control
              </Badge>
              <Badge variant="outline" className="text-[10px]">Beta</Badge>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Roles &amp; permissions</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Design up to 10 admin roles for your school. Rename each, pick exactly what they can access, then invite teammates from Workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={schoolPath(school?.slug, "/app/admin/invites")}>
                <Users className="size-4 mr-1.5" /> Invite members
              </Link>
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-border bg-background/40 backdrop-blur">
            <StatCell label="Active roles"    value={`${totalEnabled} / ${MAX_SLOTS}`} icon={<ShieldCheck className="size-4 text-primary" />} />
          <StatCell label="Permissions in catalog" value={totalPermissions} icon={<KeyRound className="size-4 text-primary" />} />
          <StatCell label="Editing"         value={current?.name || `Slot ${active}`} icon={<Lock className="size-4 text-primary" />} />
            <StatCell label="Assigned via"    value="Workspace" icon={<Plus className="size-4 text-primary" />} last />
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-muted-foreground rounded-xl border border-dashed border-border">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* LEFT — slot list */}
          <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">Role slots</div>
            {slots.map((row) => {
              const tone = SLOT_TONES[row.slot];
              const isActive = active === row.slot;
              return (
                <button
                  key={row.slot}
                  onClick={() => setActive(row.slot)}
                  className={cn(
                    "w-full text-left group relative rounded-xl border bg-card px-4 py-3.5 transition-all",
                    "hover:border-primary/40 hover:shadow-sm",
                    isActive ? `border-transparent ring-2 ${tone.ring} shadow-md` : "border-border",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("inline-flex items-center justify-center size-9 rounded-lg font-display font-semibold text-sm", tone.chip)}>
                      {String(row.slot).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{tone.label}</span>
                        {row.enabled ? (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5"><ShieldCheck className="size-2.5" />Live</Badge>
                        ) : (
                          <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-0.5 text-muted-foreground"><ShieldOff className="size-2.5" />Off</Badge>
                        )}
                      </div>
                      <div className="font-medium truncate text-sm mt-0.5">
                        {row.name || <span className="text-muted-foreground italic">Untitled role</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {row.permissions.length} of {totalPermissions} permissions
                      </div>
                    </div>
                    <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isActive && "translate-x-0.5 text-foreground")} />
                  </div>
                  {/* mini progress bar */}
                  <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isActive ? "bg-primary" : "bg-primary/40")}
                      style={{ width: `${Math.round((row.permissions.length / totalPermissions) * 100)}%` }}
                    />
                  </div>
                </button>
              );
            })}

            <div className="rounded-xl border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground leading-relaxed">
              <div className="font-medium text-foreground mb-1 flex items-center gap-1.5"><Sparkles className="size-3 text-primary" /> Tip</div>
              You have up to {MAX_SLOTS} role slots. Rename them to match your school (e.g. Vice Principal, HOD, Exam Committee).
            </div>
          </aside>

          {/* RIGHT — editor */}
          <section className="space-y-5 min-w-0">
            <RoleHeaderCard
              row={current}
              onChange={(patch) => update(current.slot, patch)}
              onReset={() => reset(current.slot)}
              onSave={() => save(current.slot)}
              saving={saving}
              dirty={dirty}
            />

            {/* Presets */}
            <div className="rounded-2xl border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-display font-semibold text-sm">Start from a preset</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Bundles tuned for common school admin jobs. You can always edit after applying.</div>
                </div>
              </div>
              <div className="p-3 grid sm:grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const matches = p.keys.every((k) => current.permissions.includes(k))
                    && p.keys.length === current.permissions.length;
                  return (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(current.slot, p.keys)}
                      className={cn(
                        "text-left rounded-xl border p-3 transition-all hover:border-primary/40 hover:bg-accent/30",
                        matches ? "border-primary bg-primary/5" : "border-border bg-background",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{p.name}</div>
                        {matches ? <Check className="size-4 text-primary" /> : <Copy className="size-3.5 text-muted-foreground" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{p.description}</div>
                      <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{p.keys.length} permissions</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permissions */}
            <PermissionsEditor
              row={current}
              query={query}
              setQuery={setQuery}
              onToggle={(k, on) => toggleKey(current.slot, k, on)}
              onGroup={(keys, on) => setGroup(current.slot, keys, on)}
              onClear={() => update(current.slot, { permissions: [] })}
              onAll={() => update(current.slot, { permissions: ALL_PERMISSION_KEYS.slice() })}
            />
          </section>
        </div>
      )}

      {/* Sticky save bar */}
      {!loading && dirty && (
        <div className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-6 sm:bottom-6 z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="mx-auto sm:mx-0 max-w-2xl flex items-center gap-3 rounded-full border border-border bg-card/95 backdrop-blur px-4 py-2 shadow-lg">
            <span className="size-2 rounded-full bg-warning animate-pulse" />
            <span className="text-sm">Unsaved changes to <strong>{current.name || `Slot ${current.slot}`}</strong></span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => reset(current.slot)} disabled={saving}>
                <RotateCcw className="size-3.5 mr-1" /> Discard
              </Button>
              <Button size="sm" onClick={() => save(current.slot)} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, icon, last }: { label: string; value: React.ReactNode; icon: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("px-5 py-4 flex items-center gap-3", !last && "border-r border-border")}>
      <div className="size-9 rounded-lg bg-primary/10 grid place-items-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display font-semibold text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

function RoleHeaderCard({
  row, onChange, onReset, onSave, saving, dirty,
}: {
  row: SlotRow;
  onChange: (p: Partial<SlotRow>) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const tone = SLOT_TONES[row.slot];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className={cn("absolute -top-20 -right-20 size-56 rounded-full blur-3xl pointer-events-none bg-gradient-to-br", tone.glow, "to-transparent")} />
      <div className="relative p-5 sm:p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={cn("size-14 rounded-2xl grid place-items-center font-display text-xl font-semibold", tone.chip)}>
            {String(row.slot).padStart(2, "0")}
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor={`role-name-${row.slot}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">Role name</Label>
            <Input
              id={`role-name-${row.slot}`}
              className="mt-1 h-11 text-base font-medium border-0 border-b border-border rounded-none px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary bg-transparent"
              placeholder="e.g. Bursar, Vice Principal, Exam Officer"
              value={row.name}
              maxLength={40}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 bg-background/60">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="text-sm font-medium">{row.enabled ? "Live" : "Disabled"}</div>
            </div>
            <Switch checked={row.enabled} onCheckedChange={(v) => onChange({ enabled: !!v })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionsEditor({
  row, query, setQuery, onToggle, onGroup, onClear, onAll,
}: {
  row: SlotRow;
  query: string;
  setQuery: (s: string) => void;
  onToggle: (k: string, on: boolean) => void;
  onGroup: (keys: string[], on: boolean) => void;
  onClear: () => void;
  onAll: () => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = PERMISSION_GROUPS.map((g) => ({
    ...g,
    items: q ? g.items.filter((it) => it.label.toLowerCase().includes(q) || it.key.toLowerCase().includes(q)) : g.items,
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <div className="font-display font-semibold text-sm flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Permissions
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {row.permissions.length} selected · toggle exactly what this role can open and do.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search permissions"
              className="h-9 w-52 pl-7"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
          <Button variant="outline" size="sm" onClick={onAll}>Grant all</Button>
        </div>
      </div>

      <div className="p-3 sm:p-4 grid sm:grid-cols-2 gap-3">
        {filtered.map((g) => {
          const keys = g.items.map((i) => i.key);
          const onCount = keys.filter((k) => row.permissions.includes(k)).length;
          const allOn = onCount === keys.length;
          return (
            <div key={g.label} className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/70 bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-md grid place-items-center bg-primary/10 text-primary text-[10px] font-semibold">{onCount}</span>
                  <div>
                    <div className="text-xs font-semibold">{g.label}</div>
                    <div className="text-[10px] text-muted-foreground">{onCount} / {keys.length} on</div>
                  </div>
                </div>
                <Switch
                  checked={allOn}
                  onCheckedChange={(v) => onGroup(keys, !!v)}
                  aria-label={`Toggle all ${g.label}`}
                />
              </div>
              <ul className="divide-y divide-border/60">
                {g.items.map((it) => {
                  const on = row.permissions.includes(it.key);
                  const isAction = it.key.startsWith("action:");
                  return (
                    <li key={it.key}>
                      <label className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors">
                        <Checkbox checked={on} onCheckedChange={(v) => onToggle(it.key, !!v)} />
                        <span className="text-sm flex-1 leading-tight">{it.label}</span>
                        {isAction && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase tracking-wider text-warning border-warning/40 bg-warning/5">
                            Action
                          </Badge>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-10">
            No permissions match "{query}".
          </div>
        )}
      </div>
    </div>
  );
}
