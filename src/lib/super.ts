import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyInvokeError } from "@/lib/errors";

export async function superAction(action: string, payload: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("super-action", { body: { action, payload } });
  if (error) { const msg = await friendlyInvokeError(error, "Action failed. Please try again."); toast.error(msg); throw new Error(msg); }
  if ((data as any)?.error) { toast.error((data as any).error); throw new Error((data as any).error); }
  return data as { ok: true };
}

export function money(cents: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
}

export function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
}

export function fmtNgn(kobo: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format((kobo ?? 0) / 100);
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}