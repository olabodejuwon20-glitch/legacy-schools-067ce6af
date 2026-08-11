import { cn } from "@/lib/utils";

export type PaletteItem = { key: string; answered: boolean; flagged?: boolean };

interface Props {
  items: PaletteItem[];
  activeIndex: number;
  onJump: (i: number) => void;
  className?: string;
  compact?: boolean;
}

export function QuestionPalette({ items, activeIndex, onJump, className, compact }: Props) {
  const answered = items.filter(i => i.answered).length;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions</div>
        <span className="text-xs font-semibold tabular-nums">{answered}/{items.length}</span>
      </div>
      <div className={cn("grid gap-1.5", compact ? "grid-cols-8" : "grid-cols-5")}>
        {items.map((it, i) => {
          const current = i === activeIndex;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onJump(i)}
              aria-current={current}
              aria-label={`Question ${i + 1}${it.answered ? ", answered" : ""}${it.flagged ? ", flagged" : ""}`}
              className={cn(
                "relative size-9 rounded-md text-xs font-semibold border transition-colors",
                current && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                it.answered
                  ? "bg-success/15 border-success/40 text-success"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {i + 1}
              {it.flagged && (
                <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning border border-background" />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <Legend className="bg-success/40" label="Answered" />
        <Legend className="bg-warning" label="Flagged" />
        <Legend className="bg-border" label="Unseen" />
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-success transition-all" style={{ width: `${(answered / Math.max(1, items.length)) * 100}%` }} />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}
