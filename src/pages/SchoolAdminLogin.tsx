import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, Mail, KeyRound, Building2, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { schoolPath, buildSchoolUrl } from "@/lib/tenant";
import { SchoolBadge } from "@/components/SchoolBadge";
import { friendlyError } from "@/lib/errors";

/** /:slug/admin — school admin sign in (email + password). */
export default function SchoolAdminLogin() {
  const navigate = useNavigate();
  const { session, loading, school, schoolLoading, memberships } = useSchool();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password flow states
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your registered email address first.");
      return;
    }
    setResetBusy(true);
    try {
      const cleanEmail = email.trim();
      const redirectUrl = `${window.location.origin}/reset-password`;

      // 1. Try custom Edge Function first (bypasses Supabase SMTP limits using Brevo/Resend)
      const { data, error: fnError } = await supabase.functions.invoke("request-password-reset", {
        body: { email: cleanEmail, redirectTo: redirectUrl },
      });

      if (!fnError && (data as any)?.ok) {
        setResetSent(true);
        toast.success("Password reset link sent! Check your inbox.");
        return;
      }

      // 2. Fall back to standard Supabase Auth recovery
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Password reset link sent! Check your inbox.");
    } catch (err: any) {
      toast.error(friendlyError(err, "We couldn't send the password reset email. Please try again."));
    } finally {
      setResetBusy(false);
    }
  }

  useEffect(() => {
    if (!session || !school) return;
    if (memberships.find(m => m.school_id === school.id && m.role === "admin")) {
      navigate(schoolPath(school.slug, "/app"), { replace: true });
    }
  }, [session, school, memberships, navigate]);

  if (loading || schoolLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!school) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signed.user!.id;
      const { data: m } = await supabase.from("memberships")
        .select("role").eq("user_id", uid).eq("school_id", school!.id).eq("role", "admin").eq("status", "active").maybeSingle();
      if (!m) {
        await supabase.auth.signOut();
        throw new Error("We couldn't find an active administrator account for these credentials. Please verify your details.");
      }
      toast.success("Welcome back, Administrator");
      window.location.href = schoolPath(school!.slug, "/app");
    } catch (err) { toast.error(friendlyError(err, "We couldn't sign you in. Please check your admin email and password.")); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <Card className="w-full max-w-md p-8">
        <Link to={schoolPath(school.slug, "")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <SchoolBadge name={school.name} logoUrl={school.logo_url} subtitle="Administrator Portal" />
        <div className="flex justify-center mb-3 -mt-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-3" /> Admin only
          </div>
        </div>

        {forgotMode ? (
          <div>
            {resetSent ? (
              <div className="text-center py-4 space-y-4">
                <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-6" />
                </div>
                <h1 className="font-display text-xl font-bold tracking-tight">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  We sent a password reset link to <strong className="text-foreground">{email}</strong>. Check your inbox and follow the link to choose a new password.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    setForgotMode(false);
                    setResetSent(false);
                  }}
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-center">Reset Admin Password</h2>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Enter your email address to receive a secure link to reset your administrator password.
                </p>
                <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Mail className="size-3.5"/>Email address</Label>
                    <Input
                      required
                      type="email"
                      placeholder="e.g. principal@school.edu.ng"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={resetBusy}>
                    {resetBusy && <Loader2 className="size-4 animate-spin mr-1.5" />}
                    Send Reset Link
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setForgotMode(false)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="size-3.5"/>Email address</Label>
              <Input required type="email" placeholder="e.g. principal@school.edu.ng" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>Password</Label>
                <button
                  type="button"
                  onClick={() => setForgotMode(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput required minLength={6} placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5"/>}Sign in to Dashboard</Button>
          </form>
        )}
      </Card>
    </div>
  );
}