import { useEffect, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImpersonation, endImpersonation, type ImpersonationState } from "@/lib/impersonation";

export default function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(() => getImpersonation());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const refresh = () => setState(getImpersonation());
    window.addEventListener("impersonation:change", refresh);
    window.addEventListener("storage", refresh);
    const t = setInterval(() => { setNow(Date.now()); refresh(); }, 1000);
    return () => {
      window.removeEventListener("impersonation:change", refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(t);
    };
  }, []);

  if (!state) return null;
  const msLeft = new Date(state.expiresAt).getTime() - now;
  if (msLeft <= 0) return null;
  const mins = Math.floor(msLeft / 60000);
  const secs = Math.floor((msLeft % 60000) / 1000);

  return (
    <div className="sticky top-0 z-[100] w-full bg-red-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-xs sm:text-sm">
        <ShieldAlert className="size-4 shrink-0" />
        <div className="flex-1 min-w-0 truncate">
          <span className="font-semibold">SUPPORT SESSION</span>
          <span className="mx-2 opacity-70">·</span>
          <span>Viewing as <b>{state.targetName}</b>{state.targetRole ? ` (${state.targetRole})` : ""}</span>
          {state.schoolName && (<><span className="mx-2 opacity-70">at</span><b>{state.schoolName}</b></>)}
        </div>
        <span className="font-mono tabular-nums opacity-90 hidden sm:inline">
          {mins}:{String(secs).padStart(2, "0")}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 bg-white text-red-700 hover:bg-white/90"
          onClick={async () => { await endImpersonation("manual"); }}
        >
          <LogOut className="size-3.5 mr-1" /> End
        </Button>
      </div>
    </div>
  );
}