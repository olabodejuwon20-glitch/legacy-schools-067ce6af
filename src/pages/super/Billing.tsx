import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, MetricCard, Skel, StatusBadge, EmptyState } from "@/components/super/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Receipt, DollarSign, Clock, AlertCircle, Plus, Download, Search } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Invoice = { id: string; school_id: string; number: string; amount_cents: number; status: string; issued_at: string; paid_at: string | null; line_items: any };
type School = { id: string; name: string; slug: string };

export default function SuperBilling() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ school_id: "", number: "", amount: "", lines: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const [i, s] = await Promise.all([
      supabase.from("invoices").select("*").order("issued_at", { ascending: false }).limit(500),
      supabase.from("schools").select("id, name, slug").order("name"),
    ]);
    setInvoices((i.data as Invoice[]) ?? []);
    setSchools((s.data as School[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const schoolName = (id: string) => schools.find(s => s.id === id)?.name ?? "—";

  const totals = useMemo(() => {
    const list = invoices ?? [];
    const paid = list.filter(x => x.status === "paid");
    const open = list.filter(x => x.status === "open");
    const failed = list.filter(x => x.status === "failed");
    const since30 = Date.now() - 30 * 86400_000;
    const rev30 = paid.filter(x => x.paid_at && new Date(x.paid_at).getTime() >= since30).reduce((a, x) => a + x.amount_cents, 0);
    const outstanding = open.reduce((a, x) => a + x.amount_cents, 0);
    const lifetime = paid.reduce((a, x) => a + x.amount_cents, 0);
    return { rev30, outstanding, lifetime, openCount: open.length, failedCount: failed.length };
  }, [invoices]);

  const trend = useMemo(() => {
    const buckets: Record<string, number> = {};
    const days = 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    (invoices ?? []).filter(x => x.status === "paid" && x.paid_at).forEach(x => {
      const k = x.paid_at!.slice(0, 10);
      if (k in buckets) buckets[k] += x.amount_cents / 100;
    });
    return Object.entries(buckets).map(([date, value]) => ({ date: date.slice(5), value: Math.round(value) }));
  }, [invoices]);

  const filtered = useMemo(() => (invoices ?? [])
    .filter(x => statusFilter === "all" || x.status === statusFilter)
    .filter(x => !q.trim() || x.number.toLowerCase().includes(q.toLowerCase()) || schoolName(x.school_id).toLowerCase().includes(q.toLowerCase()))
  , [invoices, statusFilter, q, schools]);

  async function markPaid(inv: Invoice) {
    setBusyId(inv.id);
    try {
      const { error } = await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", inv.id);
      if (error) throw error;
      setInvoices(arr => (arr ?? []).map(x => x.id === inv.id ? { ...x, status: "paid", paid_at: new Date().toISOString() } : x));
      toast.success("Marked as paid");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyId(null); }
  }

  async function createInvoice() {
    if (!form.school_id || !form.number || !form.amount) {
      toast.error("School, number and amount are required"); return;
    }
    setSaving(true);
    try {
      const amount_cents = Math.round(parseFloat(form.amount) * 100);
      const line_items = form.lines.trim()
        ? form.lines.split("\n").filter(Boolean).map(l => { const [d, v] = l.split("|"); return { description: d?.trim() ?? l.trim(), amount_cents: v ? Math.round(parseFloat(v) * 100) : 0 }; })
        : [];
      const { error } = await supabase.from("invoices").insert({
        school_id: form.school_id, number: form.number, amount_cents, status: "open", line_items,
      });
      if (error) throw error;
      toast.success("Invoice created");
      setCreating(false);
      setForm({ school_id: "", number: "", amount: "", lines: "" });
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  function exportCSV() {
    const rows = [["Number", "School", "Amount", "Status", "Issued", "Paid"]].concat(
      (invoices ?? []).map(x => [x.number, schoolName(x.school_id), (x.amount_cents/100).toString(), x.status, x.issued_at, x.paid_at ?? ""])
    );
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const fmt = (cents: number) => `$${(cents/100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Billing & Revenue"
        description="Invoices, payments, and revenue trends across every tenant."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="size-4" /> Export</Button>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> New invoice</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Revenue (30d)" value={invoices ? fmt(totals.rev30) : <Skel className="h-6 w-24" />} icon={<DollarSign className="size-4" />} />
        <MetricCard label="Outstanding" value={invoices ? fmt(totals.outstanding) : <Skel className="h-6 w-24" />} delta={totals.openCount ? { value: `${totals.openCount} open`, positive: false } : undefined} icon={<Clock className="size-4" />} />
        <MetricCard label="Lifetime revenue" value={invoices ? fmt(totals.lifetime) : <Skel className="h-6 w-24" />} icon={<Receipt className="size-4" />} />
        <MetricCard label="Failed payments" value={invoices ? totals.failedCount : <Skel className="h-6 w-12" />} icon={<AlertCircle className="size-4" />} />
      </div>

      <Section title="Revenue · last 30 days">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => `$${v}`} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="h-4" />

      <Section title={`Invoices ${invoices ? `· ${filtered.length}` : ""}`} actions={
        <div className="flex gap-2">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-8 w-[220px]" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }>
        {invoices === null ? (
          <div className="space-y-2"><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-10" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Receipt className="size-5" />} title="No invoices" description="Create one to start tracking billing." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2 font-medium">Number</th>
                  <th className="text-left px-3 py-2 font-medium">School</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Issued</th>
                  <th className="text-left px-3 py-2 font-medium">Paid</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-xs">{inv.number}</td>
                    <td className="px-3 py-3">{schoolName(inv.school_id)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(inv.amount_cents)}</td>
                    <td className="px-3 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-3 py-3 text-muted-foreground">{new Date(inv.issued_at).toLocaleDateString()}</td>
                    <td className="px-3 py-3 text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {inv.status !== "paid" && (
                        <Button size="sm" variant="outline" disabled={busyId === inv.id} onClick={() => markPaid(inv)}>
                          {busyId === inv.id ? "…" : "Mark paid"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </Section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">School</Label>
              <Select value={form.school_id} onValueChange={(v) => setForm(f => ({ ...f, school_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Invoice #</Label>
                <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="INV-001" />
              </div>
              <div>
                <Label className="text-xs">Amount (USD)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="149.00" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Line items (one per line: "description | amount")</Label>
              <Textarea rows={4} value={form.lines} onChange={e => setForm(f => ({ ...f, lines: e.target.value }))} placeholder="Pro plan monthly | 149.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={createInvoice} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}