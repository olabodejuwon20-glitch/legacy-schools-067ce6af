import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2, Clock, Send, XCircle } from "lucide-react";

export type ResultStatusInput = {
  status?: string | null;          // pending_validation | forwarded_admin | validated | rejected
  released_at?: string | null;     // when the result becomes visible to the student
  scheduled_release_at?: string | null;
};

/** Single source of truth for the exam-result lifecycle badge.
 *  Used on Teacher, Committee, and Admin views so the workflow is obvious. */
export function ResultReleaseBadge({ status, released_at, scheduled_release_at }: ResultStatusInput) {
  const now = Date.now();
  const releaseAt = released_at ? new Date(released_at).getTime() : null;
  const scheduled = scheduled_release_at ? new Date(scheduled_release_at).getTime() : null;

  if (status === "rejected") {
    return <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-300 gap-1">
      <XCircle className="size-3" />Rejected
    </Badge>;
  }
  if (status === "pending_validation") {
    return <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 gap-1">
      <Clock className="size-3" />Committee review
    </Badge>;
  }
  if (status === "forwarded_admin") {
    return <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-300 gap-1">
      <Send className="size-3" />Awaiting admin release
    </Badge>;
  }
  if (status === "validated") {
    if (releaseAt && releaseAt > now) {
      return <Badge variant="outline" className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 gap-1">
        <CalendarClock className="size-3" />Scheduled
      </Badge>;
    }
    return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 gap-1">
      <CheckCircle2 className="size-3" />Released
    </Badge>;
  }
  // Fallback for CA/Test exams where status isn't tracked but a release date may exist.
  if (scheduled && scheduled > now) {
    return <Badge variant="outline" className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 gap-1">
      <CalendarClock className="size-3" />Scheduled
    </Badge>;
  }
  if (scheduled && scheduled <= now) {
    return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 gap-1">
      <CheckCircle2 className="size-3" />Released
    </Badge>;
  }
  return <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
    <Clock className="size-3" />Not released
  </Badge>;
}