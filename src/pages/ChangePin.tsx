import { useState } from "react";
import { Loader2, KeyRound, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { schoolPath } from "@/lib/tenant";

export default function ChangePin() {
  const navigate = useNavigate();
  const { user, school, activeRole, refreshMemberships, signOut } = useSchool();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === "123456") return toast.error("Please create a unique 6-digit PIN, not the default sequence.");
    if (pin !== confirmPin) return toast.error("The two PINs do not match. Please verify and re-enter.");
    if (!/^\d{6}$/.test(pin)) return toast.error("Your security PIN must be exactly 6 digits.");
    if (!user || !school || !activeRole) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pin });
      if (error) throw error;
      const { error: mErr } = await supabase.from("memberships")
        .update({ must_change_pin: false })
        .eq("user_id", user.id).eq("school_id", school.id).eq("role", activeRole);
      if (mErr) throw mErr;
      await refreshMemberships();
      toast.success("Security PIN updated successfully! Welcome to your portal.");
      navigate(schoolPath(school.slug, "/app"), { replace: true });
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't update your security PIN. Please try again."));
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {school?.logo_url ? (
              <img src={school.logo_url} alt="" className="size-9 rounded-lg object-contain border border-border bg-card p-0.5" />
            ) : (
              <div className="grid place-items-center size-9 rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-5" /></div>
            )}
            <span className="font-display font-bold text-lg truncate">{school?.name ?? "School Portal"}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-6 py-12">
        <Card className="p-8">
          <h1 className="font-display text-2xl font-bold">Create your personal PIN</h1>
          <p className="text-sm text-muted-foreground mt-2">To protect your account and school records, please set a personal 6-digit security PIN before continuing.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>New 6-digit PIN</Label>
              <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="••••••" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} /></div>
            <div className="space-y-2"><Label>Confirm PIN</Label>
              <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="••••••" value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,""))} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-1.5"/>} Update Security PIN</Button>
          </form>
        </Card>
      </main>
    </div>
  );
}