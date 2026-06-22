import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, Mail, KeyRound, ArrowLeft, Building2 } from "lucide-react";
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
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signed.user!.id;
      const { data: m } = await supabase.from("memberships")
        .select("school_id, role, schools(slug)")
        .eq("user_id", uid).eq("role", "admin").eq("status", "active").maybeSingle();
      if (!m) {
        await supabase.auth.signOut();
        throw new Error("We couldn't sign you in with those details.");
      }
      const slug = (m as any).schools?.slug as string;
      toast.success("Welcome back");
      window.location.href = schoolPath(slug, "/app");
    } catch (err) { toast.error(friendlyError(err, "We couldn't sign you in with those details.")); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <SEO
        title="Admin Sign In — Legacyskool"
        description="Sign in to your Legacyskool admin portal to manage classes, staff, students and results."
        path="/signin"
      />
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[hsl(var(--admin))] via-[hsl(var(--student))] to-[hsl(var(--teacher))] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <Link to="/" className="relative flex items-center gap-3 w-fit">
          <div className="grid place-items-center size-11 rounded-xl bg-white/20 backdrop-blur"><GraduationCap className="size-6" /></div>
          <div><div className="font-display font-bold text-xl leading-none">Legacyskool</div><div className="text-xs opacity-80 mt-1">School Management Platform</div></div>
        </Link>
        <div className="relative space-y-4 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">Welcome back, Admin</h2>
          <p className="text-white/85">Sign in to manage your school portal.</p>
          <div className="text-xs text-white/70 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur">
            <Building2 className="size-3.5" /> Admins only — staff & students sign in from their school URL.
          </div>
        </div>
        <div className="relative text-xs opacity-70">© 2026 Legacyskool</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md p-8">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">Admin sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Use the email and password you registered with.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Mail className="size-3.5"/>Email</Label>
              <Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>Password</Label>
              <PasswordInput required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5" />} Sign in</Button>
            <p className="text-xs text-muted-foreground text-center">New school? <Link to="/register" className="text-primary font-medium">Register here</Link></p>
          </form>
        </Card>
      </div>
    </div>
  );
}