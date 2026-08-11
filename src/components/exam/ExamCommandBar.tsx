import type { ReactNode } from "react";
import { TimerRing } from "@/components/exam/TimerRing";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badges?: ReactNode;
  remaining?: number;
  total?: number;
  saveState?: "idle" | "saving" | "saved";
  actions?: ReactNode;
  className?: string;
}

export function ExamCommandBar({ title, subtitle, icon, badges, remaining, total, saveState = "idle", actions, className }: Props) {
  return (
    <div className={cn("flex items-center gap-3 px-4 sm:px-6 h-16", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="leading-tight min-w-0">
          <div className="font-semibold text-sm truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
        </div>
        {badges}
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {saveState !== "idle" && (
          <span className={cn("hidden sm:inline text-[11px]", saveState === "saved" ? "text-success" : "text-muted-foreground")}>
            {saveState === "saved" ? "Saved" : "Saving…"}
          </span>
        )}
        {typeof remaining === "number" && typeof total === "number" && (
          <TimerRing remaining={remaining} total={total} size={48} />
        )}
        {actions}
      </div>
    </div>
  );
}
