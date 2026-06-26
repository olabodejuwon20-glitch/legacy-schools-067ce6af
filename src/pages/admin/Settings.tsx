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

  useEffect(() => {
    if (!school) return;
    supabase.from("schools").select("name,email,phone,address,motto,logo_url,current_session,current_term,grading_system,resumption_date,exams_violation_limit,proctoring_default,neco_subject_codes,report_theme").eq("id", school.id).single()
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
