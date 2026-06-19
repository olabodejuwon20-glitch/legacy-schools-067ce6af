import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ScheduledView() {
  const { school } = useSchool();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!school) return;
    (async () => {
      const { data } = await supabase.from("broadcast_jobs")
        .select("id,title,body,status,scheduled_for").eq("school_id", school.id)
        .in("status", ["scheduled", "sending"]).order("scheduled_for", { ascending: true });
      setItems((data ?? []) as any[]);
    })();
  }, [school?.id]);

  return (
    <div className="h-full overflow-auto p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4"><Clock className="size-6"/> Scheduled Messages</h1>
      {items.length === 0 && <div className="text-sm text-muted-foreground py-12 text-center">No scheduled messages.</div>}
      <div className="space-y-2">
        {items.map((j) => (
          <div key={j.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2"><div className="font-semibold">{j.title}</div><Badge variant="secondary" className="ml-auto capitalize">{j.status}</Badge></div>
            <div className="text-xs text-muted-foreground mt-1">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleString() : "—"}</div>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{j.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}