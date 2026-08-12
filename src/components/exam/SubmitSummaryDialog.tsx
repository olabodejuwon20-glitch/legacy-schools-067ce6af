import { AlertTriangle, Flag, CheckCircle2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  answered: number;
  flagged?: number[];
  unanswered: number[];
  onJump?: (index: number) => void;
  onConfirm: () => void;
  submitting?: boolean;
}

export function SubmitSummaryDialog({
  open, onOpenChange, total, answered, flagged = [], unanswered, onJump, onConfirm, submitting,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Submit your paper?</AlertDialogTitle>
          <AlertDialogDescription>
            Review your progress below. Answers can't be changed after submitting.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Answered" value={`${answered}`} tone="success" icon={CheckCircle2} />
          <Stat label="Unanswered" value={`${unanswered.length}`} tone={unanswered.length ? "destructive" : "muted"} icon={AlertTriangle} />
          <Stat label="Flagged" value={`${flagged.length}`} tone={flagged.length ? "warning" : "muted"} icon={Flag} />
        </div>

        {unanswered.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Jump to unanswered</div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {unanswered.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onJump?.(i); onOpenChange(false); }}
                  className="size-8 rounded-md border border-border text-xs font-semibold hover:border-primary hover:text-primary"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">{answered} of {total} questions answered.</div>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep going</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit final answers"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "success" | "warning" | "destructive" | "muted"; icon: any }) {
  const toneCls = {
    success: "text-success border-success/30 bg-success/10",
    warning: "text-warning border-warning/30 bg-warning/10",
    destructive: "text-destructive border-destructive/30 bg-destructive/10",
    muted: "text-muted-foreground border-border bg-muted/40",
  }[tone];
  return (
    <div className={cn("rounded-lg border p-3", toneCls)}>
      <Icon className="size-4 mb-1.5" />
      <div className="text-xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[11px] mt-1 opacity-80">{label}</div>
    </div>
  );
}
