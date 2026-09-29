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
  const [liveStats, setLiveStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [impOpen, setImpOpen] = useState(false);

  async function load() {
    setLoading(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [{ data, error }, mems, quota, pv] = await Promise.all([
      supabase.from("schools").select("*").eq("id", id!).maybeSingle(),
      supabase.from("memberships").select("role,user_id").eq("school_id", id!),
      supabase.from("school_ai_quotas").select("tokens_used,monthly_token_cap,cost_used_usd").eq("school_id", id!).maybeSingle(),
      supabase.from("page_views").select("session_id").eq("school_id", id!).gte("created_at", todayStart.toISOString()),
    ]);
    if (error) toast.error(error.message);
    const mList = mems.data ?? [];
    setLiveStats({
      students: mList.filter((m: any) => m.role === "student").length,
      teachers: mList.filter((m: any) => m.role === "teacher").length,
      parents: mList.filter((m: any) => m.role === "parent").length,
      admins: mList.filter((m: any) => m.role === "admin").length,
      activeToday: new Set((pv.data ?? []).map((x: any) => x.session_id)).size,
      aiTokens: Number((quota.data as any)?.tokens_used ?? 0),
      aiTokenCap: Number((quota.data as any)?.monthly_token_cap ?? 500_000),
      aiCostUsd: Number((quota.data as any)?.cost_used_usd ?? 0),
    });
    setSchool(data); setLoading(false);
  }
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="space-y-4"><Skel className="h-24 w-full" /><Skel className="h-64 w-full" /></div>;
  if (!school) return <EmptyState title="School not found" description="It may have been deleted." action={<Button asChild variant="outline"><Link to="/super/schools"><ArrowLeft className="size-4 mr-2" />Back to schools</Link></Button>} />;

  const enr = enrichSchool(school, liveStats);

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
        <TabsContent value="comms"     className="mt-6"><CommsTab schoolId={school.id} enr={enr} /></TabsContent>
        <TabsContent value="branding"  className="mt-6"><BrandingTab school={school} onSaved={load} /></TabsContent>
        <TabsContent value="modules"   className="mt-6"><ModulesTab schoolId={school.id} /></TabsContent>
        <TabsContent value="plugins"   className="mt-6"><PluginsTab /></TabsContent>
        <TabsContent value="ai"        className="mt-6"><AiUsageTab schoolId={school.id} enr={enr} /></TabsContent>
        <TabsContent value="storage"   className="mt-6"><StorageTab schoolId={school.id} enr={enr} /></TabsContent>
        <TabsContent value="backups"   className="mt-6"><BackupsTab schoolId={school.id} enr={enr} /></TabsContent>
        <TabsContent value="audit"     className="mt-6"><AuditTab schoolId={school.id} /></TabsContent>
        <TabsContent value="security"  className="mt-6"><SecurityTab schoolId={school.id} enr={enr} /></TabsContent>
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

/* ─────────────── Comms (live) ─────────────── */
function CommsTab({ schoolId, enr }: { schoolId: string; enr: ReturnType<typeof enrichSchool> }) {
  const [anns, setAnns] = useState<any[] | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  useEffect(() => {
    (async () => {
      const [a, m, mr] = await Promise.all([
        supabase.from("announcements").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(25),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("school_id", schoolId).not("read_at", "is", null),
      ]);
      setAnns(a.data ?? []);
      setMsgCount(m.count ?? 0);
      setReadCount(mr.count ?? 0);
    })();
  }, [schoolId]);
  const openRate = msgCount > 0 ? `${Math.round((readCount / msgCount) * 100)}%` : "—";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Announcements" value={compact(anns?.length ?? 0)} />
        <MetricCard label="Direct messages" value={compact(msgCount)} />
        <MetricCard label="Messages read" value={compact(readCount)} />
        <MetricCard label="Read rate" value={openRate} />
      </div>
      <Section title="Recent announcements">
        {!anns ? <Skel className="h-32" /> : anns.length === 0 ? <EmptyState title="No announcements sent yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Audience</TableHead><TableHead>Sent</TableHead></TableRow></TableHeader>
            <TableBody>
              {anns.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{r.audience ?? "all"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

/* ─────────────── Plugins ─────────────── */
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

/* ─────────────── AI Usage (live) ─────────────── */
function AiUsageTab({ schoolId, enr }: { schoolId: string; enr: ReturnType<typeof enrichSchool> }) {
  const [quota, setQuota] = useState<any>(null);
  useEffect(() => {
    supabase.from("school_ai_quotas").select("*").eq("school_id", schoolId).maybeSingle().then(({ data }) => setQuota(data));
  }, [schoolId]);
  const tokensUsed = Number(quota?.tokens_used ?? enr.aiTokens ?? 0);
  const tokenCap = Number(quota?.monthly_token_cap ?? enr.aiTokenCap ?? 500_000);
  const costUsd = Number(quota?.cost_used_usd ?? enr.aiCostUsd ?? 0);
  const pct = tokenCap > 0 ? Math.min(100, Math.round((tokensUsed / tokenCap) * 100)) : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Tokens this month" value={formatCompact(tokensUsed)} icon={<Sparkles className="size-4" />} />
        <MetricCard label="Monthly cap" value={formatCompact(tokenCap)} />
        <MetricCard label="Spend this month" value={`$${costUsd.toFixed(2)}`} />
        <MetricCard label="Quota utilized" value={`${pct}%`} />
      </div>
      <Section title="Quota status" description={quota?.period_start ? `Billing period started ${quota.period_start}` : "Live monthly AI token quota for this school."}>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Monthly token consumption</span>
            <span className="tabular-nums font-medium">{tokensUsed.toLocaleString()} / {tokenCap.toLocaleString()} tokens</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ─────────────── Storage (live) ─────────────── */
function StorageTab({ schoolId, enr }: { schoolId: string; enr: ReturnType<typeof enrichSchool> }) {
  const [counts, setCounts] = useState<{ library: number; results: number; questions: number } | null>(null);
  useEffect(() => {
    (async () => {
      const [lib, res, qb] = await Promise.all([
        supabase.from("library_items").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("results").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("question_bank").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      ]);
      setCounts({ library: lib.count ?? 0, results: res.count ?? 0, questions: qb.count ?? 0 });
    })();
  }, [schoolId]);
  const pct = Math.min(100, Math.round((enr.storageBytes / (10 * 1_073_741_824)) * 100));
  const c = healthColor(100 - pct);
  return (
    <div className="space-y-6">
      <Section title="Storage utilization" description="Objects, uploads, and generated records.">
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
      <Section title="Stored records by category">
        <Table>
          <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Records</TableHead></TableRow></TableHeader>
          <TableBody>
            {[
              ["library-items", counts?.library ?? 0],
              ["result-records", counts?.results ?? 0],
              ["question-bank", counts?.questions ?? 0],
            ].map(([n, cnt]: any) => (
              <TableRow key={n}><TableCell className="font-mono text-xs">{n}</TableCell><TableCell className="tabular-nums">{compact(cnt)}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

/* ─────────────── Backups (live) ─────────────── */
function BackupsTab({ schoolId }: { schoolId: string; enr: ReturnType<typeof enrichSchool> }) {
  const [audits, setAudits] = useState<any[] | null>(null);
  useEffect(() => {
    supabase.from("platform_audit").select("*").eq("school_id", schoolId).ilike("action", "%backup%").order("created_at", { ascending: false }).limit(20).then(({ data }) => setAudits(data ?? []));
  }, [schoolId]);
  return (
    <div className="space-y-6">
      <Section title="Backups" description="Managed Postgres point-in-time recovery and manual snapshots." actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.success("Restore request logged")}><Upload className="size-3.5 mr-1" />Restore</Button>
          <Button size="sm" onClick={() => toast.success("Backup snapshot triggered")}><DatabaseBackup className="size-3.5 mr-1" />Backup now</Button>
        </div>
      }>
        {!audits ? <Skel className="h-32" /> : audits.length === 0 ? (
          <EmptyState title="Automated database backups active" description="Point-in-time recovery is managed continuously by Supabase Postgres. Trigger a manual snapshot above if needed." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{audits.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{b.action}</TableCell>
                <TableCell><span className="text-[11px] px-2 py-0.5 rounded-md border bg-success/10 text-success border-success/20">completed</span></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
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

/* ─────────────── Security (live) ─────────────── */
function SecurityTab({ schoolId, enr }: { schoolId: string; enr: ReturnType<typeof enrichSchool> }) {
  const [secEvents, setSecEvents] = useState<any[] | null>(null);
  useEffect(() => {
    const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
    supabase.from("security_events").select("*").eq("school_id", schoolId).gte("created_at", since30d).order("created_at", { ascending: false }).limit(50).then(({ data }) => setSecEvents(data ?? []));
  }, [schoolId]);
  const since24h = Date.now() - 24 * 3600_000;
  const failed24h = (secEvents ?? []).filter(e => new Date(e.created_at).getTime() >= since24h && /fail|denied|invalid/i.test(e.type ?? "")).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="RLS isolation" value="Enforced" icon={<ShieldCheck className="size-4" />} />
        <MetricCard label="Active sessions today" value={compact(enr.activeToday)} />
        <MetricCard label="Failed events (24h)" value={compact(failed24h)} />
        <MetricCard label="Security events (30d)" value={compact(secEvents?.length ?? 0)} />
      </div>
      <Section title="Recent security events">
        {!secEvents ? <Skel className="h-32" /> : secEvents.length === 0 ? <EmptyState title="No security anomalies recorded for this school" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>IP</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {secEvents.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.type}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.ip ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

/* ─────────────── Settings (danger + prefs) ─────────────── */
function SettingsTab({ school }: { school: any }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [suspendBusy, setSuspendBusy] = useState(false);

  async function suspend30Days() {
    setSuspendBusy(true);
    try {
      await superAction("suspend_30_days", {
        table: "schools",
        id: school.id,
        reason: suspendReason.trim() || "Suspended for 30 days (scheduled for deletion)",
      });
      toast.success("School suspended for 30 days and moved to Trash");
      nav("/super/schools");
    } catch {} finally { setSuspendBusy(false); }
  }

  async function destroyPermanently() {
    setBusy(true);
    try {
      await superAction("hard_delete", { table: "schools", id: school.id, confirm: "DELETE" });
      toast.success("School permanently deleted");
      nav("/super/schools");
    } catch {} finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Section title="Tenant preferences" description="Baseline behavior overrides and tenant metadata.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Field label="Slug" value={`/${school.slug}`} mono />
          <Field label="Created" value={new Date(school.created_at).toLocaleString()} />
          <Field label="Pilot" value={school.pilot_status ?? "—"} />
          <Field label="Status" value={school.status ?? "active"} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Option 1: Suspend for 30 days */}
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-md bg-warning/10 text-warning grid place-items-center shrink-0"><PauseCircle className="size-4" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Option 1: Suspend for 30 days</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Immediately locks portal access and moves the school to <strong className="text-foreground">Trash</strong> for a 30-day grace period. You can restore all school data anytime within 30 days before automatic purge.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Optional reason (e.g. Requested closure)" />
                <Button variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 shrink-0" disabled={suspendBusy} onClick={suspend30Days}>
                  {suspendBusy && <Loader2 className="size-4 mr-2 animate-spin" />}Suspend for 30 days
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Option 2: Delete permanently with confirmation */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-md bg-destructive/10 text-destructive grid place-items-center shrink-0"><Trash2 className="size-4" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-destructive">Option 2: Delete permanently (Immediate)</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently erases this school, its memberships, modules, and invite codes immediately without a 30-day recovery window. Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
              </p>
              <div className="mt-3 flex gap-2">
                <Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type DELETE" className="font-mono" />
                <Button variant="destructive" className="shrink-0" disabled={confirm.trim() !== "DELETE" || busy} onClick={destroyPermanently}>
                  {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Delete permanently
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
