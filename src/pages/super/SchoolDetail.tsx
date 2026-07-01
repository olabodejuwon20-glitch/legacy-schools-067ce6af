import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PlanBadge, SchoolStatusBadge } from "@/components/super/SchoolBadges";
import { MetricCard, Section, Skel, EmptyState } from "@/components/super/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import {
  ArrowLeft, ExternalLink, Trash2, Loader2, Settings2, LogOut, ShieldAlert, Copy,
  ArchiveIcon, DatabaseBackup, DownloadCloud, Upload, PauseCircle, PlayCircle,
  Megaphone, Mail, Zap, HardDrive, Package, Puzzle, Sparkles, ShieldCheck,
  Users2, GraduationCap, Building2, Cog, ScrollText, Crown, ChevronRight, Star,
} from "lucide-react";
import { superAction, money, timeAgo, compact } from "@/lib/super";
import { buildSchoolUrl } from "@/lib/tenant";
import { toast } from "sonner";
import ImpersonateDialog from "@/components/super/ImpersonateDialog";
import SchoolHealthGauge from "@/components/super/SchoolHealthGauge";
import CustomerTimeline from "@/components/super/CustomerTimeline";
import QuickActionsBar, { QuickAction } from "@/components/super/QuickActionsBar";
import { enrichSchool, formatBytes, formatCompact, buildTimeline, healthColor } from "@/lib/schoolHealth";
import { cn } from "@/lib/utils";

type School = any;

export default function SuperSchoolDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [impOpen, setImpOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("schools").select("*").eq("id", id!).maybeSingle();
    if (error) toast.error(error.message);
    setSchool(data); setLoading(false);
  }
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="space-y-4"><Skel className="h-24 w-full" /><Skel className="h-64 w-full" /></div>;
  if (!school) return <EmptyState title="School not found" description="It may have been deleted." action={<Button asChild variant="outline"><Link to="/super/schools"><ArrowLeft className="size-4 mr-2" />Back to schools</Link></Button>} />;

  const enr = enrichSchool(school);

  const quickActions: QuickAction[] = [
    { key: "portal",     label: "Open portal",       icon: <ExternalLink className="size-3.5" />, onClick: () => window.open(buildSchoolUrl(school.slug, "/"), "_blank") },
    { key: "imp",        label: "Impersonate admin", icon: <ShieldAlert className="size-3.5" />,  onClick: () => setImpOpen(true), tone: "danger" },
    { key: "backup",     label: "Backup now",        icon: <DatabaseBackup className="size-3.5" />, onClick: () => toast.success("Backup scheduled") },
    { key: "restore",    label: "Restore",           icon: <Upload className="size-3.5" />,       onClick: () => toast.message("Restore wizard coming soon") },
    { key: "export",     label: "Export data",       icon: <DownloadCloud className="size-3.5" />, onClick: () => toast.success("Export queued") },
    { key: "suspend",    label: school.status === "suspended" ? "Reactivate" : "Suspend", icon: school.status === "suspended" ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />, onClick: async () => {
        if (school.status === "suspended") { await superAction("reactivate_school", { school_id: school.id }); toast.success("Reactivated"); load(); }
        else { const reason = window.prompt("Reason:", "") ?? ""; await superAction("suspend_school", { school_id: school.id, reason }); toast.success("Suspended"); load(); }
      }, tone: school.status === "suspended" ? undefined : "warning" },
    { key: "archive",    label: "Archive",           icon: <ArchiveIcon className="size-3.5" />,  onClick: () => toast.message("Archive flow queued for review") },
    { key: "upgrade",    label: "Upgrade plan",      icon: <Crown className="size-3.5" />,        onClick: () => toast.message("Open Finance tab to change plan") },
    { key: "announce",   label: "Send announcement", icon: <Megaphone className="size-3.5" />,    onClick: () => nav("/super/announcements") },
    { key: "contact",    label: "Contact school",    icon: <Mail className="size-3.5" />,         onClick: () => window.open(`mailto:${school.email ?? ""}`, "_blank") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav("/super/schools")}><ArrowLeft className="size-4" /></Button>
        <div className="size-14 rounded-xl border border-border bg-muted overflow-hidden grid place-items-center text-lg font-semibold text-muted-foreground">
          {school.logo_url ? <img src={school.logo_url} alt="" className="size-full object-cover" /> : school.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{school.name}</h1>
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span>/{school.slug}</span>
            <button className="hover:text-foreground" title="Copy slug" onClick={() => { navigator.clipboard.writeText(school.slug); toast.success("Slug copied"); }}><Copy className="size-3" /></button>
            {school.email && <><span>·</span><span>{school.email}</span></>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <PlanBadge plan={school.plan} />
            <SchoolStatusBadge status={school.status} />
            {enr.accountManager && <span className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-card text-muted-foreground"><Star className="size-3 inline-block mr-1 opacity-70" />CSM · {enr.accountManager}</span>}
            {school.plan_expires_at && <span className="text-xs text-muted-foreground">Renews {new Date(school.plan_expires_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <ImpersonateDialog open={impOpen} onOpenChange={setImpOpen} school={{ id: school.id, name: school.name, slug: school.slug }} />
      </div>

      <QuickActionsBar actions={quickActions} />

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/60">
          {[
            ["overview","Overview"], ["users","Users"], ["academic","Academic"],
            ["finance","Finance"], ["comms","Communication"], ["branding","Branding"],
            ["modules","Modules"], ["plugins","Plugins"], ["ai","AI Usage"],
            ["storage","Storage"], ["backups","Backups"], ["audit","Audit Logs"],
            ["security","Security"], ["settings","Settings"],
          ].map(([v,l]) => (<TabsTrigger key={v} value={v}>{l}</TabsTrigger>))}
        </TabsList>

        <TabsContent value="overview"  className="mt-6"><OverviewTab school={school} enr={enr} /></TabsContent>
        <TabsContent value="users"     className="mt-6"><MembersTab schoolId={school.id} /></TabsContent>
        <TabsContent value="academic"  className="mt-6"><AcademicTab schoolId={school.id} enr={enr} /></TabsContent>
        <TabsContent value="finance"   className="mt-6"><BillingTab school={school} onChange={load} /></TabsContent>
        <TabsContent value="comms"     className="mt-6"><CommsTab enr={enr} /></TabsContent>
        <TabsContent value="branding"  className="mt-6"><BrandingTab school={school} onSaved={load} /></TabsContent>
        <TabsContent value="modules"   className="mt-6"><ModulesTab schoolId={school.id} /></TabsContent>
        <TabsContent value="plugins"   className="mt-6"><PluginsTab /></TabsContent>
        <TabsContent value="ai"        className="mt-6"><AiUsageTab enr={enr} /></TabsContent>
        <TabsContent value="storage"   className="mt-6"><StorageTab enr={enr} /></TabsContent>
        <TabsContent value="backups"   className="mt-6"><BackupsTab enr={enr} /></TabsContent>
        <TabsContent value="audit"     className="mt-6"><AuditTab schoolId={school.id} /></TabsContent>
        <TabsContent value="security"  className="mt-6"><SecurityTab enr={enr} /></TabsContent>
        <TabsContent value="settings"  className="mt-6"><SettingsTab school={school} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────── Overview ─────────────── */
function OverviewTab({ school, enr }: { school: any; enr: ReturnType<typeof enrichSchool> }) {
  const [m, setM] = useState({ members: 0, exams: 0, results: 0 });
  useEffect(() => { (async () => {
    const [mem, ex, re] = await Promise.all([
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("exams").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("results").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    ]);
    setM({ members: mem.count ?? 0, exams: ex.count ?? 0, results: re.count ?? 0 });
  })(); }, [school.id]);

  const timeline = useMemo(() => buildTimeline(school), [school.id]);
  const c = healthColor(enr.healthScore);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* left column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total members" value={compact(m.members || enr.students + enr.teachers + enr.parents)} icon={<Users2 className="size-4" />} />
          <MetricCard label="Active today" value={compact(enr.activeToday)} icon={<Sparkles className="size-4" />} />
          <MetricCard label="Exams" value={compact(m.exams)} icon={<GraduationCap className="size-4" />} />
          <MetricCard label="Storage" value={formatBytes(enr.storageBytes)} icon={<HardDrive className="size-4" />} />
        </div>

        <Section title="School profile" description="Snapshot of tenant identity and account context.">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Legal name" value={school.name} />
            <Field label="Slug" value={`/${school.slug}`} mono />
            <Field label="Email" value={school.email ?? "—"} />
            <Field label="Phone" value={school.phone ?? "—"} />
            <Field label="Address" value={school.address ?? "—"} />
            <Field label="Motto" value={school.motto ?? "—"} />
            <Field label="Plan" value={<span className="capitalize">{school.plan}</span>} />
            <Field label="Status" value={<span className="capitalize">{school.status?.replace("_"," ")}</span>} />
            <Field label="Session" value="2025 / 2026 · Term 2" />
            <Field label="Account manager" value={enr.accountManager ?? "Unassigned"} />
            <Field label="Last backup" value={timeAgo(enr.lastBackupAt)} />
            <Field label="Renews" value={enr.renewalAt ? new Date(enr.renewalAt).toLocaleDateString() : "—"} />
          </div>
        </Section>

        <Section title="Customer timeline" description="Everything that happened on this account, most recent first.">
          <CustomerTimeline events={timeline} />
        </Section>
      </div>

      {/* right column */}
      <div className="space-y-6">
        <Section title="Health score" description={`Based on adoption, uptime, security, and billing.`}>
          <div className="flex flex-col items-center gap-4">
            <SchoolHealthGauge score={enr.healthScore} trend={enr.healthTrend} />
            <div className="w-full space-y-2">
              <HealthRow label="Login activity" score={82} />
              <HealthRow label="Backup success" score={95} />
              <HealthRow label="Feature adoption" score={enr.healthScore - 5} />
              <HealthRow label="AI usage" score={Math.min(100, Math.round(enr.aiTokens / 2000))} />
              <HealthRow label="Security posture" score={88} />
            </div>
            <div className={cn("w-full rounded-md border px-3 py-2 text-xs", c.soft)}>
              {enr.healthScore >= 75 ? "Everything looks good. Keep monitoring renewal date." :
               enr.healthScore >= 55 ? "Engagement dipping — schedule a check-in with the school." :
               "Immediate attention needed. Reach out to the account manager."}
            </div>
          </div>
        </Section>

        <Section title="Quick facts">
          <ul className="text-sm space-y-2">
            <FactRow icon={<Users2 className="size-4" />} label="Students" value={compact(enr.students)} />
            <FactRow icon={<GraduationCap className="size-4" />} label="Teachers" value={compact(enr.teachers)} />
            <FactRow icon={<Building2 className="size-4" />} label="Parents" value={compact(enr.parents)} />
            <FactRow icon={<Zap className="size-4" />} label="AI tokens (mo)" value={compact(enr.aiTokens)} />
            <FactRow icon={<HardDrive className="size-4" />} label="Storage used" value={formatBytes(enr.storageBytes)} />
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("mt-1 truncate", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}
function HealthRow({ label, score }: { label: string; score: number }) {
  const c = healthColor(score);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full", c.bg)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>
      <span className={cn("w-8 text-right tabular-nums font-semibold", c.text)}>{Math.round(score)}</span>
    </div>
  );
}
function FactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </li>
  );
}

/* ─────────────── Branding (was Profile) ─────────────── */
function BrandingTab({ school, onSaved }: { school: any; onSaved: () => void }) {
  const [f, setF] = useState({
    name: school.name ?? "", slug: school.slug ?? "", email: school.email ?? "", phone: school.phone ?? "",
    address: school.address ?? "", motto: school.motto ?? "", logo_url: school.logo_url ?? "",
    platform_notice: school.platform_notice ?? "",
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await superAction("update_school", { school_id: school.id, fields: f });
      toast.success("Branding saved"); onSaved();
    } catch {} finally { setBusy(false); }
  }
  return (
    <Section title="School branding & profile" description="Edit tenant identity, contact info, and platform notice banner.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[["name","Name"],["slug","Slug"],["email","Email"],["phone","Phone"],["motto","Motto"],["logo_url","Logo URL"]].map(([k,l]) => (
          <div key={k}><Label>{l}</Label><Input value={(f as any)[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <div className="md:col-span-2"><Label>Address</Label><Input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Platform notice <span className="text-muted-foreground">(banner shown to this school)</span></Label><Textarea rows={3} value={f.platform_notice} onChange={e => setF({ ...f, platform_notice: e.target.value })} /></div>
      </div>
      <div className="mt-5 flex justify-end"><Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Save changes</Button></div>
    </Section>
  );
}

/* ─────────────── Finance (Billing) ─────────────── */
function BillingTab({ school, onChange }: { school: any; onChange: () => void }) {
  const [subs, setSubs] = useState<any[]>([]);
  const [inv, setInv] = useState<any[]>([]);
  const [openPlan, setOpenPlan] = useState(false);
  const [openSusp, setOpenSusp] = useState(false);
  const [plan, setPlan] = useState(school.plan);
  const [expires, setExpires] = useState(school.plan_expires_at?.slice(0,10) ?? "");
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [s, i] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("invoices").select("*").eq("school_id", school.id).order("issued_at", { ascending: false }).limit(10),
    ]);
    setSubs(s.data ?? []); setInv(i.data ?? []);
  }
  useEffect(() => { reload(); }, [school.id]);

  async function changePlan() {
    setBusy(true);
    try {
      await superAction("set_plan", {
        school_id: school.id, plan,
        expires_at: expires ? new Date(expires).toISOString() : null,
        monthly_amount_cents: Math.round(parseFloat(amount || "0") * 100),
      });
      toast.success("Plan updated"); setOpenPlan(false); onChange(); reload();
    } catch {} finally { setBusy(false); }
  }
  async function suspend() {
    setBusy(true);
    try { await superAction("suspend_school", { school_id: school.id, reason }); toast.success("Suspended"); setOpenSusp(false); onChange(); }
    catch {} finally { setBusy(false); }
  }
  async function reactivate() {
    setBusy(true);
    try { await superAction("reactivate_school", { school_id: school.id }); toast.success("Reactivated"); onChange(); }
    catch {} finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Section title="Current plan" actions={
        <div className="flex gap-2">
          <Dialog open={openPlan} onOpenChange={setOpenPlan}>
            <DialogTrigger asChild><Button size="sm">Change plan</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Change plan</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Plan</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="basic">Starter</SelectItem>
                      <SelectItem value="standard">Growth</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Expires (optional)</Label><Input type="date" value={expires} onChange={e => setExpires(e.target.value)} /></div>
                <div><Label>Per-term amount (₦)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /><p className="text-[11px] text-muted-foreground mt-1">Billed in NGN every term (3× per year).</p></div>
              </div>
              <DialogFooter><Button onClick={changePlan} disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Apply</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          {school.status === "suspended" ? (
            <Button size="sm" variant="outline" onClick={reactivate} disabled={busy}>Reactivate</Button>
          ) : (
            <Dialog open={openSusp} onOpenChange={setOpenSusp}>
              <DialogTrigger asChild><Button size="sm" variant="destructive">Suspend</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Suspend school</DialogTitle></DialogHeader>
                <Label>Reason (visible in audit log)</Label>
                <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
                <DialogFooter><Button variant="destructive" onClick={suspend} disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Confirm suspension</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      }>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Plan" value={<span className="capitalize">{school.plan}</span>} />
          <MetricCard label="Status" value={<span className="capitalize">{school.status?.replace("_"," ")}</span>} />
          <MetricCard label="Started" value={school.plan_started_at ? new Date(school.plan_started_at).toLocaleDateString() : "—"} />
          <MetricCard label="Expires" value={school.plan_expires_at ? new Date(school.plan_expires_at).toLocaleDateString() : "—"} />
        </div>
        {school.suspended_reason && (
          <div className="mt-4 text-sm rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2">Suspension reason: {school.suspended_reason}</div>
        )}
      </Section>

      <Section title="Recent subscriptions">
        {subs.length === 0 ? <EmptyState title="No subscriptions yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Monthly</TableHead><TableHead>Period end</TableHead><TableHead>Started</TableHead></TableRow></TableHeader>
            <TableBody>{subs.map(s => (
              <TableRow key={s.id}><TableCell className="capitalize">{s.plan}</TableCell><TableCell className="capitalize">{s.status}</TableCell><TableCell>{money(s.monthly_amount_cents)}</TableCell><TableCell>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</TableCell><TableCell>{timeAgo(s.started_at)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Section>

      <Section title="Recent invoices">
        {inv.length === 0 ? <EmptyState title="No invoices yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Issued</TableHead><TableHead>Paid</TableHead></TableRow></TableHeader>
            <TableBody>{inv.map(i => (
              <TableRow key={i.id}><TableCell className="font-mono text-xs">{i.number}</TableCell><TableCell>{money(i.amount_cents)}</TableCell><TableCell className="capitalize">{i.status}</TableCell><TableCell>{timeAgo(i.issued_at)}</TableCell><TableCell>{i.paid_at ? timeAgo(i.paid_at) : "—"}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

/* ─────────────── Modules ─────────────── */
function ModulesTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [configText, setConfigText] = useState("");

  async function load() {
    const [mods, sm] = await Promise.all([
      supabase.from("modules").select("*").order("category").order("name"),
      supabase.from("school_modules").select("*").eq("school_id", schoolId),
    ]);
    const map = new Map((sm.data ?? []).map(r => [r.module_id, r]));
    setRows((mods.data ?? []).map(m => ({ ...m, sm: map.get(m.id) ?? null })));
  }
  useEffect(() => { load(); }, [schoolId]);

  async function toggle(m: any, enabled: boolean) {
    if (!m.sm) await superAction("assign_module", { school_id: schoolId, module_id: m.id, config: m.default_config });
    await superAction("toggle_module", { school_id: schoolId, module_id: m.id, enabled });
    toast.success(enabled ? "Module enabled" : "Module disabled"); load();
  }
  async function setBeta(m: any, beta: boolean) {
    await superAction("assign_module", { school_id: schoolId, module_id: m.id, beta, config: m.sm?.config ?? m.default_config });
    load();
  }
  async function saveConfig() {
    try {
      const cfg = JSON.parse(configText || "{}");
      await superAction("update_module_config", { school_id: schoolId, module_id: editing.id, config: cfg });
      toast.success("Configuration saved"); setEditing(null); load();
    } catch { toast.error("Invalid JSON"); }
  }

  if (!rows) return <Skel className="h-64" />;
  return (
    <Section title="Modules & features" description="Toggle which features this school sees. Per-tenant configuration is stored as JSON.">
      <Table>
        <TableHeader><TableRow><TableHead>Module</TableHead><TableHead>Category</TableHead><TableHead>Pricing</TableHead><TableHead className="w-[120px]">Enabled</TableHead><TableHead className="w-[120px]">Beta</TableHead><TableHead className="w-[120px]" /></TableRow></TableHeader>
        <TableBody>
          {rows.map(m => (
            <TableRow key={m.id}>
              <TableCell><div className="font-medium text-sm">{m.name}</div><div className="text-xs text-muted-foreground">{m.description}</div></TableCell>
              <TableCell className="capitalize text-sm text-muted-foreground">{m.category}</TableCell>
              <TableCell className="text-sm">{m.pricing_model === "included" ? "Included" : money(m.monthly_price_cents) + "/mo"}</TableCell>
              <TableCell><Switch checked={!!m.sm?.enabled} onCheckedChange={(v) => toggle(m, v)} /></TableCell>
              <TableCell><Switch checked={!!m.sm?.beta} onCheckedChange={(v) => setBeta(m, v)} disabled={!m.sm?.enabled} /></TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(m); setConfigText(JSON.stringify(m.sm?.config ?? m.default_config ?? {}, null, 2)); }}>
                  <Settings2 className="size-4 mr-1" />Configure
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Drawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Configure: {editing?.name}</DrawerTitle></DrawerHeader>
          <div className="px-6 pb-4">
            <Label>Configuration (JSON)</Label>
            <Textarea rows={14} value={configText} onChange={e => setConfigText(e.target.value)} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-2">Schema-driven UI lands in the next phase. For now, edit JSON directly.</p>
          </div>
          <DrawerFooter><Button onClick={saveConfig}>Save configuration</Button></DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Section>
  );
}

/* ─────────────── Members / Users ─────────────── */
function MembersTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  async function load() {
    const { data } = await supabase
      .from("memberships")
      .select("id,user_id,role,status,created_at,profiles:user_id(full_name,email)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [schoolId]);

  const filtered = (rows ?? []).filter((r: any) => {
    if (role !== "all" && r.role !== role) return false;
    if (q) {
      const s = (r.profiles?.full_name ?? "") + " " + (r.profiles?.email ?? "");
      if (!s.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  async function logout(user_id: string) {
    if (!confirm("Force this user out of all sessions?")) return;
    await superAction("force_logout_user", { user_id, school_id: schoolId });
    toast.success("User signed out globally");
  }

  if (!rows) return <Skel className="h-64" />;
  return (
    <Section title="Members" description={`${rows.length} members on this account`} actions={
      <div className="flex gap-2">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="h-8 w-48" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="parent">Parent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    }>
      {filtered.length === 0 ? <EmptyState title="No members match" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="w-[100px]" /></TableRow></TableHeader>
          <TableBody>{filtered.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">{r.profiles?.full_name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.profiles?.email ?? "—"}</TableCell>
              <TableCell className="capitalize text-sm">{r.role}</TableCell>
              <TableCell className="capitalize text-sm">{r.status}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={() => logout(r.user_id)}><LogOut className="size-4 mr-1" />Sign out</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </Section>
  );
}

/* ─────────────── Academic (mock-driven) ─────────────── */
function AcademicTab({ schoolId, enr }: { schoolId: string; enr: ReturnType<typeof enrichSchool> }) {
  const [rows, setRows] = useState<{ classes: number; subjects: number; departments: number } | null>(null);
  useEffect(() => { (async () => {
    const [c, s, d] = await Promise.all([
      supabase.from("academic_classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("academic_subjects").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("academic_departments").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    ]);
    setRows({ classes: c.count ?? 0, subjects: s.count ?? 0, departments: d.count ?? 0 });
  })(); }, [schoolId]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Current session" value="2025 / 2026" />
        <MetricCard label="Term" value="Term 2" />
        <MetricCard label="Classes" value={compact(rows?.classes ?? 0)} />
        <MetricCard label="Subjects" value={compact(rows?.subjects ?? 0)} />
      </div>
      <Section title="Academic snapshot" description="Structure and progression at a glance.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Field label="Departments" value={compact(rows?.departments ?? 0)} />
          <Field label="Enrolled students" value={compact(enr.students)} />
          <Field label="Teachers" value={compact(enr.teachers)} />
          <Field label="Assessment structure" value="School exams · CA · Assignments" />
          <Field label="Result release" value="Admin-scheduled" />
          <Field label="Grading scale" value="WAEC · A1–F9" />
        </div>
      </Section>
    </div>
  );
}

/* ─────────────── Comms (mock) ─────────────── */
function CommsTab({ enr }: { enr: ReturnType<typeof enrichSchool> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Announcements (30d)" value={compact(24)} />
        <MetricCard label="Broadcasts sent" value={compact(112)} />
        <MetricCard label="Delivery rate" value="98.4%" />
        <MetricCard label="Open rate" value="61.2%" />
      </div>
      <Section title="Recent broadcasts">
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Channel</TableHead><TableHead>Recipients</TableHead><TableHead>Delivered</TableHead><TableHead>Sent</TableHead></TableRow></TableHeader>
          <TableBody>
            {[
              { t: "Mid-term break notice", c: "Email + Push", r: enr.parents + enr.students, d: "98%", s: "2h ago" },
              { t: "PTA meeting reminder", c: "SMS", r: enr.parents, d: "94%", s: "1d ago" },
              { t: "Exam timetable release", c: "In-app", r: enr.students, d: "100%", s: "3d ago" },
            ].map((r, i) => (
              <TableRow key={i}><TableCell className="text-sm">{r.t}</TableCell><TableCell className="text-sm text-muted-foreground">{r.c}</TableCell><TableCell className="tabular-nums">{compact(r.r)}</TableCell><TableCell>{r.d}</TableCell><TableCell className="text-xs text-muted-foreground">{r.s}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

/* ─────────────── Plugins (mock) ─────────────── */
function PluginsTab() {
  const plugins = [
    { name: "Advanced Bus Tracking", desc: "Live GPS, parent ETAs, driver console.", installed: true, tag: "Transport" },
    { name: "AI Report Comments", desc: "Automated, teacher-approved comments.", installed: true, tag: "AI" },
    { name: "SMS Gateway", desc: "Bulk SMS via local telco integrations.", installed: false, tag: "Comms" },
    { name: "Bio & QR Cards", desc: "Digital ID and public bio pages.", installed: true, tag: "Identity" },
    { name: "Cafeteria & Meals", desc: "Meal plans, prepaid balance, allergies.", installed: false, tag: "Operations" },
    { name: "Alumni Portal", desc: "Graduated student network & giving.", installed: false, tag: "Community" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {plugins.map(p => (
        <div key={p.name} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="size-9 rounded-lg bg-muted grid place-items-center"><Puzzle className="size-4 text-muted-foreground" /></div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">{p.tag}</span>
          </div>
          <div className="mt-3 font-medium text-sm">{p.name}</div>
          <div className="text-xs text-muted-foreground mt-1 min-h-[32px]">{p.desc}</div>
          <div className="mt-3">
            {p.installed
              ? <Button size="sm" variant="outline" className="w-full">Manage</Button>
              : <Button size="sm" className="w-full">Install</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── AI Usage (mock) ─────────────── */
function AiUsageTab({ enr }: { enr: ReturnType<typeof enrichSchool> }) {
  const models = [
    { name: "gemini-2.5-flash", share: 55 },
    { name: "gpt-5-mini", share: 25 },
    { name: "gemini-2.5-pro", share: 15 },
    { name: "gpt-5", share: 5 },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Tokens this month" value={formatCompact(enr.aiTokens)} icon={<Sparkles className="size-4" />} />
        <MetricCard label="Monthly cap" value="500K" />
        <MetricCard label="Cost estimate" value={money(Math.round(enr.aiTokens * 0.002) * 100)} />
        <MetricCard label="Cache hit rate" value="42%" />
      </div>
      <Section title="Usage by model">
        <div className="space-y-3">
          {models.map(m => (
            <div key={m.name} className="flex items-center gap-3 text-sm">
              <span className="w-40 font-mono text-xs">{m.name}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${m.share}%` }} /></div>
              <span className="w-10 text-right tabular-nums text-muted-foreground">{m.share}%</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ─────────────── Storage (mock) ─────────────── */
function StorageTab({ enr }: { enr: ReturnType<typeof enrichSchool> }) {
  const pct = Math.min(100, Math.round((enr.storageBytes / (10 * 1_073_741_824)) * 100));
  const c = healthColor(100 - pct);
  return (
    <div className="space-y-6">
      <Section title="Storage utilization" description="Objects, uploads, and generated artifacts.">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm font-medium">{formatBytes(enr.storageBytes)} <span className="text-muted-foreground text-xs">/ 10 GB</span></span>
              <span className={cn("text-xs font-semibold", c.text)}>{pct}% used</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={cn("h-full", c.bg)} style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </Section>
      <Section title="Buckets">
        <Table>
          <TableHeader><TableRow><TableHead>Bucket</TableHead><TableHead>Items</TableHead><TableHead>Size</TableHead></TableRow></TableHeader>
          <TableBody>
            {[["library-files", 1230, enr.storageBytes * 0.55],
              ["result-slips", 2140, enr.storageBytes * 0.22],
              ["profile-photos", 890, enr.storageBytes * 0.15],
              ["question-uploads", 320, enr.storageBytes * 0.08]].map(([n,c,b]: any) => (
              <TableRow key={n}><TableCell className="font-mono text-xs">{n}</TableCell><TableCell>{compact(c)}</TableCell><TableCell>{formatBytes(b)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

/* ─────────────── Backups (mock) ─────────────── */
function BackupsTab({ enr }: { enr: ReturnType<typeof enrichSchool> }) {
  const days = 7;
  const items = Array.from({ length: days }).map((_, i) => ({
    date: new Date(Date.now() - i * 86400_000).toISOString(),
    size: formatBytes(Math.round(enr.storageBytes * (0.9 + Math.random() * 0.2))),
    status: i === 0 ? "in_progress" : i === 4 ? "failed" : "success",
  }));
  return (
    <div className="space-y-6">
      <Section title="Backups" description="Nightly encrypted snapshots. Retention 30 days." actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.success("Restore queued")}><Upload className="size-3.5 mr-1" />Restore</Button>
          <Button size="sm" onClick={() => toast.success("Backup scheduled")}><DatabaseBackup className="size-3.5 mr-1" />Backup now</Button>
        </div>
      }>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead className="w-[100px]" /></TableRow></TableHeader>
          <TableBody>{items.map((b, i) => (
            <TableRow key={i}>
              <TableCell>{new Date(b.date).toLocaleString()}</TableCell>
              <TableCell>{b.size}</TableCell>
              <TableCell>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-md border capitalize",
                  b.status === "success" ? "bg-success/10 text-success border-success/20" :
                  b.status === "failed" ? "bg-destructive/10 text-destructive border-destructive/20" :
                  "bg-warning/10 text-warning border-warning/20")}>{b.status.replace("_"," ")}</span>
              </TableCell>
              <TableCell><Button size="sm" variant="ghost" disabled={b.status !== "success"}><DownloadCloud className="size-3.5 mr-1" />Download</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </Section>
    </div>
  );
}

/* ─────────────── Audit Logs ─────────────── */
function AuditTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("platform_audit").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100);
    setRows(data ?? []);
  })(); }, [schoolId]);
  if (!rows) return <Skel className="h-64" />;
  return (
    <Section title="Audit trail" description="Every super-admin action performed on this school.">
      {rows.length === 0 ? <EmptyState title="No actions yet" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Actor</TableHead><TableHead>Details</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-medium text-sm">{a.action}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{(a.actor ?? "").slice(0,10)}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-md">{a.details ? JSON.stringify(a.details) : "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </Section>
  );
}

/* ─────────────── Security (mock) ─────────────── */
function SecurityTab({ enr }: { enr: ReturnType<typeof enrichSchool> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="2FA adoption" value="62%" icon={<ShieldCheck className="size-4" />} />
        <MetricCard label="Active sessions" value={compact(enr.activeToday)} />
        <MetricCard label="Failed logins (24h)" value={compact(14)} />
        <MetricCard label="Security events (30d)" value={compact(3)} />
      </div>
      <Section title="Recent security events">
        <Table>
          <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Severity</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
          <TableBody>
            {[
              { t: "Unusual login location", s: "medium", w: "3h ago" },
              { t: "Password reset spike", s: "low", w: "1d ago" },
              { t: "Impersonation session opened", s: "info", w: "5d ago" },
            ].map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.t}</TableCell>
                <TableCell><span className="text-[11px] px-2 py-0.5 rounded-md border bg-muted text-muted-foreground capitalize">{r.s}</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.w}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

/* ─────────────── Settings (danger + prefs) ─────────────── */
function SettingsTab({ school }: { school: any }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function destroy() {
    setBusy(true);
    try {
      await superAction("delete_school", { school_id: school.id, confirm: "DELETE" });
      toast.success("School deleted"); nav("/super/schools");
    } catch {} finally { setBusy(false); }
  }
  return (
    <div className="space-y-6">
      <Section title="Tenant preferences" description="Baseline behavior overrides. Schema-driven UI ships in a later phase.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Field label="Slug" value={`/${school.slug}`} mono />
          <Field label="Created" value={new Date(school.created_at).toLocaleString()} />
          <Field label="Pilot" value={school.pilot_status ?? "—"} />
          <Field label="Data region" value="EU (default)" />
        </div>
      </Section>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-md bg-destructive/10 text-destructive grid place-items-center"><Trash2 className="size-4" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Delete this school</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">This permanently removes the school record. Memberships, exams, and other tenant data with foreign references may be orphaned. Type <span className="font-mono font-semibold">DELETE</span> to confirm.</p>
            <div className="mt-3 flex gap-2 max-w-sm">
              <Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type DELETE" />
              <Button variant="destructive" disabled={confirm !== "DELETE" || busy} onClick={destroy}>
                {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Delete school
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
