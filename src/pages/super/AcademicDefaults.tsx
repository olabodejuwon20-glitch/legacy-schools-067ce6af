import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save } from "lucide-react";

const KINDS = ["grading", "assessment", "calendar", "promotion", "result", "risk_scoring"];

export default function SuperAcademicDefaults() {
  const [kind, setKind] = useState("grading");
  const [body, setBody] = useState("{}");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("academic_policy_defaults" as any).select("body").eq("policy_kind", kind).maybeSingle();
      setBody(JSON.stringify((data as any)?.body ?? {}, null, 2));
    })();
  }, [kind]);

  async function save() {
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { toast.error("Invalid JSON"); return; }
    setSaving(true);
    const { error } = await supabase.from("academic_policy_defaults" as any).upsert({ policy_kind: kind, body: parsed }, { onConflict: "policy_kind" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Platform default saved");
  }

  return (
    <div>
      <PageHeader title="Academic Defaults" description="Platform-wide academic policies. Schools can override per-tenant from Academic Setup." />
      <Section title="Edit defaults">
        <div className="space-y-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea rows={18} className="font-mono text-xs" value={body} onChange={e => setBody(e.target.value)} />
          <Button onClick={save} disabled={saving}><Save className="size-3.5 mr-1.5" />Save</Button>
        </div>
      </Section>
    </div>
  );
}