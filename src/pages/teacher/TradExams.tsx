import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";
import type { TradExam } from "@/lib/tradExams";
import { DRAFT_STATUS_TONE, formatStatus } from "@/lib/tradExams";

export default function TeacherTradExams() {
  const { school } = useSchool();
  const [exams, setExams] = useState<TradExam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("trad_exams" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      setExams(((data as any) ?? []) as TradExam[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools Exam"
        description="Papers assigned to you. Build questions manually or upload a document to extract with AI."
      />
      <SectionCard title="My papers" description="You only see papers where you are listed as the author.">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No papers assigned yet"
            desc="An admin will generate exam papers for you from the timetable. They will appear here."
          />
        ) : (
          <div className="grid gap-2">
            {exams.map((e) => (
              <Link
                key={e.id}
                to={schoolPath(school?.slug, `/app/teacher/trad-exams/paper/${e.id}`)}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-accent/40 transition"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.exam_type.toUpperCase()} · {e.total_marks} marks
                  </div>
                </div>
                <Badge variant="outline" className={DRAFT_STATUS_TONE[e.draft_status]}>
                  {formatStatus(e.draft_status)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}