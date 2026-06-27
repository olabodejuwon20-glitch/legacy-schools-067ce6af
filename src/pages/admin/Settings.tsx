import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { buildSchoolUrl } from "@/lib/tenant";
import { Copy, Upload, Loader2, Image as ImageIcon, Plus, Trash2, Eye, Download, HelpCircle, BookOpen, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { schoolPath } from "@/lib/tenant";
import { GradingWeightsCard } from "@/components/admin/GradingWeightsCard";
import { PilotDetailsCard } from "@/components/pilot/PilotDetailsCard";
import { openPremiumReportCard, DEFAULT_REPORT_THEME, type ReportTheme } from "@/lib/reportCard";

export default function AdminSettings() {
  const { school } = useSchool();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [info, setInfo] = useState({ name: "", email: "", phone: "", address: "", motto: "" });
  const [academic, setAcademic] = useState({ current_session: "", current_term: "", grading_system: "", resumption_date: "" });
  const [exam, setExam] = useState({ exams_violation_limit: 3, proctoring_default: false });
  const [necoCodes, setNecoCodes] = useState<{ subject: string; code: string }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: any[]; total: number } | null>(null);
  const [necoBusy, setNecoBusy] = useState(false);
  const [theme, setTheme] = useState<Required<ReportTheme>>(DEFAULT_REPORT_THEME);
  const [savingTheme, setSavingTheme] = useState(false);
  const [appInstall, setAppInstall] = useState({ display_name: "", short_name: "", short_description: "" });
  const [savingAppInstall, setSavingAppInstall] = useState(false);

  useEffect(() => {
    if (!school) return;
    supabase.from("schools").select("name,email,phone,address,motto,logo_url,current_session,current_term,grading_system,resumption_date,exams_violation_limit,proctoring_default,neco_subject_codes,report_theme,settings").eq("id", school.id).single()
      .then(({ data }) => {
        if (!data) return;
        setInfo({ name: data.name, email: data.email ?? "", phone: data.phone ?? "", address: data.address ?? "", motto: data.motto ?? "" });
        setAcademic({
          current_session: data.current_session ?? "",
          current_term: data.current_term ?? "",
          grading_system: data.grading_system ?? "",
          resumption_date: data.resumption_date ?? "",
        });
        setLogoUrl(data.logo_url ?? null);
        setExam({ exams_violation_limit: data.exams_violation_limit ?? 3, proctoring_default: data.proctoring_default ?? false });
        const codes = (data.neco_subject_codes as Record<string, string>) ?? {};
        setNecoCodes(Object.entries(codes).map(([subject, code]) => ({ subject, code })));
        const rt = ((data as any).report_theme ?? {}) as ReportTheme;
        setTheme({
          primary: rt.primary ?? DEFAULT_REPORT_THEME.primary,
          accent: rt.accent ?? DEFAULT_REPORT_THEME.accent,
          gradientFrom: rt.gradientFrom ?? DEFAULT_REPORT_THEME.gradientFrom,
          gradientTo: rt.gradientTo ?? DEFAULT_REPORT_THEME.gradientTo,
        });
        const ai = (((data as any).settings ?? {}).app_install ?? {}) as any;
        setAppInstall({
          display_name: ai.display_name ?? "",
          short_name: ai.short_name ?? "",
          short_description: ai.short_description ?? "",
        });
      });
  }, [school]);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    const { error } = await supabase.from("schools").update(info).eq("id", school.id);
    if (error) toast.error(error.message); else toast.success("School information saved");
  }

  async function saveAcademic(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    const payload = { ...academic, resumption_date: academic.resumption_date || null };
    const { error } = await supabase.from("schools").update(payload).eq("id", school.id);
    if (error) toast.error(error.message); else toast.success("Academic settings saved");
  }

  async function saveExamSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!school) return;
    const codes = Object.fromEntries(necoCodes.filter(c => c.subject.trim()).map(c => [c.subject.trim(), c.code.trim()]));
    const { error } = await supabase.from("schools").update({
      exams_violation_limit: Number(exam.exams_violation_limit) || 3,
      proctoring_default: exam.proctoring_default,
      neco_subject_codes: codes,
    }).eq("id", school.id);
    if (error) toast.error(error.message); else toast.success("Exam & NECO settings saved");
  }

  async function callNeco(preview: boolean) {
    if (!school) return;
    setNecoBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("neco-export", { body: { school_id: school.id, preview } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (preview) {
        setPreviewData(data as any);
        setPreviewOpen(true);
      } else {
        const { csv, filename } = data as { csv: string; filename: string };
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("NECO CSV downloaded");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally { setNecoBusy(false); }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !school) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${school.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("school-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("school-logos").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase.from("schools").update({ logo_url: url }).eq("id", school.id);
      if (updErr) throw updErr;
      setLogoUrl(url);
      toast.success("Logo updated — it will appear on your portal login page");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveBranding() {
    if (!school || savingTheme) return;
    setSavingTheme(true);
    const { error } = await supabase.from("schools").update({
      motto: info.motto,
      report_theme: theme as any,
    }).eq("id", school.id);
    setSavingTheme(false);
    if (error) toast.error("Could not save branding. Please try again.");
    else toast.success("Report card branding saved");
  }

  async function saveAppInstall() {
    if (!school || savingAppInstall) return;
    setSavingAppInstall(true);
    try {
      const { data: row } = await supabase.from("schools").select("settings").eq("id", school.id).maybeSingle();
      const current = ((row?.settings ?? {}) as any);
      const next = {
        ...current,
        app_install: {
          display_name: appInstall.display_name.trim(),
          short_name: appInstall.short_name.trim(),
          short_description: appInstall.short_description.trim(),
        },
      };
      const { error } = await supabase.from("schools").update({ settings: next as any }).eq("id", school.id);
      if (error) throw error;
      toast.success("App install settings saved");
    } catch {
      toast.error("Could not save app install settings. Please try again.");
    } finally {
      setSavingAppInstall(false);
    }
  }

  function previewReportCard() {
    if (!school) return;
    openPremiumReportCard({
      schoolName: info.name || school.name,
      schoolMotto: info.motto || null,
      schoolLogo: logoUrl,
      schoolAddress: info.address || null,
      theme,
      term: `${academic.current_term || "Term"} · ${academic.current_session || "Session"}`,
      studentName: "Sample Student",
      studentClass: "JSS 2 A",
      admissionNo: "ADM/000/SAMPLE",
      subjects: [
        { subject: "Mathematics", ca1: 18, ca2: 17, exam: 55, total: 90, grade: "A1", position: 1, remark: "Excellent" },
        { subject: "English Language", ca1: 15, ca2: 16, exam: 48, total: 79, grade: "B2", position: 4, remark: "Very Good" },
        { subject: "Basic Science", ca1: 14, ca2: 13, exam: 44, total: 71, grade: "B3", position: 6, remark: "Good" },
      ],
      attendance: { present: 58, absent: 2, total: 60 },
      overallPercentage: 80,
      overallGrade: "A1",
      classPosition: 2,
      teacherComment: "A focused and consistent student.",
      principalComment: "Keep up the excellent work.",
    });
  }

  const THEME_PRESETS: { name: string; theme: Required<ReportTheme> }[] = [
    { name: "Royal Blue",   theme: DEFAULT_REPORT_THEME },
    { name: "Forest Green", theme: { primary: "#166534", accent: "#22c55e", gradientFrom: "#052e16", gradientTo: "#22c55e" } },
    { name: "Crimson",      theme: { primary: "#991b1b", accent: "#ef4444", gradientFrom: "#450a0a", gradientTo: "#ef4444" } },
    { name: "Royal Purple", theme: { primary: "#5b21b6", accent: "#8b5cf6", gradientFrom: "#2e1065", gradientTo: "#8b5cf6" } },
    { name: "Gold & Black", theme: { primary: "#1f2937", accent: "#d4a017", gradientFrom: "#000000", gradientTo: "#d4a017" } },
    { name: "Teal",         theme: { primary: "#115e59", accent: "#14b8a6", gradientFrom: "#042f2e", gradientTo: "#14b8a6" } },
  ];

  return (
    <div className="space-y-6">
      {school && (
        <div className="p-4 rounded-xl border border-border bg-muted/40">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Your school portal URL</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-background border border-border font-mono text-sm break-all">
              {buildSchoolUrl(school.slug, "")}
            </code>
            <Button type="button" variant="outline" size="sm"
              onClick={() => { navigator.clipboard.writeText(buildSchoolUrl(school.slug, "")); toast.success("Copied"); }}>
              <Copy className="size-3.5 mr-1" /> Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Share this link with your students, teachers and parents. Onboarding codes only work on this URL.
          </p>
        </div>
      )}

      <Tabs defaultValue="academic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="branding">Report Card</TabsTrigger>
          <TabsTrigger value="neco">Exams & NECO</TabsTrigger>
          <TabsTrigger value="pilot">Pilot</TabsTrigger>
          <TabsTrigger value="help">Help & Guide</TabsTrigger>
        </TabsList>

        {/* General school info now lives on the admin Profile page so the admin
            sees the same fields in one place. Edit it from My Profile. */}

        <TabsContent value="academic">
          <SectionCard title="Academic Settings">
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={saveAcademic}>
          <div><Label>Current Session</Label><Input value={academic.current_session} onChange={e => setAcademic({ ...academic, current_session: e.target.value })} placeholder="2024/2025" /></div>
          <div><Label>Current Term</Label><Input value={academic.current_term} onChange={e => setAcademic({ ...academic, current_term: e.target.value })} placeholder="Term 1" /></div>
          <div><Label>Grading System</Label><Input value={academic.grading_system} onChange={e => setAcademic({ ...academic, grading_system: e.target.value })} placeholder="A-F" /></div>
          <div><Label>Resumption Date</Label><Input type="date" value={academic.resumption_date} onChange={e => setAcademic({ ...academic, resumption_date: e.target.value })} /></div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Save changes</Button></div>
        </form>
          </SectionCard>
          <GradingWeightsCard />
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <SectionCard
            title="Report Card branding"
            description="Your logo, motto and colours appear on every student report card PDF."
          >
            <div className="grid md:grid-cols-2 gap-6">
              {/* Logo + motto */}
              <div className="space-y-4">
                <div>
                  <Label>School logo</Label>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="size-16 rounded-lg border border-border bg-muted/40 grid place-items-center overflow-hidden shrink-0">
                      {logoUrl
                        ? <img src={logoUrl} alt="logo" className="size-full object-contain" />
                        : <ImageIcon className="size-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
                        {logoUrl ? "Replace logo" : "Upload logo"}
                      </Button>
                      <p className="text-[11px] text-muted-foreground mt-1">PNG / JPG / SVG. Max 2 MB. Square works best.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>School motto</Label>
                  <Input
                    value={info.motto}
                    onChange={e => setInfo({ ...info, motto: e.target.value })}
                    placeholder="e.g. Knowledge, Character, Service"
                    maxLength={120}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Printed under the school name on the report card.</p>
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-4">
                <div>
                  <Label>Colour presets</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {THEME_PRESETS.map(p => (
                      <button key={p.name} type="button" onClick={() => setTheme(p.theme)}
                        className="flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted/50 transition">
                        <span className="inline-flex">
                          <span className="size-3 rounded-l-full" style={{ background: p.theme.gradientFrom }} />
                          <span className="size-3" style={{ background: p.theme.primary }} />
                          <span className="size-3 rounded-r-full" style={{ background: p.theme.accent }} />
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(["primary", "accent", "gradientFrom", "gradientTo"] as const).map(key => (
                    <div key={key}>
                      <Label className="capitalize text-xs">
                        {key === "gradientFrom" ? "Header start" : key === "gradientTo" ? "Header end" : key}
                      </Label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="color"
                          value={theme[key]}
                          onChange={e => setTheme({ ...theme, [key]: e.target.value })}
                          className="h-9 w-12 rounded-md border border-border bg-transparent cursor-pointer"
                        />
                        <Input
                          value={theme[key]}
                          onChange={e => setTheme({ ...theme, [key]: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live mini-preview of the cover */}
                <div className="rounded-xl overflow-hidden border border-border">
                  <div
                    className="p-4 text-white"
                    style={{ background: `linear-gradient(135deg, ${theme.gradientFrom} 0%, ${theme.primary} 60%, ${theme.gradientTo} 100%)` }}
                  >
                    <div className="flex items-center gap-3">
                      {logoUrl
                        ? <img src={logoUrl} alt="" className="size-10 rounded-md bg-white p-1 object-contain" />
                        : <div className="size-10 rounded-md bg-white grid place-items-center font-bold" style={{ color: theme.primary }}>{(info.name || "S").charAt(0)}</div>}
                      <div className="min-w-0">
                        <div className="font-bold truncate">{info.name || "Your School Name"}</div>
                        {info.motto && <div className="text-xs italic opacity-90 truncate">"{info.motto}"</div>}
                      </div>
                    </div>
                    <div className="mt-3 text-xs opacity-90">Student Report Card · Preview</div>
                  </div>
                  <div className="p-3 flex items-center justify-between gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: theme.primary }}>Grade A1</span>
                    <span className="font-semibold" style={{ color: theme.primary }}>Total: 90</span>
                    <span className="px-2 py-0.5 rounded-full" style={{ background: theme.accent, color: "#fff" }}>Position 1</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={previewReportCard}>
                <Eye className="size-4 mr-1" /> Preview full report card
              </Button>
              <Button type="button" onClick={saveBranding} disabled={savingTheme}>
                {savingTheme ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Save branding
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="App install (home-screen)" description="What your school's app is called when parents and students install your portal to their phone home screen.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>App display name</Label>
                  <Input
                    value={appInstall.display_name}
                    onChange={e => setAppInstall({ ...appInstall, display_name: e.target.value })}
                    placeholder={info.name || school?.name || "Your School"}
                    maxLength={45}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Shown on the install prompt. Defaults to your school name.</p>
                </div>
                <div>
                  <Label>Short name <span className="text-muted-foreground font-normal">(≤ 12 chars)</span></Label>
                  <Input
                    value={appInstall.short_name}
                    onChange={e => setAppInstall({ ...appInstall, short_name: e.target.value.slice(0, 12) })}
                    placeholder={(appInstall.display_name || info.name || "School").slice(0, 12)}
                    maxLength={12}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">This is the label under the icon on the home screen.</p>
                </div>
                <div>
                  <Label>Short description</Label>
                  <Input
                    value={appInstall.short_description}
                    onChange={e => setAppInstall({ ...appInstall, short_description: e.target.value })}
                    placeholder="Classes, results & fees in one place"
                    maxLength={120}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Note: Phones cache the name and icon at install time. Users who already installed your portal will need to reinstall to see changes.
                </p>
              </div>

              {/* Live preview of a home-screen tile */}
              <div className="rounded-2xl p-6 bg-muted/40 border border-border grid place-items-center">
                <div className="text-center">
                  <div className="mx-auto w-20 h-20 rounded-[22px] shadow-lg overflow-hidden border border-border bg-white grid place-items-center">
                    {logoUrl
                      ? <img src={logoUrl} alt="" className="w-full h-full object-contain p-1.5" />
                      : <div className="w-full h-full grid place-items-center text-white font-bold text-2xl" style={{ background: theme.primary }}>{(info.name || school?.name || "S").charAt(0)}</div>}
                  </div>
                  <div className="mt-2 text-xs font-medium text-foreground max-w-[88px] mx-auto leading-tight break-words">
                    {(appInstall.short_name || appInstall.display_name || info.name || school?.name || "School").slice(0, 12)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-3">Home-screen preview</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={saveAppInstall} disabled={savingAppInstall}>
                {savingAppInstall ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Save app install
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="neco" className="space-y-4">
          <SectionCard title="Exam security defaults">
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={saveExamSettings}>
              <div>
                <Label>Violation limit before auto-submit</Label>
                <Input type="number" min={1} max={20} value={exam.exams_violation_limit}
                  onChange={e => setExam({ ...exam, exams_violation_limit: Number(e.target.value) })} />
                <p className="text-[11px] text-muted-foreground mt-1">Tab switches, blur events, fullscreen exits.</p>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={exam.proctoring_default} onCheckedChange={v => setExam({ ...exam, proctoring_default: v })} />
                <div>
                  <Label className="cursor-pointer">Webcam proctoring on by default</Label>
                  <p className="text-[11px] text-muted-foreground">Teachers can still toggle per-exam.</p>
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label>NECO subject code mapping</Label>
                    <p className="text-[11px] text-muted-foreground">Used to label columns in the NECO candidate CSV.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setNecoCodes([...necoCodes, { subject: "", code: "" }])}>
                    <Plus className="size-3.5 mr-1" /> Add row
                  </Button>
                </div>
                <div className="space-y-2">
                  {necoCodes.length === 0 && <p className="text-xs text-muted-foreground">No mappings yet — add subject → NECO code rows.</p>}
                  {necoCodes.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                      <Input value={row.subject} placeholder="Mathematics"
                        onChange={e => setNecoCodes(necoCodes.map((r, j) => j === i ? { ...r, subject: e.target.value } : r))} />
                      <Input value={row.code} placeholder="001"
                        onChange={e => setNecoCodes(necoCodes.map((r, j) => j === i ? { ...r, code: e.target.value } : r))} />
                      <Button type="button" size="icon" variant="ghost"
                        onClick={() => setNecoCodes(necoCodes.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end"><Button type="submit">Save settings</Button></div>
            </form>
          </SectionCard>

          <SectionCard title="NECO candidate export" description="Generate the CSV NECO requires for candidate registration.">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={necoBusy} onClick={() => callNeco(true)}>
                {necoBusy ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Preview rows
              </Button>
              <Button disabled={necoBusy} onClick={() => callNeco(false)}>
                {necoBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download full CSV
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <SectionCard title="Platform guide" description="Step-by-step walkthroughs, FAQs and tips for every role.">
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => school && nav(schoolPath(school.slug, "/app/help"))}
                className="text-left rounded-xl border border-border p-4 hover:bg-muted/50 transition flex items-start gap-3">
                <span className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                  <HelpCircle className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">Open the Help Center</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Role-based guides for admins, teachers, students and parents.</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground mt-1" />
              </button>
              <button onClick={() => school && nav(schoolPath(school.slug, "/app/admin/classes"))}
                className="text-left rounded-xl border border-border p-4 hover:bg-muted/50 transition flex items-start gap-3">
                <span className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">Manage classes</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Add or review class levels after onboarding.</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground mt-1" />
              </button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="pilot" className="space-y-4">
          <PilotDetailsCard />
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>NECO export preview {previewData ? `· ${previewData.total} students` : ""}</DialogTitle></DialogHeader>
          {previewData && (
            <div className="overflow-auto max-h-[60vh] border border-border rounded-md">
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>{previewData.headers.map(h => <th key={h} className="text-left px-2 py-1.5 whitespace-nowrap font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {previewData.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {previewData.headers.map(h => <td key={h} className="px-2 py-1.5 whitespace-nowrap">{String(r[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          <div className="flex justify-end"><Button onClick={() => callNeco(false)} disabled={necoBusy}><Download className="size-4" /> Download full CSV</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
