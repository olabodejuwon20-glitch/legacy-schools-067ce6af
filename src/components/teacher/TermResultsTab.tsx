import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardCheck, Loader2, RefreshCw, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { NECO_GRADE_COLORS } from "@/lib/neco";
import { TermBreakdownBar } from "@/components/results/TermBreakdownBar";

const TERMS = ["Term 1", "Term 2", "Term 3"];

export function TermResultsTab() {
  const { school, user } = useSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [session, setSession] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reportEdits, setReportEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!school || !user) return;
    supabase.from("classes").select("id,code,name").eq("school_id", school.id).eq("teacher_id", user.id)
      .then(({ data }) => { setClasses(data ?? []); if (data?.[0]) setClassId(data[0].id); });
    supabase.from("schools").select("current_session").eq("id", school.id).maybeSingle()
      .then(({ data }) => setSession((data as any)?.current_session ?? ""));
  }, [school, user]);

  async function load() {
    if (!school || !classId) return;
    const { data: enr } = await supabase.from("class_enrollments").select("student_id").eq("class_id", classId);
    const ids = enr?.map(e => e.student_id) ?? [];
    if (!ids.length) { setRows([]); setProfMap({}); return; }
    const { data: results } = await supabase.from("results")
      .select("id,student_id,subject,score,grade,term,session,ca_score,assignment_score,exam_score,report_score,breakdown,published_at")
      .eq("school_id", school.id).in("student_id", ids).eq("term", term);
    const filtered = (results ?? []).filter(r => !session || (r as any).session === session || !(r as any).session);
    const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
    const pm: Record<string, string> = {};
    profs?.forEach((p: any) => pm[p.id] = p.full_name || p.email || p.id.slice(0, 8));
    setProfMap(pm);
    setRows(filtered);
  }

  useEffect(() => { load(); }, [classId, term, session]);

  const grouped = useMemo(() => {
    const m: Record<string, any[]> = {};
    rows.forEach(r => { (m[r.student_id] ||= []).push(r); });
    return m;
  }, [rows]);

  async function recomputeClass() {
    if (!classId) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("recompute_term_results_for_class", {
      _class: classId, _term: term, _session: session || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Recomputed ${data ?? 0} subject results`);
    await load();
  }

  async function saveReportScore(row: any) {
    if (!school) return;
    const raw = reportEdits[row.id];
    if (raw === undefined) return;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 100) return toast.error("Report score must be 0–100");
    setBusy(true);
    const { error } = await (supabase as any).rpc("recompute_term_result", {
      _school: school.id, _student: row.student_id, _subject: row.subject,
      _term: term, _session: session || null, _class: classId, _report_score: n,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setReportEdits(e => { const c = { ...e }; delete c[row.id]; return c; });
    await load();
  }

  async function togglePublish(publish: boolean) {
    const ids = rows.map(r => r.id);
    if (!ids.length) return;
    const { error, data } = await (supabase as any).rpc("publish_results", { _ids: ids, _publish: publish });
    if (error) return toast.error(error.message);
    toast.success(`${publish ? "Published" : "Unpublished"} ${data ?? ids.length} rows`);
    await load();
  }

  if (classes.length === 0) return <EmptyState icon={ClipboardCheck} title="No classes assigned" desc="Ask your admin to assign you to a class." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Term</Label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Session</Label>
          <Input className="w-[140px]" value={session} onChange={e => setSession(e.target.value)} placeholder="2024/2025" />
        </div>
        <Button onClick={recomputeClass} disabled={busy || !classId}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          <span className="ml-1">Recompute</span>
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => togglePublish(false)}>
            <Undo2 className="size-3.5 mr-1" /> Unpublish
          </Button>
          <Button size="sm" disabled={!rows.length} onClick={() => togglePublish(true)}>
            <Send className="size-3.5 mr-1" /> Publish all
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Combines Gradebook CA scores, graded assignments, the latest counted exam, and an optional report rubric using your school's weights. Recompute after any of these change.
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No computed results yet" desc='Click "Recompute" to roll up CA, assignments and exam scores into term results.' />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([sid, list]) => (
            <div key={sid} className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                <div className="font-semibold text-sm">{profMap[sid] || sid.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">
                  {list.length} subjects · avg {Math.round(list.reduce((a, r) => a + Number(r.score), 0) / list.length)}%
                </div>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-3 py-2">Subject</th>
                  <th className="px-2 py-2">CA</th>
                  <th className="px-2 py-2">Assign</th>
                  <th className="px-2 py-2">Exam</th>
                  <th className="px-2 py-2">Report</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Status</th>
                </tr></thead>
                <tbody>
                  {list.map((r: any) => {
                    const color = NECO_GRADE_COLORS[(r.grade ?? "F9") as keyof typeof NECO_GRADE_COLORS];
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">{r.subject}</div>
                          <TermBreakdownBar breakdown={r.breakdown} />
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums text-xs">{fmt(r.ca_score)}</td>
                        <td className="px-2 py-2 text-center tabular-nums text-xs">{fmt(r.assignment_score)}</td>
                        <td className="px-2 py-2 text-center tabular-nums text-xs">{fmt(r.exam_score)}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <Input className="h-7 w-14 text-xs"
                              value={reportEdits[r.id] ?? (r.report_score ?? "")}
                              onChange={e => setReportEdits(s => ({ ...s, [r.id]: e.target.value }))} />
                            {reportEdits[r.id] !== undefined && (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveReportScore(r)}>Save</Button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-semibold tabular-nums">{Math.round(Number(r.score))}%</td>
                        <td className="px-2 py-2 text-center">
                          <Badge variant="outline" className="font-mono" style={{ background: color + "22", color, borderColor: color + "55" }}>{r.grade}</Badge>
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {r.published_at ? <Badge variant="secondary">Published</Badge> : <Badge variant="outline">Draft</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(n: number | null | undefined) { return n == null ? "—" : `${Math.round(Number(n))}%`; }