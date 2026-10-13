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

  // 1. Verify x-paystack-signature hash
  const sig = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", k.key).update(raw).digest("hex");
  if (sig !== expected) {
    console.error("[paystack-webhook] Invalid signature");
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") {
    return new Response("ok (event ignored)");
  }

  const reference = event.data?.reference;
  if (!reference) return new Response("no reference", { status: 400 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 2. Look up the transaction in billing_transactions
  const { data: tx, error: txErr } = await admin
    .from("billing_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (txErr || !tx) {
    console.warn(`[paystack-webhook] No billing_transaction found for reference ${reference}`);
    return new Response("transaction not found", { status: 404 });
  }

  if (tx.status === "paid") {
    return new Response("already processed");
  }

  const meta = tx.metadata || {};
  const school_id = tx.school_id;
  const max_students = meta.max_students || 100;
  const storage_gb = meta.storage_gb || 10;
  const addons: string[] = Array.isArray(meta.addons) ? meta.addons : [];
  const cycle = meta.cycle || "termly";

  // Compute period end: 12 months for annual, 4 months (1 term) for termly
  const now = new Date();
  const periodEnd = new Date(now);
  if (cycle === "annually" || cycle === "annual") {
    periodEnd.setFullYear(now.getFullYear() + 1);
  } else {
    periodEnd.setMonth(now.getMonth() + 4);
  }

  // 3. Mark billing_transaction as paid
  await admin
    .from("billing_transactions")
    .update({
      status: "paid",
      updated_at: new Date().toISOString(),
      paystack_response: event.data,
    })
    .eq("reference", reference);

  // 4. Update school subscription & capacity limits on schools / subscriptions
  await admin
    .from("schools")
    .update({
      status: "active",
      included_students: max_students,
      plan_expires_at: periodEnd.toISOString(),
      term_ends_at: periodEnd.toISOString(),
      billing_cycle: cycle,
    })
    .eq("id", school_id);

  // Upsert subscriptions row
  await admin
    .from("subscriptions")
    .upsert({
      school_id,
      status: "active",
      started_at: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      monthly_amount_cents: Math.round(Number(tx.amount_kobo) / 100),
    });

  // 5. Update school_modules:
  // Read addons from metadata, resolve module IDs, and enable them
  if (addons.length > 0) {
    const { data: modRows } = await admin
      .from("modules")
      .select("id, slug")
      .in("slug", addons);

    if (modRows?.length) {
      // First disable existing paid add-ons if needed, or upsert active ones
      for (const mod of modRows) {
        await admin
          .from("school_modules")
          .upsert(
            {
              school_id,
              module_id: mod.id,
              enabled: true,
              enabled_at: now.toISOString(),
            },
            { onConflict: "school_id,module_id" }
          );
      }
    }
  }

  console.log(`[paystack-webhook] Fulfilled entitlement for school ${school_id}, capacity ${max_students}, addons: ${addons.join(", ")}`);
  return new Response("ok");
});
