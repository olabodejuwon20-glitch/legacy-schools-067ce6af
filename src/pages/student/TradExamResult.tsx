import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { ResultReleaseBadge } from "@/components/exam/ResultReleaseBadge";

export default function StudentTradExamResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { school } = useSchool();
  const [row, setRow] = useState<any | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      const { data } = await supabase.from("trad_exam_results" as any)
        .select("*, exam:trad_exams(title)")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      setRow(data);
    })();
  }, [attemptId]);

  return (
    <div className="space-y-4 max-w-2xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to={schoolPath(school?.slug, "/app/student/trad-exams")}><ArrowLeft className="size-4 mr-1" />Back</Link>
      </Button>
      {!row ? <div className="text-sm text-muted-foreground">Result not yet released.</div> : (
        <SectionCard
          title={<div className="flex items-center gap-2"><Trophy className="size-5 text-amber-500" /> {row.exam?.title}</div>}
          description="Released by your school"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Score" value={`${Number(row.total_score).toFixed(0)} / ${Number(row.max_score).toFixed(0)}`} />
            <Stat label="Percentage" value={`${Number(row.percentage).toFixed(1)}%`} />
            <Stat label="Grade" value={row.grade ?? "-"} highlight />
            <Stat label="Status" value={<ResultReleaseBadge status={row.status} released_at={row.released_at} scheduled_release_at={row.scheduled_release_at} />} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-xs text-muted-foreground">MCQ</div>
              <div className="font-display font-semibold">{Number(row.mcq_score).toFixed(0)}</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Theory</div>
              <div className="font-display font-semibold">{Number(row.theory_score).toFixed(0)}</div></div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={"rounded-lg border border-border p-3 " + (highlight ? "bg-primary/10" : "bg-card")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-semibold text-lg">{value}</div>
    </div>
  );
}