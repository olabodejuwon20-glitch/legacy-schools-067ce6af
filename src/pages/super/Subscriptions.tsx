import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, StatusBadge, EmptyState } from "@/components/super/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Search, AlertTriangle, TrendingUp, Banknote, Calendar } from "lucide-react";
import { formatNaira, revenueForSchool, type PlanPricing, type Addon } from "@/lib/pricing";

type School = {
  id: string; name: string; slug: string; status: string;
  plan: string; plan_started_at: string; plan_expires_at: string | null;
  currency: string | null; billing_cycle: string | null;
  included_students: number | null; extra_student_kobo: number | null;
  student_count: number | null; term_ends_at: string | null;
};
type ModRow = { id: string; slug: string; name: string; term_price_kobo: number };
type SM = { school_id: string; module_id: string; enabled: boolean; term_price_kobo_override: number | null };

export default function SuperSubscriptions() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [modules, setModules] = useState<ModRow[]>([]);
  const [matrix, setMatrix] = useState<SM[]>([]);
  const [pricing, setPricing] = useState<PlanPricing[]>([]);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [editing, setEditing] = useState<School | null>(null);
  const [newPlan, setNewPlan] = useState<string>("basic");
  const [newExpiry, setNewExpiry] = useState<string>("");
  const [newCycle, setNewCycle] = useState<string>("termly");
  const [newIncluded, setNewIncluded] = useState<string>("");
  const [newExtraNaira, setNewExtraNaira] = useState<string>("");
  const [newTermEnds, setNewTermEnds] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [s, m, sm, pp] = await Promise.all([
      supabase.from("schools").select("id, name, slug, status, plan, plan_started_at, plan_expires_at, currency, billing_cycle, included_students, extra_student_kobo, student_count, term_ends_at").order("name"),
      supabase.from("modules").select("id, slug, name, term_price_kobo"),
      supabase.from("school_modules").select("school_id, module_id, enabled, term_price_kobo_override").eq("enabled", true),
      supabase.from("plan_pricing").select("*").order("sort_order"),
    ]);
    setSchools((s.data as School[]) ?? []);
    setModules((m.data as ModRow[]) ?? []);
    setMatrix((sm.data as SM[]) ?? []);
    setPricing((pp.data as PlanPricing[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const addonsFor = (schoolId: string): Addon[] =>
    matrix.filter(x => x.school_id === schoolId)
      .map(x => {
        const mod = modules.find(m => m.id === x.module_id);
        if (!mod) return null;
        return {
          id: mod.id, slug: mod.slug, name: mod.name,
          term_price_kobo: x.term_price_kobo_override ?? mod.term_price_kobo,
        };
      }).filter(Boolean) as Addon[];

  const revFor = (s: School) => revenueForSchool({
    plan: s.plan,
    studentCount: s.student_count ?? 0,
    includedOverride: s.included_students,
    extraKoboOverride: s.extra_student_kobo,
    addons: addonsFor(s.id),
    planPricing: pricing,
  });

  const totals = useMemo(() => {
    const list = schools ?? [];
    const active = list.filter(s => s.status === "active" && s.plan !== "trial");
    const termRevenue = active.reduce((acc, s) => acc + revFor(s).termKobo, 0);
    const trials = list.filter(s => s.plan === "trial").length;
    const expiringSoon = list.filter(s => s.term_ends_at && new Date(s.term_ends_at).getTime() - Date.now() < 14 * 86400_000 && new Date(s.term_ends_at).getTime() > Date.now()).length;
    const overdue = list.filter(s => s.term_ends_at && new Date(s.term_ends_at).getTime() < Date.now()).length;
    return { termRevenue, annualRevenue: termRevenue * 3, active: active.length, trials, expiringSoon, overdue };
  }, [schools, matrix, modules, pricing]);

  const filtered = useMemo(() => (schools ?? [])
    .filter(s => (planFilter === "all" || s.plan === planFilter))
    .filter(s => !q.trim() || s.name.toLowerCase().includes(q.toLowerCase()) || s.slug.toLowerCase().includes(q.toLowerCase()))
  , [schools, planFilter, q]);

  function openEdit(s: School) {
    setEditing(s);
    setNewPlan(s.plan);
    setNewExpiry(s.plan_expires_at ? s.plan_expires_at.slice(0, 10) : "");
    setNewCycle(s.billing_cycle || "termly");
    setNewIncluded(s.included_students != null ? String(s.included_students) : "");
    setNewExtraNaira(s.extra_student_kobo != null ? String(Math.round(s.extra_student_kobo / 100)) : "");
    setNewTermEnds(s.term_ends_at ? s.term_ends_at.slice(0, 10) : "");
  }

  function labelFor(plan: string) {
    return pricing.find(p => p.plan === plan)?.label ?? plan;
  }

  async function savePlan() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload: any = {
        plan: newPlan,
        plan_expires_at: newExpiry ? new Date(newExpiry).toISOString() : null,
        billing_cycle: newCycle,
        term_ends_at: newTermEnds || null,
        included_students: newIncluded === "" ? null : parseInt(newIncluded, 10),
        extra_student_kobo: newExtraNaira === "" ? null : Math.round(parseFloat(newExtraNaira) * 100),
      };
      const { error } = await supabase.from("schools").update(payload).eq("id", editing.id);
      if (error) throw error;
      toast.success("Subscription updated");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Subscriptions" description="NGN per-term pricing, plan changes, term-end pipeline, and revenue per tenant." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Revenue this term" value={schools ? formatNaira(totals.termRevenue) : <Skel className="h-6 w-24" />} icon={<Banknote className="size-4" />} />
        <MetricCard label="Annualised (×3)" value={schools ? formatNaira(totals.annualRevenue) : <Skel className="h-6 w-24" />} icon={<TrendingUp className="size-4" />} />
        <MetricCard label="On trial" value={schools ? totals.trials : <Skel className="h-6 w-12" />} icon={<Calendar className="size-4" />} />
        <MetricCard label="Terms ending < 14d" value={schools ? totals.expiringSoon : <Skel className="h-6 w-12" />} delta={totals.overdue ? { value: `${totals.overdue} overdue`, positive: false } : undefined} icon={<AlertTriangle className="size-4" />} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {pricing.map(p => (
              <SelectItem key={p.plan} value={p.plan}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Section title="Subscription pipeline">
        {schools === null ? (
          <div className="space-y-2"><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-10" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<CreditCard className="size-5" />} title="No subscriptions" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2 font-medium">School</th>
                  <th className="text-left px-3 py-2 font-medium">Plan</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium">Students</th>
                  <th className="text-right px-3 py-2 font-medium">Revenue / term</th>
                  <th className="text-left px-3 py-2 font-medium">Term ends</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const exp = s.term_ends_at ? new Date(s.term_ends_at) : null;
                  const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400_000) : null;
                  const expColor = daysLeft === null ? "text-muted-foreground"
                    : daysLeft < 0 ? "text-destructive"
                    : daysLeft < 14 ? "text-warning" : "text-foreground";
                  const rev = revFor(s);
                  return (
                    <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-5 py-3"><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.slug}</div></td>
                      <td className="px-3 py-3 text-foreground">{labelFor(s.plan)}</td>
                      <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.student_count ?? 0}{rev.extraStudents > 0 && <div className="text-[11px] text-muted-foreground">+{rev.extraStudents} over cap</div>}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <div className="font-medium">{formatNaira(rev.termKobo)}</div>
                        {rev.addonsKobo > 0 && <div className="text-[11px] text-muted-foreground">incl. {formatNaira(rev.addonsKobo)} add-ons</div>}
                      </td>
                      <td className={`px-3 py-3 ${expColor}`}>
                        {exp ? (
                          <>
                            {exp.toLocaleDateString()}
                            <div className="text-[11px]">
                              {daysLeft === null ? "" : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </div>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Manage</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        )}
      </Section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage subscription</DialogTitle>
            <DialogDescription>{editing?.name} — billed in NGN</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Plan</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pricing.map(p => (
                    <SelectItem key={p.plan} value={p.plan}>
                      {p.label} — {p.term_price_kobo > 0 ? `${formatNaira(p.term_price_kobo)}/term` : "Free"}
                      {p.included_students > 0 && p.extra_student_kobo > 0 ? ` · ${p.included_students} students, +${formatNaira(p.extra_student_kobo)}/student` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Billing cycle</Label>
                <Select value={newCycle} onValueChange={setNewCycle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="termly">Termly (×3 / year)</SelectItem>
                    <SelectItem value="annual">Annual prepay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Term ends</Label>
                <Input type="date" value={newTermEnds} onChange={e => setNewTermEnds(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Included students (override)</Label>
                <Input type="number" min={0} value={newIncluded} onChange={e => setNewIncluded(e.target.value)} placeholder="Use tier default" />
              </div>
              <div>
                <Label className="text-xs">Extra student price (₦)</Label>
                <Input type="number" min={0} step="0.01" value={newExtraNaira} onChange={e => setNewExtraNaira(e.target.value)} placeholder="Use tier default" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Plan expires</Label>
              <Input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for no expiry (enterprise/manual contracts).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={savePlan} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}