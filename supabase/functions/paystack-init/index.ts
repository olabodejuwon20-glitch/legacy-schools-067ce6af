import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { paystackInit, getPaystackKey } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BRACKET_DEFAULTS: Record<string, { maxStudents: number; termPriceKobo: number; storageGb: number }> = {
  up_to_100: { maxStudents: 100, termPriceKobo: 2500000, storageGb: 10 },
  up_to_200: { maxStudents: 200, termPriceKobo: 4500000, storageGb: 15 },
  up_to_500: { maxStudents: 500, termPriceKobo: 8000000, storageGb: 20 },
  up_to_1000: { maxStudents: 1000, termPriceKobo: 13000000, storageGb: 30 },
};

const ADDON_DEFAULTS: Record<string, { termPriceKobo: number; status: string }> = {
  mod_virtual_lab: { termPriceKobo: 3500000, status: "active" },
  mod_hostel: { termPriceKobo: 2500000, status: "active" },
  mod_transport: { termPriceKobo: 2000000, status: "active" },
  mod_messaging: { termPriceKobo: 1500000, status: "active" },
  mod_copilot_flow: { termPriceKobo: 2500000, status: "active" },
  mod_copilot_auto: { termPriceKobo: 5000000, status: "active" },
};

const STORAGE_BOOST_RATES: Record<number, number> = {
  0: 0,
  20: 500000,
  50: 1000000,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      school_id,
      bracket: requestedBracket = "up_to_100",
      addons: requestedAddons = [],
      cycle = "termly",
      storage_boost_gb = 0,
    } = body as {
      school_id?: string;
      bracket?: string;
      addons?: string[];
      cycle?: "termly" | "annually" | "annual";
      storage_boost_gb?: number;
    };

    if (!school_id) {
      return json({ error: "missing_school_id", message: "school_id is required" }, 400);
    }

    if (!getPaystackKey()) {
      return json({
        error: "paystack_not_configured",
        message: "Online subscription payments are not available right now. Please contact support.",
      }, 503);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch bracket configuration
    let bracket = BRACKET_DEFAULTS[requestedBracket];
    const { data: dbBracket } = await admin
      .from("pricing_brackets")
      .select("slug, max_students, term_price_kobo, storage_gb")
      .eq("slug", requestedBracket)
      .maybeSingle();

    if (dbBracket) {
      bracket = {
        maxStudents: dbBracket.max_students,
        termPriceKobo: Number(dbBracket.term_price_kobo),
        storageGb: dbBracket.storage_gb,
      };
    }

    if (!bracket) {
      return json({ error: "invalid_bracket", message: `Pricing bracket '${requestedBracket}' not found` }, 400);
    }

    // 2. Capacity Validation: Query active students
    let activeStudentCount = 0;
    const { count: studentViewCount, error: viewErr } = await admin
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", school_id)
      .eq("status", "active");

    if (!viewErr && typeof studentViewCount === "number") {
      activeStudentCount = studentViewCount;
    } else {
      // Fallback query memberships
      const { count: memCount } = await admin
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school_id)
        .eq("role", "student");
      activeStudentCount = memCount ?? 0;
    }

    if (activeStudentCount > bracket.maxStudents) {
      return json({
        error: "capacity_exceeded",
        message: `Your active student count (${activeStudentCount}) exceeds this bracket limit (${bracket.maxStudents}). Please select a higher capacity.`,
        activeStudentCount,
        maxStudents: bracket.maxStudents,
      }, 400);
    }

    // 3. Price Summation
    let addonsKobo = 0;
    const activeAddonsList: string[] = [];

    // Query modules from DB or fallback
    const { data: dbModules } = await admin
      .from("modules")
      .select("slug, term_price_kobo, status")
      .in("slug", requestedAddons);

    const moduleMap = new Map<string, { termPriceKobo: number; status: string }>();
    if (dbModules?.length) {
      dbModules.forEach((m: any) => {
        moduleMap.set(m.slug, {
          termPriceKobo: Number(m.term_price_kobo || 0),
          status: m.status || "active",
        });
      });
    }

    for (const slug of requestedAddons) {
      const info = moduleMap.get(slug) ?? ADDON_DEFAULTS[slug];
      if (info && info.status === "active") {
        addonsKobo += info.termPriceKobo;
        activeAddonsList.push(slug);
      }
    }

    const storageBoostKobo = STORAGE_BOOST_RATES[storage_boost_gb] || 0;
    const termSubtotalKobo = bracket.termPriceKobo + addonsKobo + storageBoostKobo;

    const isAnnual = cycle === "annual" || cycle === "annually";
    let finalTotalKobo = termSubtotalKobo;

    if (isAnnual) {
      // 3 terms with 15% discount
      const fullAnnualKobo = termSubtotalKobo * 3;
      const discount = Math.round(fullAnnualKobo * 0.15);
      finalTotalKobo = fullAnnualKobo - discount;
    }

    if (finalTotalKobo < 100) {
      return json({ error: "invalid_amount", message: "Calculated amount is below minimum" }, 400);
    }

    // 4. Paystack Handshake
    const reference = `sub_${school_id.slice(0, 8)}_${Date.now()}`;
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://legacy-schools.lovable.app";
    const callback_url = `${APP_BASE_URL.replace(/\/+$/, "")}/subscription/callback?ref=${reference}`;

    const metadata = {
      school_id,
      user_id: user.id,
      bracket: requestedBracket,
      max_students: bracket.maxStudents,
      storage_gb: bracket.storageGb + storage_boost_gb,
      storage_boost_gb,
      addons: activeAddonsList,
      cycle: isAnnual ? "annually" : "termly",
      term_subtotal_kobo: termSubtotalKobo,
      final_total_kobo: finalTotalKobo,
    };

    // Save transaction intent to billing_transactions
    await admin.from("billing_transactions").insert({
      school_id,
      reference,
      amount_kobo: finalTotalKobo,
      currency: "NGN",
      status: "pending",
      metadata,
    });

    const init = await paystackInit({
      reference,
      amount: finalTotalKobo,
      email: user.email,
      callback_url,
      metadata,
    });

    // Update with response if needed
    await admin
      .from("billing_transactions")
      .update({ paystack_response: init })
      .eq("reference", reference);

    return json({
      authorization_url: init.authorization_url,
      reference,
      access_code: init.access_code,
      amount_kobo: finalTotalKobo,
      mode: init.mode,
    });
  } catch (err: any) {
    console.error("[paystack-init] error", err);
    return json({ error: "internal_error", message: err.message || "Failed to initialize payment" }, 500);
  }
});
