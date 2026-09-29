import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODULE_MANIFESTS } from "@/modules/registry";
import { PageHeader, Section, StatusBadge, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Package, RefreshCw, Sparkles, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";

type ModuleRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  global_default: boolean;
  pricing_model: string;
  monthly_price_cents: number;
  term_price_kobo: number;
  version: string;
  default_config: Record<string, unknown>;
};

export default function SuperModules() {
  const [rows, setRows] = useState<ModuleRow[] | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    setRows(null);
    const { data, error } = await supabase
      .from("modules")
      .select("id, slug, name, category, status, global_default, pricing_model, monthly_price_cents, term_price_kobo, version, default_config")
      .order("category")
      .order("name");
    if (error) toast.error(error.message);
    setRows((data as ModuleRow[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  const dbSlugs = new Set((rows ?? []).map(r => r.slug));
  const missing = MODULE_MANIFESTS.filter(m => !dbSlugs.has(m.slug));

  async function seedMissing() {
    setSeeding(true);
    try {
      const payload = missing.map(m => ({
        slug: m.slug,
        name: m.name,
        category: m.category,
        default_config: (m.defaultConfig ?? {}) as any,
        global_default: !!m.core,
      }));
      if (payload.length === 0) { toast.message("Registry is already up to date"); return; }
      const { error } = await supabase.from("modules").insert(payload);
      if (error) throw error;
      toast.success(`Seeded ${payload.length} modules`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Seeding failed");
    } finally { setSeeding(false); }
  }

  async function toggleDefault(row: ModuleRow) {
    const { error } = await supabase.from("modules").update({ global_default: !row.global_default }).eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows(r => r?.map(x => x.id === row.id ? { ...x, global_default: !row.global_default } : x) ?? null);
  }

  return (
    <div>
      <PageHeader
        title="Modules & Plugins"
        description="The canonical module registry. Slugs here are bound to the in-repo manifest and consumed by every school."
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link to="/super/testing-lab"><FlaskConical className="size-3.5 mr-1.5" />Internal Testing Lab</Link></Button>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5 mr-1.5" />Refresh</Button>
            <Button size="sm" onClick={seedMissing} disabled={seeding || missing.length === 0}>
              {seeding ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
              Seed missing ({missing.length})
            </Button>
          </>
        }
      />

      <Section title="Registered modules" description="Stored in public.modules. Schools enable these via Marketplace.">
        {rows === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{Array.from({length:6}).map((_,i)=><Skel key={i} className="h-20" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Package className="size-5 text-muted-foreground" />} title="No modules registered"
            description="Click 'Seed missing' to populate the registry from the in-repo manifest."
            action={<Button size="sm" onClick={seedMissing}>Seed now</Button>} />
        ) : (
          <ul className="divide-y divide-border -my-2">
            {rows.map(r => (
              <li key={r.id} className="py-3 flex items-center gap-3">
                <div className="size-9 rounded-md bg-muted grid place-items-center"><Package className="size-4 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.name}</span>
                    <code className="text-[11px] text-muted-foreground">{r.slug}</code>
                    <Badge variant="secondary" className="text-[10px] capitalize">{r.category}</Badge>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    v{r.version} · {r.pricing_model}{r.term_price_kobo ? ` · ₦${Math.round(r.term_price_kobo/100).toLocaleString("en-NG")}/term` : ""}
                  </p>
                </div>
                {r.status === "testing" ? (
                  <Button variant="outline" size="sm" asChild className="border-warning/40 text-warning hover:bg-warning/10">
                    <Link to="/super/testing-lab"><FlaskConical className="size-3.5 mr-1.5" />Verify & Approve in Lab</Link>
                  </Button>
                ) : (
                  <Button variant={r.global_default ? "default" : "outline"} size="sm" onClick={() => toggleDefault(r)}>
                    {r.global_default ? "Default on" : "Default off"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
