import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Appeal = {
  id: string; attempt_id: string; student_id: string; reason: string;
  status: string; stage_notes: any[]; created_at: string;
};

const NEXT_STAGE: Record<string, string> = {
  open: "teacher_review",
  teacher_review: "hod_review",
  hod_review: "admin_review",
  admin_review: "approved",
};

export default function ExamAppealsAdmin() {
  const { school } = useSchool();
  const [rows, setRows] = useState<Appeal[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!school?.id) return;
    const load = async () => {
      const { data } = await supabase.from("exam_appeals" as any).select("*")
        .eq("school_id", school.id).order("created_at", { ascending: false });
      setRows((data as any) ?? []);
    };
    load();
    const ch = supabase.channel("exam_appeals_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_appeals", filter: `school_id=eq.${school.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [school?.id]);

  async function advance(a: Appeal, decision: "advance" | "approve" | "reject") {
    const note = notes[a.id] ?? "";
    const newNotes = [...(a.stage_notes ?? []), { stage: a.status, decision, note, at: new Date().toISOString() }];
    const newStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : (NEXT_STAGE[a.status] ?? "admin_review");
    const { error } = await supabase.from("exam_appeals" as any).update({
      status: newStatus, stage_notes: newNotes,
    }).eq("id", a.id);
    if (error) toast.error(error.message); else toast.success(`Appeal ${newStatus}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Appeals" description="Multi-stage review: Teacher → HOD → Admin. Decisions are append-only." />
      <SectionCard title={`${rows.length} appeals`}>
        {rows.length === 0 && <div className="text-sm text-muted-foreground">No appeals.</div>}
        <div className="space-y-3">
          {rows.map(a => (
            <div key={a.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Attempt {a.attempt_id.slice(0,8)}…</div>
                <Badge>{a.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{a.reason}</div>
              {a.stage_notes?.length > 0 && (
                <div className="text-[11px] space-y-1">
                  {a.stage_notes.map((n: any, i: number) => (
                    <div key={i} className="border-l-2 pl-2"><b>{n.stage}</b> · {n.decision} · {n.note}</div>
                  ))}
                </div>
              )}
              {!["approved","rejected","recalculated"].includes(a.status) && (
                <div className="space-y-2">
                  <Textarea placeholder="Note for this stage" value={notes[a.id] ?? ""} onChange={e => setNotes({ ...notes, [a.id]: e.target.value })} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => advance(a, "advance")}>Advance →</Button>
                    <Button size="sm" variant="default" onClick={() => advance(a, "approve")}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => advance(a, "reject")}>Reject</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}