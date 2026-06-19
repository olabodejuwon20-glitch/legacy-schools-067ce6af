import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { BarChart3, MessageSquare, Megaphone, Hash, LifeBuoy } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function AnalyticsView() {
  const { school } = useSchool();
  const [stats, setStats] = useState({ messages: 0, broadcasts: 0, channels: 0, tickets: 0 });
  const [series, setSeries] = useState<{ day: string; sent: number; delivered: number; failed: number }[]>([]);

  useEffect(() => {
    if (!school) return;
    (async () => {
      const [m, b, c, t] = await Promise.all([
        supabase.from("conversation_messages").select("id", { head: true, count: "exact" }).eq("school_id", school.id),
        supabase.from("broadcast_jobs").select("id", { head: true, count: "exact" }).eq("school_id", school.id),
        supabase.from("conversations").select("id", { head: true, count: "exact" }).eq("school_id", school.id).in("channel_type", ["class", "subject", "group"]),
        supabase.from("support_tickets").select("id", { head: true, count: "exact" }),
      ]);
      setStats({
        messages: m.count || 0,
        broadcasts: b.count || 0,
        channels: c.count || 0,
        tickets: t.count || 0,
      });
      const since = new Date(Date.now() - 13 * 86400_000);
      since.setHours(0, 0, 0, 0);
      const { data: deliv } = await supabase.from("broadcast_deliveries")
        .select("status,created_at").eq("school_id", school.id).gte("created_at", since.toISOString());
      const bucket = new Map<string, { sent: number; delivered: number; failed: number }>();
      for (let i = 0; i < 14; i++) {
        const d = new Date(since.getTime() + i * 86400_000);
        bucket.set(d.toISOString().slice(5, 10), { sent: 0, delivered: 0, failed: 0 });
      }
      (deliv ?? []).forEach((row: any) => {
        const key = new Date(row.created_at).toISOString().slice(5, 10);
        const slot = bucket.get(key); if (!slot) return;
        slot.sent += 1;
        if (row.status === "delivered" || row.status === "read") slot.delivered += 1;
        if (row.status === "failed") slot.failed += 1;
      });
      setSeries(Array.from(bucket.entries()).map(([day, v]) => ({ day, ...v })));
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
      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="text-sm font-medium mb-3">Broadcast deliveries — last 14 days</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="delivered" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="sent" stackId="a" fill="hsl(var(--muted-foreground))" />
              <Bar dataKey="failed" stackId="a" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}