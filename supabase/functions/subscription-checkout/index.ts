import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { paystackInit, getPaystackKey } from "../_shared/paystack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { school_id, plan, cycle, invoice_id } = body as { school_id?: string; plan?: string; cycle?: "termly" | "annual"; invoice_id?: string };

    if (!getPaystackKey()) {
      return json({ error: "Online subscription payments are not available right now. Please contact support." }, 503);
    }

    let invId = invoice_id ?? null;
    if (!invId) {
      if (!school_id || !plan) return json({ error: "missing_params", message: "school_id and plan are required" }, 400);
      const { data: created, error: rpcErr } = await userClient.rpc("create_subscription_invoice", {
        _school_id: school_id, _plan: plan, _cycle: cycle ?? "termly",
      });
      if (rpcErr) {
        console.error("[subscription-checkout] create_invoice_failed", rpcErr);
        return json({ error: "create_invoice_failed" }, 400);
      }
      invId = created as string;
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inv, error: invErr } = await admin.from("invoices")
      .select("id, school_id, amount_kobo, amount_cents, currency, status, paystack_reference, plan")
      .eq("id", invId).maybeSingle();
    if (invErr || !inv) return json({ error: "invoice_not_found" }, 404);
    if (inv.status === "paid") return json({ error: "already_paid" }, 400);

    const amount = inv.amount_kobo ?? inv.amount_cents ?? 0;
    if (amount < 100) return json({ error: "invalid_amount" }, 400);

    const reference = `sub_${inv.id.slice(0, 8)}_${Date.now()}`;
    // Never trust the Origin header for redirect targets (open-redirect / phishing risk).
    // Use a server-side canonical base URL instead.
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://legacy-schools.lovable.app";
    const callback_url = `${APP_BASE_URL.replace(/\/+$/, "")}/subscription/callback?ref=${reference}`;

    const init = await paystackInit({
      email: user.email,
      amount,
      currency: inv.currency || "NGN",
      reference,
      callback_url,
      metadata: { invoice_id: inv.id, school_id: inv.school_id, plan: inv.plan, kind: "subscription" },
    });

    await admin.from("invoices")
      .update({ paystack_reference: reference, paystack_authorization_url: init.authorization_url })
      .eq("id", inv.id);

    return json({ ok: true, authorization_url: init.authorization_url, reference, invoice_id: inv.id, mode: init.mode });
  } catch (e) {
    console.error("[subscription-checkout]", e);
    return json({ error: "internal_error" }, 500);
  }
});