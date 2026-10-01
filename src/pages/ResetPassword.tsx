import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { friendlyError } from "@/lib/errors";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if recovery session is active
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please verify.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setIsSuccess(true);
      toast.success("Password updated successfully!");
      // Sign out from recovery session so user can log in cleanly
      await supabase.auth.signOut().catch(() => {});
      setTimeout(() => {
        navigate("/signin", { replace: true });
      }, 2500);
    } catch (err: any) {
      toast.error(friendlyError(err, "We couldn't reset your password. The link may have expired. Please request a new one."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <SEO
        title="Reset Password — LegacySKool"
        description="Set a new password for your LegacySKool account."
        path="/reset-password"
      />
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[hsl(var(--admin))] via-[hsl(var(--student))] to-[hsl(var(--teacher))] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <Link to="/" className="relative flex items-center gap-3 w-fit">
          <div className="grid place-items-center size-11 rounded-xl bg-white/20 backdrop-blur"><GraduationCap className="size-6" /></div>
          <div><div className="font-display font-bold text-xl leading-none">LegacySKool</div><div className="text-xs opacity-80 mt-1">School Management Platform</div></div>
        </Link>
        <div className="relative space-y-4 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">Create a new password</h2>
          <p className="text-white/85">Choose a secure, strong password to protect your LegacySKool portal account.</p>
        </div>
        <div className="relative text-xs opacity-70">© {new Date().getFullYear()} LegacySKool</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md p-8">
          <Link to="/signin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="size-3.5" /> Back to sign in
          </Link>

          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-6" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Password Reset Complete</h1>
              <p className="text-sm text-muted-foreground">
                Your password has been securely updated. Redirecting you to the sign in page...
              </p>
              <Button asChild className="w-full mt-4">
                <Link to="/signin">Sign In Now</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight">Set New Password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your new password below. Make sure it is at least 6 characters long.
              </p>

              {hasSession === false && (
                <div className="bg-amber-50 text-amber-800 border border-amber-200 text-xs p-3 rounded-lg mt-4">
                  Note: If your reset link has expired or is invalid, you will need to request a new link from the sign in page.
                </div>
              )}

              <form onSubmit={handleReset} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>New Password</Label>
                  <PasswordInput
                    required
                    minLength={6}
                    placeholder="Enter new password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>Confirm New Password</Label>
                  <PasswordInput
                    required
                    minLength={6}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin mr-1.5" />}
                  Update Password
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
