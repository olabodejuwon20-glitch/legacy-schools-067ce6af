import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSchool } from "@/contexts/SchoolContext";
import { useUnreadCount } from "@/lib/comms";
import { NavLink } from "react-router-dom";
import { schoolPath } from "@/lib/tenant";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Announcement { id: string; title: string; body: string; priority: string; created_at: string }

export function NotificationBell() {
  const { school, activeRole, user } = useSchool();
  const unreadDMs = useUnreadCount(school?.id, user?.id);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [unreadMsgIds, setUnreadMsgIds] = useState<string[]>([]);

  const refreshAnnouncements = useCallback(async () => {
    const { data: anns } = await supabase
      .from("platform_announcements")
      .select("id,title,body,priority,created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    setAnnouncements((anns ?? []) as Announcement[]);
    if (!user) return;
    const { data: reads } = await supabase
      .from("announcement_reads").select("announcement_id").eq("user_id", user.id);
    setReadIds(new Set((reads ?? []).map(r => r.announcement_id)));
  }, [user?.id]);

  const refreshUnreadMsgs = useCallback(async () => {
    if (!school || !user) return;
    const { data } = await supabase
      .from("messages").select("id")
      .eq("school_id", school.id).eq("recipient_id", user.id).is("read_at", null);
    setUnreadMsgIds((data ?? []).map(r => r.id));
  }, [school?.id, user?.id]);

  useEffect(() => {
    if (!user) return;
    refreshAnnouncements();
    refreshUnreadMsgs();
    const nonce = Math.random().toString(36).slice(2, 10);
    const ch = supabase
      .channel(`notif-bell:${user.id}:${nonce}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_announcements" }, refreshAnnouncements)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_reads", filter: `user_id=eq.${user.id}` }, refreshAnnouncements)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, refreshUnreadMsgs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refreshAnnouncements, refreshUnreadMsgs]);

  const unreadAnn = announcements.filter(a => !readIds.has(a.id));
  const total = unreadDMs + unreadAnn.length + unreadMsgIds.length;

  async function markAnnouncementRead(id: string) {
    if (!user || readIds.has(id)) return;
    setReadIds(prev => new Set(prev).add(id));
    await supabase.from("announcement_reads").upsert({ user_id: user.id, announcement_id: id });
  }

  async function markAllRead() {
    if (!user) return;
    const toMark = unreadAnn.map(a => ({ user_id: user.id, announcement_id: a.id }));
    if (toMark.length) {
      setReadIds(prev => { const n = new Set(prev); toMark.forEach(r => n.add(r.announcement_id)); return n; });
      await supabase.from("announcement_reads").upsert(toMark);
    }
    if (school && unreadMsgIds.length) {
      await supabase.from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("school_id", school.id).eq("recipient_id", user.id).is("read_at", null);
      setUnreadMsgIds([]);
    }
    if (toMark.length || unreadMsgIds.length) toast.success("Marked all as read");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">Notifications</div>
            <div className="text-[11px] text-muted-foreground">{total === 0 ? "You're all caught up" : `${total} new`}</div>
          </div>
          {total > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(unreadDMs + unreadMsgIds.length) > 0 && school && activeRole && (
            <NavLink to={schoolPath(school.slug, `/app/${activeRole}/communication/dm`)}
              className="block px-4 py-3 hover:bg-secondary border-b border-border/60">
              <div className="text-sm font-medium">
                {unreadDMs + unreadMsgIds.length} unread message{(unreadDMs + unreadMsgIds.length) === 1 ? "" : "s"}
              </div>
              <div className="text-[11px] text-muted-foreground">Open messages to reply</div>
            </NavLink>
          )}
          {announcements.map((a) => {
            const isRead = readIds.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => markAnnouncementRead(a.id)}
                className={cn(
                  "block w-full text-left px-4 py-3 border-b border-border/60 hover:bg-secondary transition-colors",
                  a.priority === "critical" && "bg-destructive/5",
                  a.priority === "high" && "bg-amber-500/5",
                  isRead && "opacity-60"
                )}
              >
                <div className="flex items-start gap-2">
                  {!isRead && <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{a.body}</div>
                  </div>
                </div>
              </button>
            );
          })}
          {total === 0 && announcements.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">Nothing new right now</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
