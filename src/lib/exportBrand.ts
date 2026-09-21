import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { DEFAULT_REPORT_THEME, type ReportTheme } from "@/lib/reportCard";

/** Resolved branding applied to every export produced inside a school portal. */
export type ExportBrand = {
  schoolName?: string;
  schoolLogo?: string | null;
  brandColor: string;
  brandDark: string;
  accentColor: string;
  fontFamily: string;
  /** Word-safe single font name derived from fontFamily. */
  wordFont: string;
};

const HEX = /^#([0-9a-f]{6})$/i;
const safeColor = (v: any, fb: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fb);

/** Font presets a school can pick; value is a full CSS stack. */
export const EXPORT_FONTS: Record<string, { css: string; word: string }> = {
  inter:     { css: "'Inter',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif", word: "Arial" },
  georgia:   { css: "Georgia,'Times New Roman',serif", word: "Georgia" },
  garamond:  { css: "'EB Garamond',Garamond,Georgia,serif", word: "Garamond" },
  helvetica: { css: "Helvetica,Arial,sans-serif", word: "Helvetica" },
  verdana:   { css: "Verdana,Geneva,sans-serif", word: "Verdana" },
};

export const DEFAULT_EXPORT_BRAND: ExportBrand = {
  brandColor: DEFAULT_REPORT_THEME.primary,
  brandDark: DEFAULT_REPORT_THEME.gradientFrom,
  accentColor: DEFAULT_REPORT_THEME.accent,
  fontFamily: EXPORT_FONTS.inter.css,
  wordFont: EXPORT_FONTS.inter.word,
};

function resolveFont(key?: string | null) {
  const f = key && EXPORT_FONTS[String(key).toLowerCase()];
  return f ?? EXPORT_FONTS.inter;
}

const cache = new Map<string, Promise<ExportBrand>>();

/** Drop cached branding so the next export picks up freshly saved settings. */
export function clearExportBrandCache(schoolId?: string) {
  if (schoolId) cache.delete(schoolId);
  else cache.clear();
}


/** Fetch (and cache) a school's export branding: logo, colors, typography. */
export function fetchExportBrand(schoolId: string, fallbackName?: string, fallbackLogo?: string | null) {
  const existing = cache.get(schoolId);
  if (existing) return existing;
  const p = (async (): Promise<ExportBrand> => {
    const { data } = await supabase
      .from("schools").select("name,logo_url,report_theme,settings").eq("id", schoolId).maybeSingle();
    const theme = ((data as any)?.report_theme ?? {}) as ReportTheme;
    const identity = ((data as any)?.settings as any)?.identity ?? {};
    const font = resolveFont(identity.export_font ?? identity.font_family ?? (theme as any)?.font);
    return {
      schoolName: (data as any)?.name ?? fallbackName,
      schoolLogo: identity.report_logo_url ?? (data as any)?.logo_url ?? fallbackLogo ?? null,
      brandColor: safeColor(theme.primary ?? identity.primary_color, DEFAULT_EXPORT_BRAND.brandColor),
      brandDark: safeColor(theme.gradientFrom, safeColor(theme.primary, DEFAULT_EXPORT_BRAND.brandDark)),
      accentColor: safeColor(theme.accent ?? identity.accent_color, DEFAULT_EXPORT_BRAND.accentColor),
      fontFamily: font.css,
      wordFont: font.word,
    };
  })().catch(() => ({ ...DEFAULT_EXPORT_BRAND, schoolName: fallbackName, schoolLogo: fallbackLogo ?? null }));
  cache.set(schoolId, p);
  return p;
}

/** Branding for the school in the current portal context. */
export function useExportBrand(): ExportBrand {
  const { school } = useSchool();
  const [brand, setBrand] = useState<ExportBrand>(DEFAULT_EXPORT_BRAND);
  useEffect(() => {
    let on = true;
    if (!school?.id) { setBrand(DEFAULT_EXPORT_BRAND); return; }
    fetchExportBrand(school.id, school.name, school.logo_url).then(b => { if (on) setBrand(b); });
    return () => { on = false; };
  }, [school?.id, school?.name, school?.logo_url]);
  return brand;
}
