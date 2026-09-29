import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, EmptyState } from "@/components/super/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  KeyRound, Search, Download, Sparkles, SlidersHorizontal, Loader2,
  CheckCircle2, Clock, Banknote, FlaskConical, Save, RefreshCw,
} from "lucide-react";
import { superAction } from "@/lib/super";

type School = { id: string; name: string; slug: string; plan: string; status: string };
type Module = { id: string; slug: string; name: string; category: string; monthly_price_cents: number; term_price_kobo: number; pricing_model: string };
type SM = {
  id: string;
  school_id: string;
  module_id: string;
  enabled: boolean;
  expires_at: string | null;
  beta: boolean;
  term_price_kobo_override: number | null;
};

type InspectTarget = {
  school: School;
  module: Module;
  enabled: boolean;
  beta: boolean;
  overrideNaira: string;
  expiresAt: string;
};

export default function SuperLicensing() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [matrix, setMatrix] = useState<SM[]>([]);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  // Bulk provisioning state
  const [bulkModuleId, setBulkModuleId] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Cell inspector modal
  const [inspecting, setInspecting] = useState<InspectTarget | null>(null);
  const [savingInspect, setSavingInspect] = useState(false);

  async function load() {
    const [s, m, sm] = await Promise.all([
      supabase.from("schools").select("id, name, slug, plan, status").is("deleted_at", null).order("name"),
      supabase.from("modules").select("id, slug, name, category, monthly_price_cents, term_price_kobo, pricing_model").is("deleted_at", null).neq("status", "archived").order("category").order("name"),
      supabase.from("school_modules").select("id, school_id, module_id, enabled, expires_at, beta, term_price_kobo_override"),
    ]);
    const schoolList = (s.data as School[]) ?? [];
    const modList = (m.data as Module[]) ?? [];
    setSchools(schoolList);
    setModules(modList);
    setMatrix((sm.data as SM[]) ?? []);
    if (!bulkModuleId && modList.length > 0) setBulkModuleId(modList[0].id);
  }

  useEffect(() => { void load(); }, []);

  const filteredSchools = useMemo(() => {
    return (schools ?? []).filter(s =>
      (planFilter === "all" || s.plan === planFilter) &&
      (q.trim() === "" || s.name.toLowerCase().includes(q.toLowerCase()) || s.slug.toLowerCase().includes(q.toLowerCase()))
    );
  }, [schools, q, planFilter]);

  function getCell(schoolId: string, moduleId: string) {
    return matrix.find(x => x.school_id === schoolId && x.module_id === moduleId);
  }

  const kpis = useMemo(() => {
    const enabledRows = matrix.filter(x => x.enabled);
    const betaCount = enabledRows.filter(x => x.beta).length;
    const customPriceCount = enabledRows.filter(x => x.term_price_kobo_override != null).length;
    const now = Date.now();
    const expiringSoon = enabledRows.filter(x => {
      if (!x.expires_at) return false;
      const t = new Date(x.expires_at).getTime();
      return t > now && t - now <= 14 * 86400_000;
    }).length;
    return {
      activeCount: enabledRows.length,
      betaCount,
      customPriceCount,
      expiringSoon,
    };
  }, [matrix]);

  async function toggle(schoolId: string, mod: Module, on: boolean) {
    const cellKey = `${schoolId}:${mod.id}`;
    setBusy(cellKey);
    try {
      const existing = getCell(schoolId, mod.id);
      const res = await superAction<{ ok: boolean; entitlement: SM }>("update_entitlement", {
        school_id: schoolId,
        module_id: mod.id,
        enabled: on,
        beta: existing?.beta ?? false,
        term_price_kobo_override: existing?.term_price_kobo_override ?? null,
        expires_at: existing?.expires_at ?? null,
      });
      if (res?.entitlement) {
        setMatrix(arr => {
          const idx = arr.findIndex(x => x.school_id === schoolId && x.module_id === mod.id);
          if (idx >= 0) {
            const copy = [...arr];
            copy[idx] = res.entitlement;
            return copy;
          }
          return [...arr, res.entitlement];
        });
      } else {
        await load();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update entitlement");
    } finally {
      setBusy(null);
    }
  }

  async function runBulk(enable: boolean) {
    if (!bulkModuleId || filteredSchools.length === 0) return;
    const mod = modules.find(m => m.id === bulkModuleId);
    setBulkBusy(true);
    try {
      const schoolIds = filteredSchools.map(s => s.id);
      await superAction("bulk_set_entitlements", {
        school_ids: schoolIds,
        module_id: bulkModuleId,
        enabled: enable,
      });
      toast.success(`${enable ? "Enabled" : "Revoked"} ${mod?.name ?? "module"} across ${schoolIds.length} school${schoolIds.length === 1 ? "" : "s"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  function openInspect(school: School, mod: Module) {
    const cell = getCell(school.id, mod.id);
    setInspecting({
      school,
      module: mod,
      enabled: !!cell?.enabled,
      beta: !!cell?.beta,
      overrideNaira: cell?.term_price_kobo_override != null ? String(Math.round(cell.term_price_kobo_override / 100)) : "",
      expiresAt: cell?.expires_at ? cell.expires_at.slice(0, 10) : "",
    });
  }

  async function saveInspect() {
    if (!inspecting) return;
    setSavingInspect(true);
    try {
      const overrideKobo = inspecting.overrideNaira.trim() === ""
        ? null
        : Math.max(0, Math.round((parseFloat(inspecting.overrideNaira) || 0) * 100));
      await superAction("update_entitlement", {
        school_id: inspecting.school.id,
        module_id: inspecting.module.id,
        enabled: inspecting.enabled,
        beta: inspecting.beta,
        term_price_kobo_override: overrideKobo,
        expires_at: inspecting.expiresAt ? new Date(inspecting.expiresAt).toISOString() : null,
      });
      toast.success(`Saved entitlement for ${inspecting.school.name}`);
      setInspecting(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save override");
    } finally {
      setSavingInspect(false);
    }
  }

  function exportCSV() {
    const header = ["School", "Slug", "Plan", ...modules.map(m => m.slug)];
    const rows = (schools ?? []).map(s => [
      s.name, s.slug, s.plan,
      ...modules.map(m => getCell(s.id, m.id)?.enabled ? "1" : "0"),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "licensing-matrix.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const groupedModules = useMemo(() => {
    const g: Record<string, Module[]> = {};
    for (const m of modules) (g[m.category] ??= []).push(m);
    return g;
  }, [modules]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-5">
      <PageHeader
        title="Feature Licensing"
        description="Per-school entitlements matrix across every module. Flip switches, bulk provision cohorts, or set custom per-school pricing & expirations."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5 mr-1.5" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="size-3.5 mr-1.5" />Export CSV</Button>
          </>
        }
      />

      {/* Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Active entitlements" value={schools ? kpis.activeCount : <Skel className="h-6 w-12" />} icon={<CheckCircle2 className="size-4" />} />
        <MetricCard label="Beta access grants" value={schools ? kpis.betaCount : <Skel className="h-6 w-12" />} icon={<FlaskConical className="size-4" />} />
        <MetricCard label="Custom price overrides" value={schools ? kpis.customPriceCount : <Skel className="h-6 w-12" />} icon={<Banknote className="size-4" />} />
        <MetricCard label="Expiring < 14 days" value={schools ? kpis.expiringSoon : <Skel className="h-6 w-12" />} icon={<Clock className="size-4" />} />
      </div>

      {/* Filters + Bulk Provisioning Bar */}
      <div className="rounded-xl border border-border bg-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search schools…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3.5 text-primary" /> Bulk ({filteredSchools.length} schools):
          </span>
          <Select value={bulkModuleId} onValueChange={setBulkModuleId}>
            <SelectTrigger className="w-[190px] h-9 text-xs"><SelectValue placeholder="Choose module" /></SelectTrigger>
            <SelectContent>
              {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="default" disabled={bulkBusy || !bulkModuleId || filteredSchools.length === 0} onClick={() => runBulk(true)}>
            {bulkBusy && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            Enable all
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy || !bulkModuleId || filteredSchools.length === 0} onClick={() => runBulk(false)}>
            Revoke all
          </Button>
        </div>
      </div>

      {schools === null ? (
        <div className="space-y-2"><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-10" /></div>
      ) : filteredSchools.length === 0 ? (
        <EmptyState icon={<KeyRound className="size-5" />} title="No schools match" description="Try adjusting your search or plan filter." />
      ) : (
        <Section
          title={`${filteredSchools.length} school${filteredSchools.length === 1 ? "" : "s"} × ${modules.length} module${modules.length === 1 ? "" : "s"}`}
          description="Click the sliders icon on any cell to configure beta access, custom negotiated NGN price, or expiration date."
        >
          <div className="overflow-x-auto -mx-5">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-muted-foreground px-5 py-2 sticky left-0 bg-card z-10 min-w-[210px]">School</th>
                  {Object.entries(groupedModules).map(([cat, mods]) => (
                    <th key={cat} colSpan={mods.length} className="text-center font-medium text-[11px] uppercase tracking-wide text-muted-foreground py-2 border-l border-border/60">
                      {cat}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-card z-10 px-5 py-2"></th>
                  {modules.map(m => (
                    <th key={m.id} className="px-2.5 py-2 text-[11px] font-medium text-foreground whitespace-nowrap border-l border-border/40">
                      {m.name}
                      {m.term_price_kobo > 0 && (
                        <div className="text-[10px] text-muted-foreground font-normal">₦{Math.round(m.term_price_kobo / 100).toLocaleString("en-NG")}/term</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map(s => (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-5 py-2.5 sticky left-0 bg-card z-10">
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{s.plan}</Badge>
                        <span className="text-[10px] text-muted-foreground">{s.slug}</span>
                      </div>
                    </td>
                    {modules.map(m => {
                      const cell = getCell(s.id, m.id);
                      const on = !!cell?.enabled;
                      const key = `${s.id}:${m.id}`;
                      const hasMeta = !!(cell?.beta || cell?.term_price_kobo_override != null || cell?.expires_at);
                      return (
                        <td key={m.id} className="px-2 py-2 text-center border-l border-border/40">
                          <div className="inline-flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <Switch checked={on} disabled={busy === key} onCheckedChange={(v) => toggle(s.id, m, v)} />
                              <button
                                type="button"
                                onClick={() => openInspect(s, m)}
                                title="Configure override / beta / expiry"
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <SlidersHorizontal className="size-3" />
                              </button>
                            </div>
                            {hasMeta && (
                              <div className="flex items-center gap-1 flex-wrap justify-center">
                                {cell?.beta && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-warning/15 text-warning border border-warning/30">
                                    BETA
                                  </span>
                                )}
                                {cell?.term_price_kobo_override != null && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-info/15 text-info border border-info/30">
                                    ₦{Math.round(cell.term_price_kobo_override / 100).toLocaleString("en-NG")}
                                  </span>
                                )}
                                {cell?.expires_at && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                                    exp {cell.expires_at.slice(5, 10)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </Section>
      )}

      {/* Cell Entitlement Inspector Dialog */}
      <Dialog open={!!inspecting} onOpenChange={o => !o && setInspecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Entitlement Override</DialogTitle>
            <DialogDescription>
              {inspecting?.school.name} · <span className="font-medium text-foreground">{inspecting?.module.name}</span>
            </DialogDescription>
          </DialogHeader>
          {inspecting && (
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Module Enabled</div>
                  <div className="text-xs text-muted-foreground">Grant or revoke access to {inspecting.module.name}.</div>
                </div>
                <Switch
                  checked={inspecting.enabled}
                  onCheckedChange={v => setInspecting({ ...inspecting, enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Beta Access</div>
                  <div className="text-xs text-muted-foreground">Enroll this school in early-access features for this module.</div>
                </div>
                <Switch
                  checked={inspecting.beta}
                  onCheckedChange={v => setInspecting({ ...inspecting, beta: v })}
                />
              </div>

              <div>
                <Label className="text-xs">Custom Term Price Override (₦ NGN)</Label>
                <Input
                  type="number"
                  min={0}
                  step="500"
                  value={inspecting.overrideNaira}
                  onChange={e => setInspecting({ ...inspecting, overrideNaira: e.target.value })}
                  placeholder={inspecting.module.term_price_kobo > 0
                    ? `Default: ₦${Math.round(inspecting.module.term_price_kobo / 100).toLocaleString("en-NG")}`
                    : "Default: Included (₦0)"}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Leave blank to use the standard catalog price.
                </p>
              </div>

              <div>
                <Label className="text-xs">Entitlement Expires At (Optional)</Label>
                <Input
                  type="date"
                  value={inspecting.expiresAt}
                  onChange={e => setInspecting({ ...inspecting, expiresAt: e.target.value })}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Useful for promotional trials of paid add-on modules.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInspecting(null)}>Cancel</Button>
            <Button onClick={saveInspect} disabled={savingInspect}>
              {savingInspect ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
              Save entitlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}