import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Megaphone } from "lucide-react";
import { relTime } from "@/lib/comms";

interface Ann { id: string; title: string; body: string; created_at: string; audience: string | null; }

export default function AnnouncementsView() {
  const { school } = useSchool();
  const [items, setItems] = useState<Ann[]>([]);
  useEffect(() => {
    if (!school) return;
    (async () => {
      const { data } = await supabase.from("announcements")
        .select("id,title,body,created_at,audience").eq("school_id", school.id)
        .order("created_at", { ascending: false }).limit(100);
      setItems((data ?? []) as Ann[]);
    })();
  }, [school?.id]);
  return (
    <div className="h-full overflow-auto p-6 max-w-4xl mx-auto space-y-3">
      <h1 className="text-2xl font-semibold flex items-center gap-2"><Megaphone className="size-6"/> Announcements</h1>
      {items.length === 0 && <div className="text-sm text-muted-foreground py-12 text-center">No announcements yet.</div>}
      {items.map((a) => (
        <article key={a.id} className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-semibold">{a.title}</h2>
            <span className="text-xs text-muted-foreground shrink-0">{relTime(a.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
          {a.audience && <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{a.audience}</div>}
        </article>
      ))}
    </div>
  );
}