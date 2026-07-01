import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuickAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "warning";
  disabled?: boolean;
};

export default function QuickActionsBar({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2 flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button
          key={a.key}
          variant="ghost"
          size="sm"
          disabled={a.disabled}
          onClick={a.onClick}
          className={cn(
            "h-8 text-[12px]",
            a.tone === "danger" && "text-destructive hover:bg-destructive/10 hover:text-destructive",
            a.tone === "warning" && "text-warning hover:bg-warning/10 hover:text-warning",
          )}
        >
          <span className="mr-1.5">{a.icon}</span>{a.label}
        </Button>
      ))}
    </div>
  );
}
