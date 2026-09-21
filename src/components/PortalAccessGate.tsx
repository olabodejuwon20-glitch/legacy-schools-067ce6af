import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";

type PortalAccess = { open: boolean; message: string };

async function fetchPortalAccess(schoolId: string): Promise<PortalAccess> {
  const { data } = await supabase.from("schools").select("settings").eq("id", schoolId).maybeSingle();
  const access = (((data?.settings ?? {}) as any).portal_access ?? {}) as any;
  return { open: access.open !== false, message: access.message ?? "" };
}

/**
 * Blocks student / teacher / parent / staff portals when the school admin has
 * closed the portal. Admins are never blocked.
 */
export function PortalAccessGate({ children }: { children: ReactNode }) {
  const { school, activeRole, displayName, signOut } = useSchool();
  const isAdmin = activeRole === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["portal-access", school?.id],
    queryFn: () => fetchPortalAccess(school!.id),
    enabled: !!school?.id && !isAdmin,
    staleTime: 60_000,
  });

  if (isAdmin || !school) return <>{children}</>;
  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (data?.open !== false) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md text-center rounded-2xl border border-border bg-card p-8 shadow-card">
        {school.logo_url
          ? <img src={school.logo_url} alt="" className="size-16 mx-auto object-contain rounded-xl border border-border p-1.5" />
          : <span className="size-16 mx-auto rounded-xl bg-destructive/10 text-destructive grid place-items-center"><Lock className="size-7" /></span>}
        <h1 className="font-display text-xl font-bold mt-4">{school.name} portal is closed</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {data?.message?.trim()
            ? data.message
            : "Your school has temporarily closed the portal. Please check back later or contact the school office."}
        </p>
        {displayName && <p className="text-xs text-muted-foreground mt-4">Signed in as {displayName}</p>}
        <Button variant="outline" className="mt-4" onClick={() => signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
