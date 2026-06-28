import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Shows a branded "Install app" card when the browser fires `beforeinstallprompt`. */
export function PWAInstallPrompt({ schoolName }: { schoolName?: string }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!evt || dismissed) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50">
      <Card className="p-4 shadow-elevated border-primary/30">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
            <Download className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Install {schoolName || "the app"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Add to your home screen for quick access.</div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>Not now</Button>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}