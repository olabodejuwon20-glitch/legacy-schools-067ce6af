import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, EmptyState, StatusBadge } from "@/components/super/primitives";
import { AreaTrend } from "@/components/super/Chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, AlertTriangle, Globe, ShieldAlert, ShieldCheck, ShieldOff, UserPlus, LogOut, Lock, Trash2, Download, Search, Sparkles } from "lucide-react";
import { compact, superAction, timeAgo } from "@/lib/super";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TrashTab = lazy(() => import("./Trash"));

type Evt = { id: string; type: string; ip: string | null; user_id: string | null; school_id: string | null; detail: Record<string, unknown> | null; created_at: string };
type SuperAdminRow = { user_id: string; full_name: string; email: string; created_at?: string };
type SecPolicy = {
  enforce_admin_mfa?: boolean;
  session_timeout_minutes?: number;
  max_failed_logins?: number;
  blocked_ips?: string[];
};

type TabKey = "events" | "admins" | "policies" | "trash";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "events",   label: "Security Events",   icon: ShieldAlert, description: "Login anomalies, IP signals, role escalations, and global sign-outs." },
  { key: "admins",   label: "Super Admins",      icon: ShieldCheck, description: "Platform-wide super_admin operators — grant, revoke, or force sign-out." },
  { key: "policies", label: "Access & IP Rules", icon: Lock,        description: "Session timeouts, failed login lockouts, and IP blocklist." },
  { key: "trash",    label: "30-Day Retention",  icon: Trash2,      description: "Soft-deleted schools, users, modules, tickets, and incidents." },
];

export default function SuperSecurity() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const active: TabKey = (["events", "admins", "policies", "trash"] as TabKey[]).includes(raw as TabKey) ? (raw as TabKey) : "events";

  const [evts, setEvts] = useState<Evt[] | null>(null);
  const [supers, setSupers] = useState<SuperAdminRow[] | null>(null);
  const [policy, setPolicy] = useState<SecPolicy>({
    enforce_admin_mfa: false,
    session_timeout_minutes: 480,
    max_failed_logins: 5,
    blocked_ips: [],
  });
  const [evtSearch, setEvtSearch] = useState("");
  const [evtType, setEvtType] = useState("all");
  const [newSuperEmail, setNewSuperEmail] = useState("");
  const [newBlockedIp, setNewBlockedIp] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [eRes, rRes, sRes] = await Promise.all([
      supabase.from("security_events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
      supabase.from("platform_settings").select("integrations").eq("id", 1).maybeSingle(),
    ]);
    setEvts((eRes.data as Evt[]) ?? []);

    const uids = Array.from(new Set(((rRes.data as { user_id: string }[]) ?? []).map(x => x.user_id)));
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", uids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const pmap = new Map((profs ?? []).map(p => [p.id, p]));
    setSupers(uids.map(uid => ({
      user_id: uid,
      full_name: pmap.get(uid)?.full_name ?? "Platform Operator",
      email: pmap.get(uid)?.email ?? uid.slice(0, 12),
    })));

    const intg = (sRes.data?.integrations as Record<string, unknown> | null) ?? {};
    if (intg.security_policy && typeof intg.security_policy === "object") {
      setPolicy({
        enforce_admin_mfa: false,
        session_timeout_minutes: 480,
        max_failed_logins: 5,
        blocked_ips: [],
        ...(intg.security_policy as SecPolicy),
      });
    }
  }

  useEffect(() => { void loadAll(); }, []);

  const kpis = useMemo(() => {
    if (!evts) return null;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = evts.filter(e => new Date(e.created_at) >= todayStart).length;
    const uniqueIps = new Set(evts.map(e => e.ip).filter(Boolean)).size;
    const escalations = evts.filter(e => e.type.includes("escalat") || e.type === "grant_super").length;
    return { today, uniqueIps, escalations, superCount: supers?.length ?? 0 };
  }, [evts, supers]);

  const trend = useMemo(() => {
    if (!evts) return [];
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    evts.forEach(e => { const k = e.created_at.slice(0, 10); if (k in days) days[k]++; });
    return Object.entries(days).map(([k, v]) => ({ label: k.slice(5), events: v }));
  }, [evts]);

  const filteredEvts = useMemo(() => {
    if (!evts) return [];
    const q = evtSearch.trim().toLowerCase();
    return evts.filter(e => {
      if (evtType !== "all" && !e.type.toLowerCase().includes(evtType)) return false;
      if (q && !e.type.toLowerCase().includes(q) && !(e.ip ?? "").toLowerCase().includes(q) && !(e.user_id ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [evts, evtSearch, evtType]);

  async function grantSuperByEmail() {
    if (!newSuperEmail.trim()) return;
    setBusy(true);
    try {
      await superAction("grant_super_by_email", { email: newSuperEmail.trim() });
      toast.success(`Granted Super Admin to ${newSuperEmail.trim()}`);
      setNewSuperEmail("");
      await loadAll();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  }

  async function revokeSuper(userId: string) {
    if (!confirm("Revoke Super Admin privileges from this user?")) return;
    try {
      await superAction("revoke_super", { user_id: userId });
      toast.success("Revoked Super Admin privileges");
      await loadAll();
    } catch {
      /* toasted */
    }
  }

  async function forceLogout(userId: string) {
    try {
      await superAction("force_logout_user", { user_id: userId });
      toast.success("Forced global sign-out");
      await loadAll();
    } catch {
      /* toasted */
    }
  }

  async function savePolicy(nextPolicy: SecPolicy) {
    setBusy(true);
    try {
      await superAction("update_security_policy", { policy: nextPolicy });
      setPolicy(nextPolicy);
      toast.success("Security policy saved");
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  }

  function exportEventsCsv() {
    const header = ["created_at", "type", "ip", "user_id", "school_id"];
    const lines = filteredEvts.map(e => [e.created_at, e.type, e.ip ?? "", e.user_id ?? "", e.school_id ?? ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `security-events-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const activeMeta = TABS.find(t => t.key === active)!;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Sparkles className="size-3" /><span>Security &amp; Governance workspace</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Security Center &amp; Retention</h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-2xl">
          Privileged operator access, authentication anomaly streams, IP blocklists, and 30-day soft-delete retention.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis === null
          ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-24" />)
          : (
            <>
              <MetricCard label="Events today" value={compact(kpis.today)} icon={<Activity className="size-4" />} />
              <MetricCard label="Unique IPs (30d)" value={compact(kpis.uniqueIps)} icon={<Globe className="size-4" />} />
              <MetricCard label="Privilege escalations" value={compact(kpis.escalations)} icon={<ShieldAlert className="size-4" />} delta={kpis.escalations ? { value: "audit", positive: false } : undefined} />
              <MetricCard label="Super Admin operators" value={compact(kpis.superCount)} icon={<ShieldCheck className="size-4 text-success" />} />
            </>
          )}
      </div>

      <div className="border-b border-border/70 sticky top-12 z-20 bg-background/85 backdrop-blur -mx-6 px-6">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none" role="tablist">
          {TABS.map(t => {
            const isActive = t.key === active;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setParams({ tab: t.key })}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
                {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-foreground rounded-full" />}
              </button>
            );
          })}
          <div className="ml-auto pl-4 text-[11px] text-muted-foreground hidden md:block">{activeMeta.description}</div>
        </nav>
      </div>

      {active === "events" && (
        <div className="space-y-6">
          <Section title="Events over the last 30 days" description="Volume of authentication, access, and policy events.">
            {evts === null ? <Skel className="h-56" /> : <AreaTrend data={trend} dataKey="events" color="hsl(var(--destructive))" />}
          </Section>

          <Section
            title={`Security Events (${filteredEvts.length})`}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-56">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={evtSearch} onChange={e => setEvtSearch(e.target.value)} placeholder="Search type, IP, user…" className="pl-8 h-8 text-xs" />
                </div>
                <Select value={evtType} onValueChange={setEvtType}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All event types</SelectItem>
                    <SelectItem value="fail">Auth failures</SelectItem>
                    <SelectItem value="logout">Force logouts</SelectItem>
                    <SelectItem value="super">Super Admin grants</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportEventsCsv} disabled={!filteredEvts.length}>
                  <Download className="size-3.5 mr-1" />CSV
                </Button>
              </div>
            }
          >
            {evts === null ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-10" />)}</div>
            ) : filteredEvts.length === 0 ? (
              <EmptyState icon={<ShieldAlert className="size-5 text-muted-foreground" />} title="No matching security events" description="Anomalies and privileged actions will appear here when recorded." />
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-5 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">IP</th>
                      <th className="text-left px-3 py-2 font-medium">User</th>
                      <th className="text-left px-3 py-2 font-medium">School</th>
                      <th className="text-right px-5 py-2 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvts.slice(0, 100).map(e => (
                      <tr key={e.id} className="border-b border-border/60">
                        <td className="px-5 py-2">
                          <StatusBadge status={e.type.includes("fail") || e.type.includes("escalat") ? "critical" : "normal"} />{" "}
                          <code className="text-[11px] text-muted-foreground">{e.type}</code>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{e.ip ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[140px]">{e.user_id?.slice(0, 8) ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[140px]">{e.school_id?.slice(0, 8) ?? "—"}</td>
                        <td className="px-5 py-2 text-right text-xs text-muted-foreground">{timeAgo(e.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {active === "admins" && (
        <div className="space-y-6">
          <Section
            title="Grant Super Admin Access"
            description="Elevate an existing registered user to platform-wide super_admin by their email address."
          >
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <Input
                type="email"
                value={newSuperEmail}
                onChange={e => setNewSuperEmail(e.target.value)}
                placeholder="operator@legacyskool.com"
                className="h-9"
              />
              <Button size="sm" className="h-9 shrink-0" disabled={busy || !newSuperEmail.trim()} onClick={() => void grantSuperByEmail()}>
                <UserPlus className="size-3.5 mr-1.5" />Grant Super Admin
              </Button>
            </div>
          </Section>

          <Section title={`Active Super Admins (${supers?.length ?? 0})`} description="Every account holding the super_admin role in user_roles.">
            {!supers ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-12" />)}</div>
            ) : supers.length === 0 ? (
              <EmptyState icon={<ShieldCheck className="size-5 text-muted-foreground" />} title="No Super Admins found" />
            ) : (
              <div className="divide-y divide-border -my-2">
                {supers.map(op => (
                  <div key={op.user_id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span>{op.full_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">super_admin</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{op.email} · {op.user_id.slice(0, 8)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void forceLogout(op.user_id)}>
                        <LogOut className="size-3 mr-1" />Force sign-out
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => void revokeSuper(op.user_id)}>
                        <ShieldOff className="size-3 mr-1" />Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {active === "policies" && (
        <div className="space-y-6">
          <Section title="Session & Authentication Hardening" description="Platform-wide security posture persisted in platform_settings.">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>Require MFA for School Admins &amp; Super Admins</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Prompt administrative accounts to enroll a second factor on sign-in.</p>
                </div>
                <Switch
                  checked={!!policy.enforce_admin_mfa}
                  onCheckedChange={v => setPolicy({ ...policy, enforce_admin_mfa: v })}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Idle Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    max={10080}
                    value={policy.session_timeout_minutes ?? 480}
                    onChange={e => setPolicy({ ...policy, session_timeout_minutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max Failed Login Attempts Before Lockout</Label>
                  <Input
                    type="number"
                    min={3}
                    max={25}
                    value={policy.max_failed_logins ?? 5}
                    onChange={e => setPolicy({ ...policy, max_failed_logins: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={busy} onClick={() => void savePolicy(policy)}>Save Security Policy</Button>
              </div>
            </div>
          </Section>

          <Section title="Blocked IP Addresses" description="Deny requests originating from abusive IPs at the edge.">
            <div className="space-y-3 max-w-xl">
              <div className="flex gap-2">
                <Input
                  value={newBlockedIp}
                  onChange={e => setNewBlockedIp(e.target.value)}
                  placeholder="e.g. 197.210.52.14"
                  className="h-9 font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                  disabled={!newBlockedIp.trim() || busy}
                  onClick={() => {
                    const ip = newBlockedIp.trim();
                    const next = { ...policy, blocked_ips: Array.from(new Set([...(policy.blocked_ips ?? []), ip])) };
                    setNewBlockedIp("");
                    void savePolicy(next);
                  }}
                >
                  Block IP
                </Button>
              </div>
              {(policy.blocked_ips ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No IPs currently blocked.</div>
              ) : (
                <ul className="divide-y divide-border border border-border rounded-lg">
                  {(policy.blocked_ips ?? []).map(ip => (
                    <li key={ip} className="px-3 py-2 flex items-center justify-between text-xs font-mono">
                      <span>{ip}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-destructive"
                        onClick={() => {
                          const next = { ...policy, blocked_ips: (policy.blocked_ips ?? []).filter(x => x !== ip) };
                          void savePolicy(next);
                        }}
                      >
                        Unblock
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        </div>
      )}

      {active === "trash" && (
        <Suspense fallback={<div className="space-y-3"><Skel className="h-24" /><Skel className="h-64" /></div>}>
          <TrashTab />
        </Suspense>
      )}
    </div>
  );
}