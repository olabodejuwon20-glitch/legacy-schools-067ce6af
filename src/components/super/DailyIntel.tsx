import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RefreshCw, ArrowUpRight, TrendingUp, AlertOctagon, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Item = { title: string; detail: string; area: string; path: string; severity?: "low" | "medium" | "high"; action?: string };
type Report = { summary: string; progress: Item[]; problems: Item[]; solutions: Item[] };
type Payload = { report: Report; signals: Record<string, any>; model: string; generated_at: string };

const CACHE_KEY = "super-daily-intel:v1";
const TTL_MS = 6 * 60 * 60 * 1000; // 6h — "daily" but refreshable

function readCache(): Payload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.generated_at) return null;
    if (Date.now() - new Date(parsed.generated_at).getTime() > TTL_MS) return null;
    return parsed;
  } catch { return null; }
}
function writeCache(p: Payload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch {}
}

export default function DailyIntel() {
  const [data, setData] = useState<Payload | null>(() => readCache());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!force && data) return;
    setLoading(true); setErr(null);
    const { data: res, error } = await supabase.functions.invoke("super-daily-intel");
    setLoading(false);
    if (error || (res as any)?.error) {
      setErr((res as any)?.error ?? error?.message ?? "Failed to generate briefing");
      return;
    }
    const payload: Payload = { ...(res as any), generated_at: (res as any)?.signals?.generated_at ?? new Date().toISOString() };
    setData(payload);
    writeCache(payload);
  }, [data]);

  useEffect(() => { if (!data) void load(false); }, [data, load]);

  const generated = data?.generated_at ? new Date(data.generated_at) : null;

  return (
    <section className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 via-card/60 to-card/40 overflow-hidden">
      <header className="px-4 py-3 border-b border-border/70 flex items-center justify-between gap-3 bg-background/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-md bg-primary/15 text-primary grid place-items-center shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
              AI Daily Intelligence
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Beta</span>
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {generated ? `Generated ${generated.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}` : "Personalized briefing across your entire platform"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {loading ? "Analyzing…" : "Refresh"}
        </Button>
      </header>

      {err && (
        <div className="p-4 text-[12px] text-destructive">{err}</div>
      )}

      {!data && loading && (
        <div className="p-6 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Compiling today's signals across schools, revenue, errors, AI & security…
        </div>
      )}

      {data && (
        <div className="p-4 space-y-4">
          {data.report.summary && (
            <p className="text-[13px] leading-relaxed text-foreground bg-muted/30 border border-border/60 rounded-lg px-3.5 py-2.5">
              {data.report.summary}
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <IntelColumn
              tone="success"
              icon={<TrendingUp className="size-3.5" />}
              title="Progress"
              subtitle="What's working today"
              items={data.report.progress ?? []}
            />
            <IntelColumn
              tone="danger"
              icon={<AlertOctagon className="size-3.5" />}
              title="Problems"
              subtitle="Risks that need attention"
              items={data.report.problems ?? []}
            />
            <IntelColumn
              tone="primary"
              icon={<Lightbulb className="size-3.5" />}
              title="Solutions"
              subtitle="Recommended next actions"
              items={data.report.solutions ?? []}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function IntelColumn({ tone, icon, title, subtitle, items }: {
  tone: "success" | "danger" | "primary";
  icon: React.ReactNode; title: string; subtitle: string; items: Item[];
}) {
  const toneMap: Record<string, string> = {
    success: "text-success bg-success/10 border-success/20",
    danger: "text-destructive bg-destructive/10 border-destructive/20",
    primary: "text-primary bg-primary/10 border-primary/20",
  };
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
        <span className={cn("size-5 rounded grid place-items-center border", toneMap[tone])}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-foreground leading-tight">{title}</div>
          <div className="text-[10px] text-muted-foreground leading-tight">{subtitle}</div>
        </div>
      </div>
      <ul className="p-2 space-y-1.5 flex-1">
        {items.length === 0 && (
          <li className="text-[11px] text-muted-foreground px-2 py-4 text-center">Nothing surfaced.</li>
        )}
        {items.map((it, i) => (
          <li key={i}>
            <Link
              to={it.path || "#"}
              className="group block rounded-md border border-transparent hover:border-border hover:bg-muted/60 px-2.5 py-2 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] font-medium text-foreground leading-snug">{it.title}</div>
                <ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
              </div>
              {it.detail && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{it.detail}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                {it.severity && (
                  <span className={cn(
                    "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                    it.severity === "high" && "bg-destructive/15 text-destructive",
                    it.severity === "medium" && "bg-warning/15 text-warning",
                    it.severity === "low" && "bg-muted text-muted-foreground",
                  )}>{it.severity}</span>
                )}
                {it.action && <span className="text-[10px] text-primary font-medium truncate">→ {it.action}</span>}
                <span className="ml-auto text-[10px] text-muted-foreground truncate">{it.area}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}