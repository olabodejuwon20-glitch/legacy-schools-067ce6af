import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { tenantHomePath } from "@/lib/tenant";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();
  const home = tenantHomePath();
  const onTenant = home !== "/";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <SEO title="Page not found — LegacySKool" description="The page you are looking for could not be found." path={location.pathname} noindex />
      <div className="text-center max-w-md">
        <h1 className="mb-2 text-5xl font-bold font-display text-foreground">404</h1>
        <h2 className="mb-2 text-xl font-semibold">We couldn't find that page</h2>
        <p className="mb-6 text-sm text-muted-foreground">The link might be outdated or the page may have moved. Let's get you back to your school portal.</p>
        <a href={home} className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
          {onTenant ? "Back to School Portal" : "Return to Home"}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
