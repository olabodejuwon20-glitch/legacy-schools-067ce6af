import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, StatusBadge, Skel, EmptyState, MetricCard } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Receipt, Plus, Check, Ban, RotateCcw, Download, Printer, Search, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { fmtNgn, superAction } from "@/lib/super";

type Sub = { id: string; school_id: string; plan: string; status: string; monthly_amount_cents: number; current_period_end: string | null; school_name?: string };
type Inv = {
  id: string;
  school_id: string;
  amount_kobo: number | null;
  amount_cents: number;
  currency: string;
  status: string;
  kind?: string | null;
  plan?: string | null;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  paid_method?: string | null;
  line_items?: Array<{ label?: string; amount_kobo?: number }>;
  school_name?: string;
};

const invAmountKobo = (i: Inv) => Number(i.amount_kobo ?? i.amount_cents ?? 0);

export default function SuperBilling() {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [invs, setInvs] = useState<Inv[] | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string; plan: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [receiptInv, setReceiptInv] = useState<Inv | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    school_id: "",
    amount_ngn: "150000",
    kind: "subscription",
    plan: "standard",
    due_at: "",
    description: "Term platform subscription",
  });

  async function load() {
    setSubs(null); setInvs(null);
    const [{ data: s }, { data: i }, { data: sc }] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("issued_at", { ascending: false }).limit(300),
      supabase.from("schools").select("id,name,plan").is("deleted_at", null).order("name"),
    ]);
    const map = new Map((sc ?? []).map((x: { id: string; name: string; plan: string }) => [x.id, x.name]));
    setSchools((sc as { id: string; name: string; plan: string }[]) ?? []);
    setSubs((s ?? []).map((x: Sub) => ({ ...x, school_name: map.get(x.school_id) ?? "—" })));
    setInvs((i ?? []).map((x: Inv) => ({ ...x, school_name: map.get(x.school_id) ?? "—" })));
  }
  useEffect(() => { void load(); }, []);

  const kpis = useMemo(() => {
    const list = invs ?? [];
    const paidKobo = list.filter(i => i.status === "paid").reduce((s, i) => s + invAmountKobo(i), 0);
    const openKobo = list.filter(i => i.status === "open").reduce((s, i) => s + invAmountKobo(i), 0);
    const overdueCount = list.filter(i => i.status === "open" && i.due_at && new Date(i.due_at).getTime() < Date.now()).length;
    return { paidKobo, openKobo, overdueCount, totalCount: list.length };
  }, [invs]);

  const filteredInvs = useMemo(() => {
    if (!invs) return [];
    const needle = q.trim().toLowerCase();
    return invs.filter(i => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (needle && !(i.school_name ?? "").toLowerCase().includes(needle) && !(i.kind ?? "").toLowerCase().includes(needle) && !(i.plan ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [invs, statusFilter, q]);

  async function createInvoice() {
    const kobo = Math.round(parseFloat(form.amount_ngn || "0") * 100);
    if (!form.school_id || !kobo || kobo <= 0) {
      toast.error("Select a school and enter a positive NGN amount");
      return;
    }
    setBusy(true);
    try {
      await superAction("create_platform_invoice", {
        school_id: form.school_id,
        amount_kobo: kobo,
        kind: form.kind,
        plan: form.plan || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        line_items: form.description.trim() ? [{ label: form.description.trim(), amount_kobo: kobo }] : [],
      });
      toast.success("NGN Invoice issued");
      setOpen(false);
      void load();
    } catch {
      /* superAction toasts */
    } finally {
      setBusy(false);
    }
  }

  async function setInvoiceStatus(inv: Inv, status: string, paid_method?: string) {
    try {
      await superAction("update_invoice_status", { invoice_id: inv.id, status, paid_method });
      toast.success(`Invoice marked ${status}`);
      void load();
    } catch {
      /* superAction toasts */
    }
  }

  function exportCsv() {
    const list = filteredInvs;
    const header = ["id", "school", "kind", "plan", "amount_ngn", "currency", "status", "issued_at", "due_at", "paid_at", "paid_method"];
    const lines = list.map(i => [
      i.id,
      i.school_name ?? i.school_id,
      i.kind ?? "subscription",
      i.plan ?? "",
      (invAmountKobo(i) / 100).toFixed(2),
      "NGN",
      i.status,
      i.issued_at,
      i.due_at ?? "",
      i.paid_at ?? "",
      i.paid_method ?? "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `platform-invoices-ngn-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Invoices & Billing (NGN)"
        description="All platform billing is denominated in Nigerian Naira (₦), stored in kobo across both amount_kobo and amount_cents."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filteredInvs.length}>
              <Download className="size-3.5 mr-1.5" />Export CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="size-3.5 mr-1.5" />Issue NGN Invoice</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Issue Platform Invoice (₦ NGN)</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>School</Label>
                    <Select
                      value={form.school_id}
                      onValueChange={v => {
                        const sc = schools.find(s => s.id === v);
                        setForm({ ...form, school_id: v, plan: sc?.plan || form.plan });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose school…" /></SelectTrigger>
                      <SelectContent>
                        {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.plan})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Kind</Label>
                      <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="subscription">Term Subscription</SelectItem>
                          <SelectItem value="module">Module Add-on</SelectItem>
                          <SelectItem value="overage">Student Overage</SelectItem>
                          <SelectItem value="onboarding">Onboarding / Setup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plan Tier</Label>
                      <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Amount (₦ Naira)</Label>
                      <Input type="number" min={0} step="500" value={form.amount_ngn} onChange={e => setForm({ ...form, amount_ngn: e.target.value })} />
                    </div>
                    <div>
                      <Label>Due Date (optional)</Label>
                      <Input type="date" value={form.due_at} onChange={e => setForm({ ...form, due_at: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Line Item Description</Label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. 2025/2026 Term 2 Standard Subscription" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={createInvoice} disabled={busy}>Issue Invoice</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Collected (Paid)" value={invs ? fmtNgn(kpis.paidKobo) : "—"} icon={<CheckCircle2 className="size-4 text-success" />} />
        <MetricCard label="Open Receivables" value={invs ? fmtNgn(kpis.openKobo) : "—"} icon={<Wallet className="size-4 text-warning" />} />
        <MetricCard label="Overdue Invoices" value={invs ? kpis.overdueCount : "—"} icon={<AlertCircle className="size-4 text-destructive" />} />
        <MetricCard label="Total Invoices" value={invs ? kpis.totalCount : "—"} icon={<Receipt className="size-4" />} />
      </div>

      <Section
        title={`Invoices (${filteredInvs.length})`}
        description="Every platform invoice issued to schools. Mark as paid, void, refund, or print an official receipt."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-56">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search school or kind…" className="pl-8 h-8 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="void">Void</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {invs === null ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-10" />)}</div>
        ) : filteredInvs.length === 0 ? (
          <EmptyState icon={<Receipt className="size-5 text-muted-foreground" />} title="No matching invoices" description="Issue a new NGN invoice or adjust your filters." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">School</th>
                  <th className="text-left px-3 py-2 font-medium">Type / Plan</th>
                  <th className="text-left px-3 py-2 font-medium">Amount (₦)</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Issued</th>
                  <th className="text-left px-3 py-2 font-medium">Due / Paid</th>
                  <th className="text-right px-5 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvs.map(i => {
                  const overdue = i.status === "open" && i.due_at && new Date(i.due_at).getTime() < Date.now();
                  return (
                    <tr key={i.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-5 py-2.5 font-medium">{i.school_name}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">
                        {i.kind ?? "subscription"}{i.plan ? ` · ${i.plan}` : ""}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold tabular-nums">{fmtNgn(invAmountKobo(i))}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={i.status} />
                          {overdue && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Overdue</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(i.issued_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {i.paid_at
                          ? `Paid ${new Date(i.paid_at).toLocaleDateString()}`
                          : i.due_at
                            ? `Due ${new Date(i.due_at).toLocaleDateString()}`
                            : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {i.status === "open" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setInvoiceStatus(i, "paid", "bank_transfer")}>
                                <Check className="size-3 mr-1" />Mark paid
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setInvoiceStatus(i, "void")}>
                                <Ban className="size-3 mr-1" />Void
                              </Button>
                            </>
                          )}
                          {i.status === "paid" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setInvoiceStatus(i, "refunded")}>
                              <RotateCcw className="size-3 mr-1" />Refund
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="size-7" title="View / Print Receipt" onClick={() => setReceiptInv(i)}>
                            <Printer className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Active Subscription Records" description="Underlying subscription ledger rows linked to schools.">
        {subs === null ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-10" />)}</div>
        ) : subs.length === 0 ? (
          <EmptyState icon={<Receipt className="size-5 text-muted-foreground" />} title="No subscription rows yet" />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">School</th>
                  <th className="text-left px-3 py-2 font-medium">Plan</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Term Value</th>
                  <th className="text-right px-5 py-2 font-medium">Period End</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="px-5 py-2.5 font-medium">{s.school_name}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.plan} /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{fmtNgn(s.monthly_amount_cents)}</td>
                    <td className="px-5 py-2.5 text-right text-xs text-muted-foreground">
                      {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Dialog open={!!receiptInv} onOpenChange={o => !o && setReceiptInv(null)}>
        <DialogContent className="sm:max-w-lg">
          {receiptInv && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Invoice #{receiptInv.id.slice(0, 8).toUpperCase()}</span>
                  <StatusBadge status={receiptInv.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 text-sm border-y border-border">
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Billed To</div>
                    <div className="font-semibold text-foreground">{receiptInv.school_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Issued</div>
                    <div>{new Date(receiptInv.issued_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground border-b border-border pb-1">
                    <span>Description</span>
                    <span>Amount (NGN)</span>
                  </div>
                  {(receiptInv.line_items && receiptInv.line_items.length > 0) ? (
                    receiptInv.line_items.map((li, idx) => (
                      <div key={idx} className="flex justify-between font-medium">
                        <span>{li.label || `${receiptInv.kind ?? "Subscription"} (${receiptInv.plan ?? "tier"})`}</span>
                        <span className="font-mono">{fmtNgn(li.amount_kobo ?? invAmountKobo(receiptInv))}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between font-medium">
                      <span className="capitalize">{receiptInv.kind ?? "Subscription"}{receiptInv.plan ? ` — ${receiptInv.plan} plan` : ""}</span>
                      <span className="font-mono">{fmtNgn(invAmountKobo(receiptInv))}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border text-base font-bold">
                    <span>Total (NGN)</span>
                    <span className="font-mono">{fmtNgn(invAmountKobo(receiptInv))}</span>
                  </div>
                </div>
                {receiptInv.paid_at && (
                  <div className="text-xs text-success font-medium">
                    Paid on {new Date(receiptInv.paid_at).toLocaleString()} ({receiptInv.paid_method ?? "bank_transfer"})
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReceiptInv(null)}>Close</Button>
                <Button onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print Receipt</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}