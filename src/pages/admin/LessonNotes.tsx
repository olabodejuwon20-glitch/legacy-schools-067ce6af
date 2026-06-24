import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, XCircle, Clock, Loader2, Search, FileEdit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Note = {
  id: string; title: string; subject: string | null; grade_level: string | null;
  topic: string | null; duration_min: number | null; content: string;
  status: "draft" | "pending" | "approved" | "rejected";
  admin_feedback: string | null; created_at: string; teacher_id: string;
};

const STATUS: Record<string, { label: string; icon: any; cls: string }> = {
  draft:    { label: "Draft",        icon: FileEdit,     cls: "bg-muted text-muted-foreground" },
  pending:  { label: "Pending",      icon: Clock,        cls: "bg-warning/15 text-warning-foreground border border-warning/30" },
  approved: { label: "Approved",     icon: CheckCircle2, cls: "bg-success/15 text-success border border-success/30" },
  rejected: { label: "Rejected",     icon: XCircle,      cls: "bg-destructive/15 text-destructive border border-destructive/30" },
};

export default function AdminLessonNotes() {
  const { school } = useSchool();
  const [notes, setNotes] = useState<Note[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [review, setReview] = useState<Note | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!school) return;
    setLoading(true);
    const { data } = await supabase
      .from("lesson_notes").select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Note[];
    setNotes(rows);
    const ids = Array.from(new Set(rows.map(r => r.teacher_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map: Record<string, string> = {};
      profs?.forEach(p => map[p.id] = p.full_name || p.email || p.id.slice(0, 6));
      setTeachers(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [school]);

  const counts = useMemo(() => ({
    pending: notes.filter(n => n.status === "pending").length,
    approved: notes.filter(n => n.status === "approved").length,
    rejected: notes.filter(n => n.status === "rejected").length,
    all: notes.length,
  }), [notes]);

  const filtered = notes.filter(n =>
    (tab === "all" || n.status === tab) &&
    (!q || n.title.toLowerCase().includes(q.toLowerCase()) || (teachers[n.teacher_id] || "").toLowerCase().includes(q.toLowerCase()))
  );

  async function decide(status: "approved" | "rejected") {
    if (!review) return;
    if (status === "rejected" && !feedback.trim()) return toast.error("Please provide feedback for rejection");
    setBusy(true);
    const { error } = await supabase.from("lesson_notes").update({
      status, admin_feedback: status === "rejected" ? feedback.trim() : null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", review.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Lesson note approved" : "Sent back to teacher");
    setReview(null); setFeedback(""); await load();
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Lesson note approvals"
        description="Review and approve lesson notes submitted by teachers before they're used in class."
        action={
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or teacher" className="pl-9 h-9" />
          </div>
        }
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="flex w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="pending" className="flex-1 min-w-[80px] text-xs sm:text-sm">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved" className="flex-1 min-w-[80px] text-xs sm:text-sm">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1 min-w-[80px] text-xs sm:text-sm">Rejected ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="all" className="flex-1 min-w-[60px] text-xs sm:text-sm">All ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={BookOpen} title="Nothing here" desc="No lesson notes match this view." />
          ) : (
            <ul className="space-y-3">
              {filtered.map(n => {
                const s = STATUS[n.status];
                return (
                  <li key={n.id} className="rounded-lg border border-border p-4 bg-card flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold truncate">{n.title}</h4>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.cls}`}>
                          <s.icon className="size-3" />{s.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        By {teachers[n.teacher_id] || "Teacher"} ·{" "}
                        {[n.subject, n.grade_level, n.topic].filter(Boolean).join(" · ")} ·{" "}
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => { setReview(n); setFeedback(n.admin_feedback ?? ""); }}>
                      Review
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SectionCard>

      <Dialog open={!!review} onOpenChange={(o) => { if (!o) { setReview(null); setFeedback(""); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{review?.title}</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground">
            {teachers[review?.teacher_id ?? ""]} · {[review?.subject, review?.grade_level, review?.topic].filter(Boolean).join(" · ")}
          </div>
          <pre className="whitespace-pre-wrap text-sm font-sans mt-3 max-h-[50vh] overflow-y-auto border border-border rounded-md p-4 bg-secondary/30">{review?.content}</pre>
          {review?.status === "pending" || review?.status === "rejected" ? (
            <>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Feedback (required to reject)</label>
                <Textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="What needs to change?" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => decide("rejected")} disabled={busy}>
                  <XCircle className="size-4 mr-2" />Reject
                </Button>
                <Button onClick={() => decide("approved")} disabled={busy}>
                  {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle2 className="size-4 mr-2" />}Approve
                </Button>
              </DialogFooter>
            </>
          ) : (
            <DialogFooter><Button variant="outline" onClick={() => setReview(null)}>Close</Button></DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}