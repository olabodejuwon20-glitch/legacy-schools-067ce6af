import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  itemName?: string;
  destructive?: "trash" | "purge";
  onConfirm: (confirm: "DELETE") => Promise<void> | void;
};

export default function ConfirmDeleteDialog({ open, onOpenChange, title, description, itemName, destructive = "trash", onConfirm }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const disabled = text.trim() !== "DELETE" || busy;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setText(""); onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-destructive/10 grid place-items-center">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm">
            {description ?? (destructive === "purge"
              ? "This will permanently delete the record. This cannot be undone."
              : "This will move the item to Trash. It will be auto-purged after 30 days.")}
            {itemName && (
              <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono break-all">{itemName}</div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm</label>
          <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="DELETE" className="font-mono" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={disabled}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm("DELETE"); setText(""); onOpenChange(false); } finally { setBusy(false); }
            }}
          >
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Trash2 className="size-4 mr-1.5" />}
            {destructive === "purge" ? "Permanently delete" : "Move to Trash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}