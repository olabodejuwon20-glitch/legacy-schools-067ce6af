import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export default function SuperClaim() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasAny, setHasAny] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("super_admin_exists").then(({ data }) => setHasAny(!!data));
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Provision or verify super_admin role via the super-action edge function
      await supabase.functions.invoke("super-action", {
        body: { action: "claim_super_admin" },
      });

      if (signed.user) {
        await supabase.from("user_roles").upsert(
          { user_id: signed.user.id, role: "super_admin" as any },
          { onConflict: "user_id,role" }
        );
      }

      toast.success("Welcome to LegacySKool OS Super Admin");
      nav("/super", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-md">
        <div className="size-10 rounded-lg bg-foreground text-background grid place-items-center mb-4">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">LegacySKool OS · Platform Access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {hasAny === false
            ? "No platform owner exists yet. Sign in below to claim Super Admin ownership."
            : "Sign in to the Super Admin console."}
        </p>

        <form className="space-y-3 mt-6" onSubmit={signIn}>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin mr-2" />} Continue
          </Button>
        </form>
      </div>
    </div>
  );
}