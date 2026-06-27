import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useSchool } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";

/** Convert "#3b82f6" → "210 100% 60%" (Tailwind HSL token format) */
function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Injects per-school PWA head tags so that when a parent/student installs the
 * school portal to their phone home screen, the icon and label show that
 * school's name and logo instead of "Legacyskool".
 *
 * Mounted globally — only emits tags when a school is resolved from the URL.
 */
export default function TenantHead() {
  const { school } = useSchool();
  const [identity, setIdentity] = useState<any>(null);

  useEffect(() => {
    if (!school?.id) { setIdentity(null); return; }
    let active = true;
    supabase.from("schools").select("settings").eq("id", school.id).maybeSingle()
      .then(({ data }) => { if (active) setIdentity((data?.settings as any)?.identity ?? null); });
    return () => { active = false; };
  }, [school?.id]);

  useEffect(() => {
    const root = document.documentElement;
    const primary = identity?.primary_color ? hexToHslTriplet(identity.primary_color) : null;
    const accent = identity?.accent_color ? hexToHslTriplet(identity.accent_color) : null;
    if (primary) root.style.setProperty("--primary", primary);
    else root.style.removeProperty("--primary");
    if (accent) root.style.setProperty("--accent", accent);
    else root.style.removeProperty("--accent");
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
    };
  }, [identity?.primary_color, identity?.accent_color]);

  if (!school) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const manifestHref = supabaseUrl
    ? `${supabaseUrl}/functions/v1/school-manifest?slug=${encodeURIComponent(school.slug)}`
    : "/manifest.webmanifest";

  const appleTitle = (school.name || "School").slice(0, 24);
  const icon = identity?.favicon_url || school.logo_url || "/apple-touch-icon.png";

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