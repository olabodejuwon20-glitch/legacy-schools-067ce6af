import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard, Section, Skel, EmptyState } from "@/components/super/primitives";
import { TrendingUp, DollarSign, AlertCircle, Users, Banknote } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Invoice = { id: string; school_id: string; amount_cents: number | null; amount_kobo: number | null; status: string; issued_at: string; paid_at: string | null; plan: string | null; kind: string | null };
type School = { id: string; name: string; plan: string | null; status: string; plan_started_at: string | null };

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

export default function BusinessRevenue() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    (async () => {
      const [i, s] = await Promise.all([
        supabase.from("invoices").select("id, school_id, amount_cents, amount_kobo, status, issued_at, paid_at, plan, kind").order("issued_at", { ascending: false }).limit(2000),
        supabase.from("schools").select("id, name, plan, status, plan_started_at"),
      ]);
      setInvoices((i.data as Invoice[]) ?? []);
      setSchools((s.data as School[]) ?? []);
    })();
  }, []);

  const amt = (x: Invoice) => (x.amount_kobo ?? (x.amount_cents ?? 0) * 1) || 0;

  const kpis = useMemo(() => {
    const list = invoices ?? [];
    const paid = list.filter(x => x.status === "paid" && x.paid_at);
    const now = Date.now();
    const d30 = now - 30 * 86400_000;
    const d60 = now - 60 * 86400_000;
    const rev30 = paid.filter(x => new Date(x.paid_at!).getTime() >= d30).reduce((a, x) => a + amt(x), 0);
    const rev60_30 = paid.filter(x => { const t = new Date(x.paid_at!).getTime(); return t >= d60 && t < d30; }).reduce((a, x) => a + amt(x), 0);
    const growth = rev60_30 > 0 ? Math.round(((rev30 - rev60_30) / rev60_30) * 100) : null;
    const mrr = rev30; // proxy: 30d paid revenue
    const arr = mrr * 12;
    const overdue = list.filter(x => x.status === "open").reduce((a, x) => a + amt(x), 0);
    const activePayers = new Set(paid.filter(x => new Date(x.paid_at!).getTime() >= d30).map(x => x.school_id)).size;
    return { mrr, arr, growth, overdue, activePayers };
  }, [invoices]);

  const trend = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 89; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); buckets[d.toISOString().slice(0, 10)] = 0; }
    (invoices ?? []).filter(x => x.status === "paid" && x.paid_at).forEach(x => {
      const k = x.paid_at!.slice(0, 10);
      if (k in buckets) buckets[k] += amt(x) / 100;
    });
    return Object.entries(buckets).map(([date, value]) => ({ date: date.slice(5), value: Math.round(value) }));
  }, [invoices]);

  const topSchools = useMemo(() => {
    const totals = new Map<string, number>();
    (invoices ?? []).filter(x => x.status === "paid").forEach(x => {
      totals.set(x.school_id, (totals.get(x.school_id) ?? 0) + amt(x));
    });
    const rows = Array.from(totals.entries()).map(([id, k]) => ({
      id, kobo: k, name: schools.find(s => s.id === id)?.name ?? "—", plan: schools.find(s => s.id === id)?.plan ?? "—",
    }));
    rows.sort((a, b) => b.kobo - a.kobo);
    return rows.slice(0, 8);
  }, [invoices, schools]);

  const planMix = useMemo(() => {
    const totals = new Map<string, number>();
    (invoices ?? []).filter(x => x.status === "paid").forEach(x => {
      const p = x.plan ?? "unknown";
      totals.set(p, (totals.get(p) ?? 0) + amt(x));
    });
    return Array.from(totals.entries()).map(([plan, kobo]) => ({ plan, value: Math.round(kobo / 100) })).sort((a, b) => b.value - a.value);
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="MRR (30d paid)" value={naira(kpis.mrr)} icon={<DollarSign className="size-4" />} />
        <MetricCard label="ARR (annualized)" value={naira(kpis.arr)} icon={<TrendingUp className="size-4" />} />
        <MetricCard label="Net new MRR" value={kpis.growth === null ? "—" : `${kpis.growth >= 0 ? "+" : ""}${kpis.growth}%`} icon={<TrendingUp className="size-4" />} />
        <MetricCard label="Overdue" value={naira(kpis.overdue)} icon={<AlertCircle className="size-4" />} />
        <MetricCard label="Active payers" value={kpis.activePayers} icon={<Users className="size-4" />} />
      </div>

      <Section title="Revenue — last 90 days" description="Paid invoices per day (₦)">
        {invoices === null ? <Skel className="h-56" /> : trend.every(t => t.value === 0) ? (
          <EmptyState icon={<Banknote className="size-6" />} title="No paid revenue yet" description="Paid invoices will start showing up here." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Revenue by plan" description="Lifetime paid, all-time">
          {invoices === null ? <Skel className="h-56" /> : planMix.length === 0 ? (
            <EmptyState icon={<Banknote className="size-6" />} title="No revenue yet" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planMix} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="plan" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Top-paying schools" description="Lifetime paid revenue">
          {invoices === null ? <Skel className="h-56" /> : topSchools.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="No paying schools yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>School</TableHead><TableHead>Plan</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topSchools.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{r.plan}</TableCell>
                    <TableCell className="text-right tabular-nums">{naira(r.kobo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}