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
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  daysUntil, planStatusTone,
  payInvoice,
  type PlanTier, type SubInvoice,
} from "@/lib/subscription";
import { formatNaira, snapStudentCountToBracket } from "@/lib/pricing";
import { PilotWidget } from "@/components/pilot/PilotWidget";
import { SubscriptionBuilder } from "@/components/billing/SubscriptionBuilder";

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

export default function AdminSubscription({ initialTab = "plans" }: { initialTab?: "plans" | "invoices" } = {}) {
  const { school } = useSchool();
  const [row, setRow] = useState<SchoolRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [invoices, setInvoices] = useState<SubInvoice[]>([]);
  const [cycle, setCycle] = useState<"termly" | "annual">("termly");
  const [busy, setBusy] = useState<string | null>(null);
  const [invQ, setInvQ] = useState("");
  const [invStatus, setInvStatus] = useState<"all" | "open" | "paid" | "failed" | "void">("all");

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

  const activeBracket = useMemo(() => {
    const count = row?.included_students || row?.student_count || 100;
    return snapStudentCountToBracket(count);
  }, [row]);

  const daysLeft = daysUntil(row?.plan_expires_at ?? row?.term_ends_at ?? null);
  const tone = planStatusTone(row?.status ?? "active", daysLeft);

  const scrollToBuilder = () => {
    const el = document.getElementById("subscription-builder-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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

  const invoiceTotals = (() => {
    const paid = invoices.filter(i => i.status === "paid");
    const open = invoices.filter(i => i.status === "open");
    const sum = (xs: SubInvoice[]) => xs.reduce((a, x) => a + (x.amount_kobo ?? x.amount_cents ?? 0), 0);
    return { paidTotal: sum(paid), outstanding: sum(open), paidCount: paid.length, openCount: open.length };
  })();

  const filteredInvoices = invoices
    .filter(i => invStatus === "all" || i.status === invStatus)
    .filter(i => {
      const q = invQ.trim().toLowerCase();
      if (!q) return true;
      return (i.number ?? "").toLowerCase().includes(q) || (i.plan ?? "").toLowerCase().includes(q);
    });

  function exportInvoicesCSV() {
    const rows = [["Invoice", "Plan", "Period start", "Period end", "Amount (NGN)", "Status", "Issued", "Paid", "Reference"]].concat(
      invoices.map(i => [
        i.number, i.plan ?? "",
        i.period_start ?? "", i.period_end ?? "",
        (((i.amount_kobo ?? i.amount_cents) ?? 0) / 100).toString(),
        i.status, i.issued_at, i.paid_at ?? "", i.paystack_reference ?? "",
      ])
    );
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `billing-history-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader title="Subscription & Billing" description="Manage your school's plan, students-on-roll pricing and pay invoices online." />

      <PilotWidget />

      <Card className={`p-5 border ${toneClasses}`}>
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusIcon className="size-5" />
              <h2 className="text-lg font-semibold">{activeBracket.name}</h2>
              <Badge variant={tone === "bad" ? "destructive" : "secondary"} className="capitalize">{sub?.status ?? row.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Capacity: up to {activeBracket.maxStudents.toLocaleString()} students · {activeBracket.includedStorageGb} GB storage · billed {row.billing_cycle ?? "termly"} in {row.currency || "NGN"}
            </p>
            <p className="text-sm">
              {daysLeft == null ? "No expiry set" : daysLeft < 0 ? <span className="text-destructive font-medium">{Math.abs(daysLeft)} day(s) overdue</span> : <span>{daysLeft} day(s) until renewal</span>}
              {row.plan_expires_at && <span className="text-muted-foreground"> · expires {new Date(row.plan_expires_at).toLocaleDateString()}</span>}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{formatNaira(activeBracket.termPriceKobo)}</div>
            <div className="text-xs text-muted-foreground">{row.billing_cycle === "annual" ? "per year (15% off)" : "per term"}</div>
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
                <Button variant="default" onClick={scrollToBuilder}>
                  <RefreshCw className="size-4 mr-1" /> Customize / Renew Plan
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

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Billing history ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          <div id="subscription-builder-section">
            <SubscriptionBuilder
              schoolId={school?.id}
              initialStudentCount={row.student_count || 100}
            />
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total paid</div>
              <div className="text-xl font-bold tabular-nums">{formatNaira(invoiceTotals.paidTotal)}</div>
              <div className="text-xs text-muted-foreground">{invoiceTotals.paidCount} invoice(s)</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className={`text-xl font-bold tabular-nums ${invoiceTotals.outstanding > 0 ? "text-destructive" : ""}`}>{formatNaira(invoiceTotals.outstanding)}</div>
              <div className="text-xs text-muted-foreground">{invoiceTotals.openCount} open</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Last payment</div>
              <div className="text-sm font-semibold">
                {invoices.find(i => i.paid_at)?.paid_at
                  ? new Date(invoices.find(i => i.paid_at)!.paid_at!).toLocaleDateString()
                  : "—"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Next billing</div>
              <div className="text-sm font-semibold">{nextBilling ? nextBilling.toLocaleDateString() : "—"}</div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 h-9" placeholder="Search invoice or plan…" value={invQ} onChange={e => setInvQ(e.target.value)} />
              </div>
              <Select value={invStatus} onValueChange={v => setInvStatus(v as any)}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportInvoicesCSV} disabled={invoices.length === 0}>
              <Download className="size-4 mr-1" /> Export CSV
            </Button>
          </div>

          <Card className="overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Receipt className="size-8 mx-auto mb-2 opacity-50" />
                No subscription invoices yet. Pick a plan to get started.
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No invoices match your filters.</div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Invoice</th>
                    <th className="text-left px-3 py-2">Plan</th>
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Issued</th>
                    <th className="text-left px-3 py-2">Paid</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(inv => {
                    const amt = inv.amount_kobo ?? inv.amount_cents;
                    return (
                      <tr key={inv.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                        <td className="px-3 py-3 capitalize">{inv.plan ?? "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">
                          {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : "—"} → {inv.period_end ? new Date(inv.period_end).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatNaira(amt)}</td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={inv.status === "paid" ? "default" : inv.status === "failed" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground text-xs">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {inv.status === "open" && (
                              <Button size="sm" disabled={busy === inv.id} onClick={() => reopen(inv)}>
                                <CreditCard className="size-3.5 mr-1" />
                                {busy === inv.id ? "…" : "Pay now"}
                              </Button>
                            )}
                            {inv.status === "failed" && (
                              <Button size="sm" variant="outline" disabled={busy === inv.id} onClick={() => reopen(inv)}>
                                <RefreshCw className="size-3.5 mr-1" />
                                {busy === inv.id ? "…" : "Retry"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}