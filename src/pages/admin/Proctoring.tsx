import { useEffect, useState } from "react";
import { Eye, ShieldAlert, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SoftClearButton } from "@/components/SoftClearButton";

type AttemptRow = {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  exam_title?: string;
  student_name?: string;
  violation_count?: number;
};

export default function Proctoring() {
  const { school } = useSchool();
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<AttemptRow | null>(null);
  const [snapshots, setSnapshots] = useState<{ name: string; url: string }[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [liveFeed, setLiveFeed] = useState<Array<{ id: string; type: string; detail: string | null; created_at: string; attempt_id: string }>>([]);

  useEffect(() => {
    (async () => {
      if (!school) return;
      setLoading(true);
      const { data: attempts } = await supabase
        .from("exam_attempts").select("id,exam_id,student_id,started_at,submitted_at,score")
        .eq("school_id", school.id).order("started_at", { ascending: false }).limit(200);
      const ids = (attempts ?? []).map(a => a.id);
      const examIds = Array.from(new Set((attempts ?? []).map(a => a.exam_id)));
      const studentIds = Array.from(new Set((attempts ?? []).map(a => a.student_id)));
      const [{ data: exams }, { data: profs }, { data: vios }] = await Promise.all([
        supabase.from("exams").select("id,title").in("id", examIds.length ? examIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("profiles").select("id,full_name,email").in("id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]),
        ids.length ? supabase.from("exam_violations").select("attempt_id").in("attempt_id", ids) : Promise.resolve({ data: [] as any[] }),
      ]);
      const examMap = new Map((exams ?? []).map((e: any) => [e.id, e.title]));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || p.email]));
      const vCount = new Map<string, number>();
      (vios ?? []).forEach((v: any) => vCount.set(v.attempt_id, (vCount.get(v.attempt_id) ?? 0) + 1));
      setRows((attempts ?? []).map(a => ({
        ...a,
        exam_title: examMap.get(a.exam_id) ?? "Exam",
        student_name: profMap.get(a.student_id) ?? "Student",
        violation_count: vCount.get(a.id) ?? 0,
      })));
      setLoading(false);
    })();
  }, [school]);

  async function review(a: AttemptRow) {
    setOpen(a); setSnapshots([]); setViolations([]);
      const { data: vlist } = await supabase
        .from("exam_violations")
        .select("type,detail,created_at,risk_score,evidence_path")
        .eq("attempt_id", a.id).order("created_at");
      setViolations(vlist ?? []);
      // Pull signed URLs for any evidence paths recorded with violations
      const paths = (vlist ?? []).map((v: any) => v.evidence_path).filter(Boolean) as string[];
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("proctor-evidence").createSignedUrls(paths, 60 * 30);
        setSnapshots((signed ?? []).map((s, i) => ({ name: paths[i].split("/").pop() ?? "snap", url: s.signedUrl })));
      } else {
        // Fallback to legacy proctor-snapshots bucket if older attempt
        const { data: files } = await supabase.storage.from("proctor-snapshots").list(`${a.exam_id}/${a.id}`, { limit: 200 });
        const items = files ?? [];
        if (items.length) {
          const legacyPaths = items.map(f => `${a.exam_id}/${a.id}/${f.name}`);
          const { data: signed } = await supabase.storage.from("proctor-snapshots").createSignedUrls(legacyPaths, 60 * 30);
          setSnapshots((signed ?? []).map((s, i) => ({ name: items[i].name, url: s.signedUrl })));
        }
      }
  }

  // Live realtime feed of violations across the school
  useEffect(() => {
    if (!school) return;
    const channel = supabase
      .channel(`proctor-live-${school.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exam_violations", filter: `school_id=eq.${school.id}` },
        (payload) => {
          const v = payload.new as any;
          setLiveFeed((prev) => [{ id: v.id, type: v.type, detail: v.detail, created_at: v.created_at, attempt_id: v.attempt_id }, ...prev].slice(0, 30));
          // Bump attempt's violation count in the table without a full refetch
          setRows((prev) => prev.map((r) => r.id === v.attempt_id ? { ...r, violation_count: (r.violation_count ?? 0) + 1 } : r));
          toast.warning(`Live violation: ${v.type}`, { id: `live-${v.id}` });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [school]);

  return (
    <SectionCard
      title="Proctoring review"
      action={
        <div className="flex items-center gap-1">
          {liveFeed.length > 0 && (
            <SoftClearButton
              label="Clear live feed"
              title="Clear the live violation feed?"
              description="This only clears the on-screen feed. Recorded violations and snapshots remain saved for review."
              onClear={() => setLiveFeed([])}
            />
          )}
          {rows.length > 0 && (
            <SoftClearButton
              label="Clear list"
              title="Clear the attempts list?"
              description="This hides the attempts from this view until you refresh. Nothing is deleted from the exam records."
              onClear={() => setRows([])}
            />
          )}
        </div>
      }
    >
      {liveFeed.length > 0 && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-destructive mb-2">
            <Radio className="size-3.5 animate-pulse" /> Live violations
          </div>
          <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
            {liveFeed.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                <span className="text-muted-foreground">{new Date(v.created_at).toLocaleTimeString()}</span>
                <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">{v.type}</span>
                {v.detail && <span className="text-muted-foreground">{v.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
       : rows.length === 0 ? <EmptyState icon={ShieldAlert} title="No exam attempts yet" />
       : (
        <div className="overflow-x-auto">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 px-2">Student</th>
                <th className="py-2 px-2">Exam</th>
                <th className="py-2 px-2">Started</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Score</th>
                <th className="py-2 px-2">Violations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 px-2">{r.student_name}</td>
                  <td className="py-2 px-2">{r.exam_title}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="py-2 px-2">
                    {r.submitted_at
                      ? <span className="px-1.5 py-0.5 rounded bg-secondary text-[11px]">Submitted</span>
                      : <span className="px-1.5 py-0.5 rounded bg-muted text-[11px]">In progress</span>}
                  </td>
                  <td className="py-2 px-2">{r.score ?? "—"}</td>
                  <td className="py-2 px-2">
                    {r.violation_count
                      ? <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[11px]">{r.violation_count}</span>
                      : <span className="text-muted-foreground text-xs">0</span>}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => review(r)}><Eye className="size-3.5 mr-1" /> Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{open?.student_name} — {open?.exam_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Violations ({violations.length})</h4>
              {(() => {
                const total = violations.reduce((s: number, v: any) => s + (v.risk_score ?? 0), 0);
                const level = total <= 20 ? "Normal" : total <= 50 ? "Review" : total <= 80 ? "High" : "Critical";
                const tone = total <= 20 ? "bg-success/10 text-success" : total <= 50 ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200" : "bg-destructive/15 text-destructive";
                return (
                  <div className={`mb-2 inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${tone}`}>
                    Risk score {total} · {level}
                  </div>
                );
              })()}
              {violations.length === 0 ? <div className="text-sm text-muted-foreground">None recorded.</div> : (
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                 {violations.map((v, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{new Date(v.created_at).toLocaleTimeString()}</span>
                      <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{v.type}</span>
                      {typeof v.risk_score === "number" && v.risk_score > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 text-[10px]">+{v.risk_score}</span>
                      )}
                      {v.detail && <span className="text-muted-foreground">{v.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Snapshots ({snapshots.length})</h4>
              {snapshots.length === 0 ? <div className="text-sm text-muted-foreground">No snapshots — this exam may not have been proctored.</div> : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[400px] overflow-y-auto">
                  {snapshots.map(s => (
                    <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="block">
                      <img src={s.url} alt={s.name} className="w-full h-24 object-cover rounded border border-border" />
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{new Date(Number(s.name.replace(".jpg", ""))).toLocaleTimeString()}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
