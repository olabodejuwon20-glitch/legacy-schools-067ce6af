import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "ls_analytics_session";
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 20;

export function getAnalyticsSession(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

let lastPath = "";
let lastAt = 0;

type PageViewRow = {
  path: string;
  referrer: string | null;
  session_id: string;
  user_id: string | null;
  school_id: string | null;
  device: string;
  user_agent: string | null;
};
type AuthEventRow = {
  event: string;
  user_id: string | null;
  school_id: string | null;
  session_id: string;
};

const pageQueue: PageViewRow[] = [];
const authQueue: AuthEventRow[] = [];
let flushScheduled = false;
let flushHandlersBound = false;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    void flushQueues();
  }, FLUSH_INTERVAL_MS);
}

async function flushQueues() {
  if (pageQueue.length) {
    const batch = pageQueue.splice(0, pageQueue.length);
    try { await supabase.from("page_views").insert(batch); } catch { /* ignore */ }
  }
  if (authQueue.length) {
    const batch = authQueue.splice(0, authQueue.length);
    try { await supabase.from("auth_events").insert(batch); } catch { /* ignore */ }
  }
}

function bindFlushHandlers() {
  if (flushHandlersBound || typeof window === "undefined") return;
  flushHandlersBound = true;
  const flushSync = () => { void flushQueues(); };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSync();
  });
  window.addEventListener("pagehide", flushSync);
  window.addEventListener("beforeunload", flushSync);
}

export function trackPageView(path: string, userId?: string | null, schoolId?: string | null) {
  const now = Date.now();
  if (path === lastPath && now - lastAt < 800) return;
  lastPath = path;
  lastAt = now;
  bindFlushHandlers();
  pageQueue.push({
    path,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    session_id: getAnalyticsSession(),
    user_id: userId ?? null,
    school_id: schoolId ?? null,
    device: detectDevice(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
  });
  if (pageQueue.length >= MAX_BATCH) void flushQueues();
  else scheduleFlush();
}

export function trackAuthEvent(event: "sign_in" | "sign_up" | "sign_out", userId?: string | null, schoolId?: string | null) {
  bindFlushHandlers();
  authQueue.push({
    event,
    user_id: userId ?? null,
    school_id: schoolId ?? null,
    session_id: getAnalyticsSession(),
  });
  // Auth events are lower volume — flush sooner.
  if (authQueue.length >= 5) void flushQueues();
  else scheduleFlush();
}