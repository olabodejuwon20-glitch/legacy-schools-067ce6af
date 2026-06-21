import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { publicEmail, publicInitials } from "@/lib/identity";

export default function ProfilePage() {
  const { user, school, activeRole, photoUrl, displayName, email, refreshProfile } = useSchool();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", address: "", gender: "", dob: "" });

  // Admin-only: school "General" info (mirrors Settings → General)
  const isAdmin = activeRole === "admin";
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [schoolForm, setSchoolForm] = useState({ name: "", email: "", phone: "", address: "", motto: "" });
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolSaving, setSchoolSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,phone,address,gender,dob").eq("id", user.id).maybeSingle()
      .then(({ data }) => data && setForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        address: data.address || "",
        gender: data.gender || "",
        dob: data.dob || "",
      }));
  }, [user]);

  useEffect(() => {
    if (!isAdmin || !school) return;
    supabase.from("schools").select("name,email,phone,address,motto,logo_url").eq("id", school.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setSchoolForm({
          name: data.name || "", email: data.email || "", phone: data.phone || "",
          address: data.address || "", motto: data.motto || "",
        });
        setSchoolLogo(data.logo_url || null);
      });
  }, [isAdmin, school?.id]);

  async function uploadPhoto(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("profiles").update({ photo_url: pub.publicUrl }).eq("id", user.id);
      if (dbErr) throw dbErr;
      await refreshProfile();
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploading(false); }
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, phone: form.phone, address: form.address,
      gender: form.gender || null, dob: form.dob || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved");
  }

  async function saveSchool() {
    if (!school) return;
    setSchoolSaving(true);
    const { error } = await supabase.from("schools").update(schoolForm).eq("id", school.id);
    setSchoolSaving(false);
    if (error) return toast.error(error.message);
    toast.success("School information saved");
  }

  async function uploadSchoolLogo(file: File) {
    if (!school) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${school.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("school-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("school-logos").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: dbErr } = await supabase.from("schools").update({ logo_url: url }).eq("id", school.id);
      if (dbErr) throw dbErr;
      setSchoolLogo(url);
      toast.success("School logo updated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setLogoUploading(false); }
  }

  const initials = publicInitials({ full_name: displayName, email });
  const cleanEmail = publicEmail(email);

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionCard title="Profile photo" description="Used across your portal and visible to your school">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative">
            <Avatar className="size-24 ring-2 ring-background border border-border">
              {photoUrl && <AvatarImage src={photoUrl} alt={displayName} />}
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 size-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md hover:opacity-90">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </div>
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            <div className="font-semibold text-foreground">{displayName || "Your name"}</div>
            {cleanEmail ? <div>{cleanEmail}</div> : form.phone ? <div>{form.phone}</div> : null}
            <p className="mt-2 text-xs">JPG or PNG, up to 5 MB. Click the camera icon to change.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Personal details">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" value={form.full_name} onChange={v => setForm({ ...form, full_name: v })} />
          <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
          <Field label="Gender" value={form.gender} onChange={v => setForm({ ...form, gender: v })} placeholder="Male / Female" />
          <Field label="Date of birth" type="date" value={form.dob} onChange={v => setForm({ ...form, dob: v })} />
          <div className="sm:col-span-2"><Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} /></div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}Save changes</Button>
        </div>
      </SectionCard>

      {isAdmin && school && (
        <SectionCard title="School information" description="Shown to staff, students and parents. This is the same data as Settings → General.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="School name" value={schoolForm.name} onChange={v => setSchoolForm({ ...schoolForm, name: v })} />
            <Field label="Email" type="email" value={schoolForm.email} onChange={v => setSchoolForm({ ...schoolForm, email: v })} />
            <Field label="Phone" value={schoolForm.phone} onChange={v => setSchoolForm({ ...schoolForm, phone: v })} />
            <Field label="Motto" value={schoolForm.motto} onChange={v => setSchoolForm({ ...schoolForm, motto: v })} />
            <div className="sm:col-span-2"><Field label="Address" value={schoolForm.address} onChange={v => setSchoolForm({ ...schoolForm, address: v })} /></div>
            <div className="sm:col-span-2">
              <Label className="text-xs">School logo</Label>
              <div className="mt-1.5 flex items-center gap-4">
                <div className="size-16 rounded-lg border border-border bg-muted/40 grid place-items-center overflow-hidden shrink-0">
                  {schoolLogo ? <img src={schoolLogo} alt="School logo" className="w-full h-full object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" />}
                </div>
                <input ref={logoFileRef} type="file" accept="image/*" hidden
                  onChange={e => e.target.files?.[0] && uploadSchoolLogo(e.target.files[0])} />
                <Button type="button" variant="outline" size="sm" onClick={() => logoFileRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
                  {schoolLogo ? "Replace logo" : "Upload logo"}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={saveSchool} disabled={schoolSaving}>
              {schoolSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              Save school info
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}