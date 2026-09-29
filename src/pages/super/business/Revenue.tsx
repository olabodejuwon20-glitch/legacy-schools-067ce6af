import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Section, MetricCard, Skel, EmptyState } from "@/components/super/primitives";
import { fmtNgn } from "@/lib/super";
import { Wallet, TrendingUp, AlertCircle, CheckCircle2, Layers, ArrowUpRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Inv = { id: string; school_id: string; amount_kobo: number | null; amount_cents: number; status: string; paid_at: string | null; issued_at: string; due_at: string | null };
type School = { id: string; name: string; slug: string; plan: string; status: string };
type PlanPrice = { plan: string; term_price_kobo: number };
type AddonSub = { school_id: string; enabled: boolean; term_price_kobo_override: number | null; module_id: string };
type ModRow = { id: string; pricing_model: string; term_price_kobo: number };

const amountOf = (i: Inv) => Number(i.amount_kobo ?? i.amount_cents ?? 0);

export default function BusinessRevenue() {
  const [invoices, setInvoices] = useState<Inv[] | null>(null);
  const [schools, setSchools] = useState<Map<string, School>>(new Map());
  const [committedRunRate, setCommittedRunRate] = useState<{ baseKobo: number; addonKobo: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [inv, sch, plans, sm, mods] = await Promise.all([
        supabase.from("invoices").select("id, school_id, amount_kobo, amount_cents, status, paid_at, issued_at, due_at").order("issued_at", { ascending: false }).limit(500),
        supabase.from("schools").select("id, name, slug, plan, status").is("deleted_at", null),
        supabase.from("plan_pricing").select("plan, term_price_kobo"),
        supabase.from("school_modules").select("school_id, module_id, enabled, term_price_kobo_override").eq("enabled", true),
        supabase.from("modules").select("id, pricing_model, term_price_kobo"),
      ]);
      if (!alive) return;
      const schList = (sch.data as School[]) ?? [];
      setInvoices((inv.data as Inv[]) ?? []);
      setSchools(new Map(schList.map(s => [s.id, s])));

      const planMap = new Map(((plans.data as PlanPrice[]) ?? []).map(p => [p.plan, Number(p.term_price_kobo ?? 0)]));
      const activeIds = new Set(schList.filter(s => s.status === "active").map(s => s.id));
      const baseKobo = schList
        .filter(s => s.status === "active")
        .reduce((sum, s) => sum + (planMap.get(s.plan) ?? 0), 0);

      const modMap = new Map(((mods.data as ModRow[]) ?? []).map(m => [m.id, m]));
      let addonKobo = 0;
      for (const row of ((sm.data as AddonSub[]) ?? [])) {
        if (!activeIds.has(row.school_id)) continue;
        const m = modMap.get(row.module_id);
        if (!m || m.pricing_model === "included") continue;
        addonKobo += Number(row.term_price_kobo_override ?? m.term_price_kobo ?? 0);
      }
      setCommittedRunRate({ baseKobo, addonKobo });
    })();
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    if (!invoices) return null;
    const now = Date.now();
    const d30 = now - 30 * 86400_000;
    const d90 = now - 90 * 86400_000;
    let rev30 = 0, rev90 = 0, revAll = 0, openTotal = 0, overdueTotal = 0;
    const bySchool = new Map<string, number>();

    for (const i of invoices) {
      const amt = amountOf(i);
      if (i.status === "paid") {
        revAll += amt;
        const t = i.paid_at ? new Date(i.paid_at).getTime() : new Date(i.issued_at).getTime();
        if (t >= d30) rev30 += amt;
        if (t >= d90) rev90 += amt;
        bySchool.set(i.school_id, (bySchool.get(i.school_id) ?? 0) + amt);
      } else if (i.status === "open") {
        openTotal += amt;
        if (i.due_at && new Date(i.due_at).getTime() < now) overdueTotal += amt;
      }
    }

    const topSchools = Array.from(bySchool.entries())
      .map(([school_id, kobo]) => ({ school: schools.get(school_id), school_id, kobo }))
      .sort((a, b) => b.kobo - a.kobo)
      .slice(0, 10);

    return { rev30, rev90, revAll, openTotal, overdueTotal, topSchools };
  }, [invoices, schools]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Paid · last 30d"   value={stats ? fmtNgn(stats.rev30) : "—"}       icon={<Wallet className="size-4" />} />
        <MetricCard label="Paid · last 90d"   value={stats ? fmtNgn(stats.rev90) : "—"}       icon={<TrendingUp className="size-4" />} />
        <MetricCard label="Paid · all time"   value={stats ? fmtNgn(stats.revAll) : "—"}      icon={<CheckCircle2 className="size-4" />} />
        <MetricCard
          label="Committed Term Run-Rate"
          value={committedRunRate ? fmtNgn(committedRunRate.baseKobo + committedRunRate.addonKobo) : "—"}
          sub={committedRunRate ? `Plans ${fmtNgn(committedRunRate.baseKobo)} + Add-ons ${fmtNgn(committedRunRate.addonKobo)}` : undefined}
          icon={<Layers className="size-4 text-info" />}
        />
        <MetricCard
          label="Outstanding"
          value={stats ? fmtNgn(stats.openTotal) : "—"}
          sub={stats && stats.overdueTotal > 0 ? `${fmtNgn(stats.overdueTotal)} overdue` : "No overdue"}
          icon={<AlertCircle className="size-4" />}
        />
      </div>

      <Section title="Top Paying Schools" description="Ranked by cumulative paid invoices in NGN. Click any school to inspect its tenant workspace.">
        {!stats ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-9" />)}</div>
        ) : stats.topSchools.length === 0 ? (
          <EmptyState icon={<Wallet className="size-5 text-muted-foreground" />} title="No paid invoices yet" description="Collections will appear here once schools settle their first invoice." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Lifetime Paid (NGN)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topSchools.map((row, idx) => (
                  <TableRow key={row.school_id}>
                    <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {row.school ? (
                        <Link to={`/super/schools/${row.school_id}`} className="inline-flex items-center gap-1 hover:underline text-foreground">
                          {row.school.name}
                          <ArrowUpRight className="size-3 text-muted-foreground" />
                        </Link>
                      ) : (
                        row.school_id.slice(0, 8)
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">{row.school?.plan ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtNgn(row.kobo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}