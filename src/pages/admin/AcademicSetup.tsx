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
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

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
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="grading">Grading</TabsTrigger>
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
                <div className="space-y-2 mt-4">
                  {periods.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={p.name} onChange={e => { const n = [...periods]; n[i] = { ...p, name: e.target.value }; setPeriods(n); }} placeholder="Period name" />
                      <Input type="date" value={p.start ?? ""} onChange={e => { const n = [...periods]; n[i] = { ...p, start: e.target.value }; setPeriods(n); }} />
                      <Input type="date" value={p.end ?? ""} onChange={e => { const n = [...periods]; n[i] = { ...p, end: e.target.value }; setPeriods(n); }} />
                      <Button size="icon" variant="ghost" onClick={() => setPeriods(periods.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setPeriods([...periods, { name: "" }])}><Plus className="size-3.5 mr-1" />Add period</Button>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="assessment">
              <SectionCard title="Assessment Structure" description="Components that combine into each subject's term result. Must total 100%.">
                <div className="space-y-2">
                  {comps.map((c, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-3" placeholder="key" value={c.key} onChange={e => { const n=[...comps]; n[i]={...c,key:e.target.value}; setComps(n); }} />
                      <Input className="col-span-5" placeholder="Label" value={c.label} onChange={e => { const n=[...comps]; n[i]={...c,label:e.target.value}; setComps(n); }} />
                      <Input className="col-span-3" type="number" placeholder="Weight %" value={c.weight} onChange={e => { const n=[...comps]; n[i]={...c,weight:Number(e.target.value)}; setComps(n); }} />
                      <Button size="icon" variant="ghost" onClick={() => setComps(comps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setComps([...comps, { key: "", label: "", weight: 0 }])}><Plus className="size-3.5 mr-1" />Add component</Button>
                  <div className={`text-xs rounded-md px-3 py-2 border ${Math.round(weightSum)===100 ? "border-success/40 bg-success/5 text-success" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
                    Total: {weightSum}% — {Math.round(weightSum)===100 ? "valid" : "must equal 100"}
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="grading">
              <SectionCard title="Grading Scale" description="Define grade bands and remarks.">
                <div className="space-y-2">
                  {bands.map((b, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-2" type="number" value={b.min} onChange={e=>{const n=[...bands];n[i]={...b,min:Number(e.target.value)};setBands(n);}} />
                      <Input className="col-span-2" type="number" value={b.max} onChange={e=>{const n=[...bands];n[i]={...b,max:Number(e.target.value)};setBands(n);}} />
                      <Input className="col-span-2" value={b.grade} onChange={e=>{const n=[...bands];n[i]={...b,grade:e.target.value};setBands(n);}} />
                      <Input className="col-span-5" value={b.remark} onChange={e=>{const n=[...bands];n[i]={...b,remark:e.target.value};setBands(n);}} />
                      <Button size="icon" variant="ghost" onClick={()=>setBands(bands.filter((_,j)=>j!==i))}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={()=>setBands([...bands,{min:0,max:0,grade:"",remark:""}])}><Plus className="size-3.5 mr-1" />Add band</Button>
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