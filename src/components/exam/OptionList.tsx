import { Check } from "lucide-react";
import { Math as MathText } from "@/components/exam/Math";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  selected: number | null | undefined;
  onSelect: (index: number) => void;
  disabled?: boolean;
  showShortcuts?: boolean;
}

export function OptionList({ options, selected, onSelect, disabled, showShortcuts = true }: Props) {
  return (
    <div className="space-y-3">
      {options.map((opt, oi) => {
        const chosen = selected === oi;
        return (
          <button
            key={oi}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(oi)}
            aria-pressed={chosen}
            className={cn(
              "w-full text-left rounded-xl border px-4 py-4 transition-all flex items-center gap-3.5 disabled:opacity-60",
              chosen
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-secondary/40",
            )}
          >
            <span className={cn(
              "size-9 grid place-items-center rounded-full text-sm font-semibold border shrink-0 transition-colors",
              chosen ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground",
            )}>
              {chosen ? <Check className="size-4" /> : String.fromCharCode(65 + oi)}
            </span>
            <MathText className="text-sm sm:text-base break-words flex-1">{opt}</MathText>
          </button>
        );
      })}
      {showShortcuts && (
        <p className="pt-1 text-[11px] text-muted-foreground hidden sm:block">
          Shortcuts: <kbd className="px-1 rounded border border-border">A</kbd>–<kbd className="px-1 rounded border border-border">{String.fromCharCode(64 + Math.max(1, options.length))}</kbd> to answer,
          <kbd className="mx-1 px-1 rounded border border-border">←</kbd><kbd className="px-1 rounded border border-border">→</kbd> to move,
          <kbd className="mx-1 px-1 rounded border border-border">F</kbd> to flag
        </p>
      )}
    </div>
  );
}
