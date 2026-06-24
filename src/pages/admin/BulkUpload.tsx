import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, friendlyInvokeError } from "@/lib/errors";
import { useSchool, Role } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Row = { full_name: string; phone: string };
const ALLOWED: Role[] = ["student", "teacher", "parent"];

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const ni = header.findIndex(h => /(full[_ ]?name|^name$)/.test(h));
  const pi = header.findIndex(h => /phone/.test(h));
  const start = ni >= 0 || pi >= 0 ? 1 : 0;
  const nIdx = ni >= 0 ? ni : 0;
  const pIdx = pi >= 0 ? pi : 1;
  return lines.slice(start).map(l => {
    const cells = l.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    return { full_name: cells[nIdx] || "", phone: cells[pIdx] || "" };
  }).filter(r => r.full_name && r.phone);
}

export default function BulkUpload() {
  const { school } = useSchool();
  const [role, setRole] = useState<Role>("student");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ phone: string; ok: boolean; pin?: string; error?: string }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setRows(parseCsv(String(reader.result || ""))); setResults(null); };
    reader.readAsText(f);
  }

  async function commit() {
    if (!school || !rows.length) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-onboard", {
        body: { schoolId: school.id, role, rows },
      });
      if (error) throw new Error(await friendlyInvokeError(error, "Bulk onboarding failed. Please try again."));
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = (data as any).results as any[];
      setResults(r);
      const ok = r.filter(x => x.ok).length;
      toast.success(`Onboarded ${ok}/${r.length}. Per-user PINs shown in the table — distribute securely.`);
    } catch (err) {
      toast.error(friendlyError(err, "Bulk onboarding failed. Please try again."));
    } finally { setBusy(false); }
  }

  return (
    <SectionCard title="Bulk onboard from CSV" description="Upload a CSV with columns: full_name, phone. Each user gets a unique random PIN and must change it on first sign in.">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ALLOWED.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>CSV file</Label>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4 mr-2"/>Choose file</Button>
              {rows.length > 0 && <Badge variant="outline">{rows.length} rows</Badge>}
            </div></div>
        </div>
        {rows.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
            <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-muted/60"><tr><th className="text-left p-2">Name{"\u00a0 \u00a0\u00a0"}</th><th className="text-left p-2">Phone</th><th className="text-left p-2">PIN</th><th className="text-left p-2">Status</th></tr></thead>
              <tbody>{rows.map((r,i)=>{
                const res = results?.find(x => x.phone === r.phone.replace(/[^\d+]/g,""));
                return <tr key={i} className="border-t border-border"><td className="p-2">{r.full_name}</td><td className="p-2 font-mono text-xs">{r.phone}</td>
                  <td className="p-2 font-mono text-xs">{res?.pin ?? "—"}</td>
                  <td className="p-2">{res ? (res.ok ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="size-3.5"/>added</span> : <span className="inline-flex items-center gap-1 text-destructive"><X className="size-3.5"/>{res.error}</span>) : <span className="text-muted-foreground">pending</span>}</td></tr>;
              })}</tbody>
            </table></div>
          </div>
        )}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground"><FileSpreadsheet className="size-8 mx-auto mb-2 opacity-60"/>Pick a CSV with <code>full_name,phone</code> headers.</div>}
        <Button disabled={busy || !rows.length} onClick={commit}>{busy && <Loader2 className="size-4 animate-spin mr-2"/>}Onboard {rows.length || ""} users</Button>
      </div>
    </SectionCard>
  );
}