import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, StatusBadge, MetricCard } from "@/components/super/primitives";
import { fmtNgn, superAction } from "@/lib/super";
import { Layers, Pencil, Plus, Building2, Wallet, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type PlanRow = {
  plan: string;
  label: string;
  term_price_kobo: number;
  included_students: number;
  extra_student_kobo: number;
  sort_order: number;
};

type SchoolRow = { id: string; plan: string; status: string };

export default function BusinessPlans() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [schools, setSchools] = useState<SchoolRow[] | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    plan: "",
    label: "",
    term_price_ngn: "0",
    included_students: "100",
    extra_student_ngn: "0",
    sort_order: "1",
  });

  async function load() {
    const [p, s] = await Promise.all([
      supabase.from("plan_pricing").select("plan, label, term_price_kobo, included_students, extra_student_kobo, sort_order").order("sort_order"),
      supabase.from("schools").select("id, plan, status").is("deleted_at", null),
    ]);
    setPlans((p.data as PlanRow[]) ?? []);
    setSchools((s.data as SchoolRow[]) ?? []);
  }

  useEffect(() => { void load(); }, []);

  function openEdit(p?: PlanRow) {
    if (p) {
      setEditing(p);
      setForm({
        plan: p.plan,
        label: p.label,
        term_price_ngn: String(Math.round((p.term_price_kobo ?? 0) / 100)),
        included_students: String(p.included_students ?? 0),
        extra_student_ngn: String(Math.round((p.extra_student_kobo ?? 0) / 100)),
        sort_order: String(p.sort_order ?? 1),
      });
    } else {
      setEditing({ plan: "", label: "", term_price_kobo: 0, included_students: 200, extra_student_kobo: 0, sort_order: (plans?.length ?? 0) + 1 });
      setForm({ plan: "", label: "", term_price_ngn: "150000", included_students: "250", extra_student_ngn: "500", sort_order: String((plans?.length ?? 0) + 1) });
    }
  }

  async function savePlan() {
    if (!form.plan.trim() || !form.label.trim()) {
      toast.error("Plan slug and label are required");
      return;
    }
    setBusy(true);
    try {
      await superAction("upsert_plan_pricing", {
        plan: form.plan.trim().toLowerCase(),
        label: form.label.trim(),
        term_price_kobo: Math.round(parseFloat(form.term_price_ngn || "0") * 100),
        included_students: parseInt(form.included_students || "0", 10),
        extra_student_kobo: Math.round(parseFloat(form.extra_student_ngn || "0") * 100),
        sort_order: parseInt(form.sort_order || "1", 10),
      });
      toast.success(`Saved ${form.label} tier pricing`);
      setEditing(null);
      await load();
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  }

  const byPlan = useMemo(() => {
    const m = new Map<string, { total: number; active: number }>();
    for (const s of schools ?? []) {
      const cur = m.get(s.plan) ?? { total: 0, active: 0 };
      cur.total++;
      if (s.status === "active") cur.active++;
      m.set(s.plan, cur);
    }
    return m;
  }, [schools]);

  const summary = useMemo(() => {
    if (!plans || !schools) return { totalActiveSchools: 0, projectedTermKobo: 0 };
    let totalActiveSchools = 0;
    let projectedTermKobo = 0;
    for (const p of plans) {
      const c = byPlan.get(p.plan) ?? { total: 0, active: 0 };
      totalActiveSchools += c.active;
      projectedTermKobo += c.active * Number(p.term_price_kobo ?? 0);
    }
    return { totalActiveSchools, projectedTermKobo };
  }, [plans, schools, byPlan]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Configured Tiers" value={plans?.length ?? "—"} icon={<Layers className="size-4" />} />
        <MetricCard label="Active Schools on Plans" value={schools ? summary.totalActiveSchools : "—"} icon={<Building2 className="size-4" />} />
        <MetricCard label="Projected Term Base Run-Rate" value={plans ? fmtNgn(summary.projectedTermKobo) : "—"} sub="Active schools × term tier price" icon={<Wallet className="size-4 text-success" />} />
      </div>

      <Section
        title="Plan Tiers & NGN Term Pricing"
        description="Live platform pricing matrix. Changes immediately apply to new subscription invoices and upgrade quotes."
        actions={
          <Button size="sm" variant="outline" onClick={() => openEdit()}>
            <Plus className="size-3.5 mr-1.5" />Add Plan Tier
          </Button>
        }
      >
        {!plans ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-10" />)}</div>
        ) : plans.length === 0 ? (
          <EmptyState icon={<Layers className="size-5 text-muted-foreground" />} title="No plans configured" description="Seed the plan_pricing table to populate tiers." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Term Price (₦)</TableHead>
                  <TableHead className="text-right">Included Students</TableHead>
                  <TableHead className="text-right">Overage / Student</TableHead>
                  <TableHead className="text-right">Active / Total Schools</TableHead>
                  <TableHead className="text-right">Term Run-Rate</TableHead>
                  <TableHead className="w-24 text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(p => {
                  const counts = byPlan.get(p.plan) ?? { total: 0, active: 0 };
                  const runRateKobo = counts.active * Number(p.term_price_kobo ?? 0);
                  return (
                    <TableRow key={p.plan}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={p.plan} />
                          <span className="font-medium text-foreground">{p.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtNgn(p.term_price_kobo)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Users className="size-3 text-muted-foreground" />
                          {p.included_students.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNgn(p.extra_student_kobo)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium text-foreground">{counts.active}</span>
                        <span className="text-muted-foreground"> / {counts.total}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono text-xs">{fmtNgn(runRateKobo)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(p)}>
                          <Pencil className="size-3 mr-1" />Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.plan ? `Edit ${editing.label} Tier` : "Add Plan Tier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan Slug</Label>
                <Input
                  value={form.plan}
                  disabled={!!editing?.plan}
                  onChange={e => setForm({ ...form, plan: e.target.value })}
                  placeholder="e.g. standard"
                />
              </div>
              <div>
                <Label>Display Label</Label>
                <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Standard" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Term Price (₦ Naira)</Label>
                <Input type="number" min={0} step="1000" value={form.term_price_ngn} onChange={e => setForm({ ...form, term_price_ngn: e.target.value })} />
              </div>
              <div>
                <Label>Included Students</Label>
                <Input type="number" min={0} step="10" value={form.included_students} onChange={e => setForm({ ...form, included_students: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Extra Student Price (₦ / term)</Label>
                <Input type="number" min={0} step="50" value={form.extra_student_ngn} onChange={e => setForm({ ...form, extra_student_ngn: e.target.value })} />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" min={0} value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={savePlan} disabled={busy}>Save Pricing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}