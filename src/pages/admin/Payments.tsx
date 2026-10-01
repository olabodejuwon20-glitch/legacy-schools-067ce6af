import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { AUDIENCES, PAYMENT_CATEGORIES, RECURRENCES, issueInvoices, invoiceStatusColor, naira, recordOfflinePayment, toKobo } from "@/lib/payments";
import { verifyPaymentProof } from "@/lib/payments";
import { ReceiptLink } from "@/components/payments/ReceiptLink";
import { Plus, Wallet, Send, Banknote, Settings as SettingsIcon, ListChecks, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function AdminPayments() {
  const { school } = useSchool();
  const [tab, setTab] = useState("overview");
  const [types, setTypes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const refresh = async () => {
    if (!school) return;
    const [t, i, p, c, s] = await Promise.all([
      supabase.from("payment_types").select("*").eq("school_id", school.id).order("created_at", { ascending: false }),
      supabase.from("school_invoices").select("*").eq("school_id", school.id).order("issued_at", { ascending: false }).limit(500),
      supabase.from("school_payments").select("*").eq("school_id", school.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("classes").select("id,name,grade_level").eq("school_id", school.id).order("name"),
      supabase.from("school_payment_settings").select("*").eq("school_id", school.id).maybeSingle(),
    ]);
    setTypes(t.data ?? []);
    setInvoices(i.data ?? []);
    setPayments(p.data ?? []);
    setClasses(c.data ?? []);
    setSettings(s.data ?? { school_id: school.id });
    const ids = Array.from(new Set([...(i.data ?? []).map(r => r.student_id), ...(p.data ?? []).map(r => r.student_id)]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      setProfiles(Object.fromEntries((profs ?? []).map(p => [p.id, p.full_name || p.email || "—"])));
    }
  };

  useEffect(() => { refresh(); }, [school?.id]);

  const totals = useMemo(() => {
    const billed = invoices.reduce((s, r) => s + Number(r.amount_due_kobo), 0);
    const collected = invoices.reduce((s, r) => s + Number(r.amount_paid_kobo), 0);
    return { billed, collected, outstanding: billed - collected, count: invoices.length };
  }, [invoices]);

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="types">Payment Types</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard label="Invoices" value={String(totals.count)} icon={ListChecks} />
            <StatCard label="Billed" value={naira(totals.billed)} icon={Wallet} />
            <StatCard label="Collected" value={naira(totals.collected)} icon={Banknote} tone="success" />
            <StatCard label="Outstanding" value={naira(totals.outstanding)} icon={Wallet} tone="warning" />
          </div>
          <SectionCard title="Recent payments">
            {payments.length === 0 ? <EmptyState icon={Banknote} title="No payments recorded yet" desc="School fee payments, online transactions, and manual receipts will appear here." /> : (
              <PaymentsTable rows={payments.slice(0, 10)} profiles={profiles} onChanged={refresh} />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="types" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <PaymentTypeDialog schoolId={school?.id} classes={classes} onSaved={refresh} />
          </div>
          {types.length === 0 ? <EmptyState icon={Wallet} title="No fee categories yet" desc="Create your school fee categories — tuition, development levy, uniforms, bus fares, etc." /> : (
            <div className="grid gap-3">
              {types.map(t => (
                <div key={t.id} className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{t.name}</div>
                      <Badge variant="outline" className="capitalize">{t.category}</Badge>
                      <Badge variant="outline" className="capitalize">{t.recurrence.replace("_", " ")}</Badge>
                      {!t.active && <Badge variant="outline" className="bg-muted">Inactive</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{naira(t.default_amount_kobo)} • Audience: {t.audience}{t.term ? ` • ${t.term}` : ""}{t.session ? ` • ${t.session}` : ""}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <IssueDialog type={t} onIssued={refresh} />
                    <PaymentTypeDialog schoolId={school?.id} classes={classes} existing={t} onSaved={refresh} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4 mt-6">
          <SectionCard title={`All invoices (${invoices.length})`}>
            {invoices.length === 0 ? <EmptyState icon={ListChecks} title="No invoices issued yet" /> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border"><tr>
                  <th className="text-left py-2">Student</th><th className="text-left">Type</th>
                  <th className="text-right">Due</th><th className="text-right">Paid</th>
                  <th className="text-left">Status</th><th></th>
                </tr></thead>
                <tbody>{invoices.map(inv => {
                  const type = types.find(t => t.id === inv.payment_type_id);
                  return (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="py-3">{profiles[inv.student_id] || "—"}</td>
                      <td>{type?.name || inv.notes || "—"}</td>
                      <td className="text-right tabular-nums">{naira(inv.amount_due_kobo)}</td>
                      <td className="text-right tabular-nums">{naira(inv.amount_paid_kobo)}</td>
                      <td><Badge variant="outline" className={invoiceStatusColor(inv.status)}>{inv.status}</Badge></td>
                      <td className="text-right">
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <RecordOfflineDialog invoice={inv} onRecorded={refresh} />
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-6">
          <SectionCard title={`All payments (${payments.length})`}>
            {payments.length === 0 ? <EmptyState icon={Banknote} title="No payments yet" /> : <PaymentsTable rows={payments} profiles={profiles} onChanged={refresh} />}
          </SectionCard>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-6">
          <SettingsForm settings={settings} schoolId={school?.id} onSaved={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentsTable({ rows, profiles, onChanged }: { rows: any[]; profiles: Record<string, string>; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await verifyPaymentProof(id, approve);
      toast.success(approve ? "Payment verified" : "Proof rejected");
      onChanged?.();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(null); }
  };
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground border-b border-border"><tr>
        <th className="text-left py-2">Date</th><th className="text-left">Student</th>
        <th className="text-left">Method</th><th className="text-right">Amount</th>
        <th className="text-left">Status</th><th className="text-left">Receipt</th><th className="text-left">Reference</th><th></th>
      </tr></thead>
      <tbody>{rows.map(p => (
        <tr key={p.id} className="border-b border-border last:border-0">
          <td className="py-3 text-muted-foreground">{new Date(p.paid_at || p.created_at).toLocaleDateString()}</td>
          <td>{profiles[p.student_id] || "—"}</td>
          <td className="capitalize">{p.method.replace("_", " ")}</td>
          <td className="text-right tabular-nums">{naira(p.amount_kobo)}</td>
          <td><Badge variant="outline" className={p.status === "successful" ? "bg-success/10 text-success border-success/30" : p.status === "failed" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-warning/10 text-warning border-warning/30"}>{p.status === "initiated" && p.proof_url ? "pending review" : p.status}</Badge></td>
          <td><ReceiptLink path={p.proof_url} /></td>
          <td className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">{p.provider_reference}</td>
          <td className="text-right">
            {p.status === "initiated" && p.proof_url && (
              <div className="flex gap-1 justify-end">
                <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => act(p.id, true)}><CheckCircle2 className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => act(p.id, false)}><XCircle className="w-4 h-4" /></Button>
              </div>
            )}
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

function PaymentTypeDialog({ schoolId, classes, existing, onSaved }: { schoolId?: string; classes: any[]; existing?: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "tuition");
  const [amount, setAmount] = useState(existing ? (existing.default_amount_kobo / 100).toString() : "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [recurrence, setRecurrence] = useState(existing?.recurrence ?? "one_off");
  const [audience, setAudience] = useState(existing?.audience ?? "school");
  const [classId, setClassId] = useState(existing?.class_id ?? "");
  const [level, setLevel] = useState(existing?.level ?? "");
  const [term, setTerm] = useState(existing?.term ?? "");
  const [session, setSession] = useState(existing?.session ?? "");
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [mandatory, setMandatory] = useState(existing?.mandatory ?? true);
  const [allowPartial, setAllowPartial] = useState(existing?.allow_partial ?? true);
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!schoolId || !name) return;
    setSaving(true);
    const payload: any = {
      school_id: schoolId, name, category, description: description || null,
      default_amount_kobo: toKobo(amount || 0), recurrence, audience,
      class_id: audience === "class" ? (classId || null) : null,
      level: audience === "level" ? (level || null) : null,
      term: term || null, session: session || null,
      due_date: dueDate || null, mandatory, allow_partial: allowPartial, active,
    };
    const op = existing
      ? supabase.from("payment_types").update(payload).eq("id", existing.id)
      : supabase.from("payment_types").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Updated" : "Created");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={existing ? "outline" : "default"} size={existing ? "sm" : "default"}>
          {existing ? "Edit" : <><Plus className="w-4 h-4 mr-1" />New payment type</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Edit payment type" : "New payment type"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tuition Term 1" /></div>
          <div><Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Default amount (₦)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50000" /></div>
          <div><Label>Recurrence</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RECURRENCES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AUDIENCES.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {audience === "class" && (
            <div className="col-span-2"><Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Pick a class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {audience === "level" && (
            <div className="col-span-2"><Label>Grade level</Label><Input value={level} onChange={e => setLevel(e.target.value)} placeholder="e.g. SS1" /></div>
          )}
          <div><Label>Term</Label><Input value={term} onChange={e => setTerm(e.target.value)} placeholder="Term 1" /></div>
          <div><Label>Session</Label><Input value={session} onChange={e => setSession(e.target.value)} placeholder="2025/2026" /></div>
          <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <div className="col-span-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={mandatory} onCheckedChange={setMandatory} /> Mandatory</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={allowPartial} onCheckedChange={setAllowPartial} /> Allow partial payment</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} /> Active</label>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving || !name}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ type, onIssued }: { type: any; onIssued: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const issue = async () => {
    setLoading(true);
    try {
      const r = await issueInvoices(type.id);
      toast.success(`Issued ${r.issued} invoice${r.issued === 1 ? "" : "s"}`);
      setOpen(false);
      onIssued();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Send className="w-4 h-4 mr-1" />Issue invoices</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue invoices for "{type.name}"</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will issue a {naira(type.default_amount_kobo)} invoice to the configured audience
          ({type.audience}{type.audience === "class" ? ` — ${type.class_id}` : ""}{type.audience === "level" ? ` — ${type.level}` : ""}).
          Duplicates for the same student + term + session are skipped.
        </p>
        <DialogFooter><Button onClick={issue} disabled={loading}>{loading ? "Issuing…" : "Confirm"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordOfflineDialog({ invoice, onRecorded }: { invoice: any; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const outstanding = invoice.amount_due_kobo - invoice.amount_paid_kobo;
  const [amount, setAmount] = useState((outstanding / 100).toString());
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "pos" | "waiver">("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const kobo = toKobo(amount);
    if (kobo <= 0 || kobo > outstanding) return toast.error("Invalid amount");
    setLoading(true);
    try {
      await recordOfflinePayment({ invoice_id: invoice.id, amount_kobo: kobo, method, notes });
      toast.success("Payment recorded");
      setOpen(false);
      onRecorded();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Record payment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record offline payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Outstanding: <span className="font-semibold text-foreground">{naira(outstanding)}</span></div>
          <div><Label>Amount (₦)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div><Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
                <SelectItem value="waiver">Waiver</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={loading}>{loading ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ settings, schoolId, onSaved }: { settings: any; schoolId?: string; onSaved: () => void }) {
  const [s, setS] = useState<any>(settings ?? {});
  useEffect(() => { setS(settings ?? {}); }, [settings]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!schoolId) return;
    setSaving(true);
    const payload = {
      school_id: schoolId,
      bank_name: s.bank_name || null,
      account_number: s.account_number || null,
      account_name: s.account_name || null,
      receipt_footer: s.receipt_footer || null,
      paystack_subaccount_code: s.paystack_subaccount_code || null,
      auto_late_fee: !!s.auto_late_fee,
      grace_days: Number(s.grace_days) || 0,
    };
    const { error } = await supabase.from("school_payment_settings").upsert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <SectionCard title="Payment settings" description="Bank details, receipts and online payments.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Bank name</Label><Input value={s.bank_name ?? ""} onChange={e => setS({ ...s, bank_name: e.target.value })} /></div>
        <div><Label>Account number</Label><Input value={s.account_number ?? ""} onChange={e => setS({ ...s, account_number: e.target.value })} /></div>
        <div><Label>Account name</Label><Input value={s.account_name ?? ""} onChange={e => setS({ ...s, account_name: e.target.value })} /></div>
        <div><Label>Paystack subaccount code (optional)</Label><Input value={s.paystack_subaccount_code ?? ""} onChange={e => setS({ ...s, paystack_subaccount_code: e.target.value })} placeholder="ACCT_xxx" /></div>
        <div className="md:col-span-2"><Label>Receipt footer</Label><Textarea value={s.receipt_footer ?? ""} onChange={e => setS({ ...s, receipt_footer: e.target.value })} rows={2} /></div>
        <div><Label>Grace days before overdue</Label><Input type="number" value={s.grace_days ?? 0} onChange={e => setS({ ...s, grace_days: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm self-end"><Switch checked={!!s.auto_late_fee} onCheckedChange={(v) => setS({ ...s, auto_late_fee: v })} /> Auto-apply late fee</label>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={save} disabled={saving}><SettingsIcon className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}</Button></div>
    </SectionCard>
  );
}