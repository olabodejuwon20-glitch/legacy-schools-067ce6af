import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Loader2, UserCircle2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool, ROLE_META } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { schoolPath } from "@/lib/tenant";

export default function Bio() {
  const navigate = useNavigate();
  const { user, school, activeRole, loading, schoolLoading, refreshMemberships, refreshProfile, displayName, signOut } = useSchool();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("File too large (max 5 MB)");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setUploading(false); }
  }

  async function removePhoto() {
    setPhotoUrl("");
    toast("Photo removed", { description: "Save to apply." });
  }

  // common
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  // role-specific
  const [gradeLevel, setGradeLevel] = useState("");
  const [parentContact, setParentContact] = useState("");
  const [subjects, setSubjects] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [occupation, setOccupation] = useState("");
  const [childrenNames, setChildrenNames] = useState("");

  useEffect(() => {
    if (loading || schoolLoading) return;
    if (!user) navigate(schoolPath(school?.slug, "/signin"), { replace: true });
    else if (!school || !activeRole) navigate("/", { replace: true });
  }, [user, school, activeRole, loading, schoolLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("phone,dob,gender,address,photo_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPhone(data.phone || ""); setDob(data.dob || ""); setGender(data.gender || "");
          setAddress(data.address || ""); setPhotoUrl(data.photo_url || "");
        }
      });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !school || !activeRole) return;
    setBusy(true);
    try {
      const { error: pErr } = await supabase.from("profiles").update({
        phone, dob: dob || null, gender, address, photo_url: photoUrl,
      }).eq("id", user.id);
      if (pErr) throw pErr;

      const profile_data: Record<string, unknown> = {};
      if (activeRole === "student") Object.assign(profile_data, { grade_level: gradeLevel, parent_contact: parentContact });
      if (activeRole === "teacher") Object.assign(profile_data, { subjects: subjects.split(",").map(s => s.trim()).filter(Boolean), qualifications });
      if (activeRole === "parent")  Object.assign(profile_data, { occupation, children_names: childrenNames.split(",").map(s => s.trim()).filter(Boolean) });

      const { error: mErr } = await supabase.from("memberships").update({
        bio_completed: true, profile_data: profile_data as any,
      }).eq("user_id", user.id).eq("school_id", school.id).eq("role", activeRole);
      if (mErr) throw mErr;

      await Promise.all([refreshMemberships(), refreshProfile()]);
      toast.success("Profile saved");
      navigate(schoolPath(school.slug, `/app/${activeRole}`), { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  if (loading || schoolLoading || !user || !school || !activeRole)
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Complete your profile — Legacyskool" description="Add your photo and details to finish setting up your account." path={`/${school.slug}/bio`} noindex />
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {school.logo_url ? (
              <img src={school.logo_url} alt="" className="size-9 rounded-lg object-contain border border-border bg-card p-0.5" />
            ) : (
              <div className="grid place-items-center size-9 rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-5" /></div>
            )}
            <div>
              <div className="font-display font-bold text-lg leading-none">{school.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1 capitalize">{activeRole} portal</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-10 rounded-xl grid place-items-center text-white" style={{ background: ROLE_META[activeRole].color }}>
            <UserCircle2 className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Complete your profile</h1>
            <p className="text-sm text-muted-foreground">This info will be used as your identification across {school.name}.</p>
          </div>
        </div>

        <Card className="p-6 mt-6">
          <form onSubmit={save} className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Personal details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full name</Label><Input value={displayName} disabled /></div>
                <div className="space-y-2"><Label>Phone</Label><Input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} /></div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Profile photo</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="size-20 border border-border">
                      {photoUrl && <AvatarImage src={photoUrl} alt={displayName} />}
                      <AvatarFallback style={{ background: ROLE_META[activeRole].color, color: "white" }} className="text-lg font-semibold">
                        {(displayName || "U").split(/\s+/).map(s => s[0]).slice(0,2).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex">
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onPickPhoto} />
                        <Button asChild size="sm" variant="outline" disabled={uploading}>
                          <span>{uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {photoUrl ? "Replace photo" : "Upload photo"}</span>
                        </Button>
                      </label>
                      {photoUrl && (
                        <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={removePhoto} disabled={uploading}>
                          <Trash2 className="size-3.5" /> Remove
                        </Button>
                      )}
                      <p className="text-[11px] text-muted-foreground">PNG, JPG or WebP · up to 5 MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {activeRole === "student" && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Student details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Class / grade</Label><Input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} placeholder="e.g. JHS 2 / Grade 8" /></div>
                  <div className="space-y-2"><Label>Parent contact</Label><Input value={parentContact} onChange={e => setParentContact(e.target.value)} placeholder="Phone or email" /></div>
                </div>
              </section>
            )}
            {activeRole === "teacher" && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Teacher details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Subjects (comma separated)</Label><Input value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="Math, Physics" /></div>
                  <div className="space-y-2"><Label>Qualifications</Label><Input value={qualifications} onChange={e => setQualifications(e.target.value)} placeholder="B.Ed Mathematics" /></div>
                </div>
              </section>
            )}
            {activeRole === "parent" && (
              <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parent details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Occupation</Label><Input value={occupation} onChange={e => setOccupation(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Children names (comma separated)</Label><Input value={childrenNames} onChange={e => setChildrenNames(e.target.value)} /></div>
                </div>
              </section>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save and continue
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
