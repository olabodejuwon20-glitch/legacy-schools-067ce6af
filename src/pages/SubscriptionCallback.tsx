import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyReference } from "@/lib/subscription";
import { useSchool } from "@/contexts/SchoolContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowRight, RotateCw } from "lucide-react";
import { friendlyError } from "@/lib/errors";

export default function SubscriptionCallback() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("ref") || params.get("trxref");
  const nav = useNavigate();
  const { school } = useSchool();
  const [state, setState] = useState<"pending" | "ok" | "fail">("pending");
  const [msg, setMsg] = useState<string>("Verifying your payment…");
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    if (!reference) { setState("fail"); setMsg("Missing payment reference"); return; }
    verifyReference(reference)
      .then(r => {
        if (r.ok && r.status === "paid") { setState("ok"); setMsg("Payment confirmed. Your subscription is active."); }
        else { setState("fail"); setMsg("Payment not completed. You can retry from your subscription page."); }
      })
      .catch(e => { setState("fail"); setMsg(friendlyError(e, "Verification failed. Please try again.")); });
  }, [reference]);

  const back = school ? `/${school.slug}/app/admin/subscription` : "/";

  // Auto-redirect on success
  useEffect(() => {
    if (state !== "ok") return;
    if (countdown <= 0) { nav(back); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [state, countdown, back, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-5">
        <div className={`mx-auto size-20 rounded-full grid place-items-center ${
          state === "ok" ? "bg-success/10" : state === "fail" ? "bg-destructive/10" : "bg-primary/10"
        }`}>
          {state === "pending" && <Loader2 className="size-10 animate-spin text-primary" />}
          {state === "ok" && <CheckCircle2 className="size-10 text-success" />}
          {state === "fail" && <XCircle className="size-10 text-destructive" />}
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            {state === "ok" ? "Payment successful" : state === "fail" ? "Payment not completed" : "Verifying your payment"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{msg}</p>
          {reference && (
            <p className="text-[11px] text-muted-foreground mt-3 font-mono break-all">Ref: {reference}</p>
          )}
        </div>
        {state === "ok" && (
          <div className="space-y-2">
            <Button onClick={() => nav(back)} className="w-full">
              Continue to subscription <ArrowRight className="size-4 ml-1" />
            </Button>
            <p className="text-[11px] text-muted-foreground">Redirecting in {countdown}s…</p>
          </div>
        )}
        {state === "fail" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RotateCw className="size-4 mr-1" /> Retry
            </Button>
            <Button onClick={() => nav(back)}>Back to subscription</Button>
          </div>
        )}
      </Card>
    </div>
  );
}