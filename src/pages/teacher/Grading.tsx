import { useEffect, useState } from "react";
import { PencilRuler, FilePlus2, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TermResultsTab } from "@/components/teacher/TermResultsTab";

export default function Grading() {
  const { school, user } = useSchool();
  const [exams, setExams] = useState<any[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const { data: ex } = await supabase.from("exams").select("id,title,mode").eq("school_id", school.id).eq("created_by", user.id).neq("mode", "practice");
      const examIds = ex?.map(e => e.id) ?? [];
      const [{ data: attempts }, { data: asgs }] = await Promise.all([
        examIds.length ? supabase.from("exam_attempts").select("id,student_id,score,submitted_at,exam_id").in("exam_id", examIds).not("submitted_at", "is", null) : Promise.resolve({ data: [] as any[] }),
        supabase.from("assignments").select("id,title,max_score,assignment_submissions(id,student_id,submitted_at,score,feedback)").eq("school_id", school.id).eq("teacher_id", user.id),
      ]);
      const eMap: Record<string, string> = {}; ex?.forEach(e => eMap[e.id] = e.title);
      const rows = (attempts ?? []).map(a => ({ ...a, examTitle: eMap[a.exam_id] }));
      setExams(rows); setAssignments(asgs ?? []);
      const sids = Array.from(new Set([...(attempts ?? []).map(a => a.student_id), ...(asgs ?? []).flatMap((a: any) => (a.assignment_submissions ?? []).map((s: any) => s.student_id))]));
      if (sids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", sids);
        const pm: Record<string, string> = {}; profs?.forEach(p => pm[p.id] = p.full_name || p.email || p.id.slice(0,8));
        setProfMap(pm);
      }
    })();
  }, [school, user]);

  async function saveExamScore(id: string, val: string) {
    const n = Number(val);
    if (Number.isNaN(n)) return toast.error("Invalid score");
    const { error } = await supabase.from("exam_attempts").update({ score: n }).eq("id", id);
    if (error) return toast.error(error.message);
    setExams(rs => rs.map(r => r.id === id ? { ...r, score: n } : r));
    toast.success("Saved");
  }

  async function saveSubScore(id: string, val: string) {
    const n = Number(val);
    if (Number.isNaN(n)) return toast.error("Invalid score");
    const { error } = await supabase.from("assignment_submissions").update({ score: n, graded_by: user!.id, graded_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    setAssignments(as => as.map(a => ({ ...a, assignment_submissions: (a.assignment_submissions ?? []).map((s: any) => s.id === id ? { ...s, score: n } : s) })));
    toast.success("Saved");
  }

  return (
    <SectionCard title="Grading Center" description="Score exam attempts and assignment submissions">
      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="exams">Exam attempts ({exams.length})</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({assignments.reduce((a, x) => a + (x.assignment_submissions?.length ?? 0), 0)})</TabsTrigger>
          <TabsTrigger value="term"><ClipboardCheck className="size-3.5 mr-1" />Term Results</TabsTrigger>
        </TabsList>
        <TabsContent value="exams" className="mt-4">
          {exams.length === 0 ? <EmptyState icon={PencilRuler} title="No submissions yet" /> :
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-xs uppercase text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-3">Exam</th><th className="text-left font-medium py-3">Student</th>
                <th className="text-left font-medium py-3">Score</th><th className="text-left font-medium py-3">Submitted</th><th></th>
              </tr></thead>
              <tbody>
                {exams.map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-3">{r.examTitle}</td>
                    <td className="py-3">{profMap[r.student_id] || r.student_id.slice(0,8)}</td>
                    <td className="py-3"><Input className="w-20 h-8" defaultValue={r.score ?? ""} onChange={e => setScores({ ...scores, [r.id]: e.target.value })} /></td>
                    <td className="py-3 text-muted-foreground text-xs">{new Date(r.submitted_at).toLocaleString()}</td>
                    <td className="py-3"><Button size="sm" variant="outline" onClick={() => saveExamScore(r.id, scores[r.id] ?? String(r.score ?? ""))}>Save</Button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>}
        </TabsContent>
        <TabsContent value="assignments" className="mt-4">
          {assignments.length === 0 ? <EmptyState icon={FilePlus2} title="No assignments created" /> :
            <div className="space-y-4">
              {assignments.map(a => (
                <div key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2"><div className="font-semibold">{a.title}</div><Badge variant="secondary" className="text-[10px]">Max {a.max_score}</Badge></div>
                  {!a.assignment_submissions?.length ? <div className="text-xs text-muted-foreground">No submissions</div> :
                    <ul className="divide-y divide-border">
                      {a.assignment_submissions.map((s: any) => (
                        <li key={s.id} className="py-2 flex items-center gap-3 text-sm">
                          <span className="flex-1">{profMap[s.student_id] || s.student_id.slice(0,8)}</span>
                          <span className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</span>
                          <Input className="w-20 h-8" defaultValue={s.score ?? ""} onChange={e => setScores({ ...scores, [s.id]: e.target.value })} />
                          <Button size="sm" variant="outline" onClick={() => saveSubScore(s.id, scores[s.id] ?? String(s.score ?? ""))}>Save</Button>
                        </li>
                      ))}
                    </ul>}
                </div>
              ))}
            </div>}
        </TabsContent>
        <TabsContent value="term" className="mt-4">
          <TermResultsTab />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}
