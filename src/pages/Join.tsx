import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, Loader2, User, Phone, KeyRound, Hash, Users2, BookOpen, Briefcase, Heart, Shield, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { schoolPath } from "@/lib/tenant";
import { friendlyError, friendlyInvokeError } from "@/lib/errors";
import { SchoolBadge } from "@/components/SchoolBadge";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

type Step = "role" | "code" | "details";

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { school, schoolLoading } = useSchool();
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [code, setCode] = useState(params.get("code")?.toUpperCase() || "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [chosenRole, setChosenRole] = useState<string | null>(params.get("role"));
  const [customRoles, setCustomRoles] = useState<{ key: string; label: string; base_role: string }[]>([]);
  const [enabledRoles, setEnabledRoles] = useState<Record<string, boolean>>({});
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [step, setStep] = useState<Step>(params.get("role") ? "code" : "role");

  useEffect(() => { if (!schoolLoading && !school) navigate("/", { replace: true }); }, [school, schoolLoading, navigate]);

  useEffect(() => {
    if (!school?.id) return;
    supabase.from("schools").select("settings").eq("id", school.id).maybeSingle()
      .then(({ data }) => {
        const s = (data?.settings as any) ?? {};
        setEnabledRoles((s.onboarding?.enabled_roles ?? { student: true, teacher: true, parent: true, driver: true, staff: true }));
        setWelcomeMessage(s.identity?.welcome_message ?? "");
      });
    supabase.rpc("get_school_custom_roles", { _school_id: school.id })
      .then(({ data }) => setCustomRoles((data ?? []) as any));
  }, [school?.id]);

  const roleOptions = useMemo(() => {
    const base = [
      { key: "student", label: "Student",     icon: Users2,    desc: "I'm a learner at this school" },
      { key: "parent",  label: "Parent",      icon: Heart,     desc: "I'm a parent or guardian" },
      { key: "teacher", label: "Teacher",     icon: BookOpen,  desc: "I teach classes here" },
      { key: "staff",   label: "Other staff", icon: Briefcase, desc: "Non-teaching staff (driver, bursar, etc.)" },
      { key: "admin",   label: "Admin",       icon: Shield,    desc: "School leadership / management" },
    ].filter((r) => enabledRoles[r.key] !== false);
    return [
      ...base,
      ...customRoles.map((r) => ({ key: r.key, label: r.label, icon: Briefcase, desc: "Custom school role" })),
    ];
  }, [enabledRoles, customRoles]);

  const chosenLabel = useMemo(
    () => roleOptions.find((r) => r.key === chosenRole)?.label ?? chosenRole ?? "",
    [roleOptions, chosenRole],
  );

  async function verifyCode() {
    if (!code.trim()) return toast.error("Enter your activation code");
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("join-with-code", {
        body: { preview: true, code, schoolSlug: school?.slug },
      });
      if (error) throw new Error(await friendlyInvokeError(error, "We couldn't verify that code."));
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Code verified — let's set up your profile");
      setStep("details");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't verify that code. Please check and try again."));
    } finally { setVerifying(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== confirmPin) return toast.error("PINs don't match");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("join-with-code", {
        body: {
          code, fullName, phone, pin,
          schoolSlug: school?.slug,
          bio: { gender, dob: dob || null, address, photo_url: null, profile_data: {} },
        },
      });
      if (error) throw new Error(await friendlyInvokeError(error, "We couldn't process your onboarding code. Please check and try again."));
      if ((data as any)?.error) throw new Error((data as any).error);
      const email = (data as any).email as string;
      const slug = (data as any).schoolSlug as string;
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (sErr) throw sErr;
      toast.success("Welcome to your school");
      window.location.href = schoolPath(slug, "/app");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't complete your sign-up. Please try again."));
    } finally { setBusy(false); }
  }

  if (schoolLoading || !school) return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt schoolName={school.name} />
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link to={schoolPath(school.slug, "")} className="flex items-center gap-2">
            {school.logo_url ? <img src={school.logo_url} alt="" className="size-9 rounded-lg object-contain border border-border bg-card p-0.5" /> :
              <div className="grid place-items-center size-9 rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-5" /></div>}
            <div><div className="font-display font-bold text-lg leading-none">{school.name}</div><div className="text-[11px] text-muted-foreground mt-1">School portal</div></div>
          </Link>
          <Link to={schoolPath(school.slug, "/signin")} className="text-sm text-muted-foreground hover:text-foreground">Already a member? Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <SchoolBadge name={school.name} logoUrl={school.logo_url} subtitle={welcomeMessage || "Set up your account — one time only"} />

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground mb-4">
          {(["role", "code", "details"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`size-6 grid place-items-center rounded-full border ${step === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{i + 1}</span>
              <span className={step === s ? "text-foreground font-medium" : ""}>{s === "role" ? "Role" : s === "code" ? "Activation" : "Profile"}</span>
              {i < 2 && <span className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === "role" ? (
          <Card className="mt-6 p-6">
            <div className="text-sm font-semibold mb-1">Who are you joining as?</div>
            <p className="text-xs text-muted-foreground mb-4">Pick the role your school assigned to you.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {roleOptions.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => { setChosenRole(key); setStep("code"); }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition text-left">
                  <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center"><Icon className="size-5" /></div>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-[11px] text-muted-foreground">{(roleOptions.find(r=>r.key===key) as any).desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ) : step === "code" ? (
          <Card className="mt-6 p-6">
            <button type="button" onClick={() => setStep("role")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
              <ArrowLeft className="size-3" /> Change role
            </button>
            <div className="text-sm font-semibold mb-1">Enter your activation code</div>
            <p className="text-xs text-muted-foreground mb-4">
              Joining as <span className="font-medium capitalize text-foreground">{chosenLabel}</span>. Use the 6-character code your school shared with you.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); verifyCode(); }} className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Hash className="size-3.5" />Activation code</Label>
                <Input
                  required autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD"
                  className="text-base tracking-widest uppercase"
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifying}>
                {verifying && <Loader2 className="size-4 animate-spin mr-2" />} Verify code
              </Button>
            </form>
          </Card>
        ) : (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              <span>Joining as <span className="font-semibold capitalize">{chosenLabel}</span></span>
            </div>
            <button type="button" onClick={() => setStep("code")} className="text-xs text-muted-foreground hover:text-foreground underline">
              Re-enter code
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><User className="size-3.5"/>Full name</Label>
              <Input required value={fullName} onChange={e=>setFullName(e.target.value)} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Phone className="size-3.5"/>Phone number</Label>
              <Input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+233 555 000 000" /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="flex items-center gap-1.5"><KeyRound className="size-3.5"/>6-digit PIN</Label>
                <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} /></div>
              <div className="space-y-2"><Label>Confirm PIN</Label>
                <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,""))} /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Date of birth</Label><Input required type="date" value={dob} onChange={e=>setDob(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea required value={address} onChange={e=>setAddress(e.target.value)} rows={2} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-2"/>} Join school</Button>
          </form>
        </Card>
        )}
      </main>
    </div>
  );
}