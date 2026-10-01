import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, FileText, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export default function ParentAttendance() {
  const { school, user } = useSchool();
  const [groups, setGroups] = useState<{ name: string; rows: any[] }[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [excuseText, setExcuseText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!school || !user) return;
    const { data: links } = await supabase.from("parent_links").select("student_user_id").eq("school_id", school.id).eq("parent_user_id", user.id);
    const ids = (links ?? []).map(l => l.student_user_id);
    if (!ids.length) return;
    const [{ data: profs }, { data: att }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").in("id", ids),
      supabase.from("attendance").select("*").eq("school_id", school.id).in("student_id", ids).order("date", { ascending: false }).limit(200),
    ]);
    const map = Object.fromEntries((profs ?? []).map(p => [p.id, p.full_name || p.email || "?"]));
    const g: Record<string, any[]> = {};
    (att ?? []).forEach(r => { (g[map[r.student_id] || "?"] ||= []).push(r); });
    setGroups(Object.entries(g).map(([name, rows]) => ({ name, rows })));
  }, [school, user]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  async function submitExcuse(row: any) {
    if (!excuseText.trim()) return toast.error("Please provide a reason for the absence or late arrival.");
    setSubmitting(true);
    const { error } = await supabase.from("attendance").update({ excuse_note: excuseText.trim(), excuse_status: "pending" } as any).eq("id", row.id);
    setSubmitting(false);
    if (error) toast.error(friendlyError(error, "We couldn't submit your absence note. Please try again."));
    else { toast.success("Absence note submitted for teacher and admin review."); setActiveRowId(null); setExcuseText(""); void loadRecords(); }
  }

  if (!groups.length) return <SectionCard title="Attendance"><EmptyState icon={ClipboardCheck} title="No attendance records yet" desc="Daily attendance marks will appear here once recorded by the class teacher." /></SectionCard>;

  return (
    <div className="space-y-6">{groups.map(g => {
      const tot = g.rows.length;
      const pres = g.rows.filter(r => r.status === "present" || r.status === "late").length;
      return (
        <SectionCard key={g.name} title={g.name} description={`${pres}/${tot} days attended (${Math.round(pres/tot*100)}%)`}>
          <ul className="divide-y divide-border max-h-[380px] overflow-y-auto">{g.rows.slice(0, 30).map(r => (
            <li key={r.id} className="py-2.5 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{new Date(r.date).toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" })}</span>
                  {r.excuse_status && (
                    <Badge variant="outline" className={r.excuse_status === "approved" ? "border-success/40 text-success text-[10px]" : r.excuse_status === "rejected" ? "border-destructive/40 text-destructive text-[10px]" : "border-warning/40 text-warning text-[10px]"}>
                      Excuse {r.excuse_status}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(r.status === "absent" || r.status === "late") && !r.excuse_status && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setActiveRowId(activeRowId === r.id ? null : r.id); setExcuseText(r.excuse_note || ""); }}>
                      <FileText className="h-3 w-3" /> Submit Excuse
                    </Button>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "present" ? "bg-success/10 text-success" : r.status === "absent" ? "bg-destructive/10 text-destructive" : r.status === "excused" ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning"}`}>{r.status}</span>
                </div>
              </div>
              {r.excuse_note && <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5"><strong>Excuse note:</strong> {r.excuse_note}</div>}
              {activeRowId === r.id && (
                <div className="flex items-center gap-2 pt-1">
                  <Input value={excuseText} onChange={e => setExcuseText(e.target.value)} placeholder="Reason (e.g., medical appointment, transport delay)…" className="h-8 text-xs" />
                  <Button size="sm" className="h-8 text-xs gap-1" disabled={submitting} onClick={() => submitExcuse(r)}><Send className="h-3 w-3" /> Send</Button>
                </div>
              )}
            </li>
          ))}</ul>
        </SectionCard>
      );
    })}</div>
  );
}