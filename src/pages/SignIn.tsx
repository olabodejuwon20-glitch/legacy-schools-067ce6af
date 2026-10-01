import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { schoolPath } from "@/lib/tenant";
import SEO from "@/components/SEO";
import { friendlyError } from "@/lib/errors";

/** Root admin sign in. School admins can sign in here OR from their /:slug/admin URL. */
export default function SignIn() {
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signed.user!.id;
      const { data: rows } = await supabase
        .from("memberships")
        .select("school_id, role, created_at, schools(slug)")
        .eq("user_id", uid)
        .eq("role", "admin")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);

      const m = rows?.[0];
      if (!m) {
        const { data: isSuper } = await supabase.rpc("is_super_admin" as any, { _user: uid });
        if (isSuper) {
          toast.success("Welcome back");
          window.location.href = "/super";
          return;
        }
        await supabase.auth.signOut();
        throw new Error("We couldn't sign you in with those details.");
      }
      const slug = (m as any).schools?.slug as string;
      toast.success("Welcome back, Administrator");
      window.location.href = schoolPath(slug, "/app");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't sign you in. Please check your email and password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <SEO
        title="Admin Sign In — LegacySKool"
        description="Sign in to your LegacySKool admin portal to manage classes, staff, students and results."
        path="/signin"
      />
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[hsl(var(--admin))] via-[hsl(var(--student))] to-[hsl(var(--teacher))] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <Link to="/" className="relative flex items-center gap-3 w-fit">
          <div className="grid place-items-center size-11 rounded-xl bg-white/20 backdrop-blur"><GraduationCap className="size-6" /></div>
          <div><div className="font-display font-bold text-xl leading-none">LegacySKool</div><div className="text-xs opacity-80 mt-1">School Management Platform</div></div>
        </Link>
        <div className="relative space-y-4 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">Welcome back, Administrator</h2>
          <p className="text-white/85">Sign in to access your administrative dashboard, manage staff and students, and monitor academic progress.</p>
          <div className="text-xs text-white/70 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur">
            {"\u00a0"}
          </div>
        </div>
        <div className="relative text-xs opacity-70">© 2026 LegacySKool</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md p-8">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>

          {forgotMode ? (
            <div>
              {resetSent ? (
                <div className="text-center py-4 space-y-4">
                  <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">Check your email</h1>
                  <p className="text-sm text-muted-foreground">
                    We sent a password reset link to <strong className="text-foreground">{email}</strong>. Please check your inbox and click the link to choose a new password.
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
                  <h1 className="font-display text-2xl font-bold tracking-tight">Reset Password</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your registered email address and we'll send you a secure link to reset your password.
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
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Administrator Sign In</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your registered email address and password to manage your school portal.</p>
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
                <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5" />} Sign in to Dashboard</Button>
                <p className="text-xs text-muted-foreground text-center">New school? <Link to="/register" className="text-primary font-medium">Register your school portal</Link></p>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}