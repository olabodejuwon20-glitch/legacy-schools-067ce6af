import { useEffect, useState } from "react";
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter } from "@/components/ui/drawer";
import { ArrowLeft, ExternalLink, ShieldCheck, Trash2, Loader2, Settings2, LogOut, ShieldAlert } from "lucide-react";
import { superAction, money, timeAgo } from "@/lib/super";
import { buildSchoolUrl } from "@/lib/tenant";
import { toast } from "sonner";
import ImpersonateDialog from "@/components/super/ImpersonateDialog";

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
          <div className="text-sm text-muted-foreground">/{school.slug} · {school.email ?? "no email"}</div>
          <div className="flex items-center gap-2 mt-2">
            <PlanBadge plan={school.plan} />
            <SchoolStatusBadge status={school.status} />
            {school.plan_expires_at && <span className="text-xs text-muted-foreground">Expires {new Date(school.plan_expires_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImpOpen(true)} className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800">
            <ShieldAlert className="size-4 mr-2" />Login as
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(buildSchoolUrl(school.slug, "/"), "_blank")}><ExternalLink className="size-4 mr-2" />Open portal</Button>
        </div>
        <ImpersonateDialog open={impOpen} onOpenChange={setImpOpen} school={{ id: school.id, name: school.name, slug: school.slug }} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewTab school={school} /></TabsContent>
        <TabsContent value="profile" className="mt-6"><ProfileTab school={school} onSaved={load} /></TabsContent>
        <TabsContent value="billing" className="mt-6"><BillingTab school={school} onChange={load} /></TabsContent>
        <TabsContent value="modules" className="mt-6"><ModulesTab schoolId={school.id} /></TabsContent>
        <TabsContent value="members" className="mt-6"><MembersTab schoolId={school.id} /></TabsContent>
        <TabsContent value="danger" className="mt-6"><DangerTab school={school} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ school }: { school: any }) {
  const [m, setM] = useState({ members: 0, exams: 0, results: 0, storage: 0 });
  const [audit, setAudit] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const [mem, ex, re, lib, au] = await Promise.all([
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("exams").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("results").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("library_files").select("size_bytes").eq("school_id", school.id),
      supabase.from("platform_audit").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(10),
    ]);
    const bytes = (lib.data ?? []).reduce((s: number, r: any) => s + (r.size_bytes ?? 0), 0);
    setM({ members: mem.count ?? 0, exams: ex.count ?? 0, results: re.count ?? 0, storage: bytes });
    setAudit(au.data ?? []);
  })(); }, [school.id]);
  const mb = (b: number) => b > 1e9 ? `${(b/1e9).toFixed(1)} GB` : `${(b/1e6).toFixed(1)} MB`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Members" value={m.members} />
        <MetricCard label="Exams" value={m.exams} />
        <MetricCard label="Results" value={m.results} />
        <MetricCard label="Storage" value={mb(m.storage)} />
      </div>
      <Section title="Recent platform actions" description="Audit trail of super-admin operations on this school.">
        {audit.length === 0 ? <EmptyState title="No actions yet" /> : (
          <div className="divide-y divide-border -mx-5">
            {audit.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div><span className="font-medium">{a.action}</span><span className="text-muted-foreground text-xs ml-2">by {a.actor.slice(0,8)}</span></div>
                <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ProfileTab({ school, onSaved }: { school: any; onSaved: () => void }) {
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
      toast.success("Profile saved"); onSaved();
    } catch {} finally { setBusy(false); }
  }
  return (
    <Section title="School profile" description="Edit core tenant identity. Changes are logged.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          ["name","Name"], ["slug","Slug"], ["email","Email"], ["phone","Phone"],
          ["motto","Motto"], ["logo_url","Logo URL"],
        ].map(([k,l]) => (
          <div key={k}><Label>{l}</Label><Input value={(f as any)[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <div className="md:col-span-2"><Label>Address</Label><Input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Platform notice <span className="text-muted-foreground">(banner shown to this school)</span></Label><Textarea rows={3} value={f.platform_notice} onChange={e => setF({ ...f, platform_notice: e.target.value })} /></div>
      </div>
      <div className="mt-5 flex justify-end"><Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 mr-2 animate-spin" />}Save changes</Button></div>
    </Section>
  );
}

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
    } catch (e: any) { toast.error("Invalid JSON"); }
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

function MembersTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
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

  async function logout(user_id: string) {
    if (!confirm("Force this user out of all sessions?")) return;
    await superAction("force_logout_user", { user_id, school_id: schoolId });
    toast.success("User signed out globally");
  }

  if (!rows) return <Skel className="h-64" />;
  return (
    <Section title="Members" description={`${rows.length} active members`}>
      {rows.length === 0 ? <EmptyState title="No members yet" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="w-[100px]" /></TableRow></TableHeader>
          <TableBody>{rows.map(r => (
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

function DangerTab({ school }: { school: any }) {
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
  );
}
