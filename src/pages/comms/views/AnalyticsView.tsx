import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { BarChart3, MessageSquare, Megaphone, Hash, LifeBuoy } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";

export default function AnalyticsView() {
  const { school } = useSchool();
  const [stats, setStats] = useState({ messages: 0, broadcasts: 0, channels: 0, tickets: 0 });

  useEffect(() => {
    if (!school) return;
    (async () => {
      const [m, b, c, t] = await Promise.all([
        supabase.from("conversation_messages").select("id", { head: true, count: "exact" }).eq("school_id", school.id),
        (supabase as any).from("broadcast_jobs").select("id", { head: true, count: "exact" }).eq("school_id", school.id),
        supabase.from("conversations").select("id", { head: true, count: "exact" }).eq("school_id", school.id).in("channel_type", ["class", "subject", "group"]),
        supabase.from("support_tickets").select("id", { head: true, count: "exact" }),
      ]);
      setStats({
        messages: m.count || 0,
        broadcasts: b.count || 0,
        channels: c.count || 0,
        tickets: t.count || 0,
      });
    })();
  }, [school?.id]);

  return (
    <div className="h-full overflow-auto p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4"><BarChart3 className="size-6"/> Communication Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Messages Sent" value={stats.messages} icon={MessageSquare} />
        <StatCard label="Broadcasts" value={stats.broadcasts} icon={Megaphone} />
        <StatCard label="Active Channels" value={stats.channels} icon={Hash} />
        <StatCard label="Support Tickets" value={stats.tickets} icon={LifeBuoy} />
      </div>
      <div className="mt-6 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Detailed engagement charts (read rates, response times, top channels) will populate as events accumulate.
      </div>
    </div>
  );
}