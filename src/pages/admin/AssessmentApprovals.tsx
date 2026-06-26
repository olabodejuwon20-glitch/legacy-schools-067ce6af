import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ClipboardCheck, Send, MessageSquareWarning, Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type Pending = {
  kind: "assessment" | "exam";
  id: string;
  title: string;
  type?: string | null;
  subject?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  status: string;
};

export default function AssessmentApprovals() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changesFor, setChangesFor] = useState<Pending | null>(null);
  const [changesNote, setChangesNote] = useState("");

  async function load() {
    if (!school) return;
    setLoading(true);
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from("assessments").select("id,title,type,status,created_at")
        .eq("school_id", school.id).eq("status", "in_review").order("created_at", { ascending: false }),
      supabase.from("exams").select("id,title,subject,status,submitted_at,submitted_by,created_at")
        .eq("school_id", school.id).eq("status", "draft").not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }),
    ]);
    const list: Pending[] = [
      ...(((a as any[]) ?? []).map(r => ({ kind: "assessment" as const, id: r.id, title: r.title, type: r.type, status: r.status, submitted_at: r.created_at }))),
      ...(((e as any[]) ?? []).map(r => ({ kind: "exam" as const, id: r.id, title: r.title, subject: r.subject, status: r.status, submitted_at: r.submitted_at, submitted_by: r.submitted_by }))),
    ];
    setRows(list);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function approveAndPublish(p: Pending) {
    if (!school || !user || busyId) return;
    setBusyId(p.id);
    try {
      if (p.kind === "assessment") {
        const { error } = await supabase.rpc("publish_assessment", { _assessment_id: p.id });
        if (error) throw error;
      } else {
        const nowIso = new Date().toISOString();
        const { error } = await supabase.from("exams").update({
          status: "scheduled" as any,
          approved_at: nowIso, approved_by: user.id,
          published_at: nowIso, published_by: user.id,
        } as any).eq("id", p.id);
        if (error) throw error;
      }
      await supabase.from("exam_review_events").insert({
        school_id: school.id, exam_kind: p.kind === "assessment" ? "legacy" : "legacy",
        exam_id: p.id, action: "approved", actor_id: user.id,
      } as any);
      toast.success("Approved and published to students");
      load();
    } catch {
      toast.error("Could not approve. Please try again.");
    } finally { setBusyId(null); }
  }

  async function requestChanges() {
    if (!changesFor || !school || !user) return;
    if (!changesNote.trim()) return toast.error("Add a note for the teacher");
    setBusyId(changesFor.id);
    try {
      const tbl = changesFor.kind === "assessment" ? "assessments" : "exams";
      const patch = changesFor.kind === "assessment"
        ? { status: "draft" as any, review_notes: changesNote.trim() }
        : { status: "draft" as any, submitted_at: null, review_notes: changesNote.trim() };
      const { error } = await supabase.from(tbl).update(patch as any).eq("id", changesFor.id);
      if (error) throw error;
      await supabase.from("exam_review_events").insert({
        school_id: school.id, exam_kind: "legacy", exam_id: changesFor.id,
        action: "changes_requested", notes: changesNote.trim(), actor_id: user.id,
      } as any);
      toast.success("Sent back to the teacher with notes");
      setChangesFor(null); setChangesNote(""); load();
    } catch {
      toast.error("Could not save. Please try again.");
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={schoolPath(school?.slug, "/app/admin/assessments")}><ArrowLeft className="size-4 mr-1" />Back</Link>
        </Button>
      </div>
      <SectionCard
        title="Exam & test approvals"
        description="Papers submitted by teachers. Review the questions, then approve to publish or send back with notes."
      >
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div>
          : rows.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Nothing waiting"
              desc="When a teacher submits an exam or CA test, it shows up here for the committee to review." />
          ) : (
            <div className="space-y-2">
              {rows.map(p => (
                <div key={`${p.kind}:${p.id}`} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-display font-semibold truncate">{p.title}</div>
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                        <ShieldCheck className="size-3 mr-1" />Awaiting approval
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {p.kind === "assessment" ? (p.type ?? "assessment") : "CA / Test"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Submitted {p.submitted_at ? new Date(p.submitted_at).toLocaleString() : "—"}
                      {p.subject ? ` · ${p.subject}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => { setChangesFor(p); setChangesNote(""); }} disabled={!!busyId}>
                      <MessageSquareWarning className="size-3.5 mr-1" />Request changes
                    </Button>
                    <Button size="sm" onClick={() => approveAndPublish(p)} disabled={busyId === p.id}>
                      {busyId === p.id ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Rocket className="size-3.5 mr-1" />}
                      Approve &amp; publish
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </SectionCard>

      <Dialog open={!!changesFor} onOpenChange={(o) => !o && setChangesFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Request changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The paper goes back to the teacher as a draft with your notes attached. They can edit and resubmit.
          </p>
          <Textarea
            value={changesNote}
            onChange={e => setChangesNote(e.target.value)}
            placeholder="What needs to be revised? e.g. Question 4 has two correct options. Add 5 more questions to Section B."
            rows={5}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangesFor(null)}>Cancel</Button>
            <Button onClick={requestChanges} disabled={busyId === changesFor?.id}>
              {busyId === changesFor?.id ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Send className="size-4 mr-1.5" />}
              Send back to teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}