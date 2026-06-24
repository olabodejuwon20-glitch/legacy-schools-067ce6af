import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, Mail, KeyRound, Building2, ArrowLeft, ShieldCheck } from "lucide-react";
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
        throw new Error("We couldn't sign you in with those details.");
      }
      toast.success("Welcome back");
      window.location.href = schoolPath(school!.slug, "/app");
    } catch (err) { toast.error(friendlyError(err, "We couldn't sign you in with those details.")); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <Card className="w-full max-w-md p-8">
        <Link to={schoolPath(school.slug, "")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <SchoolBadge name={school.name} logoUrl={school.logo_url} subtitle="Administrator portal" />
        <div className="flex justify-center mb-3 -mt-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-3" /> Admin only
        </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mb-2">{"\u00a0"}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2"><Label className="flex items-center gap-1.5"><Mail className="size-3.5"/>Email</Label>
            <Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>Password</Label>
            <PasswordInput required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5"/>}Sign in</Button>
        </form>
      </Card>
    </div>
  );
}