import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Send, CalendarClock, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Row = {
  id: string; attempt_id: string; student_id: string;
  percentage: number; grade: string | null; status: string;
  released_at: string | null;
  scheduled_release_at: string | null;
  forwarded_to_admin_at: string | null;
  exam: { title: string } | null;
  student: { full_name: string | null; email: string | null } | null;
};

const TONE: Record<string, string> = {
  pending_validation: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  forwarded_admin: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  validated: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const LABEL: Record<string, string> = {
  pending_validation: "Committee review",
  forwarded_admin: "Awaiting admin release",
  validated: "Released",
  rejected: "Rejected",
};

export default function AdminTradExamResults() {
  const { school } = useSchool();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [releaseAt, setReleaseAt] = useState<Record<string, string>>({});

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase.from("trad_exam_results" as any)
      .select("id, attempt_id, student_id, percentage, grade, status, released_at, scheduled_release_at, forwarded_to_admin_at, exam:trad_exams(title), student:profiles(full_name,email)")
      .eq("school_id", school.id)
      .order("updated_at", { ascending: false });
    setRows(((data as any) ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [school?.id]);

  async function forwardToAdmin(attemptId: string) {
    const { error } = await supabase.rpc("trad_committee_forward_result" as any, { _attempt_id: attemptId });
    if (error) return toast.error(error.message);
    toast.success("Forwarded to admin for release scheduling");
    load();
  }

  async function reject(attemptId: string) {
    const { error } = await supabase.rpc("trad_validate_result", { _attempt_id: attemptId, _action: "reject" });
    if (error) return toast.error(error.message);
    toast.success("Result rejected — sent back for review");
    load();
  }

  async function schedule(attemptId: string, when: string) {
    if (!when) return toast.error("Pick a release date and time");
    const iso = new Date(when).toISOString();
    const { error } = await supabase.rpc("trad_admin_schedule_release" as any, { _attempt_id: attemptId, _release_at: iso });
    if (error) return toast.error(error.message);
    toast.success("Release scheduled — students will see it at that time");
    load();
  }

  async function releaseNow(attemptId: string) {
    const { error } = await supabase.rpc("trad_admin_schedule_release" as any, { _attempt_id: attemptId, _release_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Result released to student");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={schoolPath(school?.slug, "/app/admin/trad-exams")}><ArrowLeft className="size-4 mr-1" />Back</Link>
        </Button>
      </div>
      <SectionCard title="Results pipeline"
        description="Committee reviews graded results and forwards them to administration. Admin then schedules the release date — students only see results when that date passes.">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
          : rows.length === 0 ? (
            <EmptyState icon={Trophy} title="No results yet"
              desc="Once students submit and theory answers are graded, results appear here for validation." />
          ) : (
            <div className="space-y-2">
              {rows.map(r => {
                const scheduledFuture = r.released_at && new Date(r.released_at) > new Date();
                return (
                  <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold truncate">{r.exam?.title ?? "Paper"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.student?.full_name ?? r.student?.email ?? r.student_id} · {Number(r.percentage).toFixed(1)}% · {r.grade ?? "-"}
                      </div>
                      {scheduledFuture && (
                        <div className="text-xs text-blue-600 dark:text-blue-300 mt-1 inline-flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          Scheduled for {new Date(r.released_at!).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={TONE[r.status] ?? ""}>{LABEL[r.status] ?? r.status}</Badge>

                    {r.status === "pending_validation" && (
                      <>
                        <Button size="sm" onClick={() => forwardToAdmin(r.attempt_id)}>
                          <Send className="size-3.5 mr-1" />Forward to admin
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => reject(r.attempt_id)}>
                          <XCircle className="size-3.5 mr-1" />Reject
                        </Button>
                      </>
                    )}

                    {r.status === "forwarded_admin" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          type="datetime-local"
                          className="h-9 w-auto"
                          value={releaseAt[r.attempt_id] ?? ""}
                          onChange={(e) => setReleaseAt(s => ({ ...s, [r.attempt_id]: e.target.value }))}
                        />
                        <Button size="sm" onClick={() => schedule(r.attempt_id, releaseAt[r.attempt_id])}>
                          <CalendarClock className="size-3.5 mr-1" />Schedule release
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => releaseNow(r.attempt_id)}>
                          <Rocket className="size-3.5 mr-1" />Release now
                        </Button>
                      </div>
                    )}

                    {r.status === "validated" && scheduledFuture && (
                      <Button size="sm" variant="outline" onClick={() => releaseNow(r.attempt_id)}>
                        <Rocket className="size-3.5 mr-1" />Release now
                      </Button>
                    )}

                    {r.status === "validated" && !scheduledFuture && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-300 inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />Visible to student
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </SectionCard>
    </div>
  );
}