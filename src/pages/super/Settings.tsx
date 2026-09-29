import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, Skel } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Brain, ShieldAlert, LogIn, LogOut as LogOutIcon, RefreshCw, AlertOctagon, Radio } from "lucide-react";
import { toast } from "sonner";
import { superAction } from "@/lib/super";

type Settings = {
  brand: { name?: string; logo_url?: string; primary?: string; support_email?: string };
  smtp: { host?: string; port?: number; user?: string; password?: string; from_name?: string; from_email?: string };
  integrations: Record<string, boolean>;
  maintenance_mode: boolean;
  maintenance_message: string | null;
};

const KNOWN_INTEGRATIONS = [
  { key: "paddle", name: "Paddle", desc: "Subscription billing" },
  { key: "resend", name: "Resend", desc: "Transactional email" },
  { key: "sentry", name: "Sentry", desc: "Error tracking" },
  { key: "posthog", name: "PostHog", desc: "Product analytics" },
];

function formatNumber(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString();
}
function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SuperSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) {
      setS({ brand: {}, smtp: {}, integrations: {}, maintenance_mode: false, maintenance_message: null });
    } else {
      setS({
        brand: (data.brand as any) ?? {},
        smtp: (data.smtp as any) ?? {},
        integrations: (data.integrations as any) ?? {},
        maintenance_mode: data.maintenance_mode,
        maintenance_message: data.maintenance_message,
      });
    }
  }
  useEffect(() => { load(); }, []);

  async function saveFields(fields: Partial<Settings>) {
    setSaving(true);
    try {
      await superAction("update_settings", { fields });
      toast.success("Saved");
    } catch {/* toasted */} finally { setSaving(false); }
  }
  async function saveMaintenance() {
    if (!s) return;
    setSaving(true);
    try {
      await superAction("toggle_maintenance", { enabled: s.maintenance_mode, message: s.maintenance_message });
      toast.success("Maintenance updated");
    } catch {/* toasted */} finally { setSaving(false); }
  }

  if (!s) return <div><PageHeader title="Platform Settings" /><Skel className="h-72" /></div>;

  return (
    <div>
      <PageHeader title="Platform Settings" description="Branding, email infrastructure, integrations and maintenance mode." />

      <Tabs defaultValue="brand">
        <TabsList className="mb-4">
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="ai-cache">AI Cache</TabsTrigger>
          <TabsTrigger value="auth-activity">Auth Activity</TabsTrigger>
        <TabsTrigger value="live-errors">Live Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <Section title="Brand">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Platform name</Label><Input value={s.brand.name ?? ""} onChange={e => setS({ ...s, brand: { ...s.brand, name: e.target.value } })} placeholder="Legacyskool" /></div>
              <div><Label>Support email</Label><Input type="email" value={s.brand.support_email ?? ""} onChange={e => setS({ ...s, brand: { ...s.brand, support_email: e.target.value } })} /></div>
              <div><Label>Logo URL</Label><Input value={s.brand.logo_url ?? ""} onChange={e => setS({ ...s, brand: { ...s.brand, logo_url: e.target.value } })} placeholder="https://…" /></div>
              <div><Label>Primary color</Label><Input value={s.brand.primary ?? ""} onChange={e => setS({ ...s, brand: { ...s.brand, primary: e.target.value } })} placeholder="#0F172A or hsl(…)" /></div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => saveFields({ brand: s.brand })} disabled={saving}>{saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}Save brand</Button>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="smtp">
          <Section title="SMTP" description="Outbound email config. Secrets live in Lovable Cloud — this only persists the connection metadata.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Host</Label><Input value={s.smtp.host ?? ""} onChange={e => setS({ ...s, smtp: { ...s.smtp, host: e.target.value } })} /></div>
              <div><Label>Port</Label><Input type="number" value={s.smtp.port ?? ""} onChange={e => setS({ ...s, smtp: { ...s.smtp, port: Number(e.target.value) || undefined } })} /></div>
              <div><Label>User</Label><Input value={s.smtp.user ?? ""} onChange={e => setS({ ...s, smtp: { ...s.smtp, user: e.target.value } })} /></div>
              <div><Label>Password</Label><Input type="password" value={s.smtp.password ?? ""} onChange={e => setS({ ...s, smtp: { ...s.smtp, password: e.target.value } })} /></div>
              <div><Label>From name</Label><Input value={s.smtp.from_name ?? ""} onChange={e => setS({ ...s, smtp: { ...s.smtp, from_name: e.target.value } })} /></div>
              <div><Label>From email</Label><Input type="email" value={s.smtp.from_email ?? ""} onChange={e => setS({ ...s, smtp: { ...s.smtp, from_email: e.target.value } })} /></div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => saveFields({ smtp: s.smtp })} disabled={saving}>{saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}Save SMTP</Button>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="integrations">
          <Section title="Integrations" description="Toggle availability across the platform. API keys are managed in Lovable Cloud secrets, not here.">
            <ul className="divide-y divide-border -my-2">
              {KNOWN_INTEGRATIONS.map(i => (
                <li key={i.key} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{i.name}</div>
                    <div className="text-[11px] text-muted-foreground">{i.desc}</div>
                  </div>
                  <Switch checked={!!s.integrations[i.key]} onCheckedChange={v => setS({ ...s, integrations: { ...s.integrations, [i.key]: v } })} />
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-4">
              <Button onClick={() => saveFields({ integrations: s.integrations })} disabled={saving}>{saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}Save integrations</Button>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="maintenance">
          <Section title="Maintenance mode" description="Show a banner to every user. Use sparingly.">
            <div className="flex items-center justify-between rounded-md border border-border p-3 mb-3">
              <div>
                <Label>Enable maintenance mode</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">When on, every tenant sees the message below.</p>
              </div>
              <Switch checked={s.maintenance_mode} onCheckedChange={v => setS({ ...s, maintenance_mode: v })} />
            </div>
            <Label>Message</Label>
            <Textarea rows={3} value={s.maintenance_message ?? ""} onChange={e => setS({ ...s, maintenance_message: e.target.value })} placeholder="We’re upgrading our exam infrastructure. Back at 9pm UTC." />
            <div className="flex justify-end mt-4">
              <Button onClick={saveMaintenance} disabled={saving}>{saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}Save maintenance</Button>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="ai-cache">
          <AICachePanel />
        </TabsContent>

        <TabsContent value="auth-activity">
          <AuthActivityPanel />
        </TabsContent>

        <TabsContent value="live-errors">
          <LiveErrorsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AICachePanel() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("super_ai_cache_stats" as any);
    if (error) toast.error(error.message);
    setData(res ?? null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Skel className="h-72" />;
  const t = data?.totals ?? {};
  const byFeature = (data?.by_feature ?? []) as any[];
  const byRole = (data?.by_role ?? []) as any[];
  const recent = (data?.recent ?? []) as any[];

  return (
    <Section
      title="AI Cache status"
      description="Hit rate, tokens saved and last cache activity across all schools."
    >
      <div className="flex justify-end -mt-2 mb-3">
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="size-3.5 mr-1.5" />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Hit rate" value={`${t.hit_rate ?? 0}%`} />
        <Stat label="Cache entries" value={formatNumber(t.entries)} />
        <Stat label="Total hits" value={formatNumber(t.total_hits)} />
        <Stat label="Tokens saved" value={formatNumber(t.tokens_saved)} />
        <Stat label="Cost saved" value={`$${Number(t.cost_saved_usd ?? 0).toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-md border border-border">
          <div className="px-3 py-2 border-b border-border text-xs font-semibold flex items-center gap-1.5"><Brain className="size-3.5" /> By feature</div>
          <div className="max-h-80 overflow-y-auto text-xs">
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-muted/40 text-muted-foreground"><tr>
                <th className="text-left px-3 py-1.5">Feature</th>
                <th className="text-right px-3 py-1.5">Hit %</th>
                <th className="text-right px-3 py-1.5">Hits</th>
                <th className="text-right px-3 py-1.5">Tokens saved</th>
                <th className="text-right px-3 py-1.5">Last</th>
              </tr></thead>
              <tbody>
                {byFeature.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No cache activity yet.</td></tr>}
                {byFeature.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 font-medium">{r.feature}</td>
                    <td className="px-3 py-1.5 text-right">{r.hit_rate}%</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.hits)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.tokens_saved)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{formatRelative(r.last_used_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="rounded-md border border-border">
          <div className="px-3 py-2 border-b border-border text-xs font-semibold">By role (last 60 days)</div>
          <div className="max-h-80 overflow-y-auto text-xs">
            <div className="overflow-x-auto"><table className="w-full">
              <thead className="bg-muted/40 text-muted-foreground"><tr>
                <th className="text-left px-3 py-1.5">Role</th>
                <th className="text-right px-3 py-1.5">Hit %</th>
                <th className="text-right px-3 py-1.5">Hits</th>
                <th className="text-right px-3 py-1.5">Misses</th>
                <th className="text-right px-3 py-1.5">Last hit</th>
              </tr></thead>
              <tbody>
                {byRole.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No data.</td></tr>}
                {byRole.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 font-medium capitalize">{r.role}</td>
                    <td className="px-3 py-1.5 text-right">{r.hit_rate}%</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.hits)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.misses)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{formatRelative(r.last_hit_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border mt-4">
        <div className="px-3 py-2 border-b border-border text-xs font-semibold">Latest cached entries</div>
        <ul className="divide-y divide-border text-xs">
          {recent.length === 0 && <li className="px-3 py-3 text-muted-foreground">Nothing cached yet.</li>}
          {recent.map((r, i) => (
            <li key={i} className="px-3 py-2 flex items-center justify-between">
              <span className="font-medium">{r.feature}</span>
              <span className="text-muted-foreground">{formatNumber(r.hits)} hits · {formatNumber(r.tokens_saved)} tokens · {formatRelative(r.last_used_at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

type AuthRow = { id: string; event: string; user_id: string | null; school_id: string | null; session_id: string | null; created_at: string; full_name: string | null; email: string | null };

function AuthActivityPanel() {
  const [rows, setRows] = useState<AuthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "sign_in" | "sign_out" | "sign_up">("all");
  const [windowDays, setWindowDays] = useState<number>(7);
  const [q, setQ] = useState("");
  const [live, setLive] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
    const { data, error } = await supabase.rpc("super_recent_auth_events" as any, {
      _limit: 500,
      _event: filter === "all" ? null : filter,
      _since: since,
    });
    if (error) toast.error(error.message);
    setRows((data ?? []) as AuthRow[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, windowDays]);

  // Realtime stream — prepend new auth_events as they happen
  useEffect(() => {
    if (!live) return;
    const nonce = Math.random().toString(36).slice(2, 10);
    const ch = supabase
      .channel(`super:auth_events:${nonce}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auth_events" }, async (payload: any) => {
        const ev = payload.new;
        if (filter !== "all" && ev.event !== filter) return;
        const cutoff = Date.now() - windowDays * 86400_000;
        if (new Date(ev.created_at).getTime() < cutoff) return;
        // hydrate profile
        let full_name: string | null = null, email: string | null = null;
        if (ev.user_id) {
          const { data: p } = await supabase.from("profiles").select("full_name,email").eq("id", ev.user_id).maybeSingle();
          full_name = p?.full_name ?? null; email = (p as any)?.email ?? null;
        }
        setRows(prev => [{ ...ev, full_name, email } as AuthRow, ...prev].slice(0, 1000));
        setLiveCount(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [live, filter, windowDays]);

  const filtered = rows.filter(r => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.email || "").toLowerCase().includes(s) || (r.full_name || "").toLowerCase().includes(s);
  });

  // Suspicious: > 5 sign-ins for the same user in the last 10 min
  const suspicious = (() => {
    const cutoff = Date.now() - 10 * 60_000;
    const by: Record<string, number> = {};
    rows.forEach(r => {
      if (r.event !== "sign_in" || !r.user_id) return;
      if (new Date(r.created_at).getTime() < cutoff) return;
      by[r.user_id] = (by[r.user_id] ?? 0) + 1;
    });
    return Object.entries(by).filter(([, n]) => n >= 5).length;
  })();

  const counts = {
    sign_in: rows.filter(r => r.event === "sign_in").length,
    sign_out: rows.filter(r => r.event === "sign_out").length,
    sign_up: rows.filter(r => r.event === "sign_up").length,
  };

  return (
    <Section title="Authentication activity" description="Monitor sign-in and sign-out events across the platform to spot suspicious access.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Sign-ins" value={formatNumber(counts.sign_in)} />
        <Stat label="Sign-outs" value={formatNumber(counts.sign_out)} />
        <Stat label="Sign-ups" value={formatNumber(counts.sign_up)} />
        <div className={`rounded-md border p-3 ${suspicious > 0 ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><ShieldAlert className="size-3" /> Suspicious users</div>
          <div className="text-lg font-semibold mt-0.5">{suspicious}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Event:</span>
          {(["all","sign_in","sign_out","sign_up"] as const).map(v => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-2 py-1 rounded-md border text-xs ${filter === v ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>{v.replace("_"," ")}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Window:</span>
          {[1, 7, 30].map(d => (
            <button key={d} onClick={() => setWindowDays(d)}
              className={`px-2 py-1 rounded-md border text-xs ${windowDays === d ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>{d}d</button>
          ))}
        </div>
        <div className="flex-1" />
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${live ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground"}`}>
          <Radio className={`size-3 ${live ? "animate-pulse" : ""}`} /> {live ? `Live · ${liveCount} new` : "Paused"}
        </span>
        <button onClick={() => { setLive(v => !v); setLiveCount(0); }}
          className="px-2 py-1 rounded-md border border-border text-xs hover:bg-muted">
          {live ? "Pause" : "Resume"}
        </button>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or name…" className="h-8 w-56" />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="size-3.5 mr-1.5" />Refresh</Button>
      </div>

      {loading ? <Skel className="h-64" /> : (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Event</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Session</th>
            </tr></thead>
            <tbody className="max-h-[480px]">
              {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No events.</td></tr>}
              {filtered.slice(0, 300).map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted-foreground">{formatRelative(r.created_at)}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.event === "sign_in" ? "bg-success/15 text-success"
                      : r.event === "sign_out" ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary"
                    }`}>
                      {r.event === "sign_in" ? <LogIn className="size-3" /> : r.event === "sign_out" ? <LogOutIcon className="size-3" /> : null}
                      {r.event}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{r.full_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-1.5">{r.email || <span className="text-muted-foreground">anonymous</span>}</td>
                  <td className="px-3 py-1.5 text-muted-foreground font-mono text-[10px]">{r.session_id ? r.session_id.slice(0, 12) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </Section>
  );
}

type ErrRow = {
  id: string;
  created_at: string;
  source: string | null;
  message: string;
  cause: string | null;
  stack: string | null;
  route: string | null;
  user_id: string | null;
  user_agent: string | null;
  severity: string | null;
  context: any;
};

function LiveErrorsPanel() {
  const [rows, setRows] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_errors")
      .select("id,created_at,source,message,cause,stack,route,user_id,user_agent,severity,context")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(error.message);
    setRows((data ?? []) as ErrRow[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!live) return;
    // Poll every 5s for new errors (realtime publication is disabled for client_errors
    // to prevent cross-tenant data exposure via postgres_changes broadcasts).
    let lastSeen = rows[0]?.created_at ?? new Date(0).toISOString();
    const tick = async () => {
      const { data } = await supabase
        .from("client_errors")
        .select("id,created_at,source,message,cause,stack,route,user_id,user_agent,severity,context")
        .gt("created_at", lastSeen)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data && data.length) {
        lastSeen = data[0].created_at;
        setRows(prev => [...(data as ErrRow[]), ...prev].slice(0, 500));
        setLiveCount(c => c + data.length);
        const row = data[0] as ErrRow;
        toast.error(row.message, {
          description: row.cause ? `${row.source ?? "error"} · ${row.cause}` : (row.source ?? "error"),
          duration: 6000,
        });
      }
    };
    const iv = setInterval(tick, 5000);
    return () => clearInterval(iv);
  }, [live]);

  const filtered = rows.filter(r => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.message || "").toLowerCase().includes(s)
        || (r.cause || "").toLowerCase().includes(s)
        || (r.route || "").toLowerCase().includes(s)
        || (r.source || "").toLowerCase().includes(s);
  });

  const last5m = rows.filter(r => Date.now() - new Date(r.created_at).getTime() < 5 * 60_000).length;
  const last1h = rows.filter(r => Date.now() - new Date(r.created_at).getTime() < 60 * 60_000).length;
  const bySource = rows.reduce<Record<string, number>>((acc, r) => { const k = r.source || "unknown"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});

  return (
    <Section title="Live error feed" description="Streams every error users encounter across the platform — with the cause — in real time.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Last 5 min" value={formatNumber(last5m)} />
        <Stat label="Last hour" value={formatNumber(last1h)} />
        <Stat label="Total (window)" value={formatNumber(rows.length)} />
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><AlertOctagon className="size-3" /> Top source</div>
          <div className="text-lg font-semibold mt-0.5">{Object.entries(bySource).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—"}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${live ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground"}`}>
          <Radio className={`size-3 ${live ? "animate-pulse" : ""}`} /> {live ? `Live · ${liveCount} new` : "Paused"}
        </span>
        <button onClick={() => { setLive(v => !v); setLiveCount(0); }}
          className="px-2 py-1 rounded-md border border-border text-xs hover:bg-muted">{live ? "Pause" : "Resume"}</button>
        <div className="flex-1" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search message, cause, route…" className="h-8 w-72" />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="size-3.5 mr-1.5" />Refresh</Button>
      </div>

      {loading ? <Skel className="h-64" /> : (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>
              <th className="text-left px-3 py-2 w-28">When</th>
              <th className="text-left px-3 py-2 w-24">Source</th>
              <th className="text-left px-3 py-2">Error</th>
              <th className="text-left px-3 py-2 w-56">Cause</th>
              <th className="text-left px-3 py-2 w-48">Route</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No errors recorded.</td></tr>}
              {filtered.slice(0, 200).flatMap(r => [
                  (<tr key={r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="border-t border-border hover:bg-muted/40 cursor-pointer">
                    <td className="px-3 py-1.5 text-muted-foreground">{formatRelative(r.created_at)}</td>
                    <td className="px-3 py-1.5"><span className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-destructive/10 text-destructive">{r.source || "error"}</span></td>
                    <td className="px-3 py-1.5 font-medium truncate max-w-[420px]" title={r.message}>{r.message}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate" title={r.cause ?? ""}>{r.cause || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono text-[10px] truncate" title={r.route ?? ""}>{r.route || "—"}</td>
                  </tr>),
                  expanded === r.id ? (
                    <tr key={r.id + ":d"} className="bg-muted/20 border-t border-border">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <div className="text-muted-foreground mb-1">User</div>
                            <div className="font-mono">{r.user_id || "anonymous"}</div>
                            <div className="text-muted-foreground mt-2 mb-1">User-Agent</div>
                            <div className="break-all">{r.user_agent || "—"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Stack</div>
                            <pre className="whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-background rounded border border-border p-2">{r.stack || "—"}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
              ])}
            </tbody>
          </table></div>
        </div>
      )}
    </Section>
  );
}