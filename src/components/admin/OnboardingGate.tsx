import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";

/** Forces newly-registered school admins through setup before the app shell loads. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { school, activeRole } = useSchool();
  const location = useLocation();
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!school || activeRole !== "admin") { setDone(true); return; }
    try {
      if (sessionStorage.getItem(`onboarding-complete:${school.id}`) === "1") {
        setDone(true);
        return;
      }
    } catch {}
    let active = true;
    supabase.from("schools").select("settings").eq("id", school.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      const s = (data?.settings ?? {}) as any;
      setDone(Boolean(s.onboarded_at));
    });
    return () => { active = false; };
  }, [school?.id, activeRole]);

  if (done === null) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!done) {
    return <Navigate to={schoolPath(school?.slug, "/onboarding")} replace />;
  }
  return <>{children}</>;
}