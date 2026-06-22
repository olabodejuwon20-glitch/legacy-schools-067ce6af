import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, Rocket, FileBarChart, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResultReleaseBadge } from "@/components/exam/ResultReleaseBadge";
import { toast } from "sonner";

type ExamRow = {
  id: string;
  title: string;
  subject: string | null;
  mode: string | null;
  results_release_at: string | null;
  submitted_count?: number;
};

export default function AdminExamResultsRelease() {
  const { school } = useSchool();
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function load() {
    if (!school) return;
    setLoading(true);
    const { data: exams } = await supabase
      .from("exams")
      .select("id,title,subject,mode,results_release_at")
      .eq("school_id", school.id)
      .neq("mode", "practice")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = (exams ?? []).map((e: any) => e.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: atts } = await supabase
        .from("exam_attempts")
        .select("exam_id, submitted_at")
        .in("exam_id", ids)
        .not("submitted_at", "is", null);
      (atts ?? []).forEach((a: any) => counts.set(a.exam_id, (counts.get(a.exam_id) ?? 0) + 1));
    }
    setRows((exams ?? []).map((e: any) => ({ ...e, submitted_count: counts.get(e.id) ?? 0 })));
    setLoading(false);
  }
  useEffect(() => { load(); }, [school?.id]);

  function localDatetimeValue(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function schedule(examId: string, when: string) {
    if (!when) return toast.error("Pick a release date and time");
    const iso = new Date(when).toISOString();
    const { error } = await supabase.from("exams").update({ results_release_at: iso }).eq("id", examId);
    if (error) return toast.error(error.message);
    toast.success("Release scheduled — students see results at that time");
    load();
  }

  async function releaseNow(examId: string) {
    const iso = new Date().toISOString();
    const { error } = await supabase.from("exams").update({ results_release_at: iso }).eq("id", examId);
    if (error) return toast.error(error.message);
    toast.success("Released to students");
    load();
  }

  async function clearRelease(examId: string) {
    const { error } = await supabase.from("exams").update({ results_release_at: null }).eq("id", examId);
    if (error) return toast.error(error.message);
    toast.success("Release withdrawn — results hidden from students");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={schoolPath(school?.slug, "/app/admin/assessments")}><ArrowLeft className="size-4 mr-1" />Back</Link>
        </Button>
      </div>
      <SectionCard title="CA & Test result release"
        description="Students cannot see scores until the release date passes. Schedule the moment results unlock, or release now.">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
          : rows.length === 0 ? (
            <EmptyState icon={FileBarChart} title="No exams yet"
              desc="Once teachers publish CA tests or exams here, you'll schedule when students see results." />
          ) : (
            <div className="space-y-2">
              {rows.map(e => {
                const value = draft[e.id] ?? localDatetimeValue(e.results_release_at);
                return (
                  <div key={e.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold truncate">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {(e.subject ?? "—")} · {(e.mode ?? "exam").toUpperCase()} · {e.submitted_count} submitted
                      </div>
                      {e.results_release_at && (
                        <div className="text-xs text-blue-600 dark:text-blue-300 mt-1 inline-flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          {new Date(e.results_release_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <ResultReleaseBadge scheduled_release_at={e.results_release_at} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="datetime-local"
                        className="h-9 w-auto"
                        value={value}
                        onChange={(ev) => setDraft(s => ({ ...s, [e.id]: ev.target.value }))}
                      />
                      <Button size="sm" onClick={() => schedule(e.id, draft[e.id] ?? value)}>
                        <CalendarClock className="size-3.5 mr-1" />Schedule
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => releaseNow(e.id)}>
                        <Rocket className="size-3.5 mr-1" />Release now
                      </Button>
                      {e.results_release_at && (
                        <Button size="sm" variant="ghost" onClick={() => clearRelease(e.id)}>
                          <RotateCcw className="size-3.5 mr-1" />Withdraw
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </SectionCard>
    </div>
  );
}