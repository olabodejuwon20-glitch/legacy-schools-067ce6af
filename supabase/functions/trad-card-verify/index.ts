import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { paystackVerify } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function rand(len: number, alphabet: string) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}
async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { reference } = await req.json();
    if (!reference) return json({ error: "missing_reference" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: purchase } = await admin.from("trad_scratch_purchases")
      .select("id, school_id, batch_id, buyer_user_id, status, card_id")
      .eq("paystack_reference", reference).maybeSingle();
    if (!purchase) return json({ error: "purchase_not_found" }, 404);
    if (purchase.buyer_user_id !== user.id) return json({ error: "forbidden" }, 403);

    // Already finalised? Return existing card credentials are NOT stored — only the serial.
    if (purchase.status === "paid" && purchase.card_id) {
      const { data: card } = await admin.from("trad_scratch_cards")
        .select("serial,max_uses,use_count,expires_at").eq("id", purchase.card_id).maybeSingle();
      return json({ ok: true, already: true, serial: card?.serial ?? null });
    }

    const tx = await paystackVerify(reference);
    if (tx.status !== "success") {
      await admin.from("trad_scratch_purchases").update({ status: "failed" }).eq("id", purchase.id);
      return json({ error: "payment_not_successful", status: tx.status }, 402);
    }

    // Generate a brand-new card under this batch, mark it sold to buyer.
    const ALPHA_SERIAL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const ALPHA_PIN = "0123456789";
    const { data: batch } = await admin.from("trad_scratch_batches")
      .select("max_uses, expires_at").eq("id", purchase.batch_id).single();
    const max_uses = batch?.max_uses ?? 5;
    const expires_at = batch?.expires_at ?? null;

    const serial = "LS-" + rand(4, ALPHA_SERIAL) + "-" + rand(4, ALPHA_SERIAL);
    const pin = rand(12, ALPHA_PIN);
    const pin_hash = await sha256Hex(pin + "|" + serial);

    const { data: card, error: cErr } = await admin.from("trad_scratch_cards").insert({
      school_id: purchase.school_id, batch_id: purchase.batch_id,
      serial, pin_hash, status: "sold", buyer_user_id: user.id, sold_at: new Date().toISOString(),
      max_uses, expires_at,
    }).select("id, serial, max_uses, expires_at").single();
    if (cErr || !card) {
      console.error("[trad-card-verify] card_create_failed", cErr);
      return json({ error: "We couldn't create the result card. Please contact support." }, 500);
    }

    await admin.from("trad_scratch_purchases").update({
      status: "paid", paid_at: new Date().toISOString(), card_id: card.id,
    }).eq("id", purchase.id);

    // PIN returned ONCE only.
    return json({ ok: true, serial: card.serial, pin, max_uses: card.max_uses, expires_at: card.expires_at });
  } catch (e) {
    console.error("[trad-card-verify]", e);
    return json({ error: "internal_error" }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}