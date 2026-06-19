import { useEffect, useState } from "react";
import { Plus, Download, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Batch = { id: string; name: string; quantity: number; price_kobo: number; max_uses: number; status: string; created_at: string };

export default function TradScratchCards() {
  const { school } = useSchool();
  const [rows, setRows] = useState<Batch[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", quantity: 50, price_naira: 500, max_uses: 5 });

  async function load() {
    if (!school) return;
    const { data } = await supabase.from("trad_scratch_batches")
      .select("*").eq("school_id", school.id).order("created_at", { ascending: false });
    setRows((data ?? []) as Batch[]);
  }
  useEffect(() => { load(); }, [school?.id]);

  async function generate() {
    if (!school) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("trad-card-generate", {
        body: {
          school_id: school.id,
          name: form.name || `Batch ${new Date().toLocaleDateString()}`,
          quantity: Number(form.quantity),
          price_kobo: Math.round(Number(form.price_naira) * 100),
          max_uses: Number(form.max_uses),
        },
      });
      if (error) throw error;
      const csv = (data as any)?.csv as string | undefined;
      if (csv) {
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `scratch-cards-${Date.now()}.csv`;
        a.click();
      }
      toast.success(`Generated ${form.quantity} cards. CSV downloaded — store it safely; PINs are not recoverable.`);
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate cards");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Scratch Cards" description="Generate result-unlock cards for parents and students." />
      <SectionCard
        title="Card Batches"
        description={`${rows.length} batch${rows.length === 1 ? "" : "es"}`}
        action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> New batch</Button>}
      >
        {rows.length === 0 ? (
          <EmptyState icon={Ticket} title="No batches yet" desc="Generate your first batch of result-unlock cards." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map(b => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{b.name}</div>
                  <Badge variant="secondary">{b.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {b.quantity} cards · ₦{(b.price_kobo / 100).toLocaleString()} each · {b.max_uses} uses
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate scratch-card batch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Batch name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Term 1 result cards" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Quantity</Label><Input type="number" min={1} max={5000} value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} /></div>
              <div><Label>Price (₦)</Label><Input type="number" min={1} value={form.price_naira} onChange={e => setForm({ ...form, price_naira: +e.target.value })} /></div>
              <div><Label>Max uses</Label><Input type="number" min={1} max={50} value={form.max_uses} onChange={e => setForm({ ...form, max_uses: +e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              PINs are shown only once via CSV download. Keep the file safe — Legacyskool does not store recoverable copies.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={generate} disabled={busy}>
                {busy ? "Generating…" : (<><Download className="size-4" /> Generate & Download</>)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}