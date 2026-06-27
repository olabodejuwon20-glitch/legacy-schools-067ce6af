import { useEffect, useState } from "react";
import { Settings2, Save, CheckCircle2, XCircle, ExternalLink, Cpu, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS, AI_TASKS, AI_ROLES, TIER_BADGE, AI_MODEL_BY_ID } from "@/lib/aiModels";

type Quota = {
  school_id: string;
  enabled: boolean;
  monthly_token_cap: number;
  monthly_cost_cap_usd: number;
  tokens_used: number;
  cost_used_usd: number;
  period_start: string;
};

const DEFAULTS = { monthly_token_cap: 5_000_000, monthly_cost_cap_usd: 25, enabled: true };

export default function AISettings() {
  const { school } = useSchool();
  const [q, setQ] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<number>(0);
  // routing: { [`${kind}:${role}`]: model }
  const [routing, setRouting] = useState<Record<string, string>>({});
  const [savingRouting, setSavingRouting] = useState(false);

  async function load() {
    if (!school) return;
    setLoading(true);
    const [{ data: quota }, { count }, { data: routes }] = await Promise.all([
      supabase.from("school_ai_quotas").select("*").eq("school_id", school.id).maybeSingle(),
      supabase.from("ai_approvals").select("id", { count: "exact", head: true })
        .eq("school_id", school.id).eq("status", "pending"),
      supabase.from("ai_model_routing").select("task_kind, role, model").eq("school_id", school.id),
    ]);
    setQ((quota as Quota) ?? {
      school_id: school.id,
      enabled: DEFAULTS.enabled,
      monthly_token_cap: DEFAULTS.monthly_token_cap,
      monthly_cost_cap_usd: DEFAULTS.monthly_cost_cap_usd,
      tokens_used: 0, cost_used_usd: 0,
      period_start: new Date().toISOString().slice(0, 10),
    });
    setPending(count ?? 0);
    const map: Record<string, string> = {};
    (routes ?? []).forEach((r: any) => { map[`${r.task_kind}:${r.role}`] = r.model; });
    setRouting(map);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function save() {
    if (!school || !q) return;
    setSaving(true);
    const { error } = await supabase
      .from("school_ai_quotas")
      .upsert({
        school_id: school.id,
        enabled: q.enabled,
        monthly_token_cap: q.monthly_token_cap,
        monthly_cost_cap_usd: q.monthly_cost_cap_usd,
      }, { onConflict: "school_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("AI settings saved");
  }

  async function saveRouting() {
    if (!school) return;
    setSavingRouting(true);
    try {
      const rows = Object.entries(routing)
        .filter(([, model]) => !!model)
        .map(([key, model]) => {
          const [task_kind, role] = key.split(":");
          return { school_id: school.id, task_kind, role, model };
        });
      // Delete cleared rows then upsert the rest.
      const { error: delErr } = await supabase
        .from("ai_model_routing").delete().eq("school_id", school.id);
      if (delErr) throw delErr;
      if (rows.length) {
        const { error: insErr } = await supabase.from("ai_model_routing").insert(rows);
        if (insErr) throw insErr;
      }
      toast.success("Model routing saved");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save model routing");
    } finally {
      setSavingRouting(false);
    }
  }

  function setRoute(kind: string, role: string, model: string) {
    setRouting((prev) => {
      const next = { ...prev };
      const key = `${kind}:${role}`;
      if (!model || model === "__unset__") delete next[key];
      else next[key] = model;
      return next;
    });
  }

  if (loading || !q) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const tokenPct = Math.min(100, (Number(q.tokens_used) / Math.max(1, Number(q.monthly_token_cap))) * 100);
  const costPct = Math.min(100, (Number(q.cost_used_usd) / Math.max(0.01, Number(q.monthly_cost_cap_usd))) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Settings"
        description="Control how much AI your school uses this month and review what's awaiting approval."
      />

      <SectionCard title="Monthly budget" description="Caps reset automatically at the start of each calendar month.">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              checked={q.enabled}
              onCheckedChange={(v) => setQ({ ...q, enabled: v })}
              id="ai-enabled"
            />
            <Label htmlFor="ai-enabled" className="flex items-center gap-1.5">
              {q.enabled
                ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI features enabled</>
                : <><XCircle className="w-4 h-4 text-muted-foreground" /> AI features disabled</>}
            </Label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tok">Monthly token cap</Label>
              <Input id="tok" type="number" min={0} step={100000}
                value={q.monthly_token_cap}
                onChange={e => setQ({ ...q, monthly_token_cap: Number(e.target.value) })} />
              <Progress value={tokenPct} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                {Number(q.tokens_used).toLocaleString()} / {Number(q.monthly_token_cap).toLocaleString()} used ({tokenPct.toFixed(1)}%)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cost">Monthly cost cap (USD)</Label>
              <Input id="cost" type="number" min={0} step={1}
                value={q.monthly_cost_cap_usd}
                onChange={e => setQ({ ...q, monthly_cost_cap_usd: Number(e.target.value) })} />
              <Progress value={costPct} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                ${Number(q.cost_used_usd).toFixed(4)} / ${Number(q.monthly_cost_cap_usd).toFixed(2)} used ({costPct.toFixed(1)}%)
              </p>
            </div>
          </div>

          <Button onClick={save} disabled={saving} size="sm">
            <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Approval queue"
        description="AI drafts (lesson plans, parent messages, grading) waiting for a human to sign off."
        action={
          <Link
            to={schoolPath(school?.slug, "/app/admin/parent-alerts")}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Open parent alerts <ExternalLink className="w-3 h-3" />
          </Link>
        }
      >
        <div className="flex items-center gap-3 text-sm">
          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold">
            {pending}
          </div>
          <div className="text-muted-foreground">
            {pending === 0
              ? "Nothing waiting — you're all caught up."
              : `${pending} item${pending === 1 ? "" : "s"} need your review.`}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Where to see usage" description="">
        <Link
          to={schoolPath(school?.slug, "/app/admin/ai-activity")}
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <Settings2 className="w-4 h-4" /> Open AI Activity dashboard
        </Link>
      </SectionCard>

      <SectionCard
        title="AI model routing"
        description="Pick which model powers each task. Leave a cell blank to inherit the Default for that task. Heavier models give better answers but cost more."
        action={
          <Button onClick={saveRouting} size="sm" disabled={savingRouting}>
            <Save className="w-3.5 h-3.5 mr-1" /> {savingRouting ? "Saving…" : "Save routing"}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
            <div>
              You can mix <strong>Gemini</strong> and <strong>GPT-5</strong> families today.
              Specialist providers like <em>Anthropic Claude Sonnet</em> or <em>Google Vertex AI</em> aren't part of the included gateway — they need a separate paid integration. Ask in chat if you want one of those wired in.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Task</th>
                  {AI_ROLES.map((r) => (
                    <th key={r.id} className="text-left py-2 px-2 font-medium">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AI_TASKS.map((task) => (
                  <tr key={task.kind} className="border-b last:border-0 align-top">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium text-foreground">{task.label}</div>
                          <div className="text-[10px] text-muted-foreground">{task.description}</div>
                          <Badge variant="outline" className={`mt-1 text-[10px] ${TIER_BADGE[task.suggestedTier]}`}>
                            Suggested: {task.suggestedTier}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    {AI_ROLES.map((r) => {
                      const key = `${task.kind}:${r.id}`;
                      const value = routing[key] ?? "__unset__";
                      const info = AI_MODEL_BY_ID[routing[key] ?? ""];
                      return (
                        <td key={r.id} className="py-2 px-2 min-w-[180px]">
                          <Select value={value} onValueChange={(v) => setRoute(task.kind, r.id, v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={r.id === "default" ? "System default" : "Inherit"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unset__">
                                {r.id === "default" ? "System default" : "Inherit Default"}
                              </SelectItem>
                              <SelectGroup>
                                <SelectLabel>Google Gemini</SelectLabel>
                                {AI_MODELS.filter((m) => m.vendor === "Google").map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                                ))}
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>OpenAI GPT</SelectLabel>
                                {AI_MODELS.filter((m) => m.vendor === "OpenAI").map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {info && (
                            <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                              {info.blurb}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}