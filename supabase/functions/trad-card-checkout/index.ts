import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { paystackInit } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { batch_id } = await req.json();
    if (!batch_id) return json({ error: "missing_batch" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: batch } = await admin.from("trad_scratch_batches")
      .select("id, school_id, price_kobo, status").eq("id", batch_id).maybeSingle();
    if (!batch) return json({ error: "batch_not_found" }, 404);
    if (batch.status !== "active") return json({ error: "batch_inactive" }, 400);

    const { count } = await admin.from("trad_scratch_cards")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch_id).eq("status", "available");
    if (!count || count < 1) return json({ error: "sold_out" }, 410);

    const reference = `lscard_${batch.id.slice(0, 8)}_${Date.now()}`;
    const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://legacy-schools.lovable.app").replace(/\/+$/, "");
    const callback_url = `${APP_BASE_URL}/${batch.school_id}/trad-cards/verify?ref=${reference}`;
    const init = await paystackInit({
      email: user.email,
      amount: batch.price_kobo,
      currency: "NGN",
      reference,
      callback_url,
      metadata: { kind: "trad_card", batch_id: batch.id, school_id: batch.school_id, buyer_user_id: user.id },
    });

    await admin.from("trad_scratch_purchases").insert({
      school_id: batch.school_id, batch_id: batch.id, buyer_user_id: user.id,
      amount_kobo: batch.price_kobo, currency: "NGN",
      paystack_reference: reference, status: "initiated",
    });

    return json({ authorization_url: init.authorization_url, reference, mode: init.mode });
  } catch (e) {
    console.error("[trad-card-checkout]", e);
    return json({ error: "internal_error" }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}