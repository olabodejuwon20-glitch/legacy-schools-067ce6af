import { healthColor } from "@/lib/schoolHealth";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export default function SchoolHealthGauge({ score, trend, size = 140 }: { score: number; trend?: "up" | "down" | "flat"; size?: number }) {
  const c = healthColor(score);
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} className="stroke-muted" strokeWidth="10" fill="none" />
          <circle cx={size/2} cy={size/2} r={r} className={cn(c.ring, "transition-[stroke-dashoffset] duration-700")}
            strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className={cn("text-3xl font-bold tabular-nums", c.text)}>{score}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">/ 100</div>
          </div>
        </div>
      </div>
      <div className={cn("mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium", c.soft)}>
        <Icon className="size-3" />
        {c.label}
      </div>
    </div>
  );
}
