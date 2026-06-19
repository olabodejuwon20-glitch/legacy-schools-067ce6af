import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { usePilot } from "@/lib/pilot";

export function PilotReadOnlyBanner() {
  const { school, activeRole } = useSchool();
  const { pilot } = usePilot(school?.id);
  if (!pilot || !pilot.read_only || activeRole !== "admin") return null;
  return (
    <div className="sticky top-0 z-30 bg-destructive text-destructive-foreground">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="font-semibold">Pilot expired.</span> Your school is read-only. Upgrade to continue adding new students, classes, exams, and attendance.
        </span>
        <Link
          to={schoolPath(school?.slug, "/app/admin/subscription")}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-destructive-foreground/15 hover:bg-destructive-foreground/25 font-medium"
        >
          Upgrade <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}