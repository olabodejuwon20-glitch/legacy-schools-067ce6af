import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, CheckCircle2, Clock, AlertCircle, Receipt, ArrowUpRight, CreditCard, CalendarClock, XCircle, RefreshCw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  formatNaira, daysUntil, planStatusTone,
  startSubscriptionCheckout, payInvoice,
  type PlanTier, type SubInvoice,
} from "@/lib/subscription";
import { PilotWidget } from "@/components/pilot/PilotWidget";

type SchoolRow = {
  id: string; name: string; plan: string; status: string;
  plan_started_at: string; plan_expires_at: string | null; term_ends_at: string | null;
  student_count: number; included_students: number | null; extra_student_kobo: number | null;
  billing_cycle: string; currency: string;
};

type SubRow = {
  id: string; plan: string; status: string;
  started_at: string; period_start: string | null; current_period_end: string | null;
  monthly_amount_cents: number;
};

export default function AdminSubscription() {
  const { school } = useSchool();
  const [row, setRow] = useState<SchoolRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [invoices, setInvoices] = useState<SubInvoice[]>([]);
  const [cycle, setCycle] = useState<"termly" | "annual">("termly");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!school) return;
    const [s, p, i, sb] = await Promise.all([
      supabase.from("schools").select("id,name,plan,status,plan_started_at,plan_expires_at,term_ends_at,student_count,included_students,extra_student_kobo,billing_cycle,currency").eq("id", school.id).maybeSingle(),
      supabase.from("plan_pricing").select("*").order("sort_order"),
      supabase.from("invoices").select("id,school_id,number,amount_kobo,amount_cents,currency,status,kind,plan,period_start,period_end,issued_at,paid_at,paystack_reference,paystack_authorization_url").eq("school_id", school.id).eq("kind", "subscription").order("issued_at", { ascending: false }),
      supabase.from("subscriptions").select("id,plan,status,started_at,period_start,current_period_end,monthly_amount_cents").eq("school_id", school.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setRow((s.data as SchoolRow) ?? null);
    setPlans((p.data as PlanTier[]) ?? []);
    setInvoices((i.data as SubInvoice[]) ?? []);
    setSub((sb.data as SubRow) ?? null);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const currentTier = useMemo(() => plans.find(p => p.plan === row?.plan), [plans, row]);
  const daysLeft = daysUntil(row?.plan_expires_at ?? row?.term_ends_at ?? null);
  const tone = planStatusTone(row?.status ?? "active", daysLeft);

  function priceFor(p: PlanTier): number {
    const students = row?.student_count ?? 0;
    const included = row?.included_students ?? p.included_students;
    const extra = Math.max(0, students - included);
    const extraKobo = (row?.extra_student_kobo ?? p.extra_student_kobo) * extra;
    const base = p.term_price_kobo + extraKobo;
    return cycle === "annual" ? base * 3 : base;
  }

  async function choose(plan: string) {
    if (!school) return;
    setBusy(plan);
    try {
      const res = await startSubscriptionCheckout({ school_id: school.id, plan, cycle });
      if (res.mode === "test") toast.info("Test mode — using Paystack test key");
      window.location.href = res.authorization_url;
    } catch (e: any) {
      toast.error(e.message ?? "Could not start checkout");
    } finally { setBusy(null); }
  }

  async function reopen(inv: SubInvoice) {
    setBusy(inv.id);
    try {
      const res = await payInvoice(inv.id);
      window.location.href = res.authorization_url;
    } catch (e: any) {
      toast.error(e.message ?? "Could not reopen checkout");
    } finally { setBusy(null); }
  }

  async function changeStatus(action: "cancel" | "resume") {
    if (!school) return;
    setBusy(action);
    try {
      const { error } = await supabase.rpc("set_subscription_status" as any, { _school_id: school.id, _action: action });
      if (error) throw error;
      toast.success(action === "cancel" ? "Subscription cancelled" : "Subscription resumed");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally { setBusy(null); }
  }

  if (!row) return <div className="p-6"><div className="h-32 rounded-xl bg-muted animate-pulse" /></div>;

  const toneClasses = tone === "bad"
    ? "border-destructive/40 bg-destructive/5"
    : tone === "warn" ? "border-warning/40 bg-warning/5"
    : "border-success/30 bg-success/5";
  const StatusIcon = tone === "bad" ? AlertCircle : tone === "warn" ? Clock : CheckCircle2;
  const nextBillingISO = sub?.current_period_end ?? row.plan_expires_at ?? row.term_ends_at ?? null;
  const nextBilling = nextBillingISO ? new Date(nextBillingISO) : null;
  const isCancelled = (sub?.status ?? row.status) === "cancelled";

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader title="Subscription & Billing" description="Manage your school's plan, students-on-roll pricing and pay invoices online." />

      <PilotWidget />

      <Card className={`p-5 border ${toneClasses}`}>
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusIcon className="size-5" />
              <h2 className="text-lg font-semibold">{currentTier?.label ?? row.plan} plan</h2>
              <Badge variant={tone === "bad" ? "destructive" : "secondary"} className="capitalize">{sub?.status ?? row.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {row.student_count} students on roll · billed {row.billing_cycle ?? "termly"} in {row.currency || "NGN"}
            </p>
            <p className="text-sm">
              {daysLeft == null ? "No expiry set" : daysLeft < 0 ? <span className="text-destructive font-medium">{Math.abs(daysLeft)} day(s) overdue</span> : <span>{daysLeft} day(s) until renewal</span>}
              {row.plan_expires_at && <span className="text-muted-foreground"> · expires {new Date(row.plan_expires_at).toLocaleDateString()}</span>}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{currentTier ? formatNaira(priceFor(currentTier)) : "—"}</div>
            <div className="text-xs text-muted-foreground">{cycle === "annual" ? "per year" : "per term"}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="size-4" /> Manage subscription</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Current cycle</div>
                <div className="font-medium capitalize">{row.billing_cycle ?? "termly"}</div>
                {sub?.period_start && (
                  <div className="text-xs text-muted-foreground">since {new Date(sub.period_start).toLocaleDateString()}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3" /> Next billing date</div>
                <div className="font-medium">{nextBilling ? nextBilling.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</div>
                {daysLeft != null && <div className="text-xs text-muted-foreground">{daysLeft < 0 ? `${Math.abs(daysLeft)} day(s) overdue` : `in ${daysLeft} day(s)`}</div>}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant={isCancelled ? "destructive" : "secondary"} className="capitalize">{sub?.status ?? row.status}</Badge>
                {isCancelled && nextBilling && <div className="text-xs text-muted-foreground mt-1">Access continues until {nextBilling.toLocaleDateString()}</div>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-start">
            {isCancelled ? (
              <Button onClick={() => changeStatus("resume")} disabled={busy === "resume"}>
                <RefreshCw className="size-4 mr-1" /> {busy === "resume" ? "Resuming…" : "Resume subscription"}
              </Button>
            ) : (
              <>
                <Button variant="default" onClick={() => currentTier && choose(currentTier.plan)} disabled={!currentTier || busy === currentTier?.plan}>
                  <RefreshCw className="size-4 mr-1" /> Renew now
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={busy === "cancel"}><XCircle className="size-4 mr-1" /> Cancel</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your access will remain active until {nextBilling ? nextBilling.toLocaleDateString() : "the end of the current period"}.
                        No further invoices will be issued. You can resume any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                      <AlertDialogAction onClick={() => changeStatus("cancel")}>Confirm cancel</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">Pricing scales with your student roll. Choose a billing cycle and a plan to start checkout.</p>
            <Select value={cycle} onValueChange={v => setCycle(v as any)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="termly">Termly (per term)</SelectItem>
                <SelectItem value="annual">Annual (×3 prepay)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.filter(p => p.plan !== "trial").map(p => {
              const isCurrent = p.plan === row.plan;
              const price = priceFor(p);
              return (
                <Card key={p.plan} className={`p-5 flex flex-col gap-3 ${isCurrent ? "border-primary ring-2 ring-primary/20" : ""}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">{p.label} {isCurrent && <Badge variant="default" className="text-[10px]">Current</Badge>}</h3>
                    {p.plan === "premium" && <Sparkles className="size-4 text-primary" />}
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatNaira(price)}</div>
                    <div className="text-xs text-muted-foreground">{cycle === "annual" ? "per year" : "per term"}</div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 flex-1">
                    <li>• Up to {p.included_students.toLocaleString()} students included</li>
                    {p.extra_student_kobo > 0 && <li>• +{formatNaira(p.extra_student_kobo)} per extra student</li>}
                    <li>• All core LMS features</li>
                    {p.plan === "standard" && <li>• AI tutor, parent digest, NECO mock</li>}
                    {p.plan === "premium" && <li>• Priority support + advanced AI</li>}
                    {p.plan === "enterprise" && <li>• Custom integrations</li>}
                  </ul>
                  <Button
                    disabled={busy === p.plan || (isCurrent && row.status === "active" && (daysLeft ?? 0) > 14)}
                    onClick={() => choose(p.plan)}
                    variant={isCurrent ? "outline" : "default"}
                  >
                    {busy === p.plan ? "Starting…" : isCurrent ? "Renew now" : "Choose plan"}
                    <ArrowUpRight className="size-4 ml-1" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Receipt className="size-8 mx-auto mb-2 opacity-50" />
                No subscription invoices yet. Pick a plan to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Invoice</th>
                    <th className="text-left px-3 py-2">Plan</th>
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const amt = inv.amount_kobo ?? inv.amount_cents;
                    return (
                      <tr key={inv.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                        <td className="px-3 py-3 capitalize">{inv.plan ?? "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">
                          {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : "—"} → {inv.period_end ? new Date(inv.period_end).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatNaira(amt)}</td>
                        <td className="px-3 py-3"><Badge variant={inv.status === "paid" ? "default" : "secondary"} className="capitalize">{inv.status}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          {inv.status === "open" && (
                            <Button size="sm" disabled={busy === inv.id} onClick={() => reopen(inv)}>
                              {busy === inv.id ? "…" : "Pay now"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}