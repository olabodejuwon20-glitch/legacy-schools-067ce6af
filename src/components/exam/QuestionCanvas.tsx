import { useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Math as MathText } from "@/components/exam/Math";
import { cn } from "@/lib/utils";

interface Props {
  index: number;
  total: number;
  prompt: string;
  imageUrl?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Shared, distraction-free question surface used by every exam runner. */
export function QuestionCanvas({ index, total, prompt, imageUrl, meta, actions, children, className }: Props) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className={cn("w-full max-w-3xl mx-auto", className)}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Question {index + 1} <span className="opacity-60">/ {total}</span>
          </span>
          {meta}
        </div>
        {actions}
      </div>

      <MathText className="block text-lg sm:text-2xl font-medium leading-[1.7] text-foreground mb-7 whitespace-pre-wrap break-words">
        {prompt}
      </MathText>

      {imageUrl && (
        <button type="button" onClick={() => setZoom(true)} className="block mb-7 group">
          <img
            src={imageUrl}
            alt="Question diagram"
            loading="lazy"
            className="max-h-72 rounded-lg border border-border transition group-hover:border-primary/50"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">Tap to enlarge</span>
        </button>
      )}

      {children}

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-4xl p-2">
          {imageUrl && <img src={imageUrl} alt="Question diagram enlarged" className="w-full h-auto rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
