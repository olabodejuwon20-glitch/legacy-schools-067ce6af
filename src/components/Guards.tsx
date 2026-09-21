import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSchool, Role } from "@/contexts/SchoolContext";
import { schoolPath, getResolvedSchoolSlug } from "@/lib/tenant";
import { PortalAccessGate } from "@/components/PortalAccessGate";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useSchool();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to={schoolPath(getResolvedSchoolSlug(), "/signin")} replace />;
  return <>{children}</>;
}

export function RequireSchool({ children }: { children: ReactNode }) {
  const { school, schoolLoading, loading, activeRole, user, memberships } = useSchool();
  if (loading || schoolLoading) return <FullLoader />;
  if (!user) return <Navigate to={schoolPath(getResolvedSchoolSlug(), "/signin")} replace />;
  if (!school) return <Navigate to="/" replace />;
  if (!activeRole) return <Navigate to={schoolPath(school.slug, "")} replace />;
  const m = memberships.find(x => x.school_id === school.id && x.role === activeRole);
  if (m?.must_change_pin) return <Navigate to={schoolPath(school.slug, "/change-pin")} replace />;
  if (m && m.bio_completed === false && activeRole !== "admin") return <Navigate to={schoolPath(school.slug, "/bio")} replace />;
  return <PortalAccessGate>{children}</PortalAccessGate>;
}

export function RoleGate({ allow, children }: { allow: Role | Role[]; children: ReactNode }) {
  const { activeRole, school } = useSchool();
  const list = Array.isArray(allow) ? allow : [allow];
  if (!activeRole) return <Navigate to={schoolPath(school?.slug, "")} replace />;
  if (!list.includes(activeRole)) return <Navigate to={schoolPath(school?.slug, "/app")} replace />;
  return <>{children}</>;
}

function FullLoader() {
  return <div className="min-h-screen grid place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
}
