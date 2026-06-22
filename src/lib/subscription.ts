import { supabase } from "@/integrations/supabase/client";
import { friendlyInvokeError } from "@/lib/errors";

export type PlanTier = {
  plan: string;
  label: string;
  term_price_kobo: number;
  included_students: number;
  extra_student_kobo: number;
  sort_order: number;
};

export type SubInvoice = {
  id: string; school_id: string; number: string;
  amount_kobo: number | null; amount_cents: number;
  currency: string; status: string; kind: string;
  plan: string | null; period_start: string | null; period_end: string | null;
  issued_at: string; paid_at: string | null;
  paystack_reference: string | null; paystack_authorization_url: string | null;
};

export function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format((kobo ?? 0) / 100);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

export function planStatusTone(status: string, daysLeft: number | null): "ok" | "warn" | "bad" {
  if (status === "suspended" || status === "cancelled") return "bad";
  if (daysLeft != null && daysLeft < 0) return "bad";
  if (daysLeft != null && daysLeft < 14) return "warn";
  return "ok";
}

export async function startSubscriptionCheckout(opts: { school_id: string; plan: string; cycle: "termly" | "annual" }) {
  const { data, error } = await supabase.functions.invoke("subscription-checkout", { body: opts });
  if (error) throw new Error(await friendlyInvokeError(error, "Checkout failed. Please try again."));
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as { authorization_url: string; reference: string; invoice_id: string; mode: "test" | "live" };
}

export async function payInvoice(invoice_id: string) {
  const { data, error } = await supabase.functions.invoke("subscription-checkout", { body: { invoice_id } });
  if (error) throw new Error(await friendlyInvokeError(error, "Checkout failed. Please try again."));
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as { authorization_url: string; reference: string; invoice_id: string; mode: "test" | "live" };
}

export async function verifyReference(reference: string) {
  const { data, error } = await supabase.functions.invoke("subscription-verify", { body: { reference } });
  if (error) throw new Error(await friendlyInvokeError(error, "Verification failed. Please try again."));
  return data as { ok: boolean; status: string; invoice_id?: string };
}