import { useEffect, useMemo, useState } from "react";
import {
  QrCode, Download, Printer, RefreshCw, Copy, Plus, Trash2, Ticket, Palette,
  ShieldCheck, History, Users2,
} from "lucide-react";
import { useSchool, Role } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import { buildSchoolUrl } from "@/lib/tenant";
import { generateQrPng, downloadDataUrl } from "@/lib/qr";
import { printOnboardingPoster } from "@/lib/onboardingPoster";

type BaseRole = "student" | "teacher" | "parent" | "driver" | "staff";
const BASE_ROLES: { key: BaseRole; label: string }[] = [
  { key: "student", label: "Student" },
  { key: "teacher", label: "Teacher" },
  { key: "parent",  label: "Parent" },
  { key: "driver",  label: "Driver" },
  { key: "staff",   label: "Staff" },
];
const PREFIX: Record<string, string> = { student: "STU", teacher: "TCH", parent: "PRT", driver: "DRV", staff: "STF" };

const rand = (n: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = ""; for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export default function OnboardingCenter() {
  const { school, user } = useSchool();
  const [identity, setIdentity] = useState<any>({});
  const [onboardingCfg, setOnboardingCfg] = useState<any>({});
  const [tab, setTab] = useState("identity");

  useEffect(() => {
    if (!school?.id) return;
    supabase.from("schools").select("settings").eq("id", school.id).maybeSingle().then(({ data }) => {
      const s = (data?.settings ?? {}) as any;
      setIdentity(s.identity ?? {});
      setOnboardingCfg(s.onboarding ?? {});
    });
  }, [school?.id]);

  if (!school) return null;
  const joinUrl = buildSchoolUrl(school.slug, "/join");

  return (
    <>
      <SEO title="Onboarding Center" description="Manage QR codes, activation codes, branding and onboarding policies." path="/admin/onboarding-center" />
      <SectionCard
        title="Onboarding Center"
        description="Bring new students, teachers, parents, drivers and staff into your portal — all from one place."
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="identity"><QrCode className="size-4 mr-1.5" />Identity & QR</TabsTrigger>
            <TabsTrigger value="codes"><Ticket className="size-4 mr-1.5" />Activation Codes</TabsTrigger>
            <TabsTrigger value="roles"><Users2 className="size-4 mr-1.5" />Roles</TabsTrigger>
            <TabsTrigger value="policies"><ShieldCheck className="size-4 mr-1.5" />Policies</TabsTrigger>
            <TabsTrigger value="history"><History className="size-4 mr-1.5" />History</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-4">
            <IdentityTab school={school} identity={identity} setIdentity={setIdentity} joinUrl={joinUrl} />
          </TabsContent>
          <TabsContent value="codes" className="mt-4">
            <CodesTab school={school} user={user} cfg={onboardingCfg} />
          </TabsContent>
          <TabsContent value="roles" className="mt-4">
            <RolesTab school={school} cfg={onboardingCfg} setCfg={setOnboardingCfg} />
          </TabsContent>
          <TabsContent value="policies" className="mt-4">
            <PoliciesTab school={school} cfg={onboardingCfg} setCfg={setOnboardingCfg} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryTab school={school} />
          </TabsContent>
        </Tabs>
      </SectionCard>
    </>
  );
}

/* ---------------- Identity & QR ---------------- */
function IdentityTab({ school, identity, setIdentity, joinUrl }: any) {
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<any>(identity || {});

  useEffect(() => { setDraft(identity || {}); }, [identity]);

  useEffect(() => {
    let cancelled = false;
    generateQrPng(joinUrl, { color: draft.primary_color || "#0f172a" }).then((d) => { if (!cancelled) setQr(d); });
    return () => { cancelled = true; };
  }, [joinUrl, draft.primary_color]);

  async function save() {
    setSaving(true);
    try {
      const { data: cur } = await supabase.from("schools").select("settings").eq("id", school.id).maybeSingle();
      const settings = { ...((cur?.settings as any) ?? {}), identity: { ...(identity ?? {}), ...draft } };
      const { error } = await supabase.from("schools").update({ settings }).eq("id", school.id);
      if (error) throw error;
      setIdentity(settings.identity);
      toast.success("Identity saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally { setSaving(false); }
  }

  async function regenerate() {
    setBusy(true);
    try {
      const d = await generateQrPng(joinUrl + "?v=" + Date.now(), { color: draft.primary_color || "#0f172a" });
      setQr(d);
      toast.success("QR refreshed");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4 bg-card">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Palette className="size-4" />Brand</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="School code (auto)"><Input value={identity?.school_code || ""} readOnly className="font-mono uppercase" /></Field>
            <Field label="Favicon URL"><Input value={draft.favicon_url || ""} onChange={(e) => setDraft({ ...draft, favicon_url: e.target.value })} placeholder="https://…/favicon.png" /></Field>
            <Field label="Primary color">
              <div className="flex gap-2">
                <input type="color" value={draft.primary_color || "#4f46e5"} onChange={(e) => setDraft({ ...draft, primary_color: e.target.value })} className="h-10 w-12 rounded-md border border-border bg-transparent cursor-pointer" />
                <Input value={draft.primary_color || ""} onChange={(e) => setDraft({ ...draft, primary_color: e.target.value })} placeholder="#4f46e5" />
              </div>
            </Field>
            <Field label="Accent color">
              <div className="flex gap-2">
                <input type="color" value={draft.accent_color || "#22c55e"} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} className="h-10 w-12 rounded-md border border-border bg-transparent cursor-pointer" />
                <Input value={draft.accent_color || ""} onChange={(e) => setDraft({ ...draft, accent_color: e.target.value })} placeholder="#22c55e" />
              </div>
            </Field>
            <Field label="Contact phone"><Input value={draft.contact_phone || ""} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })} /></Field>
            <Field label="Contact email"><Input type="email" value={draft.contact_email || ""} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} /></Field>
          </div>
          <div className="mt-3">
            <Field label="Welcome message">
              <Textarea rows={2} value={draft.welcome_message || ""} onChange={(e) => setDraft({ ...draft, welcome_message: e.target.value })} placeholder="Welcome! Use the QR code to join your portal." />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save identity"}</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 bg-card text-center">
        <div className="text-sm font-semibold mb-3 flex items-center justify-center gap-2"><QrCode className="size-4" />Join QR</div>
        {qr ? (
          <img src={qr} alt="QR" className="mx-auto size-64 rounded-lg bg-white p-2 border border-border" />
        ) : <div className="size-64 mx-auto rounded-lg border border-dashed border-border" />}
        <div className="text-xs text-muted-foreground mt-3 break-all font-mono">{joinUrl}</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qr && downloadDataUrl(qr, `${school.slug}-qr.png`)}><Download className="size-4 mr-1.5" />PNG</Button>
          <Button variant="outline" size="sm" onClick={() => qr && printOnboardingPoster({
            schoolName: school.name,
            schoolLogo: school.logo_url,
            brandColor: draft.primary_color || identity?.primary_color,
            joinUrl, schoolCode: identity?.school_code,
            qrDataUrl: qr,
            contactPhone: draft.contact_phone || identity?.contact_phone,
            contactEmail: draft.contact_email || identity?.contact_email,
            welcomeMessage: draft.welcome_message || identity?.welcome_message,
          })}><Printer className="size-4 mr-1.5" />Poster PDF</Button>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Link copied"); }}><Copy className="size-4 mr-1.5" />Copy link</Button>
          <Button variant="ghost" size="sm" onClick={regenerate} disabled={busy}><RefreshCw className={`size-4 mr-1.5 ${busy ? "animate-spin" : ""}`} />Regenerate</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Activation Codes ---------------- */
function CodesTab({ school, user, cfg }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<BaseRole>("student");
  const [qty, setQty] = useState(10);
  const [ttlDays, setTtlDays] = useState<number>(cfg?.policies?.code_ttl_days ?? 30);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    if (!school) return;
    const { data } = await supabase.from("invite_codes").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []).filter((r: any) => r.role !== "admin"));
  }
  useEffect(() => { load(); }, [school?.id]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!school || !user || busy) return;
    setBusy(true);
    try {
      const expires_at = ttlDays > 0 ? new Date(Date.now() + ttlDays * 86400_000).toISOString() : null;
      const payload = Array.from({ length: Math.max(1, Math.min(qty, 200)) }).map(() => ({
        school_id: school.id,
        code: `${PREFIX[role]}-${rand(role === "student" ? 5 : 4)}-${rand(3)}`,
        role, max_uses: 1, uses: 0,
        created_by: user.id, expires_at,
        metadata: {},
      }));
      const { error } = await supabase.from("invite_codes").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} code${payload.length > 1 ? "s" : ""} generated`);
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not generate codes");
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("invite_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Revoked"); load(); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("invite_codes").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  }

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.role === filter), [rows, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {BASE_ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" />Generate codes</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate activation codes</DialogTitle></DialogHeader>
            <form onSubmit={generate} className="space-y-3">
              <Field label="Role">
                <Select value={role} onValueChange={(v) => setRole(v as BaseRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BASE_ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Quantity"><Input type="number" min={1} max={200} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
              <Field label="Expires in (days, 0 = no expiry)"><Input type="number" min={0} value={ttlDays} onChange={(e) => setTtlDays(Number(e.target.value))} /></Field>
              <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={Ticket} title="No codes yet" desc="Generate activation codes to onboard your school." />
        : <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((r: any) => {
              const used = r.uses >= r.max_uses;
              const revoked = !!r.revoked_at;
              const expired = r.expires_at && new Date(r.expires_at) < new Date();
              const dead = used || revoked || expired;
              return (
                <div key={r.id} className={`flex flex-wrap items-center gap-2 p-3 rounded-lg border ${dead ? "border-muted-foreground/20 bg-muted/30 opacity-80" : "border-border"}`}>
                  <code className={`px-2.5 py-1.5 rounded-md font-mono text-sm ${dead ? "line-through bg-muted" : "bg-secondary"}`}>{r.code}</code>
                  <Badge variant="outline" className="capitalize">{r.role}</Badge>
                  {used && <Badge variant="secondary">Used</Badge>}
                  {revoked && <Badge variant="destructive">Revoked</Badge>}
                  {expired && !used && <Badge variant="outline">Expired</Badge>}
                  {r.expires_at && !expired && !used && (
                    <span className="text-xs text-muted-foreground">expires {new Date(r.expires_at).toLocaleDateString()}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" disabled={dead} onClick={() => { navigator.clipboard.writeText(r.code); toast.success("Copied"); }}><Copy className="size-4" /></Button>
                    {!revoked && !used && (
                      <Button variant="ghost" size="sm" onClick={() => revoke(r.id)}>Revoke</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </div>}
    </div>
  );
}

/* ---------------- Roles ---------------- */
function RolesTab({ school, cfg, setCfg }: any) {
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newBase, setNewBase] = useState<BaseRole>("staff");
  const [busy, setBusy] = useState(false);
  const enabledMap: Record<string, boolean> = cfg?.enabled_roles ?? { student: true, teacher: true, parent: true, driver: true, staff: true };

  async function load() {
    const { data } = await supabase.from("school_custom_roles").select("*").eq("school_id", school.id).is("deleted_at", null).order("created_at");
    setCustomRoles(data ?? []);
  }
  useEffect(() => { load(); }, [school?.id]);

  async function persistEnabled(next: Record<string, boolean>) {
    const { data: cur } = await supabase.from("schools").select("settings").eq("id", school.id).maybeSingle();
    const settings = { ...((cur?.settings as any) ?? {}), onboarding: { ...(cfg ?? {}), enabled_roles: next } };
    const { error } = await supabase.from("schools").update({ settings }).eq("id", school.id);
    if (error) toast.error(error.message);
    else setCfg(settings.onboarding);
  }

  async function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32);
      const { error } = await supabase.from("school_custom_roles").insert({
        school_id: school.id, label, key, base_role: newBase, enabled: true,
      });
      if (error) throw error;
      setNewLabel("");
      toast.success("Role added");
      load();
    } catch (e: any) { toast.error(e?.message || "Could not add"); }
    finally { setBusy(false); }
  }

  async function toggleCustom(id: string, enabled: boolean) {
    await supabase.from("school_custom_roles").update({ enabled }).eq("id", id);
    load();
  }
  async function deleteCustom(id: string) {
    await supabase.from("school_custom_roles").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-border p-4 bg-card">
        <div className="text-sm font-semibold mb-3">Default roles on the join screen</div>
        <div className="space-y-2">
          {BASE_ROLES.map((r) => (
            <div key={r.key} className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div className="text-sm">{r.label}</div>
              <Switch checked={enabledMap[r.key] !== false} onCheckedChange={(v) => persistEnabled({ ...enabledMap, [r.key]: v })} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 bg-card">
        <div className="text-sm font-semibold mb-3">Custom roles</div>
        <div className="flex gap-2 mb-3">
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Librarian, Nurse, ICT Officer" />
          <Select value={newBase} onValueChange={(v) => setNewBase(v as BaseRole)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{BASE_ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={addCustom} disabled={busy || !newLabel.trim()}><Plus className="size-4" /></Button>
        </div>
        {customRoles.length === 0
          ? <p className="text-xs text-muted-foreground">No custom roles yet.</p>
          : <div className="space-y-2">
              {customRoles.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">acts as <span className="capitalize">{r.base_role}</span></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.enabled} onCheckedChange={(v) => toggleCustom(r.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteCustom(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}

/* ---------------- Policies ---------------- */
function PoliciesTab({ school, cfg, setCfg }: any) {
  const pol = cfg?.policies ?? {};
  const [draft, setDraft] = useState<any>({
    password_min: pol.password_min ?? 8,
    pin_length: pol.pin_length ?? 6,
    otp_required: pol.otp_required ?? true,
    code_ttl_days: pol.code_ttl_days ?? 30,
    onboarding_enabled: cfg?.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const { data: cur } = await supabase.from("schools").select("settings").eq("id", school.id).maybeSingle();
      const next = {
        ...((cur?.settings as any) ?? {}),
        onboarding: {
          ...(cfg ?? {}),
          enabled: draft.onboarding_enabled,
          policies: {
            password_min: Math.max(6, Number(draft.password_min) || 8),
            pin_length: Math.min(8, Math.max(4, Number(draft.pin_length) || 6)),
            otp_required: !!draft.otp_required,
            code_ttl_days: Math.max(0, Number(draft.code_ttl_days) || 30),
          },
        },
      };
      const { error } = await supabase.from("schools").update({ settings: next }).eq("id", school.id);
      if (error) throw error;
      setCfg(next.onboarding);
      toast.success("Policies saved");
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-border p-4 bg-card max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Onboarding enabled</div>
            <div className="text-xs text-muted-foreground">Allow new users to join via the QR / activation code flow.</div>
          </div>
          <Switch checked={draft.onboarding_enabled} onCheckedChange={(v) => setDraft({ ...draft, onboarding_enabled: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Require OTP for parents</div>
            <div className="text-xs text-muted-foreground">Send a one-time code to the parent's phone/email when linking a child.</div>
          </div>
          <Switch checked={draft.otp_required} onCheckedChange={(v) => setDraft({ ...draft, otp_required: v })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Password min length"><Input type="number" min={6} max={32} value={draft.password_min} onChange={(e) => setDraft({ ...draft, password_min: e.target.value })} /></Field>
          <Field label="PIN length"><Input type="number" min={4} max={8} value={draft.pin_length} onChange={(e) => setDraft({ ...draft, pin_length: e.target.value })} /></Field>
          <Field label="Default code expiry (days)"><Input type="number" min={0} value={draft.code_ttl_days} onChange={(e) => setDraft({ ...draft, code_ttl_days: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save policies"}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- History ---------------- */
function HistoryTab({ school }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, used: 0, revoked: 0 });

  useEffect(() => {
    if (!school) return;
    supabase.from("invite_codes").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => {
        const r = (data ?? []).filter((x: any) => x.role !== "admin");
        setRows(r);
      });
    supabase.from("invite_codes").select("uses, max_uses, revoked_at", { count: "exact" }).eq("school_id", school.id).neq("role", "admin")
      .then(({ data, count }) => {
        const used = (data ?? []).filter((x: any) => x.uses >= x.max_uses).length;
        const revoked = (data ?? []).filter((x: any) => !!x.revoked_at).length;
        setStats({ total: count ?? (data?.length ?? 0), used, revoked });
      });
  }, [school?.id]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Codes generated" value={stats.total} />
        <Stat label="Used" value={stats.used} />
        <Stat label="Revoked" value={stats.revoked} />
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {rows.length === 0
          ? <div className="p-6 text-center text-sm text-muted-foreground">No onboarding activity yet.</div>
          : rows.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 text-sm">
                <code className="font-mono text-xs">{r.code}</code>
                <Badge variant="outline" className="capitalize">{r.role}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  {r.revoked_at ? "Revoked" : r.uses >= r.max_uses ? "Used" : "Active"}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}