import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, MetricCard } from "@/components/super/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyRound, Users, Layers, ArrowRight } from "lucide-react";

type Plan = { plan: string; label: string; term_price_kobo: number; included_students: number; extra_student_kobo: number; sort_order: number };
type School = { id: string; plan: string | null; status: string; student_count: number | null };
type Invoice = { school_id: string; plan: string | null; status: string; amount_kobo: number | null; amount_cents: number | null };

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

export default function BusinessPlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    (async () => {
      const [p, s, i] = await Promise.all([
        supabase.from("plan_pricing").select("*").order("sort_order"),
        supabase.from("schools").select("id, plan, status, student_count"),
        supabase.from("invoices").select("school_id, plan, status, amount_kobo, amount_cents"),
      ]);
      setPlans((p.data as Plan[]) ?? []);
      setSchools((s.data as School[]) ?? []);
      setInvoices((i.data as Invoice[]) ?? []);
    })();
  }, []);

  const rows = useMemo(() => {
    return (plans ?? []).map(pl => {
      const cohort = schools.filter(s => s.plan === pl.plan);
      const active = cohort.filter(s => s.status === "active").length;
      const rev = invoices
        .filter(x => x.status === "paid" && x.plan === pl.plan)
        .reduce((a, x) => a + (x.amount_kobo ?? (x.amount_cents ?? 0)), 0);
      const students = cohort.reduce((a, s) => a + (s.student_count ?? 0), 0);
      return { ...pl, schools: cohort.length, active, revenue: rev, students };
    });
  }, [plans, schools, invoices]);

  const totals = useMemo(() => ({
    plans: plans?.length ?? 0,
    schools: schools.length,
    revenue: rows.reduce((a, r) => a + r.revenue, 0),
  }), [plans, schools, rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard label="Plans" value={totals.plans} icon={<Layers className="size-4" />} />
        <MetricCard label="Schools on plans" value={totals.schools} icon={<Users className="size-4" />} />
        <MetricCard label="Total plan revenue" value={naira(totals.revenue)} icon={<KeyRound className="size-4" />} />
      </div>

      <Section
        title="Plan catalog"
        description="Read-only summary. Edit pricing in Products → Licensing."
        actions={<Button asChild size="sm" variant="outline"><Link to="/super/products?tab=licensing">Manage pricing <ArrowRight className="size-3 ml-1" /></Link></Button>}
      >
        {plans === null ? <Skel className="h-40" /> : rows.length === 0 ? (
          <EmptyState icon={<Layers className="size-6" />} title="No plans configured" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Term price</TableHead>
                <TableHead className="text-right">Included students</TableHead>
                <TableHead className="text-right">Extra / student</TableHead>
                <TableHead className="text-right">Schools</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.plan}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.label}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{r.plan}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{naira(r.term_price_kobo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.included_students}</TableCell>
                  <TableCell className="text-right tabular-nums">{naira(r.extra_student_kobo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.schools} <span className="text-muted-foreground">({r.active} active)</span></TableCell>
                  <TableCell className="text-right tabular-nums">{r.students.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{naira(r.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}