import { Helmet } from "react-helmet-async";
import { useSchool } from "@/contexts/SchoolContext";

/**
 * Injects per-school PWA head tags so that when a parent/student installs the
 * school portal to their phone home screen, the icon and label show that
 * school's name and logo instead of "Legacyskool".
 *
 * Mounted globally — only emits tags when a school is resolved from the URL.
 */
export default function TenantHead() {
  const { school } = useSchool();
  if (!school) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const manifestHref = supabaseUrl
    ? `${supabaseUrl}/functions/v1/school-manifest?slug=${encodeURIComponent(school.slug)}`
    : "/manifest.webmanifest";

  const appleTitle = (school.name || "School").slice(0, 24);
  const icon = school.logo_url || "/apple-touch-icon.png";

  return (
    <Helmet>
      <link rel="manifest" href={manifestHref} />
      <link rel="apple-touch-icon" href={icon} />
      <link rel="icon" href={icon} />
      <meta name="apple-mobile-web-app-title" content={appleTitle} />
      <meta name="application-name" content={appleTitle} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
    </Helmet>
  );
}