import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const raw = await req.text();
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) return new Response("service unavailable", { status: 503, headers: corsHeaders });

  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  if (signature !== expected) return new Response("invalid signature", { status: 401, headers: corsHeaders });

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return new Response("ok", { headers: corsHeaders });

  const reference = event.data?.reference;
  if (!reference) return new Response("no reference", { status: 400, headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: payment } = await admin.from("school_payments").select("id, status").eq("provider_reference", reference).maybeSingle();
  if (!payment) return new Response("payment not found", { status: 404, headers: corsHeaders });
  if (payment.status === "successful") return new Response("already processed", { headers: corsHeaders });

  await admin.from("school_payments").update({
    status: "successful",
    paid_at: new Date().toISOString(),
    provider_payload: event.data,
  }).eq("id", payment.id);

  const { error: applyErr } = await admin.rpc("apply_payment", { _payment_id: payment.id });
  if (applyErr) {
    console.error("[payments-webhook] apply_failed", applyErr);
    return new Response("apply failed", { status: 500, headers: corsHeaders });
  }

  return new Response("ok", { headers: corsHeaders });
});