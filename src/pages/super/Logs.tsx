import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollText, Search, Download, Eye } from "lucide-react";
import { timeAgo } from "@/lib/super";

type Row = { id: string; action: string; actor: string; school_id: string | null; ip: string | null; payload: any; created_at: string };

const PAGE = 100;

export default function SuperLogs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [q, setQ] = useState("");

  async function loadMore(reset = false) {
    setLoading(true);
    let query = supabase.from("platform_audit").select("*").order("created_at", { ascending: false }).limit(PAGE);
    if (!reset && rows.length) query = query.lt("created_at", rows[rows.length - 1].created_at);
    if (q.trim()) query = query.ilike("action", `%${q.trim()}%`);
    const { data } = await query;
    const next = (data as Row[]) ?? [];
    setRows(reset ? next : [...rows, ...next]);
    setDone(next.length < PAGE);
    setLoading(false);
  }

  useEffect(() => { loadMore(true); /* eslint-disable-next-line */ }, []);

  function exportCsv() {
    const header = ["created_at","action","actor","school_id","ip"];
    const lines = rows.map(r => [r.created_at, r.action, r.actor, r.school_id ?? "", r.ip ?? ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <div>
      <PageHeader title="System Logs" description="Platform-wide audit trail. Every privileged write touches this stream."
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-3.5 mr-1.5" />Export current</Button>} />

      <Section title={`${rows.length} entries`} actions={
        <div className="relative w-64">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") loadMore(true); }} placeholder="Filter by action…" className="pl-7 h-8" />
        </div>
      }>
        {loading && rows.length === 0 ? (
          <div className="space-y-2">{Array.from({length:6}).map((_,i)=><Skel key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-5 text-muted-foreground" />} title="No audit rows" />
        ) : (
          <>
            <div className="overflow-x-auto -mx-5">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                  <tr><th className="text-left px-5 py-2 font-medium">Action</th><th className="text-left px-3 py-2 font-medium">Actor</th><th className="text-left px-3 py-2 font-medium">School</th><th className="text-left px-3 py-2 font-medium">IP</th><th className="text-right px-5 py-2 font-medium">When</th></tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="px-5 py-2 flex items-center gap-2">
                        <code className="text-[11px]">{r.action}</code>
                        <Popover>
                          <PopoverTrigger asChild><Button size="icon" variant="ghost" className="size-6"><Eye className="size-3.5" /></Button></PopoverTrigger>
                          <PopoverContent className="w-96"><pre className="text-[11px] whitespace-pre-wrap break-all max-h-72 overflow-y-auto">{JSON.stringify(r.payload, null, 2)}</pre></PopoverContent>
                        </Popover>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.actor?.slice(0,8)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.school_id?.slice(0,8) ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.ip ?? "—"}</td>
                      <td className="px-5 py-2 text-right text-xs text-muted-foreground">{timeAgo(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
            <div className="flex justify-center pt-4">
              <Button size="sm" variant="outline" disabled={loading || done} onClick={() => loadMore()}>{done ? "End of log" : loading ? "Loading…" : "Load more"}</Button>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}