import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, MetricCard, EmptyState, Skel } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Rocket, TrendingUp, Clock, CheckCircle2, AlertCircle, Plus, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string; name: string; slug: string; plan: string; status: string;
  pilot_status: string; pilot_started_at: string | null; pilot_ends_at: string | null;
  pilot_converted_at: string | null; days_remaining: number | null;
  students: number; teachers: number;
};
type Totals = { total: number; active: number; expired: number; converted: number; conversion_rate: number };

export default function SuperPilots() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  async function load() {
    setRows(null);
    const { data, error } = await supabase.rpc("pilot_super_overview");
    if (error) { toast.error(error.message); setRows([]); return; }
    const d = data as any;
    setRows((d?.schools ?? []) as Row[]);
    setTotals((d?.totals ?? null) as Totals | null);
  }
  useEffect(() => { load(); }, []);

  async function extend(id: string, days: number) {
    const { error } = await supabase.rpc("pilot_extend_days", { _school_id: id, _days: days });
    if (error) { toast.error(error.message); return; }
    toast.success(`Extended pilot by ${days} days`);
    load();
  }
  async function convert(id: string, plan: string) {
    const { error } = await supabase.rpc("pilot_convert_manual", { _school_id: id, _plan: plan });
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as converted");
    load();
  }

  const filtered = (rows ?? []).filter(r => {
    if (status !== "all" && r.pilot_status !== status) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.slug.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="60-Day Pilot Program"
        description="Track founding-school pilots, conversion rate, and manage trial extensions."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Total pilots" value={totals?.total ?? 0} icon={<Rocket className="size-4" />} />
        <MetricCard label="Active" value={totals?.active ?? 0} icon={<Clock className="size-4" />} />
        <MetricCard label="Expired" value={totals?.expired ?? 0} icon={<AlertCircle className="size-4" />} />
        <MetricCard label="Converted" value={totals?.converted ?? 0} icon={<CheckCircle2 className="size-4" />} />
        <MetricCard label="Conversion rate" value={`${totals?.conversion_rate ?? 0}%`} icon={<TrendingUp className="size-4" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search school name or slug…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex gap-1">
          {["all", "active", "expired", "converted"].map(s => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="capitalize">{s}</Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={load} className="ml-auto">Refresh</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pilot start</TableHead>
              <TableHead>Pilot end</TableHead>
              <TableHead className="text-right">Days left</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Teachers</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skel className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {rows !== null && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8}><EmptyState icon={<Rocket className="size-5" />} title="No pilot schools" /></TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/super/schools/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                  <div className="text-xs text-muted-foreground">{r.slug} · {r.plan}</div>
                </TableCell>
                <TableCell><PilotStatusBadge status={r.pilot_status} /></TableCell>
                <TableCell className="text-xs">{r.pilot_started_at ? new Date(r.pilot_started_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-xs">{r.pilot_ends_at ? new Date(r.pilot_ends_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.days_remaining ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.students}</TableCell>
                <TableCell className="text-right tabular-nums">{r.teachers}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.pilot_status !== "converted" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => extend(r.id, 14)}>+14d</Button>
                        <Button size="sm" variant="outline" onClick={() => extend(r.id, 30)}>+30d</Button>
                        <Button size="sm" onClick={() => convert(r.id, "standard")}>Convert</Button>
                      </>
                    )}
                    <Link to={`/super/schools/${r.id}`} className="inline-flex items-center justify-center size-8 rounded-md hover:bg-muted">
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PilotStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "bg-primary/15 text-primary border-primary/30" },
    expired:   { label: "Expired",   cls: "bg-destructive/15 text-destructive border-destructive/30" },
    converted: { label: "Converted", cls: "bg-success/15 text-success border-success/30" },
    none:      { label: "—",         cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] ?? map.none;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}