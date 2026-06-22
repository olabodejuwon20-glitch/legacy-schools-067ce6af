import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";
import { getPaystackKey } from "../_shared/paystack.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const k = getPaystackKey();
  if (!k) return new Response("service unavailable", { status: 503 });

  const sig = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", k.key).update(raw).digest("hex");
  if (sig !== expected) return new Response("invalid signature", { status: 401 });

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return new Response("ok");

  const reference = event.data?.reference;
  const meta = event.data?.metadata || {};
  if (!reference) return new Response("no reference", { status: 400 });
  if (meta.kind && meta.kind !== "subscription") return new Response("ignored", { status: 200 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: inv } = await admin.from("invoices").select("id, status, kind").eq("paystack_reference", reference).maybeSingle();
  if (!inv) return new Response("invoice not found", { status: 404 });
  if (inv.status === "paid") return new Response("already processed");
  if (inv.kind !== "subscription") return new Response("ignored");

  const { error } = await admin.rpc("apply_subscription_payment", { _invoice_id: inv.id, _reference: reference, _method: "paystack" });
  if (error) {
    console.error("[subscription-webhook] apply_failed", error);
    return new Response("apply failed", { status: 500 });
  }
  return new Response("ok");
});