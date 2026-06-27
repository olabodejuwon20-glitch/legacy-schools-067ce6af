// Dynamic per-school PWA manifest. Each school portal (/:slug) serves its own
// manifest with the school's name, short_name, theme and icons so installed
// home-screen apps appear as the school's brand rather than "Legacyskool".

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FALLBACK_192 = "/icon-192.png";
const FALLBACK_512 = "/icon-512.png";

function trimShort(name: string, max = 12) {
  const n = (name || "").trim();
  if (n.length <= max) return n;
  // try first word
  const first = n.split(/\s+/)[0];
  if (first.length <= max) return first;
  return n.slice(0, max);
}

function safe(s: unknown, fallback = "") {
  return typeof s === "string" && s.trim() ? s.trim() : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Accept either /functions/v1/school-manifest?slug=foo or trailing path .../school-manifest/foo
    let slug = url.searchParams.get("slug") || "";
    if (!slug) {
      const parts = url.pathname.split("/").filter(Boolean);
      slug = parts[parts.length - 1] || "";
      if (slug.endsWith(".webmanifest")) slug = slug.replace(/\.webmanifest$/, "");
      if (slug === "school-manifest") slug = "";
    }
    slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let school: any = null;
    if (slug) {
      const { data } = await admin
        .from("schools")
        .select("name,slug,logo_url,settings,report_theme")
        .eq("slug", slug)
        .maybeSingle();
      school = data;
    }

    if (!school) {
      // Platform fallback manifest
      const body = {
        name: "Legacyskool",
        short_name: "Legacyskool",
        start_url: "/",
        scope: "/",
        id: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [
          { src: FALLBACK_192, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: FALLBACK_512, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: FALLBACK_512, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };
      return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "content-type": "application/manifest+json", "cache-control": "public, max-age=300" },
      });
    }

    const settings = (school.settings ?? {}) as any;
    const appInstall = (settings.app_install ?? {}) as any;
    const theme = (school.report_theme ?? {}) as any;

    const fullName = safe(school.name, "School Portal");
    const displayName = safe(appInstall.display_name, fullName);
    const shortName = trimShort(safe(appInstall.short_name, displayName), 12);
    const description = safe(appInstall.short_description, `${fullName} portal`);
    const themeColor = safe(theme.primary, "#2563eb");
    const logo = safe(school.logo_url);

    const icons = logo
      ? [
          { src: logo, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: logo, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [
          { src: FALLBACK_192, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: FALLBACK_512, sizes: "512x512", type: "image/png", purpose: "any" },
        ];

    const body = {
      name: displayName,
      short_name: shortName,
      description,
      start_url: `/${school.slug}/app`,
      scope: `/${school.slug}/`,
      id: `/${school.slug}/`,
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: themeColor,
      icons,
    };

    return new Response(JSON.stringify(body), {
      headers: {
        ...corsHeaders,
        "content-type": "application/manifest+json",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "manifest unavailable" }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});