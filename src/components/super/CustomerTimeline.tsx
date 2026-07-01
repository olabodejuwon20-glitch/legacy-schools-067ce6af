import { TimelineEvent, TIMELINE_META } from "@/lib/schoolHealth";
import { timeAgo } from "@/lib/super";
import { cn } from "@/lib/utils";

export default function CustomerTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative border-l border-border/70 ml-3 space-y-4">
      {events.map((e) => {
        const meta = TIMELINE_META[e.kind];
        return (
          <li key={e.id} className="ml-4">
            <span className={cn("absolute -left-[7px] size-3 rounded-full border-2 border-background", meta.color.split(" ").find(c => c.startsWith("bg-")) ?? "bg-primary")} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border", meta.color)}>{meta.label}</span>
                  <span className="text-sm font-medium">{e.title}</span>
                </div>
                {e.detail && <div className="text-xs text-muted-foreground mt-1">{e.detail}</div>}
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(e.at)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
