import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULE_MANIFESTS } from "@/modules/registry";
import { PageHeader, Section, StatusBadge, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Package, RefreshCw, Sparkles, FlaskConical, Plus, Pencil, Trash2,
  Search, Building2, Banknote, Save,
} from "lucide-react";
import { Link } from "react-router-dom";
import { superAction } from "@/lib/super";
import ConfirmDeleteDialog from "@/components/super/ConfirmDeleteDialog";

type ModuleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  global_default: boolean;
  pricing_model: string;
  monthly_price_cents: number;
  term_price_kobo: number;
  version: string;
  default_config: Record<string, unknown>;
  config_schema: unknown[] | null;
};

type InstallRow = {
  module_id: string;
  school_id: string;
  enabled: boolean;
  term_price_kobo_override: number | null;
};

type DraftModule = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: string;
  version: string;
  pricing_model: string;
  term_price_naira: string;
  global_default: boolean;
  default_config_json: string;
  config_schema_json: string;
};

const CATEGORIES = ["core", "academics", "assessments", "finance", "communication", "ai", "operations", "facilities", "general"];
const STATUSES = ["available", "beta", "testing", "archived"];
const PRICING_MODELS = [
  { value: "included", label: "Included in base plan" },
  { value: "addon", label: "Paid Add-on (per term)" },
  { value: "per_student", label: "Per-student meter" },
];

export default function SuperModules() {
  const [rows, setRows] = useState<ModuleRow[] | null>(null);
  const [installs, setInstalls] = useState<InstallRow[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<DraftModule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ModuleRow | null>(null);

  async function load() {
    setRows(null);
    const [mRes, smRes] = await Promise.all([
      supabase
        .from("modules")
        .select("id, slug, name, description, category, status, global_default, pricing_model, monthly_price_cents, term_price_kobo, version, default_config, config_schema")
        .is("deleted_at", null)
        .order("category")
        .order("name"),
      supabase
        .from("school_modules")
        .select("module_id, school_id, enabled, term_price_kobo_override")
        .eq("enabled", true),
    ]);
    if (mRes.error) toast.error(mRes.error.message);
    setRows((mRes.data as ModuleRow[]) ?? []);
    setInstalls((smRes.data as InstallRow[]) ?? []);
  }
  useEffect(() => { void load(); }, []);

  const dbSlugs = new Set((rows ?? []).map(r => r.slug));
  const missing = MODULE_MANIFESTS.filter(m => !dbSlugs.has(m.slug));

  const statsByModule = useMemo(() => {
    const map = new Map<string, { schools: number; revenueKobo: number }>();
    if (!rows) return map;
    const basePrice = new Map(rows.map(r => [r.id, r.term_price_kobo ?? 0]));
    for (const inst of installs) {
      if (!inst.enabled) continue;
      const cur = map.get(inst.module_id) ?? { schools: 0, revenueKobo: 0 };
      cur.schools += 1;
      cur.revenueKobo += inst.term_price_kobo_override ?? basePrice.get(inst.module_id) ?? 0;
      map.set(inst.module_id, cur);
    }
    return map;
  }, [rows, installs]);

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    (rows ?? []).forEach(r => { if (r.category) set.add(r.category); });
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const search = q.trim().toLowerCase();
    return rows.filter(r => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search) return true;
      return (
        r.name.toLowerCase().includes(search) ||
        r.slug.toLowerCase().includes(search) ||
        (r.description ?? "").toLowerCase().includes(search)
      );
    });
  }, [rows, q, catFilter, statusFilter]);

  async function seedMissing() {
    setSeeding(true);
    try {
      const payload = missing.map(m => ({
        slug: m.slug,
        name: m.name,
        category: m.category,
        default_config: (m.defaultConfig ?? {}) as any,
        global_default: !!m.core,
      }));
      if (payload.length === 0) { toast.info("Registry is already up to date"); return; }
      const { error } = await supabase.from("modules").insert(payload);
      if (error) throw error;
      toast.success(`Seeded ${payload.length} modules`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Seeding failed");
    } finally { setSeeding(false); }
  }

  async function toggleDefault(row: ModuleRow) {
    const next = !row.global_default;
    const { error } = await supabase.from("modules").update({ global_default: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows(r => r?.map(x => x.id === row.id ? { ...x, global_default: next } : x) ?? null);
    toast.success(`${row.name} default set to ${next ? "ON" : "OFF"}`);
  }

  function openNew() {
    setEditing({
      slug: "",
      name: "",
      description: "",
      category: "academics",
      status: "available",
      version: "1.0.0",
      pricing_model: "included",
      term_price_naira: "0",
      global_default: false,
      default_config_json: "{\n  \n}",
      config_schema_json: "[]",
    });
  }

  function openEdit(r: ModuleRow) {
    setEditing({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? ((r.default_config as any)?.description ?? ""),
      category: r.category || "general",
      status: r.status || "available",
      version: r.version || "1.0.0",
      pricing_model: r.pricing_model || "included",
      term_price_naira: String(Math.round((r.term_price_kobo ?? 0) / 100)),
      global_default: !!r.global_default,
      default_config_json: JSON.stringify(r.default_config ?? {}, null, 2),
      config_schema_json: JSON.stringify(r.config_schema ?? [], null, 2),
    });
  }

  async function saveModule() {
    if (!editing) return;
    if (!editing.slug.trim() || !editing.name.trim()) {
      toast.error("Module name and slug are required");
      return;
    }
    let parsedConfig: Record<string, unknown> = {};
    let parsedSchema: unknown[] = [];
    try {
      parsedConfig = JSON.parse(editing.default_config_json || "{}");
    } catch {
      toast.error("Default config must be valid JSON");
      return;
    }
    try {
      const s = JSON.parse(editing.config_schema_json || "[]");
      parsedSchema = Array.isArray(s) ? s : [];
    } catch {
      toast.error("Config schema must be a valid JSON array");
      return;
    }

    setSaving(true);
    try {
      const termKobo = Math.max(0, Math.round((parseFloat(editing.term_price_naira || "0") || 0) * 100));
      await superAction("upsert_module", {
        module: {
          id: editing.id,
          slug: editing.slug.trim(),
          name: editing.name.trim(),
          description: editing.description.trim() || null,
          category: editing.category,
          status: editing.status,
          version: editing.version.trim() || "1.0.0",
          pricing_model: editing.pricing_model,
          term_price_kobo: editing.pricing_model === "included" ? 0 : termKobo,
          global_default: editing.global_default,
          default_config: parsedConfig,
          config_schema: parsedSchema,
        },
      });
      toast.success(editing.id ? "Module updated" : "Module registered");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save module");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Modules & Plugins"
        description="The canonical module registry. Configure pricing, default configs, schemas, and global rollout defaults."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/super/testing-lab"><FlaskConical className="size-3.5 mr-1.5" />Internal Testing Lab</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="size-3.5 mr-1.5" />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={seedMissing} disabled={seeding || missing.length === 0}>
              {seeding ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
              Seed missing ({missing.length})
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="size-3.5 mr-1.5" />New module
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search module name, slug, or description…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Section
        title={`Registered modules (${filtered.length})`}
        description="Stored in public.modules. Schools enable these via Marketplace or Licensing."
      >
        {rows === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-20" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="size-5 text-muted-foreground" />}
            title="No modules match"
            description={rows.length === 0 ? "Click 'Seed missing' to populate the registry from the in-repo manifest." : "Try clearing your search or category filters."}
            action={rows.length === 0 ? <Button size="sm" onClick={seedMissing}>Seed now</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-border -my-2">
            {filtered.map(r => {
              const stat = statsByModule.get(r.id) ?? { schools: 0, revenueKobo: 0 };
              const desc = r.description || (r.default_config as any)?.description || "";
              const isCore = MODULE_MANIFESTS.find(m => m.slug === r.slug)?.core;
              return (
                <li key={r.id} className="py-3.5 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className="size-9 rounded-md bg-muted grid place-items-center shrink-0">
                    <Package className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{r.name}</span>
                      <code className="text-[11px] text-muted-foreground font-mono">{r.slug}</code>
                      <Badge variant="secondary" className="text-[10px] capitalize">{r.category}</Badge>
                      {isCore && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">Core</Badge>}
                      <StatusBadge status={r.status} />
                    </div>
                    {desc && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{desc}</p>}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                      <span>v{r.version}</span>
                      <span>·</span>
                      <span className="capitalize">{r.pricing_model.replace("_", " ")}</span>
                      {r.term_price_kobo > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-foreground">₦{Math.round(r.term_price_kobo / 100).toLocaleString("en-NG")}/term</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3" /> {stat.schools} active school{stat.schools === 1 ? "" : "s"}
                      </span>
                      {stat.revenueKobo > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-success font-medium">
                            <Banknote className="size-3" /> ₦{Math.round(stat.revenueKobo / 100).toLocaleString("en-NG")}/term live
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.status === "testing" ? (
                      <Button variant="outline" size="sm" asChild className="border-warning/40 text-warning hover:bg-warning/10">
                        <Link to="/super/testing-lab"><FlaskConical className="size-3.5 mr-1.5" />Verify in Lab</Link>
                      </Button>
                    ) : (
                      <Button variant={r.global_default ? "default" : "outline"} size="sm" onClick={() => toggleDefault(r)}>
                        {r.global_default ? "Default on" : "Default off"}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Edit module">
                      <Pencil className="size-3.5" />
                    </Button>
                    {!isCore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(r)}
                        title="Archive or delete module"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Create / Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing?.id ? `Edit ${editing.name}` : "Register new module"}</DialogTitle>
            <DialogDescription>
              Configure metadata, NGN termly pricing, default availability, and JSON configuration schema.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Module Name</Label>
                  <Input
                    value={editing.name}
                    onChange={e => {
                      const name = e.target.value;
                      const autoSlug = !editing.id && (!editing.slug || editing.slug === editing.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-"))
                        ? name.toLowerCase().replace(/[^a-z0-9-_]/g, "-")
                        : editing.slug;
                      setEditing({ ...editing, name, slug: autoSlug });
                    }}
                    placeholder="e.g. Biometric Attendance"
                  />
                </div>
                <div>
                  <Label className="text-xs">Canonical Slug</Label>
                  <Input
                    value={editing.slug}
                    disabled={!!editing.id}
                    onChange={e => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-") })}
                    placeholder="biometric-attendance"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={2}
                  value={editing.description}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="What capabilities does this module unlock for schools?"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={editing.category} onValueChange={v => setEditing({ ...editing, category: v })}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Lifecycle Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Version</Label>
                  <Input
                    value={editing.version}
                    onChange={e => setEditing({ ...editing, version: e.target.value })}
                    placeholder="1.0.0"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Pricing Model</Label>
                  <Select value={editing.pricing_model} onValueChange={v => setEditing({ ...editing, pricing_model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICING_MODELS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Term Price (₦ NGN)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="500"
                    disabled={editing.pricing_model === "included"}
                    value={editing.pricing_model === "included" ? "0" : editing.term_price_naira}
                    onChange={e => setEditing({ ...editing, term_price_naira: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                <div>
                  <div className="text-sm font-medium text-foreground">Enabled by default for new schools</div>
                  <div className="text-xs text-muted-foreground">When enabled, newly registered schools receive this module automatically.</div>
                </div>
                <Switch
                  checked={editing.global_default}
                  onCheckedChange={v => setEditing({ ...editing, global_default: v })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Default Config (JSON)</Label>
                  <Textarea
                    rows={5}
                    value={editing.default_config_json}
                    onChange={e => setEditing({ ...editing, default_config_json: e.target.value })}
                    className="font-mono text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Config Schema Fields (JSON Array)</Label>
                  <Textarea
                    rows={5}
                    value={editing.config_schema_json}
                    onChange={e => setEditing({ ...editing, config_schema_json: e.target.value })}
                    className="font-mono text-xs mt-1"
                    placeholder='[{"key":"allowOffline","label":"Allow Offline","type":"boolean"}]'
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveModule} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
              Save module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={v => !v && setDeleting(null)}
        title={`Remove module "${deleting?.name ?? ""}"`}
        description="Choose whether to archive this module for 30 days (hiding it from catalog while preserving school configs) or permanently delete it."
        itemName={deleting?.name}
        onSuspend30Days={async () => {
          if (!deleting) return;
          await superAction("archive_module", { module_id: deleting.id });
          toast.success(`${deleting.name} archived for 30 days`);
          setDeleting(null);
          await load();
        }}
        onConfirm={async (confirm) => {
          if (!deleting) return;
          await superAction("delete_module", { module_id: deleting.id, confirm });
          toast.success(`${deleting.name} permanently deleted`);
          setDeleting(null);
          await load();
        }}
      />
    </div>
  );
}
