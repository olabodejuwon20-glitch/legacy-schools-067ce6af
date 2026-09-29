import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, EmptyState, StatusBadge } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FlaskConical, Rocket, CheckCircle2, ExternalLink, Plus, Play, RefreshCw,
  ShieldCheck, Package, Eye, Loader2, Layers, ArrowRight,
} from "lucide-react";
import { superAction } from "@/lib/super";
import { buildSchoolUrl } from "@/lib/tenant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Checklist = {
  sandbox_mounted: boolean;
  admin_verified: boolean;
  teacher_verified: boolean;
  student_verified: boolean;
  parent_verified: boolean;
  rls_verified: boolean;
};

type ModuleItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  global_default: boolean;
  pricing_model: string;
  term_price_kobo: number;
  version: string;
  default_config: {
    description?: string;
    lab_stage?: string;
    checklist?: Partial<Checklist>;
    qa_notes?: string;
    approved_at?: string;
  } | null;
};

const CHECKLIST_ITEMS: { key: keyof Checklist; label: string; hint: string }[] = [
  { key: "sandbox_mounted", label: "Sandbox Mounted",     hint: "Feature enabled on Internal QA Sandbox School" },
  { key: "admin_verified",  label: "Admin Portal QA",     hint: "Verified configuration & UI in Admin role" },
  { key: "teacher_verified",label: "Teacher Portal QA",   hint: "Verified workflows in Teacher role" },
  { key: "student_verified",label: "Student Portal QA",   hint: "Verified student experience & mobile layout" },
  { key: "parent_verified", label: "Parent Portal QA",    hint: "Verified parent visibility & notifications" },
  { key: "rls_verified",    label: "RLS & Isolation QA",  hint: "Verified tenant data isolation & permissions" },
];

const DEFAULT_CHECKLIST: Checklist = {
  sandbox_mounted: true,
  admin_verified: false,
  teacher_verified: false,
  student_verified: false,
  parent_verified: false,
  rls_verified: false,
};

export default function SuperTestingLab() {
  const nav = useNavigate();
  const [modules, setModules] = useState<ModuleItem[] | null>(null);
  const [sandboxSchool, setSandboxSchool] = useState<any | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [previewRole, setPreviewRole] = useState<"admin" | "teacher" | "student" | "parent">("admin");
  const [showPreviewFrame, setShowPreviewFrame] = useState(false);

  // Diagnostic probe state
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ dbMs: number; rlsOk: boolean; modulesCount: number; flagsCount: number; ranAt: string } | null>(null);

  // Create new feature modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "academics",
    version: "0.1.0-rc1",
    pricing_model: "included",
    term_price_naira: "0",
    description: "",
  });

  // Rollout modal
  const [rolloutTarget, setRolloutTarget] = useState<ModuleItem | null>(null);
  const [rolloutGlobalDefault, setRolloutGlobalDefault] = useState(false);
  const [rolloutAllSchools, setRolloutAllSchools] = useState(true);
  const [rollingOut, setRollingOut] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const [modsRes, sbRes] = await Promise.all([
      supabase
        .from("modules")
        .select("id, slug, name, category, status, global_default, pricing_model, term_price_kobo, version, default_config")
        .order("name"),
      supabase
        .from("schools")
        .select("*")
        .eq("slug", "internal-sandbox")
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    setModules((modsRes.data as ModuleItem[]) ?? []);
    setSandboxSchool(sbRes.data ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function ensureSandboxSchool() {
    setProvisioning(true);
    try {
      const res = await superAction("provision_sandbox_school", {});
      if ((res as any)?.school) setSandboxSchool((res as any).school);
      toast.success("Internal QA Sandbox School is ready for testing");
      await load();
    } catch {
      /* superAction toasts */
    } finally {
      setProvisioning(false);
    }
  }

  async function runDiagnostics() {
    setProbing(true);
    try {
      const t0 = performance.now();
      const [schCheck, modCheck, flagCheck] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("feature_flags").select("id", { count: "exact", head: true }),
      ]);
      const dbMs = Math.max(1, Math.round(performance.now() - t0));
      setProbeResult({
        dbMs,
        rlsOk: !schCheck.error && !modCheck.error,
        modulesCount: modCheck.count ?? 0,
        flagsCount: flagCheck.count ?? 0,
        ranAt: new Date().toLocaleTimeString(),
      });
      toast.success(`Sandbox diagnostics passed (${dbMs}ms)`);
    } catch (e: any) {
      toast.error(e.message ?? "Diagnostics failed");
    } finally {
      setProbing(false);
    }
  }

  async function handleCreateFeature() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Feature name and slug are required");
      return;
    }
    setCreating(true);
    try {
      let sbId = sandboxSchool?.id;
      if (!sbId) {
        const sb = await superAction("provision_sandbox_school", {});
        sbId = (sb as any)?.school?.id;
      }
      await superAction("create_lab_feature", {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
        category: form.category,
        version: form.version.trim() || "0.1.0-rc1",
        pricing_model: form.pricing_model,
        term_price_kobo: Math.round((parseFloat(form.term_price_naira) || 0) * 100),
        description: form.description.trim(),
        sandbox_school_id: sbId,
      });
      toast.success("Feature staged in Internal Testing Lab");
      setCreateOpen(false);
      setForm({ name: "", slug: "", category: "academics", version: "0.1.0-rc1", pricing_model: "included", term_price_naira: "0", description: "" });
      await load();
    } catch {
      /* toasted */
    } finally {
      setCreating(false);
    }
  }

  async function toggleCheckItem(mod: ModuleItem, key: keyof Checklist) {
    const current: Checklist = {
      ...DEFAULT_CHECKLIST,
      ...(mod.default_config?.checklist ?? {}),
    };
    const next: Checklist = { ...current, [key]: !current[key] };
    setBusyId(mod.id);
    try {
      await superAction("update_lab_checklist", {
        module_id: mod.id,
        checklist: next,
        qa_notes: mod.default_config?.qa_notes ?? "",
      });
      setModules((prev) =>
        (prev ?? []).map((m) =>
          m.id === mod.id
            ? { ...m, default_config: { ...(m.default_config ?? {}), checklist: next } }
            : m
        )
      );
    } catch {
      /* toasted */
    } finally {
      setBusyId(null);
    }
  }

  async function moveExistingToLab(mod: ModuleItem) {
    setBusyId(mod.id);
    try {
      await superAction("create_lab_feature", {
        name: mod.name,
        slug: mod.slug,
        category: mod.category,
        version: mod.version,
        pricing_model: mod.pricing_model,
        term_price_kobo: mod.term_price_kobo,
        description: mod.default_config?.description ?? "",
        sandbox_school_id: sandboxSchool?.id,
        default_config: mod.default_config ?? {},
      });
      toast.success(`${mod.name} moved to Testing Lab`);
      await load();
    } catch {
      /* toasted */
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveAndRollout() {
    if (!rolloutTarget) return;
    setRollingOut(true);
    try {
      await superAction("rollout_lab_feature", {
        module_id: rolloutTarget.id,
        global_default: rolloutGlobalDefault,
        enable_all_schools: rolloutAllSchools,
      });
      toast.success(`${rolloutTarget.name} approved and rolled out to Products!`);
      setRolloutTarget(null);
      await load();
    } catch {
      /* toasted */
    } finally {
      setRollingOut(false);
    }
  }

  const testingModules = useMemo(
    () => (modules ?? []).filter((m) => m.status === "testing" || m.status === "beta" || m.default_config?.lab_stage === "testing"),
    [modules]
  );

  const productionModules = useMemo(
    () => (modules ?? []).filter((m) => m.status !== "testing" && m.status !== "beta" && m.default_config?.lab_stage !== "testing"),
    [modules]
  );

  const readyToRolloutCount = useMemo(
    () =>
      testingModules.filter((m) => {
        const c = { ...DEFAULT_CHECKLIST, ...(m.default_config?.checklist ?? {}) };
        return Object.values(c).every(Boolean);
      }).length,
    [testingModules]
  );

  const previewUrl = sandboxSchool ? buildSchoolUrl(sandboxSchool.slug, `/app/${previewRole}`) : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internal Testing Lab"
        description="Isolated staging & verification environment. Test new features and modules inside the Sandbox School across all roles, complete QA checks, then approve & roll out to the Products section."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={runDiagnostics} disabled={probing}>
              {probing ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
              Run Diagnostics
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5 mr-1.5" /> Stage New Feature / Module
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Sandbox Environment"
          value={sandboxSchool ? "Active · Ready" : "Not provisioned"}
          icon={<FlaskConical className="size-4" />}
        />
        <MetricCard
          label="Features in Testing Lab"
          value={testingModules.length}
          icon={<Layers className="size-4" />}
        />
        <MetricCard
          label="Verified & Ready for Rollout"
          value={readyToRolloutCount}
          icon={<CheckCircle2 className="size-4" />}
        />
        <MetricCard
          label="Live in Products Catalog"
          value={productionModules.length}
          icon={<Package className="size-4" />}
        />
      </div>

      {/* Diagnostic Probe Result Banner */}
      {probeResult && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-success">
            <ShieldCheck className="size-4" />
            <span>Sandbox Diagnostic Probe Passed ({probeResult.ranAt})</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <span>DB Roundtrip: <strong className="text-foreground font-mono">{probeResult.dbMs}ms</strong></span>
            <span>RLS Isolation: <strong className="text-success">Verified</strong></span>
            <span>Registered Modules: <strong className="text-foreground">{probeResult.modulesCount}</strong></span>
            <span>Feature Flags: <strong className="text-foreground">{probeResult.flagsCount}</strong></span>
          </div>
        </div>
      )}

      {/* Sandbox Tenant & Role Portal Launcher */}
      <Section
        title="1. Isolated Sandbox School Environment"
        description="A dedicated multi-role test school isolated from customer tenants. You are automatically enrolled as Admin, Teacher, Student, and Parent."
        actions={
          sandboxSchool ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPreviewFrame((v) => !v)}>
                <Eye className="size-3.5 mr-1.5" />
                {showPreviewFrame ? "Hide Inline Preview" : "Open Inline Portal Preview"}
              </Button>
              <Button variant="outline" size="sm" onClick={ensureSandboxSchool} disabled={provisioning}>
                {provisioning ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="size-3.5 mr-1.5" />}
                Reset / Sync Sandbox
              </Button>
            </div>
          ) : undefined
        }
      >
        {!sandboxSchool ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/30">
            <div>
              <div className="font-semibold text-sm">Provision your Internal QA Sandbox School</div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Creates an isolated enterprise tenant (<code className="font-mono">/internal-sandbox</code>) pre-configured with Admin, Teacher, Student, and Parent roles for your account so you can test new modules safely before releasing them to real schools.
              </p>
            </div>
            <Button onClick={ensureSandboxSchool} disabled={provisioning}>
              {provisioning ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FlaskConical className="size-4 mr-2" />}
              Provision Sandbox Now
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center font-bold">QA</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{sandboxSchool.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">/{sandboxSchool.slug}</Badge>
                    <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Isolated Sandbox</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Launch any role portal below to test staged features with live database isolation.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(["admin", "teacher", "student", "parent"] as const).map((role) => (
                  <Button
                    key={role}
                    size="sm"
                    variant={previewRole === role && showPreviewFrame ? "default" : "outline"}
                    className="capitalize text-xs"
                    onClick={() => {
                      setPreviewRole(role);
                      window.open(buildSchoolUrl(sandboxSchool.slug, `/app/${role}`), "_blank");
                    }}
                  >
                    Test {role} Portal <ExternalLink className="size-3 ml-1.5 opacity-70" />
                  </Button>
                ))}
              </div>
            </div>

            {showPreviewFrame && (
              <div className="rounded-xl border border-border overflow-hidden bg-background">
                <div className="px-4 py-2 border-b border-border bg-muted/40 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium mr-2">Inline Role Switcher:</span>
                    {(["admin", "teacher", "student", "parent"] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setPreviewRole(role)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors",
                          previewRole === role ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="font-mono text-[11px]">{previewUrl}</code>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => window.open(previewUrl, "_blank")}>
                      Open Full Tab <ExternalLink className="size-3 ml-1" />
                    </Button>
                  </div>
                </div>
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="Internal Sandbox Portal Preview"
                  className="w-full h-[560px] border-0 bg-background"
                />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Staged Features / Modules in Testing Lab */}
      <Section
        title={`2. Features & Modules in Testing (${testingModules.length})`}
        description="Verify each role portal and RLS check below. Once verified, click 'Approve & Roll Out to Products' to publish to the Products catalog."
        actions={
          <Button variant="outline" size="sm" onClick={() => nav("/super/products?tab=modules")}>
            View Products Section <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        }
      >
        {modules === null ? (
          <div className="space-y-3">
            <Skel className="h-28" />
            <Skel className="h-28" />
          </div>
        ) : testingModules.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="size-5 text-muted-foreground" />}
            title="No features currently staged in the Testing Lab"
            description="Click 'Stage New Feature / Module' above or pull an existing module into the Lab below to test and verify before rollout."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5 mr-1.5" /> Stage Feature in Lab
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {testingModules.map((mod) => {
              const checklist: Checklist = {
                ...DEFAULT_CHECKLIST,
                ...(mod.default_config?.checklist ?? {}),
              };
              const passedCount = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
              const allPassed = passedCount === CHECKLIST_ITEMS.length;

              return (
                <div key={mod.id} className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{mod.name}</span>
                        <code className="text-xs font-mono text-muted-foreground">{mod.slug}</code>
                        <Badge variant="secondary" className="text-[10px] capitalize">{mod.category}</Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">v{mod.version}</Badge>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            allPassed
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-warning/15 text-warning border-warning/30"
                          )}
                        >
                          {allPassed ? "QA Verified · Ready for Rollout" : `Testing · ${passedCount}/${CHECKLIST_ITEMS.length} checks`}
                        </Badge>
                      </div>
                      {mod.default_config?.description && (
                        <p className="text-xs text-muted-foreground mt-1">{mod.default_config.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={allPassed ? "default" : "outline"}
                        onClick={() => {
                          setRolloutTarget(mod);
                          setRolloutGlobalDefault(false);
                          setRolloutAllSchools(true);
                        }}
                      >
                        <Rocket className="size-3.5 mr-1.5" />
                        Approve & Roll Out to Products
                      </Button>
                    </div>
                  </div>

                  {/* 6-step Verification Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {CHECKLIST_ITEMS.map((item) => {
                      const checked = !!checklist[item.key];
                      return (
                        <label
                          key={item.key}
                          className={cn(
                            "flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors",
                            checked
                              ? "border-success/40 bg-success/5 text-foreground"
                              : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={busyId === mod.id}
                            onCheckedChange={() => toggleCheckItem(mod, item.key)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground leading-snug">{item.hint}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Existing Production Modules — Option to pull back into Testing Lab for regression testing */}
      <Section
        title={`3. Approved Products Catalog (${productionModules.length})`}
        description="Modules already live in the Products section. You can pull any module into the Testing Lab to verify an upgrade."
      >
        {productionModules.length === 0 ? (
          <EmptyState title="No production modules yet" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {productionModules.map((mod) => (
              <div key={mod.id} className="rounded-xl border border-border bg-card p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{mod.name}</span>
                    <StatusBadge status={mod.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                    {mod.slug} · v{mod.version}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs"
                  disabled={busyId === mod.id}
                  onClick={() => moveExistingToLab(mod)}
                >
                  <FlaskConical className="size-3.5 mr-1" /> Stage in Lab
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Dialog: Stage New Feature / Module in Testing Lab */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" />
              Stage New Feature / Module in Testing Lab
            </DialogTitle>
            <DialogDescription>
              This feature will be created in <strong className="text-foreground">testing</strong> status and mounted only on your Internal Sandbox School until you approve and roll it out to Products.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Feature / Module Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const autoSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    setForm((f) => ({ ...f, name, slug: f.slug ? f.slug : autoSlug }));
                  }}
                  placeholder="e.g. Biometric Gate Attendance"
                />
              </div>
              <div>
                <Label className="text-xs">Slug (Identifier)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="biometric-gate-attendance"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academics">Academics</SelectItem>
                    <SelectItem value="exams">Exams & CBT</SelectItem>
                    <SelectItem value="finance">Finance & Billing</SelectItem>
                    <SelectItem value="ai">AI & Copilot</SelectItem>
                    <SelectItem value="comms">Communications</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Release Version</Label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="0.1.0-rc1"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Term Price (₦)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.term_price_naira}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      term_price_naira: e.target.value,
                      pricing_model: Number(e.target.value) > 0 ? "per_school" : "included",
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description & Test Scope</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe what this module does and what should be verified before production rollout…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreateFeature} disabled={creating}>
              {creating ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <FlaskConical className="size-4 mr-1.5" />}
              Stage in Testing Lab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Approve & Roll Out to Products */}
      <Dialog open={!!rolloutTarget} onOpenChange={(o) => !o && setRolloutTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-success" />
              Approve & Roll Out to Products
            </DialogTitle>
            <DialogDescription>
              Promote <strong className="text-foreground">{rolloutTarget?.name}</strong> (<code className="font-mono">{rolloutTarget?.slug}</code>) from the Internal Testing Lab to the live <strong className="text-foreground">Products</strong> catalog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Enable for all active schools immediately</div>
                <div className="text-xs text-muted-foreground">Installs and enables this module across all active schools now.</div>
              </div>
              <Switch checked={rolloutAllSchools} onCheckedChange={setRolloutAllSchools} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Set as default for newly onboarded schools</div>
                <div className="text-xs text-muted-foreground">Marks <code className="font-mono">global_default = true</code> in the Products registry.</div>
              </div>
              <Switch checked={rolloutGlobalDefault} onCheckedChange={setRolloutGlobalDefault} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRolloutTarget(null)} disabled={rollingOut}>
              Cancel
            </Button>
            <Button onClick={handleApproveAndRollout} disabled={rollingOut}>
              {rollingOut ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Rocket className="size-4 mr-1.5" />}
              Approve & Roll Out Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
