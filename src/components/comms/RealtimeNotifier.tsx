import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { useOnlineStatus } from "@/lib/realtime-status";

/**
 * Global realtime hub mounted once in AppLayout.
 * - Toasts on incoming DMs (where I'm the recipient) and new platform announcements.
 * - Watches browser online/offline and shows a reconnect banner.
 * - Auto-resubscribes when the channel closes (e.g. after a reconnect).
 */
export function RealtimeNotifier() {
  const { user, school, activeRole } = useSchool();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [channelStatus, setChannelStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const wasOnlineRef = useRef(true);

  useEffect(() => {
    if (!user || !school) return;
    let cancelled = false;
    let retry: number | null = null;
    let currentCh: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      // Tear down any previous channel before creating a new one to avoid
      // "cannot add postgres_changes callbacks ... after subscribe()" when
      // the topic is reused (e.g. React strict-mode double-invoke or retry).
      if (currentCh) {
        try { supabase.removeChannel(currentCh); } catch { /* noop */ }
        currentCh = null;
      }
      const nonce = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
      const ch = supabase.channel(`notifier:${user.id}:${school.id}:${nonce}:${Date.now()}`);
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
          if (status === "SUBSCRIBED") setChannelStatus("open");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setChannelStatus("closed");
            // schedule a single retry
            if (retry) window.clearTimeout(retry);
            retry = window.setTimeout(() => {
              if (cancelled) return;
              subscribe();
            }, 2000);
          } else {
            setChannelStatus("connecting");
          }
        });
      return ch;
    };

    subscribe();
    return () => {
      cancelled = true;
      if (retry) window.clearTimeout(retry);
      if (currentCh) {
        try { supabase.removeChannel(currentCh); } catch { /* noop */ }
        currentCh = null;
      }
    };
  }, [user?.id, school?.id, activeRole, navigate]);

  // Toast on network status transitions
  useEffect(() => {
    if (online && !wasOnlineRef.current) toast.success("Back online", { duration: 2000 });
    if (!online && wasOnlineRef.current) toast.error("You're offline. Reconnecting…", { duration: 3000 });
    wasOnlineRef.current = online;
  }, [online]);

  const showBanner = !online || channelStatus !== "open";
  if (!showBanner) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-md ${
        !online ? "bg-destructive text-destructive-foreground" : "bg-amber-500/95 text-white"
      }`}>
        {!online ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5 animate-pulse" />}
        {!online ? "Offline" : "Reconnecting…"}
      </div>
    </div>
  );
}
