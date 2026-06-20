import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function StudentAppealForm() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { school, user } = useSchool();
  const nav = useNavigate();
  const [reason, setReason] = useState("");
  const [existing, setExisting] = useState<any[]>([]);

  useEffect(() => {
    if (!attemptId) return;
    supabase.from("exam_appeals" as any).select("*").eq("attempt_id", attemptId)
      .then(({ data }) => setExisting((data as any) ?? []));
  }, [attemptId]);

  async function submit() {
    if (!school?.id || !user?.id || !attemptId) return;
    if (reason.trim().length < 10) { toast.error("Please describe your concern (10+ chars)"); return; }
    const { error } = await supabase.from("exam_appeals" as any).insert({
      school_id: school.id, student_id: user.id, attempt_id: attemptId,
      reason: reason.trim(), exam_kind: "cbt",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Appeal submitted");
    nav(-1);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Request a Review" description="Explain why you'd like your exam reviewed. Your appeal goes to your teacher, then HOD, then Admin." />
      <SectionCard title="Your appeal">
        <Textarea rows={6} placeholder="Describe what happened…" value={reason} onChange={e => setReason(e.target.value)} />
        <div className="flex justify-end mt-3"><Button onClick={submit}>Submit appeal</Button></div>
      </SectionCard>
      {existing.length > 0 && (
        <SectionCard title="Previous appeals for this attempt">
          {existing.map(a => (
            <div key={a.id} className="flex items-center justify-between border-b py-2">
              <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              <Badge>{a.status}</Badge>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}