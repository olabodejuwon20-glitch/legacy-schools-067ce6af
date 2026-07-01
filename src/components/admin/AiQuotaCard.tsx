import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

type Q = {
  enabled: boolean;
  monthly_token_cap: number;
  monthly_cost_cap_usd: number;
  tokens_used: number;
  cost_used_usd: number;
  period_start: string;
};

export default function AiQuotaCard() {
  const { school } = useSchool();
  const [q, setQ] = useState<Q | null>(null);

  useEffect(() => {
    if (!school?.id) return;
    (async () => {
      const { data } = await supabase
        .from("school_ai_quotas")
        .select("enabled, monthly_token_cap, monthly_cost_cap_usd, tokens_used, cost_used_usd, period_start")
        .eq("school_id", school.id)
        .maybeSingle();
      setQ(data as any ?? {
        enabled: true, monthly_token_cap: 5000000, monthly_cost_cap_usd: 25,
        tokens_used: 0, cost_used_usd: 0, period_start: new Date().toISOString().slice(0, 10),
      });
    })();
  }, [school?.id]);

  if (!q) return null;
  const tokPct = Math.min(100, Math.round((q.tokens_used / Math.max(1, q.monthly_token_cap)) * 100));
  const costPct = Math.min(100, Math.round((Number(q.cost_used_usd) / Math.max(0.01, Number(q.monthly_cost_cap_usd))) * 100));

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center"><Zap className="size-4" /></div>
          <div>
            <div className="font-semibold text-sm">AI usage this month</div>
            <div className="text-xs text-muted-foreground">Resets on the 1st. Contact support to raise your cap.</div>
          </div>
        </div>
        {!q.enabled
          ? <Badge variant="destructive" className="text-xs">Disabled</Badge>
          : tokPct >= 100
            ? <Badge variant="destructive" className="text-xs">Cap reached</Badge>
            : tokPct >= 80
              ? <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-500/30">Near cap</Badge>
              : <Badge className="text-xs bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Healthy</Badge>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-medium">{q.tokens_used.toLocaleString()} / {q.monthly_token_cap.toLocaleString()}</span>
          </div>
          <Progress value={tokPct} />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Cost</span>
            <span className="font-medium">${Number(q.cost_used_usd).toFixed(2)} / ${Number(q.monthly_cost_cap_usd).toFixed(2)}</span>
          </div>
          <Progress value={costPct} />
        </div>
      </div>
    </Card>
  );
}