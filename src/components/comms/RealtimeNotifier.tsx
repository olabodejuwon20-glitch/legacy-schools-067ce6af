import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { useOnlineStatus } from "@/lib/realtime-status";

/**
 * Global realtime hub mounted once in AppLayout.
 * - Toasts on incoming DMs (where I'm the recipient).
 * - Shows an offline banner ONLY when the device is actually offline.
 * - Uses exponential backoff and max retry limits to avoid infinite reconnect loops.
 */
export function RealtimeNotifier() {
  const { user, school, activeRole } = useSchool();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const wasOnlineRef = useRef(true);

  useEffect(() => {
    if (!user || !school || !online) return;
    let cancelled = false;
    let retryTimer: number | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let currentCh: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      if (cancelled) return;
      if (currentCh) {
        try { supabase.removeChannel(currentCh); } catch { /* noop */ }
        currentCh = null;
      }
      const nonce = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
      const ch = supabase.channel(`notifier:${user.id}:${school.id}:${nonce}`);
      currentCh = ch;
      ch.on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
          async (payload: any) => {
            const m = payload.new;
            if (!m || m.school_id !== school.id) return;
            // Resolve sender name
            const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: [m.sender_id] });
            const name = profs?.[0]?.full_name || "Someone";
            toast(`New message from ${name}`, {
              description: (m.body || "(attachment)").slice(0, 140),
              action: activeRole
                ? { label: "Open", onClick: () => navigate(schoolPath(school.slug, `/app/${activeRole}/communication/dm`)) }
                : undefined,
            });
          }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            retryCount = 0;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (retryCount < MAX_RETRIES) {
              const delay = Math.min(30000, 2000 * Math.pow(2, retryCount));
              retryCount += 1;
              if (retryTimer) window.clearTimeout(retryTimer);
              retryTimer = window.setTimeout(() => {
                if (cancelled || !navigator.onLine) return;
                subscribe();
              }, delay);
            }
          }
        });
      return ch;
    };

    subscribe();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (currentCh) {
        try { supabase.removeChannel(currentCh); } catch { /* noop */ }
        currentCh = null;
      }
    };
  }, [user?.id, school?.id, activeRole, navigate, online]);

  // Toast on network status transitions
  useEffect(() => {
    if (online && !wasOnlineRef.current) toast.success("Back online", { duration: 2000 });
    if (!online && wasOnlineRef.current) toast.error("You are offline", { duration: 3000 });
    wasOnlineRef.current = online;
  }, [online]);

  // Only display the banner if the user's browser is actually offline
  if (online) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-md bg-destructive text-destructive-foreground animate-in fade-in slide-in-from-top-1">
        <WifiOff className="size-3.5" />
        Offline
      </div>
    </div>
  );
}
