import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Global error reporter.
 * - Logs errors to `public.client_errors` (streams to Super Admin via realtime).
 * - Shows a user-facing toast so the person who triggered the error sees it immediately.
 */

type ReportSource = "window" | "unhandledrejection" | "react" | "manual" | "supabase";

type ReportInput = {
  message: string;
  source?: ReportSource;
  cause?: string;
  stack?: string;
  context?: Record<string, any>;
  severity?: "error" | "warning" | "info";
  silent?: boolean; // skip toast
};

const recent = new Map<string, number>();
const DEDUPE_MS = 4000;

function shouldSkip(msg: string) {
  if (!msg) return true;
  // Noise filters
  return (
    /ResizeObserver loop|Non-Error promise rejection captured|Loading chunk \d+ failed|ChunkLoadError|Script error\.?$/i.test(msg)
  );
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}
function detectOS(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}
function detectRole(): string | null {
  try {
    const path = location.pathname;
    if (/\/super(\/|$)/.test(path)) return "super_admin";
    const m = path.match(/\/app\/([^/]+)/);
    if (m) return m[1]; // admin | teacher | student | parent | driver
    return null;
  } catch { return null; }
}
function detectSchoolId(): string | null {
  try {
    const v = localStorage.getItem("legacyskool.currentSchoolId");
    if (v && /^[0-9a-f-]{36}$/i.test(v)) return v;
  } catch {}
  return null;
}

export async function reportError(input: ReportInput) {
  try {
    const message = String(input.message || "").slice(0, 1000);
    if (shouldSkip(message)) return;

    const key = `${input.source ?? "manual"}::${message}`;
    const now = Date.now();
    const last = recent.get(key) ?? 0;
    if (now - last < DEDUPE_MS) return;
    recent.set(key, now);

    if (!input.silent) {
      toast.error(message, {
        description: input.cause ? `Cause: ${input.cause}` : undefined,
        duration: 7000,
      });
    }

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const route = typeof location !== "undefined" ? location.pathname + location.search : null;
    await supabase.rpc("report_client_error" as any, {
      _message: message,
      _stack: (input.stack ?? "").slice(0, 4000) || null,
      _source: input.source ?? "manual",
      _route: route,
      _role: detectRole(),
      _browser: ua ? detectBrowser(ua) : null,
      _os: ua ? detectOS(ua) : null,
      _school_id: detectSchoolId(),
      _metadata: {
        cause: input.cause ?? null,
        severity: input.severity ?? "error",
        user_agent: ua || null,
        ...(input.context ?? {}),
      },
    });
  } catch (e) {
    // last-ditch: don't recurse
    // eslint-disable-next-line no-console
    console.warn("[error-reporter] failed", e);
  }
}

let installed = false;
export function installGlobalErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    reportError({
      source: "window",
      message: ev.message || String(ev.error || "Unknown error"),
      cause: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
      stack: ev.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const reason: any = ev.reason;
    reportError({
      source: "unhandledrejection",
      message: reason?.message || String(reason || "Unhandled promise rejection"),
      cause: reason?.code || reason?.name,
      stack: reason?.stack,
    });
  });
}