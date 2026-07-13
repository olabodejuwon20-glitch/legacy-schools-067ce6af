import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type AuthDetails = {
  client?: { name?: string; client_id?: string; redirect_uri?: string };
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
const oauthApi = (): {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
} => (supabase.auth as unknown as { oauth: any }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) { setError("Missing authorization_id"); setCheckingSession(false); return; }
      const { data: sess } = await supabase.auth.getSession();
      if (!active) return;
      setSessionEmail(sess.session?.user.email ?? null);
      setCheckingSession(false);
      if (!sess.session) return;
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) { setError(error.message); return; }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Reload so the useEffect picks up the new session and fetches details on the same URL.
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Sign-in failed");
    } finally { setBusy(false); }
  }

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center size-10 rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">Legacyskool</div>
            <div className="text-xs text-muted-foreground mt-1">Authorize access</div>
          </div>
        </div>

        {error ? (
          <div className="text-sm text-destructive">Could not load this authorization request: {error}</div>
        ) : checkingSession ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
        ) : !sessionEmail ? (
          <form onSubmit={signIn} className="space-y-3">
            <p className="text-sm text-muted-foreground">Sign in to your Legacyskool account to continue authorizing this connection.</p>
            <div className="space-y-2"><Label>Email</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label>
              <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />} Sign in and continue
            </Button>
          </form>
        ) : !details ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading authorization…</div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-base font-semibold">Connect {clientName} to your account</div>
              <p className="text-sm text-muted-foreground">
                {clientName} will be able to call this app's enabled tools while you are signed in as{" "}
                <span className="font-medium text-foreground">{sessionEmail}</span>.
              </p>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-1">
                <ShieldCheck className="size-3.5" /> This does not bypass Legacyskool's permissions or backend policies.
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy && <Loader2 className="size-4 animate-spin mr-2" />} Approve
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}