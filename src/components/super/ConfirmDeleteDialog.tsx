import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Loader2, PauseCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  itemName?: string;
  destructive?: "trash" | "purge";
  onConfirm: (confirm: "DELETE") => Promise<void> | void;
  onSuspend30Days?: () => Promise<void> | void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  destructive = "trash",
  onConfirm,
  onSuspend30Days,
}: Props) {
  const [mode, setMode] = useState<"suspend30" | "delete">(onSuspend30Days ? "suspend30" : "delete");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const effectiveMode = onSuspend30Days ? mode : "delete";
  const disabled = (effectiveMode === "delete" && text.trim() !== "DELETE") || busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setText("");
          setMode(onSuspend30Days ? "suspend30" : "delete");
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-destructive/10 grid place-items-center">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm">
            {description ??
              (onSuspend30Days
                ? "Choose how you want to remove this account: suspend for 30 days (recoverable in Trash) or permanently delete immediately."
                : destructive === "purge"
                ? "This will permanently delete the record. This cannot be undone."
                : "This will move the item to Trash. It will be auto-purged after 30 days.")}
            {itemName && (
              <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
                {itemName}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {onSuspend30Days && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-1">
            <button
              type="button"
              onClick={() => setMode("suspend30")}
              className={cn(
                "text-left rounded-xl border p-3 transition-all",
                effectiveMode === "suspend30"
                  ? "border-warning bg-warning/10 ring-1 ring-warning/30"
                  : "border-border bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                <PauseCircle className="size-4 text-warning shrink-0" />
                1. Suspend for 30 Days
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Locks access immediately and holds in Trash for 30 days. Can be restored anytime before auto-purge.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("delete")}
              className={cn(
                "text-left rounded-xl border p-3 transition-all",
                effectiveMode === "delete"
                  ? "border-destructive bg-destructive/10 ring-1 ring-destructive/30"
                  : "border-border bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-destructive">
                <ShieldAlert className="size-4 text-destructive shrink-0" />
                2. Delete Permanently
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Immediately and permanently erases the account. Requires typing DELETE to confirm.
              </p>
            </button>
          </div>
        )}

        {effectiveMode === "delete" ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm permanent deletion
            </label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-muted-foreground">
            This account will be suspended immediately and scheduled for automatic purge in <strong className="text-foreground">30 days</strong>. You can restore it from <strong className="text-foreground">Trash</strong> at any time during the 30-day window.
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {effectiveMode === "suspend30" && onSuspend30Days ? (
            <Button
              variant="default"
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSuspend30Days();
                  setText("");
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <PauseCircle className="size-4 mr-1.5" />}
              Suspend for 30 days
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={disabled}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm("DELETE");
                  setText("");
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Trash2 className="size-4 mr-1.5" />}
              {onSuspend30Days || destructive === "purge" ? "Permanently delete" : "Move to Trash"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDeleteDialog;
