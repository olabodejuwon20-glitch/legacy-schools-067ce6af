import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { usePilot } from "@/lib/pilot";
import { Loader2 } from "lucide-react";

interface Props {
  feature: string;
  description?: string;
  children: ReactNode;
  /** Show a soft inline lock card instead of replacing children */
  soft?: boolean;
}

export function PremiumGate({ feature, description, children, soft }: Props) {
  const { school, activeRole } = useSchool();
  const { pilot, loading } = usePilot(school?.id);

  if (loading) {
    return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  // No school context or not a pilot school → allow (covers super admin, paid plans, legacy schools)
  if (!pilot || pilot.pilot_status === "none") return <>{children}</>;
  if (pilot.premium_unlocked) return <>{children}</>;

  const base = schoolPath(school?.slug, `/app/${activeRole ?? "admin"}`);

  if (soft) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center text-primary"><Lock className="size-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-primary">Premium Feature</div>
            <div className="font-medium truncate">{feature}</div>
          </div>
          <Link to={`${base}/subscription`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-foreground text-background text-sm font-medium">
            Upgrade <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {description && <p className="text-sm text-muted-foreground mt-3">{description}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="max-w-md w-full text-center rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 shadow-soft">
        <div className="size-14 mx-auto rounded-2xl bg-primary/15 grid place-items-center text-primary mb-4">
          <Sparkles className="size-7" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Premium Feature</div>
        <h2 className="font-display text-2xl font-bold">{feature}</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {description ?? "Upgrade your school subscription to unlock this feature."}
        </p>
        {pilot.days_remaining != null && pilot.pilot_status === "active" && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-background border border-border">
            <Lock className="size-3" />
            {pilot.days_remaining} days left in your pilot
          </div>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link to={`${base}/subscription`} className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-foreground text-background text-sm font-medium">
            View plans <ArrowRight className="size-4" />
          </Link>
          <Link to={base} className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-border text-sm font-medium">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}