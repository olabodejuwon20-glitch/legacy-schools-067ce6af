import { useSchool } from "@/contexts/SchoolContext";
import { usePilot, pilotProgress, pilotTone } from "@/lib/pilot";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { schoolPath } from "@/lib/tenant";
import { ArrowRight, Calendar, Clock, Crown, Sparkles, CheckCircle2, AlertCircle, Lock } from "lucide-react";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PilotDetailsCard() {
  const { school } = useSchool();
  const { pilot, loading } = usePilot(school?.id);

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!school) return null;

  if (!pilot || pilot.pilot_status === "none") {
    return (
      <SectionCard title="Pilot Program">
        <p className="text-sm text-muted-foreground">
          This school is not enrolled in the 60-Day Pilot Program. Your subscription is active.
        </p>
      </SectionCard>
    );
  }

  const tone = pilotTone(pilot);
  const pct = pilotProgress(pilot);
  const base = schoolPath(school.slug, "/app/admin");

  const statusMeta = {
    active:    { label: "Active",    icon: Sparkles,      color: "text-primary",     bg: "bg-primary/10",     ring: "ring-primary/30" },
    expired:   { label: "Expired",   icon: AlertCircle,   color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/30" },
    converted: { label: "Converted", icon: CheckCircle2,  color: "text-primary",     bg: "bg-primary/10",     ring: "ring-primary/30" },
    none:      { label: "—",         icon: Crown,         color: "text-muted-foreground", bg: "bg-muted", ring: "ring-border" },
  }[pilot.pilot_status];
  const StatusIcon = statusMeta.icon;

  const barColor = tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-primary";

  return (
    <div className="space-y-4">
      <SectionCard title="60-Day Pilot Program">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`size-11 rounded-xl ${statusMeta.bg} ring-1 ${statusMeta.ring} grid place-items-center ${statusMeta.color}`}>
              <StatusIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current status</div>
              <div className="font-display text-xl font-semibold mt-0.5">{statusMeta.label}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Plan: <span className="font-medium text-foreground">{pilot.plan}</span>
                {" · "}School status: <span className="font-medium text-foreground">{pilot.status}</span>
              </div>
            </div>
          </div>
          {pilot.pilot_status !== "converted" && (
            <Link
              to={`${base}/subscription`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
            >
              Upgrade now <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3.5" /> Trial start
            </div>
            <div className="text-sm font-medium mt-1">{fmt(pilot.pilot_started_at)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3.5" /> Trial end
            </div>
            <div className="text-sm font-medium mt-1">{fmt(pilot.pilot_ends_at)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Days remaining
            </div>
            <div className="text-sm font-medium mt-1">
              {pilot.pilot_status === "active" && pilot.days_remaining != null
                ? `${pilot.days_remaining} day${pilot.days_remaining === 1 ? "" : "s"}`
                : pilot.pilot_status === "expired" ? "0 days" : "—"}
            </div>
          </div>
        </div>

        {pilot.pilot_status === "active" && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Trial progress</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Lock className="size-3.5 text-primary" /> Premium preview
          </div>
          <p className="text-muted-foreground mt-1">
            {pilot.premium_unlocked
              ? `Premium features are unlocked until ${fmt(pilot.pilot_premium_until)}.`
              : "Premium features are locked. Upgrade your school subscription to unlock this feature."}
          </p>
        </div>

        {pilot.pilot_converted_at && (
          <p className="text-xs text-muted-foreground mt-3">
            Converted to a paid subscription on {fmt(pilot.pilot_converted_at)}.
          </p>
        )}
      </SectionCard>
    </div>
  );
}