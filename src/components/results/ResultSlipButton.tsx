import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSchool } from "@/contexts/SchoolContext";
import { fetchReportCardData, openPremiumReportCard } from "@/lib/reportCard";
import { downloadResultSlip } from "@/lib/slip";

export function ResultSlipButton({
  studentId,
  term,
  disabled,
  className,
  size = "default",
  variant = "default",
  fullWidthOnMobile = true,
}: {
  studentId?: string;
  term?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary";
  fullWidthOnMobile?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { school } = useSchool();
  async function handle() {
    if (!studentId) return;
    if (loading) return;
    setLoading(true);
    try {
      if (school?.id) {
        const data = await fetchReportCardData(school.id, studentId, term ?? "");
        if (data && data.subjects.length) {
          openPremiumReportCard(data);
          toast.success("Opening branded report card…");
          return;
        }
      }
      // fallback to legacy slip when no released results yet
      await downloadResultSlip(studentId, term);
      toast.success("Result slip downloaded");
    } catch (e: any) {
      toast.error("Could not generate the report card. Please try again.");
    } finally { setLoading(false); }
  }
  return (
    <Button
      onClick={handle}
      size={size}
      variant={variant}
      disabled={!studentId || disabled || loading}
      className={cn(fullWidthOnMobile && "w-full sm:w-auto", className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin sm:mr-2" /> : <FileDown className="size-4 sm:mr-2" />}
      <span className={cn("ml-2 sm:ml-0")}>{loading ? "Preparing report card…" : "Download Report Card"}</span>
    </Button>
  );
}