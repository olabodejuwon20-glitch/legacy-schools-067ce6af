import { Link } from "react-router-dom";
import { Sparkles, Crown, AlertCircle, CheckCircle2, ArrowRight, Lock } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { usePilot, pilotProgress, pilotTone } from "@/lib/pilot";
import { Skeleton } from "@/components/ui/skeleton";

export function PilotWidget({ compact = false }: { compact?: boolean }) {
  const { school } = useSchool();
  const { pilot, loading } = usePilot(school?.id);

  if (!school) return null;
  if (loading) return <Skeleton className="h-32 w-full rounded-2xl" />;
  if (!pilot || pilot.pilot_status === "none") return null;

  const tone = pilotTone(pilot);
  const pct = pilotProgress(pilot);
  const base = schoolPath(school.slug, "/app/admin");

  const palette = {
    ok:    "from-primary/15 via-primary/5 to-transparent border-primary/30",
    warn:  "from-warning/15 via-warning/5 to-transparent border-warning/30",
    bad:   "from-destructive/15 via-destructive/5 to-transparent border-destructive/30",
    muted: "from-muted/40 to-transparent border-border",
  }[tone];

  const Icon = pilot.pilot_status === "converted" ? CheckCircle2
             : pilot.pilot_status === "expired" ? AlertCircle
             : pilot.premium_unlocked ? Sparkles : Crown;

  const statusLabel = pilot.pilot_status === "converted" ? "Converted"
                    : pilot.pilot_status === "expired" ? "Expired"
                    : "Active";

  const headline = pilot.pilot_status === "converted"
    ? "Welcome to Legacyskool — your subscription is active."
    : pilot.pilot_status === "expired"
      ? "Your 60-Day Pilot Program has ended."
      : pilot.premium_unlocked
        ? "🎉 Premium preview is unlocked"
        : "🎉 Welcome to the Legacyskool 60-Day Pilot Program";

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${palette} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-background/70 backdrop-blur grid place-items-center border border-border/60">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              60-Day Pilot Program · {statusLabel}
            </div>
            <h3 className="font-display text-lg sm:text-xl font-semibold mt-0.5 truncate">{headline}</h3>
            {pilot.pilot_status === "active" && (
              <p className="text-sm text-muted-foreground mt-1">
                {pilot.premium_unlocked
                  ? `Premium features unlock until ${new Date(pilot.pilot_premium_until!).toLocaleDateString()}.`
                  : "Upgrade anytime to unlock premium features."}
              </p>
            )}
            {pilot.pilot_status === "expired" && (
              <p className="text-sm text-muted-foreground mt-1">
                Your data is preserved and read-only. Upgrade to continue creating records.
              </p>
            )}
          </div>
        </div>
        {pilot.pilot_status !== "converted" && (
          <Link
            to={`${base}/subscription`}
            className="hidden sm:inline-flex shrink-0 items-center gap-1.5 h-9 px-3 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
          >
            Upgrade now <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {pilot.pilot_status === "active" && pilot.days_remaining != null && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{pilot.days_remaining} days remaining</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-background/60 overflow-hidden">
            <div
              className={`h-full rounded-full ${tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {!compact && pilot.pilot_status === "active" && pilot.days_remaining != null && pilot.days_remaining > 14 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/60 backdrop-blur border border-border/60 p-3 text-xs">
          <Lock className="size-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Early Adopter offer:</span> subscribe before your pilot ends for <span className="font-medium text-foreground">20% off</span> your first annual term.
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
        {pilot.pilot_status !== "converted" && (
          <Link to={`${base}/subscription`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-foreground text-background text-sm font-medium">
            Upgrade now <ArrowRight className="size-3.5" />
          </Link>
        )}
        <Link to={`${base}/subscription`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm font-medium">
          View plans
        </Link>
      </div>
    </div>
  );
}