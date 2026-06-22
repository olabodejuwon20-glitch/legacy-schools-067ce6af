import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, Building2, User, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getCurrentSchoolSlug, schoolPath, buildSchoolUrl } from "@/lib/tenant";
import SEO from "@/components/SEO";
import { friendlyError, friendlyInvokeError } from "@/lib/errors";

export default function Register() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => { if (getCurrentSchoolSlug()) navigate("/", { replace: true }); }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-school", {
        body: { schoolName, fullName, email, password },
      });
      if (error) throw new Error(await friendlyInvokeError(error, "We couldn't register your school. Please try again."));
      if ((data as any)?.error) throw new Error((data as any).error);
      const slug = (data as any).slug as string;
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) throw sErr;
      toast.success(`School created — ${buildSchoolUrl(slug, "")}`);
      window.location.href = schoolPath(slug, "/onboarding");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't register your school. Please try again."));
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <SEO
        title="Register Your School — Legacyskool"
        description="Create your Legacyskool school account in minutes — get a dedicated portal for admins, teachers, students and parents."
        path="/register"
      />
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[hsl(var(--admin))] via-[hsl(var(--student))] to-[hsl(var(--teacher))] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <Link to="/" className="relative flex items-center gap-3 w-fit">
          <div className="grid place-items-center size-11 rounded-xl bg-white/20 backdrop-blur"><GraduationCap className="size-6" /></div>
          <div><div className="font-display font-bold text-xl leading-none">Legacyskool</div><div className="text-xs opacity-80 mt-1">School Management Platform</div></div>
        </Link>
        <div className="relative space-y-4 max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">Launch your school portal</h2>
          <p className="text-white/85">Set up your school in minutes and invite everyone with a single link.</p>
        </div>
        <div className="relative text-xs opacity-70">© 2026 Legacyskool</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md p-8">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">Create your school</h1>
          <p className="text-sm text-muted-foreground mt-1">You'll be set as the school admin.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Building2 className="size-3.5"/>School name</Label>
              <Input required value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder="Greenfield Academy" /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><User className="size-3.5"/>Your full name</Label>
              <Input required value={fullName} onChange={e=>setFullName(e.target.value)} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Mail className="size-3.5"/>Email</Label>
              <Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>Password</Label>
              <PasswordInput required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5" />} Register school</Button>
            <p className="text-xs text-muted-foreground text-center">Already have a school? <Link to="/signin" className="text-primary font-medium">Sign in</Link></p>
          </form>
        </Card>
      </div>
    </div>
  );
}