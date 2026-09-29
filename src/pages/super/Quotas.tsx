import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { MetricCard, Skel } from "@/components/super/primitives";
import { RefreshCw, Search, Save, RotateCcw, Zap, DollarSign, AlertTriangle, CheckCircle2, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

type Row = {
  school_id: string;
  school_name: string;
  school_slug: string;
  plan: string;
  enabled: boolean;
  monthly_token_cap: number;
  monthly_cost_cap_usd: number;
  tokens_used: number;
  cost_used_usd: number;
  period_start: string;
  updated_at: string;
};

function fmt(n: number) { return n.toLocaleString(); }

export default function SuperQuotas() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("super_list_ai_quotas" as never);
    if (error) toast.error("Could not load quotas");
    setRows((data ?? []) as Row[]);
    setEdits({});
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      r.school_name?.toLowerCase().includes(s) || r.school_slug?.toLowerCase().includes(s));
  }, [rows, q]);

  const summary = useMemo(() => {
    const totalTokens = rows.reduce((s, r) => s + Number(r.tokens_used ?? 0), 0);
    const totalCost = rows.reduce((s, r) => s + Number(r.cost_used_usd ?? 0), 0);
    const nearOrAtCap = rows.filter(r => {
      const cap = Math.max(1, Number(r.monthly_token_cap ?? 500000));
      return (r.tokens_used / cap) >= 0.8;
    }).length;
    const enabledCount = rows.filter(r => r.enabled).length;
    return { totalTokens, totalCost, nearOrAtCap, enabledCount };
  }, [rows]);

  function patch(id: string, p: Partial<Row>) {
    setEdits(e => ({ ...e, [id]: { ...e[id], ...p } }));
  }
  function val<K extends keyof Row>(r: Row, k: K): Row[K] {
    return (edits[r.school_id]?.[k] ?? r[k]) as Row[K];
  }

  async function save(r: Row) {
    setBusy(r.school_id);
    const { error } = await supabase.rpc("super_set_ai_quota" as never, {
      _school_id: r.school_id,
      _token_cap: Number(val(r, "monthly_token_cap")),
      _cost_cap: Number(val(r, "monthly_cost_cap_usd")),
      _enabled: Boolean(val(r, "enabled")),
    } as never);
    setBusy(null);
    if (error) { toast.error("Could not save"); return; }
    toast.success("Quota updated");
    void load();
  }

  async function reset(r: Row) {
    if (!confirm(`Reset this month's usage for ${r.school_name}?`)) return;
    setBusy(r.school_id);
    const { error } = await supabase.rpc("super_reset_ai_quota" as never, { _school_id: r.school_id } as never);
    setBusy(null);
    if (error) { toast.error("Could not reset"); return; }
    toast.success("Usage reset");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="size-5 text-primary" /> AI Quotas &amp; Budget Controls
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cap monthly AI token spend per school. When a school hits its cap, AI features return a friendly budget notice until raised or the next billing period begins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search schools…" className="pl-8 w-64 h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={"size-4 " + (loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Tokens Used (Month)" value={loading ? "—" : fmt(summary.totalTokens)} icon={<Zap className="size-4 text-primary" />} />
        <MetricCard label="Total AI Spend (Month)" value={loading ? "—" : `$${summary.totalCost.toFixed(2)}`} icon={<DollarSign className="size-4 text-warning" />} />
        <MetricCard label="Schools Near / At Cap" value={loading ? "—" : summary.nearOrAtCap} icon={<AlertTriangle className="size-4 text-destructive" />} />
        <MetricCard label="AI Enabled Schools" value={loading ? "—" : `${summary.enabledCount} / ${rows.length}`} icon={<CheckCircle2 className="size-4 text-success" />} />
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-32" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No schools found.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const tokPct = Math.min(100, Math.round((r.tokens_used / Math.max(1, Number(val(r, "monthly_token_cap")))) * 100));
            const costPct = Math.min(100, Math.round((Number(r.cost_used_usd) / Math.max(0.01, Number(val(r, "monthly_cost_cap_usd")))) * 100));
            const dirty = !!edits[r.school_id];
            return (
              <Card key={r.school_id} className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/super/schools/${r.school_id}`} className="font-semibold truncate hover:underline inline-flex items-center gap-1">
                        {r.school_name}
                        <ArrowUpRight className="size-3.5 text-muted-foreground" />
                      </Link>
                      <Badge variant="secondary" className="text-xs capitalize">{r.plan}</Badge>
                      {!val(r, "enabled") && <Badge variant="destructive" className="text-xs">AI disabled</Badge>}
                      {tokPct >= 100 && <Badge variant="destructive" className="text-xs">Cap reached</Badge>}
                      {tokPct >= 80 && tokPct < 100 && <Badge variant="outline" className="text-xs bg-warning/15 text-warning border-warning/30">Near cap</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">/{r.school_slug} · period {r.period_start}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={Boolean(val(r, "enabled"))} onCheckedChange={(v) => patch(r.school_id, { enabled: v })} />
                      Enabled
                    </label>
                    <Button size="sm" variant="outline" onClick={() => void reset(r)} disabled={busy === r.school_id}>
                      <RotateCcw className="size-4 mr-1" /> Reset
                    </Button>
                    <Button size="sm" onClick={() => void save(r)} disabled={!dirty || busy === r.school_id}>
                      <Save className="size-4 mr-1" />
                      {busy === r.school_id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Tokens this month</span>
                      <span className="font-medium tabular-nums">{fmt(r.tokens_used)} / {fmt(Number(val(r, "monthly_token_cap")))}</span>
                    </div>
                    <Progress value={tokPct} />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground w-20">Token cap</span>
                      <Input type="number" min={0} step={100000}
                        value={Number(val(r, "monthly_token_cap"))}
                        onChange={e => patch(r.school_id, { monthly_token_cap: Number(e.target.value) })}
                        className="h-8" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Cost this month (USD)</span>
                      <span className="font-medium tabular-nums">${Number(r.cost_used_usd).toFixed(2)} / ${Number(val(r, "monthly_cost_cap_usd")).toFixed(2)}</span>
                    </div>
                    <Progress value={costPct} />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground w-20">Cost cap</span>
                      <Input type="number" min={0} step={1}
                        value={Number(val(r, "monthly_cost_cap_usd"))}
                        onChange={e => patch(r.school_id, { monthly_cost_cap_usd: Number(e.target.value) })}
                        className="h-8" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}