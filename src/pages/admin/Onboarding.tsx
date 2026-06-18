import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Loader2, Plus, School as SchoolIcon, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpTip } from "@/components/HelpTip";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL, waLink } from "@/lib/contact";
import { Mail, MessageCircle, HelpCircle } from "lucide-react";

type Step = 0 | 1;

const SUGGESTED_CLASSES = [
  "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3",
];
const SUGGESTED_SUBJECTS = [
  "Mathematics", "English Language", "Civic Education", "Basic Science",
  "Physics", "Chemistry", "Biology", "Economics", "Government", "Literature",
];

export default function AdminOnboarding() {
  const { school, refreshMemberships, refreshSchool } = useSchool();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — profile
  const [profile, setProfile] = useState({
    name: "", motto: "", address: "", phone: "", email: "",
    current_session: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
    current_term: "First Term",
    logo_url: "" as string | null,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Step 2 — classes & subjects
  const [selectedClasses, setSelectedClasses] = useState<string[]>(["JSS 1", "JSS 2", "JSS 3"]);
  const [customClass, setCustomClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(["Mathematics", "English Language"]);
  const [customSubject, setCustomSubject] = useState("");

  useEffect(() => {
    if (!school) return;
    supabase.from("schools").select("name,motto,address,phone,email,current_session,current_term,logo_url").eq("id", school.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setProfile(p => ({
          ...p,
          name: data.name ?? p.name,
          motto: data.motto ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          current_session: data.current_session ?? p.current_session,
          current_term: data.current_term ?? p.current_term,
          logo_url: data.logo_url ?? null,
        }));
      });
  }, [school?.id]);

  function saveProfile() {
    if (!profile.name.trim()) return toast.error("Enter your school name");
    setStep(1);
  }

  async function saveClassesAndFinish() {
    if (!school) return;
    if (selectedClasses.length === 0) return toast.error("Add at least one class");
    if (saving) return;
    setSaving(true);
    try {
      let logo_url = profile.logo_url;
      if (logoFile) {
        const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
        const path = `${school.id}/logo-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("school-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type || undefined });
        if (upErr) {
          console.warn("[onboarding] logo upload failed", upErr);
          toast.warning("We couldn't upload the logo right now — you can add it later from Settings.");
        } else {
          const { data: pub } = supabase.storage.from("school-logos").getPublicUrl(path);
          logo_url = pub.publicUrl;
        }
      }

      const seen = new Set<string>();
      const rows = selectedClasses
        .map((name) => name.trim())
        .filter((name) => {
          const key = name.toLowerCase();
          if (!name || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((name, i) => ({
          name,
          code: name.replace(/\s+/g, "").toUpperCase() + "-" + (i + 1),
          grade_level: name,
          subject: selectedSubjects.map(s => s.trim()).filter(Boolean).join(", ") || null,
        }));

      const { error } = await (supabase as any).rpc("complete_admin_onboarding", {
        _school_id: school.id,
        _profile: { ...profile, name: profile.name.trim(), logo_url },
        _classes: rows,
        _default_subjects: selectedSubjects.map(s => s.trim()).filter(Boolean),
      });
      if (error) throw error;
      try { sessionStorage.setItem(`onboarding-complete:${school.id}`, "1"); } catch {}
      await refreshMemberships();
      await refreshSchool();
      toast.success("Setup complete — welcome aboard!");
      nav(schoolPath(school.slug, "/app/admin"), { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not finish setup");
    } finally { setSaving(false); }
  }

  if (!school) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Stepper step={step} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SchoolIcon className="size-5 text-primary" /> School profile</CardTitle>
            <CardDescription>This appears on result slips, invoices and the parent/student portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="School name" tip="The official name shown on result slips.">
                <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
              </Field>
              <Field label="Motto" tip="Optional school motto printed under the name.">
                <Input value={profile.motto} onChange={e => setProfile({ ...profile, motto: e.target.value })} />
              </Field>
              <Field label="Phone"><Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></Field>
              <Field label="Contact email"><Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} /></Field>
              <Field label="Current session" tip="e.g. 2026/2027 — used as default on reports.">
                <Input value={profile.current_session} onChange={e => setProfile({ ...profile, current_session: e.target.value })} />
              </Field>
              <Field label="Current term">
                <Select value={profile.current_term} onValueChange={v => setProfile({ ...profile, current_term: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Term">First Term</SelectItem>
                    <SelectItem value="Second Term">Second Term</SelectItem>
                    <SelectItem value="Third Term">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Address">
              <Textarea rows={2} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
            </Field>
            <Field label="School logo" tip="Square PNG/JPG works best. Shown on reports and portal header.">
              <div className="flex items-center gap-3">
                {profile.logo_url && <img src={profile.logo_url} alt="logo" className="size-12 rounded border object-cover" />}
                <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={saveProfile} disabled={saving || !profile.name.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Continue <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" /> Classes & subjects</CardTitle>
            <CardDescription>Pick the levels you run and your core subjects. You can edit them anytime later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Chips
              title="Classes / Levels"
              tip="These become the class records students can be enrolled into."
              options={SUGGESTED_CLASSES}
              selected={selectedClasses}
              onToggle={(v) => setSelectedClasses(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v])}
              custom={customClass}
              setCustom={setCustomClass}
              onAddCustom={() => {
                const v = customClass.trim(); if (!v) return;
                if (!selectedClasses.includes(v)) setSelectedClasses([...selectedClasses, v]);
                setCustomClass("");
              }}
              onRemove={(v) => setSelectedClasses(selectedClasses.filter(x => x !== v))}
            />
            <Chips
              title="Core subjects"
              tip="Suggested subjects to attach to each new class. You can manage subjects per class later."
              options={SUGGESTED_SUBJECTS}
              selected={selectedSubjects}
              onToggle={(v) => setSelectedSubjects(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v])}
              custom={customSubject}
              setCustom={setCustomSubject}
              onAddCustom={() => {
                const v = customSubject.trim(); if (!v) return;
                if (!selectedSubjects.includes(v)) setSelectedSubjects([...selectedSubjects, v]);
                setCustomSubject("");
              }}
              onRemove={(v) => setSelectedSubjects(selectedSubjects.filter(x => x !== v))}
            />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={saveClassesAndFinish} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Finish setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HelpCircle className="size-4 text-primary" /> Need a hand with setup?
        </div>
        <div className="text-xs text-muted-foreground flex-1">Our onboarding team is on standby — usually replies within 4 working hours.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Onboarding help")}`}><Mail className="size-3.5 mr-1.5" /> Email</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={waLink("Hi, I need help with school onboarding on Legacyskool.")} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-3.5 mr-1.5" /> WhatsApp</a>
          </Button>
        </div>
      </div>

    </div>
  );
}

function Field({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">{label}{tip && <HelpTip text={tip} />}</Label>
      {children}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items = ["School profile", "Classes & subjects", "Done"];
  return (
    <div className="flex items-center gap-2">
      {items.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className={cn(
            "size-7 rounded-full grid place-items-center text-xs font-medium border",
            i < step && "bg-primary text-primary-foreground border-primary",
            i === step && "bg-primary/10 text-primary border-primary",
            i > step && "bg-muted text-muted-foreground",
          )}>
            {i < step ? <Check className="size-4" /> : i + 1}
          </div>
          <div className={cn("text-sm", i === step ? "font-medium" : "text-muted-foreground")}>{label}</div>
          {i < items.length - 1 && <div className="flex-1 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

function Chips(props: {
  title: string; tip?: string; options: string[]; selected: string[];
  onToggle: (v: string) => void; onRemove: (v: string) => void;
  custom: string; setCustom: (v: string) => void; onAddCustom: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">{props.title}{props.tip && <HelpTip text={props.tip} />}</Label>
      <div className="flex flex-wrap gap-2">
        {props.options.map(opt => {
          const on = props.selected.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => props.onToggle(opt)}
              className={cn("px-3 py-1.5 rounded-full text-sm border transition",
                on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted")}>
              {opt}
            </button>
          );
        })}
      </div>
      {props.selected.filter(s => !props.options.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {props.selected.filter(s => !props.options.includes(s)).map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-primary text-primary-foreground">
              {s}
              <button type="button" onClick={() => props.onRemove(s)} className="opacity-80 hover:opacity-100"><Trash2 className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Input placeholder={`Add custom ${props.title.toLowerCase()}…`} value={props.custom}
          onChange={e => props.setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); props.onAddCustom(); } }} />
        <Button type="button" variant="outline" onClick={props.onAddCustom}><Plus className="size-4" /></Button>
      </div>
    </div>
  );
}

function NextStep({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 text-left">
      <span className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}