import { ReactNode } from "react";
import { AlertTriangle, TrendingDown, Timer, Sparkles, HardDrive, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Insight = { key: string; icon: ReactNode; label: string; count: number; tone: "danger" | "warning" | "info" | "success" };

const TONES: Record<Insight["tone"], string> = {
  danger:  "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info:    "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
};

export default function InsightsCards({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {insights.map((i) => (
        <div key={i.key} className={cn("rounded-xl border p-3 flex flex-col justify-between min-h-[86px]", TONES[i.tone])}>
          <div className="flex items-center justify-between">
            <span className="opacity-80">{i.icon}</span>
            <span className="text-2xl font-bold tabular-nums">{i.count}</span>
          </div>
          <div className="text-[11px] font-medium mt-1 leading-snug">{i.label}</div>
        </div>
      ))}
    </div>
  );
}

export function buildInsights(rows: Array<{ status?: string | null; plan_expires_at?: string | null; healthScore: number; storageBytes: number; aiTokens: number }>): Insight[] {
  const now = Date.now();
  const churn = rows.filter(r => r.healthScore < 55).length;
  const trialSoon = rows.filter(r => r.status === "trial" && r.plan_expires_at && new Date(r.plan_expires_at).getTime() - now < 7 * 86400_000).length;
  const lowEngagement = rows.filter(r => r.healthScore < 60).length;
  const aiHeavy = rows.filter(r => r.aiTokens > 150_000).length;
  const storageHigh = rows.filter(r => r.storageBytes > 7 * 1_073_741_824).length;
  const needsAttn = rows.filter(r => r.status === "suspended" || r.healthScore < 45).length;
  return [
    { key: "churn",       icon: <TrendingDown className="size-4" />, label: "At churn risk",         count: churn,        tone: "danger" },
    { key: "trial",       icon: <Timer className="size-4" />,        label: "Trial expiring < 7d",   count: trialSoon,    tone: "warning" },
    { key: "engagement",  icon: <AlertTriangle className="size-4" />, label: "Low engagement",       count: lowEngagement,tone: "warning" },
    { key: "ai",          icon: <Sparkles className="size-4" />,     label: "High AI adoption",      count: aiHeavy,      tone: "info" },
    { key: "storage",     icon: <HardDrive className="size-4" />,    label: "Storage near capacity", count: storageHigh,  tone: "info" },
    { key: "attention",   icon: <ShieldAlert className="size-4" />,  label: "Needs attention",       count: needsAttn,    tone: "danger" },
  ];
}
