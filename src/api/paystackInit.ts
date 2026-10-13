import { supabase } from "@/integrations/supabase/client";
import {
  calculateSubscriptionTotal,
  snapStudentCountToBracket,
  CalculationBreakdown,
  OFFICIAL_PRICING_BRACKETS,
} from "@/lib/pricing";
import { toast } from "sonner";
import { verifyPaystackTransaction } from "./paystackVerify";

export interface CheckoutPayload {
  school_id: string;
  bracket: string;
  addons: string[];
  cycle: "termly" | "annually";
  storage_boost_gb?: number;
  user_email?: string;
  school_name?: string;
  onSuccess?: (reference: string) => void;
}

export interface CheckoutResponse {
  authorization_url?: string;
  reference: string;
  access_code?: string;
  amount_kobo: number;
  mode?: "live" | "test";
  inline?: boolean;
}

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

/**
 * Ensures Paystack inline script is loaded in the browser.
 */
export async function loadPaystackScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.PaystackPop) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="paystack.co"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      // Give it a brief timeout if already in document
      setTimeout(() => resolve(!!window.PaystackPop), 1000);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("[Paystack] Failed to load inline script from CDN");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Computes the client estimate for a given payload.
 */
export function computeClientEstimate(
  payload: Omit<CheckoutPayload, "school_id">
): CalculationBreakdown {
  return calculateSubscriptionTotal({
    bracketSlug: payload.bracket,
    addonSlugs: payload.addons,
    cycle: payload.cycle,
    storageBoostGb: payload.storage_boost_gb || 0,
  });
}

/**
 * Fulfills entitlements directly in Supabase after a confirmed Paystack charge.
 */
export async function fulfillSubscriptionLocally(
  payload: CheckoutPayload,
  reference: string,
  amountKobo: number,
  paystackResponse?: any
) {
  try {
    const bracketInfo =
      OFFICIAL_PRICING_BRACKETS.find((b) => b.slug === payload.bracket) ||
      snapStudentCountToBracket(100);

    const now = new Date();
    const periodEnd = new Date(now);
    if (payload.cycle === "annually") {
      periodEnd.setFullYear(now.getFullYear() + 1);
    } else {
      periodEnd.setMonth(now.getMonth() + 4);
    }

    // 1. Record transaction in billing_transactions if table exists
    try {
      await supabase.from("billing_transactions" as any).upsert({
        school_id: payload.school_id,
        reference,
        amount_kobo: amountKobo,
        currency: "NGN",
        status: "paid",
        metadata: {
          bracket: payload.bracket,
          max_students: bracketInfo.maxStudents,
          storage_gb: bracketInfo.includedStorageGb + (payload.storage_boost_gb || 0),
          addons: payload.addons,
          cycle: payload.cycle,
          storage_boost_gb: payload.storage_boost_gb || 0,
        },
        paystack_response: paystackResponse || { reference, status: "success" },
        updated_at: new Date().toISOString(),
      });
    } catch (txErr) {
      console.warn("[Fulfillment] billing_transactions log skipped", txErr);
    }

    // 2. Update schools table
    await supabase
      .from("schools")
      .update({
        status: "active",
        included_students: bracketInfo.maxStudents,
        plan_expires_at: periodEnd.toISOString(),
        term_ends_at: periodEnd.toISOString(),
        billing_cycle: payload.cycle,
      })
      .eq("id", payload.school_id);

    // 3. Upsert subscriptions table
    try {
      await supabase.from("subscriptions").upsert({
        school_id: payload.school_id,
        status: "active",
        started_at: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        monthly_amount_cents: Math.round(amountKobo / 100),
      });
    } catch (subErr) {
      console.warn("[Fulfillment] subscriptions update skipped", subErr);
    }

    // 4. Update school_modules table
    if (payload.addons.length > 0) {
      try {
        const rows = payload.addons.map((slug) => ({
          school_id: payload.school_id,
          module_id: slug,
          enabled: true,
          settings: { source: "modular_checkout", term_activated: now.toISOString() },
        }));
        await supabase.from("school_modules").upsert(rows, { onConflict: "school_id,module_id" });
      } catch (modErr) {
        console.warn("[Fulfillment] school_modules update skipped", modErr);
      }
    }
  } catch (err) {
    console.error("[Fulfillment] Error fulfilling entitlements:", err);
  }
}

/**
 * Initializes subscription checkout via Paystack.
 * Attempts Edge Function first; falls back smoothly to Paystack Inline popup
 * if the remote backend secrets are not configured.
 */
export async function initializePaystackCheckout(
  payload: CheckoutPayload
): Promise<CheckoutResponse> {
  if (!payload.school_id) {
    throw new Error("school_id is required to initialize subscription checkout.");
  }

  const breakdown = computeClientEstimate(payload);
  const reference = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Try remote Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("paystack-init", {
      body: payload,
    });

    if (!error && data?.authorization_url) {
      return data as CheckoutResponse;
    }

    // If error returned from edge function indicates missing key or 503
    console.warn(
      "[Paystack] Edge function unavailable or key not configured:",
      error?.message || data?.error,
      "— Falling back to Paystack Inline."
    );
  } catch (invokeErr) {
    console.warn("[Paystack] Edge function invoke failed, using Inline fallback:", invokeErr);
  }

  // 2. Resilient Fallback: Launch Paystack Inline modal
  await loadPaystackScript();

  const publicKey =
    import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
    "pk_test_4bf9e9c8298d8909dd6942150a5b01cea5412850";

  if (!window.PaystackPop) {
    throw new Error(
      "Paystack secure checkout library could not be loaded. Please check your internet connection."
    );
  }

  return new Promise((resolve) => {
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: payload.user_email || "admin@legacyskool.com",
      amount: breakdown.finalTotalKobo,
      currency: "NGN",
      ref: reference,
      metadata: {
        school_id: payload.school_id,
        school_name: payload.school_name || "LegacySkool",
        bracket: payload.bracket,
        addons: payload.addons,
        cycle: payload.cycle,
        storage_boost_gb: payload.storage_boost_gb || 0,
      },
      callback: function (response: any) {
        toast.success("Payment verified! Unlocking plan and modules…");
        void (async () => {
          try {
            // Optional server‑side verification before granting entitlement
            const verified = await verifyPaystackTransaction(response?.reference || reference);
            if (!verified) {
              toast.error("Payment could not be verified. Please contact support.");
              resolve({
                reference: response?.reference || reference,
                amount_kobo: breakdown.finalTotalKobo,
                inline: true,
              });
              return;
            }
            await fulfillSubscriptionLocally(
              payload,
              response?.reference || reference,
              breakdown.finalTotalKobo,
              response
            );
            
            // Optional: call a backend endpoint to send an email receipt
            try {
              await supabase.functions.invoke("send-receipt", {
                body: {
                  reference: response?.reference || reference,
                  email: payload.user_email,
                  amount: breakdown.finalTotalKobo,
                  school_name: payload.school_name,
                }
              });
            } catch (emailErr) {
              console.warn("[Paystack] Failed to trigger email receipt:", emailErr);
            }

            if (payload.onSuccess) {
              payload.onSuccess(response?.reference || reference);
            }
            // Notify any listeners that the subscription state changed
            if (typeof window !== "undefined" && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent("subscription-updated", { 
                detail: { reference: response?.reference || reference } 
              }));
            }
          } catch (err) {
            console.error("[Paystack] Error fulfilling subscription:", err);
          } finally {
            resolve({
              reference: response?.reference || reference,
              amount_kobo: breakdown.finalTotalKobo,
              mode: "test",
              inline: true,
            });
          }
        })();
      },
      onClose: function () {
        toast.info("Payment cancelled.");
        resolve({
          reference,
          amount_kobo: breakdown.finalTotalKobo,
          inline: true,
        });
      },
    });

    handler.openIframe();
  });
}
