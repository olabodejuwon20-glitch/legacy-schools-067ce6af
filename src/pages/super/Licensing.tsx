import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, Skel, EmptyState } from "@/components/super/primitives";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, Search, Download } from "lucide-react";

type School = { id: string; name: string; slug: string; plan: string; status: string };
type Module = { id: string; slug: string; name: string; category: string; monthly_price_cents: number; term_price_kobo: number; pricing_model: string };
type SM = { id: string; school_id: string; module_id: string; enabled: boolean; expires_at: string | null; beta: boolean };

export default function SuperLicensing() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [matrix, setMatrix] = useState<SM[]>([]);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, m, sm] = await Promise.all([
        supabase.from("schools").select("id, name, slug, plan, status").order("name"),
        supabase.from("modules").select("id, slug, name, category, monthly_price_cents, term_price_kobo, pricing_model").order("category").order("name"),
        supabase.from("school_modules").select("id, school_id, module_id, enabled, expires_at, beta"),
      ]);
      setSchools((s.data as School[]) ?? []);
      setModules((m.data as Module[]) ?? []);
      setMatrix((sm.data as SM[]) ?? []);
    })();
  }, []);

  const filteredSchools = useMemo(() => {
    return (schools ?? []).filter(s =>
      (planFilter === "all" || s.plan === planFilter) &&
      (q.trim() === "" || s.name.toLowerCase().includes(q.toLowerCase()) || s.slug.toLowerCase().includes(q.toLowerCase()))
    );
  }, [schools, q, planFilter]);

  function getCell(schoolId: string, moduleId: string) {
    return matrix.find(x => x.school_id === schoolId && x.module_id === moduleId);
  }

  async function toggle(schoolId: string, mod: Module, on: boolean) {
    const cellKey = `${schoolId}:${mod.id}`;
    setBusy(cellKey);
    try {
      const existing = getCell(schoolId, mod.id);
      if (existing) {
        const { error } = await supabase.from("school_modules").update({ enabled: on }).eq("id", existing.id);
        if (error) throw error;
        setMatrix(arr => arr.map(x => x.id === existing.id ? { ...x, enabled: on } : x));
      } else {
        const { data, error } = await supabase.from("school_modules")
          .insert({ school_id: schoolId, module_id: mod.id, enabled: on, config: {} as any })
          .select("id, school_id, module_id, enabled, expires_at, beta").single();
        if (error) throw error;
        setMatrix(arr => [...arr, data as SM]);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  function exportCSV() {
    const header = ["School", "Slug", "Plan", ...modules.map(m => m.slug)];
    const rows = (schools ?? []).map(s => [
      s.name, s.slug, s.plan,
      ...modules.map(m => getCell(s.id, m.id)?.enabled ? "1" : "0"),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "licensing-matrix.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const groupedModules = useMemo(() => {
    const g: Record<string, Module[]> = {};
    for (const m of modules) (g[m.category] ??= []).push(m);
    return g;
  }, [modules]);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        title="Feature Licensing"
        description="Per-school entitlements matrix across every module. Flip switches to grant or revoke access."
        actions={<Button variant="outline" size="sm" onClick={exportCSV}><Download className="size-4" /> Export CSV</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search schools…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {schools === null ? (
        <div className="space-y-2"><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-10" /></div>
      ) : filteredSchools.length === 0 ? (
        <EmptyState icon={<KeyRound className="size-5" />} title="No schools match" description="Try adjusting your search or plan filter." />
      ) : (
        <Section title={`${filteredSchools.length} school${filteredSchools.length === 1 ? "" : "s"} × ${modules.length} module${modules.length === 1 ? "" : "s"}`}>
          <div className="overflow-x-auto -mx-5">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-muted-foreground px-5 py-2 sticky left-0 bg-card z-10 min-w-[200px]">School</th>
                  {Object.entries(groupedModules).map(([cat, mods]) => (
                    <th key={cat} colSpan={mods.length} className="text-center font-medium text-[11px] uppercase tracking-wide text-muted-foreground py-2 border-l border-border/60">
                      {cat}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-card z-10 px-5 py-2"></th>
                  {modules.map(m => (
                    <th key={m.id} className="px-2 py-2 text-[11px] font-medium text-foreground whitespace-nowrap border-l border-border/40">
                      {m.name}
                      {m.term_price_kobo > 0 && (
                        <div className="text-[10px] text-muted-foreground font-normal">₦{Math.round(m.term_price_kobo/100).toLocaleString("en-NG")}/term</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map(s => (
                  <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-5 py-2 sticky left-0 bg-card z-10">
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{s.plan}</Badge>
                        <span className="text-[10px] text-muted-foreground">{s.slug}</span>
                      </div>
                    </td>
                    {modules.map(m => {
                      const cell = getCell(s.id, m.id);
                      const on = !!cell?.enabled;
                      const key = `${s.id}:${m.id}`;
                      return (
                        <td key={m.id} className="px-2 py-2 text-center border-l border-border/40">
                          <Switch checked={on} disabled={busy === key} onCheckedChange={(v) => toggle(s.id, m, v)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </Section>
      )}
    </div>
  );
}