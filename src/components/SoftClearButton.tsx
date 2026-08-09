import { useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

type Props = {
  label?: string;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  onClear: () => void | Promise<void>;
  disabled?: boolean;
};

/** Soft, non-destructive "clear from view" control with a gentle confirmation. */
export function SoftClearButton({
  label = "Clear",
  title = "Clear this view?",
  description = "This only hides the items from your view here. Nothing is deleted from your records.",
  confirmLabel = "Yes, clear",
  onClear,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" disabled={disabled} onClick={() => setOpen(true)}>
        <Eraser className="size-3.5 mr-1" /> {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void onClear(); }}>{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SoftClearButton;