import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, Phone, KeyRound, Building2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { schoolPath, buildSchoolUrl } from "@/lib/tenant";
import { SchoolBadge } from "@/components/SchoolBadge";
import { friendlyError, friendlyInvokeError } from "@/lib/errors";

/** /:slug/signin — returning members (student/teacher/parent): phone + 6-digit PIN. */
export default function SchoolLogin() {
  const navigate = useNavigate();
  const { session, loading, school, schoolLoading, memberships } = useSchool();
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!session || !school) return;
    if (memberships.find(m => m.school_id === school.id)) navigate(schoolPath(school.slug, "/app"), { replace: true });
  }, [session, school, memberships, navigate]);

  if (loading || schoolLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!school) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-auth", {
        body: { phone, schoolSlug: school!.slug },
      });
      if (error) throw new Error(await friendlyInvokeError(error, "We couldn't sign you in. Please try again."));
      if ((data as any)?.error) throw new Error((data as any).error);
      const email = (data as any).email as string;
      const mustChange = !!(data as any).mustChangePin;
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (sErr) throw new Error("We couldn't sign you in with those details.");
      toast.success("Welcome");
      window.location.href = schoolPath(school!.slug, mustChange ? "/change-pin" : "/app");
    } catch (err) { toast.error(friendlyError(err, "We couldn't sign you in. Please try again.")); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <Card className="w-full max-w-md p-8">
        <Link to={schoolPath(school.slug, "")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <SchoolBadge name={school.name} logoUrl={school.logo_url} subtitle="Sign in to your portal" />
        <p className="text-sm text-muted-foreground text-center -mt-3 mb-2">{"\u00a0"}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2"><Label className="flex items-center gap-1.5"><Phone className="size-3.5"/>Phone number</Label>
            <Input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+233 555 000 000" /></div>
          <div className="space-y-2"><Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>6-digit PIN</Label>
            <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="••••••" />
            <p className="text-[11px] text-muted-foreground">{"\u00a0"}</p></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5"/>}Sign in</Button>
          <p className="text-xs text-muted-foreground text-center">First time?{" "}
            <Link to={schoolPath(school.slug, "/join")} className="text-primary font-medium">Use your onboarding code</Link></p>
        </form>
      </Card>
    </div>
  );
}