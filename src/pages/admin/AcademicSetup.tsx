import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

type Band = { min: number; max: number; grade: string; remark: string };
type Comp = { key: string; label: string; weight: number };
type Period = { name: string; start?: string; end?: string };

const DEFAULT_BANDS: Band[] = [
  { min: 70, max: 100, grade: "A", remark: "Excellent" },
  { min: 60, max: 69, grade: "B", remark: "Very Good" },
  { min: 50, max: 59, grade: "C", remark: "Good" },
  { min: 45, max: 49, grade: "D", remark: "Pass" },
  { min: 0, max: 44, grade: "F", remark: "Fail" },
];
const DEFAULT_COMPS: Comp[] = [
  { key: "attendance", label: "Attendance", weight: 5 },
  { key: "assignment", label: "Assignment", weight: 10 },
  { key: "test", label: "Test", weight: 25 },
  { key: "examination", label: "Examination", weight: 60 },
];

export default function AcademicSetup() {
  const { school } = useSchool();
  const sid = school?.id;

  // Calendar
  const [session, setSession] = useState("2025/2026");
  const [calKind, setCalKind] = useState<"term" | "semester" | "custom">("term");
  const [periods, setPeriods] = useState<Period[]>([
    { name: "First Term" }, { name: "Second Term" }, { name: "Third Term" },
  ]);

  // Grading
  const [bands, setBands] = useState<Band[]>(DEFAULT_BANDS);

  // Assessment
  const [comps, setComps] = useState<Comp[]>(DEFAULT_COMPS);

  // Promotion
  const [minAvg, setMinAvg] = useState(50);
  const [minAtt, setMinAtt] = useState(75);
  const [coreSubjects, setCoreSubjects] = useState("Mathematics, English");

  // Result release
  const [reqApproval, setReqApproval] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinPriceN, setPinPriceN] = useState(500);
  const [approvalChain, setApprovalChain] = useState("teacher,admin");

  // Live preview
  const [previewScore, setPreviewScore] = useState(72);

  useEffect(() => {
    if (!sid) return;
    (async () => {
      const [cal, grad, ass, prom, rel] = await Promise.all([
        supabase.from("academic_calendar" as any).select("*").eq("school_id", sid).maybeSingle(),
        supabase.from("grading_scales" as any).select("*").eq("school_id", sid).eq("is_default", true).maybeSingle(),
        supabase.from("assessment_structures" as any).select("*").eq("school_id", sid).eq("is_default", true).maybeSingle(),
        supabase.from("promotion_rules" as any).select("*").eq("school_id", sid).maybeSingle(),
        supabase.from("result_release_rules" as any).select("*").eq("school_id", sid).maybeSingle(),
      ]);
      const c: any = cal.data;
      if (c) {
        setSession(c.session); setCalKind(c.kind);
        setPeriods(Array.isArray(c.periods) ? c.periods.map((p: any) => typeof p === "string" ? { name: p } : p) : []);
      }
      const g: any = grad.data;
      if (g?.bands?.length) setBands(g.bands);
      const a: any = ass.data;
      if (a?.components?.length) setComps(a.components);
      const p: any = prom.data;
      if (p) { setMinAvg(Number(p.min_average)); setMinAtt(Number(p.min_attendance_pct)); setCoreSubjects((p.core_subjects ?? []).join(", ")); }
      const r: any = rel.data;
      if (r) {
        setReqApproval(!!r.requires_approval); setPinRequired(!!r.pin_required);
        setPinPriceN(Math.round((r.pin_price_kobo ?? 0) / 100));
        setApprovalChain((r.approval_chain ?? ["teacher","admin"]).join(","));
      }
    })();
  }, [sid]);

  const weightSum = useMemo(() => comps.reduce((s, c) => s + Number(c.weight || 0), 0), [comps]);
  const bandsValid = useMemo(() => {
    // No overlaps, covers 0-100, ordered desc
    const sorted = [...bands].sort((a, b) => b.min - a.min);
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (b.min > b.max) return { ok: false, msg: `${b.grade || "?"}: min > max` };
      if (i > 0 && sorted[i - 1].min <= b.max) return { ok: false, msg: `${b.grade || "?"} overlaps ${sorted[i - 1].grade || "?"}` };
    }
    return { ok: true, msg: `${bands.length} bands` };
  }, [bands]);
  const previewGrade = useMemo(() => {
    const b = bands.find(b => previewScore >= b.min && previewScore <= b.max);
    return b ?? { grade: "F", remark: "Fail" };
  }, [bands, previewScore]);
  const previewPromoted = previewScore >= minAvg;

  async function saveAll() {
    if (!sid) return;
    if (Math.round(weightSum) !== 100) { toast.error(`Assessment weights must total 100 (got ${weightSum})`); return; }
    try {
      await Promise.all([
        supabase.from("academic_calendar" as any).upsert({ school_id: sid, session, kind: calKind, periods, is_current: true }, { onConflict: "school_id,session" }),
        supabase.from("grading_scales" as any).upsert({ school_id: sid, name: "Default", bands, is_default: true }, { onConflict: "school_id,is_default" } as any).then(r => {
          if (r.error) return supabase.from("grading_scales" as any).insert({ school_id: sid, name: "Default", bands, is_default: true });
        }),
        supabase.from("assessment_structures" as any).upsert({ school_id: sid, name: "Default", components: comps, is_default: true }, { onConflict: "school_id,is_default" } as any).then(r => {
          if (r.error) return supabase.from("assessment_structures" as any).insert({ school_id: sid, name: "Default", components: comps, is_default: true });
        }),
        supabase.from("promotion_rules" as any).upsert({
          school_id: sid, min_average: minAvg, min_attendance_pct: minAtt,
          core_subjects: coreSubjects.split(",").map(s => s.trim()).filter(Boolean),
        }, { onConflict: "school_id" }),
        supabase.from("result_release_rules" as any).upsert({
          school_id: sid, requires_approval: reqApproval, pin_required: pinRequired,
          pin_price_kobo: pinPriceN * 100,
          approval_chain: approvalChain.split(",").map(s => s.trim()).filter(Boolean),
        }, { onConflict: "school_id" }),
      ]);
      toast.success("Academic configuration saved");
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Setup"
        description="Configure your school's academic calendar, grading scale, assessment weights, promotion rules and result release policy. Live preview on the right."
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Tabs defaultValue="calendar">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="calendar">Calendar <span className="ml-1.5 text-[10px] text-muted-foreground">{periods.length}</span></TabsTrigger>
              <TabsTrigger value="assessment">Assessment {Math.round(weightSum)===100 ? <CheckCircle2 className="size-3 text-success ml-1.5" /> : <AlertCircle className="size-3 text-destructive ml-1.5" />}</TabsTrigger>
              <TabsTrigger value="grading">Grading {bandsValid.ok ? <CheckCircle2 className="size-3 text-success ml-1.5" /> : <AlertCircle className="size-3 text-destructive ml-1.5" />}</TabsTrigger>
              <TabsTrigger value="promotion">Promotion</TabsTrigger>
              <TabsTrigger value="result">Result Release</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar">
              <SectionCard title="Academic Calendar" description="Term, semester, or custom periods.">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><Label className="text-xs">Session</Label><Input value={session} onChange={e => setSession(e.target.value)} /></div>
                  <div>
                    <Label className="text-xs">Structure</Label>
                    <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={calKind} onChange={e => setCalKind(e.target.value as any)}>
                      <option value="term">Three Terms</option>
                      <option value="semester">Two Semesters</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Period name</TableHead>
                        <TableHead className="w-44">Start</TableHead>
                        <TableHead className="w-44">End</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                          <TableCell className="p-2"><Input value={p.name} onChange={e => { const n = [...periods]; n[i] = { ...p, name: e.target.value }; setPeriods(n); }} placeholder="e.g. First Term" /></TableCell>
                          <TableCell className="p-2"><Input type="date" value={p.start ?? ""} onChange={e => { const n = [...periods]; n[i] = { ...p, start: e.target.value }; setPeriods(n); }} /></TableCell>
                          <TableCell className="p-2"><Input type="date" value={p.end ?? ""} onChange={e => { const n = [...periods]; n[i] = { ...p, end: e.target.value }; setPeriods(n); }} /></TableCell>
                          <TableCell className="p-2"><Button size="icon" variant="ghost" onClick={() => setPeriods(periods.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-2 border-t border-border bg-muted/30">
                    <Button size="sm" variant="outline" onClick={() => setPeriods([...periods, { name: "" }])}><Plus className="size-3.5 mr-1" />Add period</Button>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="assessment">
              <SectionCard title="Assessment Structure" description="Components that combine into each subject's term result. Must total 100%.">
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Key</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="w-32">Weight %</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comps.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="p-2"><Input placeholder="ca" value={c.key} onChange={e => { const n=[...comps]; n[i]={...c,key:e.target.value}; setComps(n); }} /></TableCell>
                          <TableCell className="p-2"><Input placeholder="Continuous Assessment" value={c.label} onChange={e => { const n=[...comps]; n[i]={...c,label:e.target.value}; setComps(n); }} /></TableCell>
                          <TableCell className="p-2"><Input type="number" min={0} max={100} value={c.weight} onChange={e => { const n=[...comps]; n[i]={...c,weight:Number(e.target.value)}; setComps(n); }} /></TableCell>
                          <TableCell className="p-2"><Button size="icon" variant="ghost" onClick={() => setComps(comps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-2 border-t border-border bg-muted/30 flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => setComps([...comps, { key: "", label: "", weight: 0 }])}><Plus className="size-3.5 mr-1" />Add component</Button>
                    <Badge variant="outline" className={Math.round(weightSum)===100 ? "bg-success/10 text-success border-success/40" : "bg-destructive/10 text-destructive border-destructive/40"}>
                      Total {weightSum}% {Math.round(weightSum)===100 ? "✓" : `(needs ${100-weightSum})`}
                    </Badge>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="grading">
              <SectionCard title="Grading Scale" description="Define grade bands and remarks.">
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Min %</TableHead>
                        <TableHead className="w-24">Max %</TableHead>
                        <TableHead className="w-24">Grade</TableHead>
                        <TableHead>Remark</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bands.map((b, i) => {
                        const rangeOk = b.min <= b.max;
                        return (
                          <TableRow key={i} className={!rangeOk ? "bg-destructive/5" : ""}>
                            <TableCell className="p-2"><Input type="number" min={0} max={100} value={b.min} onChange={e=>{const n=[...bands];n[i]={...b,min:Number(e.target.value)};setBands(n);}} /></TableCell>
                            <TableCell className="p-2"><Input type="number" min={0} max={100} value={b.max} onChange={e=>{const n=[...bands];n[i]={...b,max:Number(e.target.value)};setBands(n);}} /></TableCell>
                            <TableCell className="p-2"><Input value={b.grade} onChange={e=>{const n=[...bands];n[i]={...b,grade:e.target.value};setBands(n);}} /></TableCell>
                            <TableCell className="p-2"><Input value={b.remark} onChange={e=>{const n=[...bands];n[i]={...b,remark:e.target.value};setBands(n);}} /></TableCell>
                            <TableCell className="p-2"><Button size="icon" variant="ghost" onClick={()=>setBands(bands.filter((_,j)=>j!==i))}><Trash2 className="size-4" /></Button></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="p-2 border-t border-border bg-muted/30 flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={()=>setBands([...bands,{min:0,max:0,grade:"",remark:""}])}><Plus className="size-3.5 mr-1" />Add band</Button>
                    <Badge variant="outline" className={bandsValid.ok ? "bg-success/10 text-success border-success/40" : "bg-destructive/10 text-destructive border-destructive/40"}>
                      {bandsValid.ok ? `✓ ${bandsValid.msg}` : `⚠ ${bandsValid.msg}`}
                    </Badge>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="promotion">
              <SectionCard title="Promotion Rules" description="Conditions for moving a student to the next class.">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Minimum average %</Label><Input type="number" value={minAvg} onChange={e=>setMinAvg(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Minimum attendance %</Label><Input type="number" value={minAtt} onChange={e=>setMinAtt(Number(e.target.value))} /></div>
                  <div className="sm:col-span-2"><Label className="text-xs">Core subjects (comma separated)</Label><Input value={coreSubjects} onChange={e=>setCoreSubjects(e.target.value)} /></div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="result">
              <SectionCard title="Result Release" description="Approval workflow and PIN access.">
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><Label>Require approval before release</Label><Switch checked={reqApproval} onCheckedChange={setReqApproval} /></div>
                  <div><Label className="text-xs">Approval chain (comma)</Label><Input value={approvalChain} onChange={e=>setApprovalChain(e.target.value)} placeholder="teacher,hod,admin" /></div>
                  <div className="flex items-center justify-between"><Label>Require scratch-card PIN to view</Label><Switch checked={pinRequired} onCheckedChange={setPinRequired} /></div>
                  <div><Label className="text-xs">PIN price (₦)</Label><Input type="number" value={pinPriceN} onChange={e=>setPinPriceN(Number(e.target.value))} /></div>
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end"><Button onClick={saveAll}><Save className="size-4 mr-2" />Save all</Button></div>
        </div>

        <div className="space-y-4">
          <SectionCard title="Live Preview" description="Enter a score to see how rules apply.">
            <Label className="text-xs">Sample score</Label>
            <Input type="number" value={previewScore} onChange={e=>setPreviewScore(Number(e.target.value))} />
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>Grade</span><Badge>{previewGrade.grade}</Badge></div>
              <div className="flex justify-between"><span>Remark</span><span className="text-muted-foreground">{previewGrade.remark}</span></div>
              <div className="flex justify-between"><span>Promotion verdict</span><Badge variant={previewPromoted ? "default" : "destructive"}>{previewPromoted ? "Promoted" : "Not promoted"}</Badge></div>
              <div className="flex justify-between"><span>Weights sum</span><span className={Math.round(weightSum)===100 ? "text-success" : "text-destructive"}>{weightSum}%</span></div>
              <div className="flex justify-between"><span>Calendar periods</span><span>{periods.length}</span></div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}