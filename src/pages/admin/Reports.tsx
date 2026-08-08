import { useEffect, useState } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { FileBarChart, FileText, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportMenu } from "@/components/ExportMenu";
import type { BrandedPDFOptions } from "@/lib/exporters";
import { fetchResultSlip } from "@/lib/slip";
import { toast } from "sonner";
import JSZip from "jszip";

export default function AdminReports() {
  const { school } = useSchool();
  const [perfData, setPerfData] = useState<any[]>([]);
  const [att, setAtt] = useState<any[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!school) return;
    (async () => {
      const { data: results } = await supabase.from("results").select("subject,score").eq("school_id", school.id);
      const bySubj: Record<string, { total: number; count: number }> = {};
      results?.forEach(r => { bySubj[r.subject] ??= { total: 0, count: 0 }; bySubj[r.subject].total += Number(r.score); bySubj[r.subject].count += 1; });
      setPerfData(Object.entries(bySubj).map(([subject, v]) => ({ subject, score: Math.round(v.total / v.count) })));

      const { data: at } = await supabase.from("attendance").select("status").eq("school_id", school.id);
      const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 };
      at?.forEach(a => counts[a.status]++);
      const colors: Record<string, string> = { present: "hsl(var(--success))", absent: "hsl(var(--destructive))", late: "hsl(var(--warning))", excused: "hsl(var(--muted-foreground))" };
      setAtt(Object.entries(counts).filter(([,v]) => v > 0).map(([k, v]) => ({ name: k, value: v, color: colors[k] })));

      const { data: cls } = await supabase.from("classes").select("id,name").eq("school_id", school.id).order("name");
      setClasses(cls ?? []);
    })();
  }, [school]);

  async function downloadClassSlips() {
    if (!school || !classId) return;
    setZipping(true); setZipProgress({ done: 0, total: 0 });
    try {
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("school_id", school.id).eq("class_id", classId);
      const ids = (enr ?? []).map(e => e.student_id);
      if (!ids.length) { toast.info("No students in this class"); return; }
      setZipProgress({ done: 0, total: ids.length });
      const zip = new JSZip();
      let done = 0;
      for (const id of ids) {
        try {
          const { blob, filename } = await fetchResultSlip(id);
          zip.file(filename, blob);
        } catch (e: any) {
          zip.file(`ERROR_${id}.txt`, `Failed: ${e.message ?? e}`);
        }
        done++; setZipProgress({ done, total: ids.length });
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      const cls = classes.find(c => c.id === classId);
      a.href = url; a.download = `${(cls?.name ?? "class").replace(/\s+/g, "_")}_result_slips.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${done} slips`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to bundle slips");
    } finally { setZipping(false); setZipProgress(null); }
  }

  const analyticsData = (): BrandedPDFOptions => ({
            title: "School Analytics Report",
            subtitle: "Performance and attendance overview",
            schoolName: school?.name,
            schoolLogo: school?.logo_url,
            stats: [
              { label: "Subjects tracked", value: perfData.length },
              { label: "Attendance records", value: att.reduce((a, b) => a + b.value, 0) },
            ],
            sections: [
              { kind: "table", heading: "Performance by subject", headers: ["Subject", "Average"], rows: perfData.map(p => [p.subject, p.score + "%"]) },
              { kind: "table", heading: "Attendance distribution", headers: ["Status", "Count"], rows: att.map(a => [a.name, a.value]) },
            ],
            footerNote: "School analytics",
  });

  const exportAction = (
    <div className="flex items-center gap-2">
      <ExportMenu data={analyticsData} disabled={!perfData.length && !att.length} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-lg">School analytics</h2>
          <p className="text-sm text-muted-foreground">Performance and attendance overview</p>
        </div>
        {exportAction}
      </div>

      <SectionCard title="Class result slips" description="Generate NECO-styled PDF slips for every student in a class and download as a ZIP.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={downloadClassSlips} disabled={!classId || zipping}>
            {zipping ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
            <span className="ml-1">{zipping && zipProgress ? `Generating ${zipProgress.done}/${zipProgress.total}…` : "Download class slips (ZIP)"}</span>
          </Button>
          {!classes.length && <p className="text-xs text-muted-foreground">No classes yet — create classes first.</p>}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SectionCard title="Performance by Subject">
        {perfData.length === 0 ? <EmptyState icon={FileBarChart} title="No results yet" /> :
          <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={perfData} margin={{ top: 5, right: 10, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="subject" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer></div>}
      </SectionCard>
      <SectionCard title="Attendance Distribution">
        {att.length === 0 ? <EmptyState icon={FileBarChart} title="No attendance data" /> :
          <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={att} dataKey="value" innerRadius={60} outerRadius={100}>{att.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip />
            </PieChart>
          </ResponsiveContainer></div>}
      </SectionCard>
      </div>
    </div>
  );
}
