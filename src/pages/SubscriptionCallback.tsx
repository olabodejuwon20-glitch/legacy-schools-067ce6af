import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyReference } from "@/lib/subscription";
import { useSchool } from "@/contexts/SchoolContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { friendlyError } from "@/lib/errors";

export default function SubscriptionCallback() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("ref") || params.get("trxref");
  const nav = useNavigate();
  const { school } = useSchool();
  const [state, setState] = useState<"pending" | "ok" | "fail">("pending");
  const [msg, setMsg] = useState<string>("Verifying your payment…");

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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {state === "pending" && <Loader2 className="size-12 mx-auto animate-spin text-primary" />}
        {state === "ok" && <CheckCircle2 className="size-12 mx-auto text-success" />}
        {state === "fail" && <XCircle className="size-12 mx-auto text-destructive" />}
        <h1 className="text-xl font-semibold">
          {state === "ok" ? "Subscription activated" : state === "fail" ? "Payment issue" : "Verifying payment"}
        </h1>
        <p className="text-sm text-muted-foreground">{msg}</p>
        {state !== "pending" && (
          <Button onClick={() => nav(back)}>Back to subscription</Button>
        )}
      </Card>
    </div>
  );
}