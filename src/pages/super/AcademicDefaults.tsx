import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Sparkles } from "lucide-react";
import { superAction } from "@/lib/super";

const KINDS = ["grading", "assessment", "calendar", "promotion", "result", "risk_scoring"] as const;

const NIGERIAN_PRESETS: Record<string, Record<string, unknown>> = {
  grading: {
    scale: "WAEC_9_POINT",
    bands: [
      { grade: "A1", min: 75, max: 100, remark: "Excellent" },
      { grade: "B2", min: 70, max: 74, remark: "Very Good" },
      { grade: "B3", min: 65, max: 69, remark: "Good" },
      { grade: "C4", min: 60, max: 64, remark: "Credit" },
      { grade: "C5", min: 55, max: 59, remark: "Credit" },
      { grade: "C6", min: 50, max: 54, remark: "Credit" },
      { grade: "D7", min: 45, max: 49, remark: "Pass" },
      { grade: "E8", min: 40, max: 44, remark: "Pass" },
      { grade: "F9", min: 0,  max: 39, remark: "Fail" },
    ],
  },
  assessment: {
    ca_weight: 40,
    exam_weight: 60,
    components: [
      { code: "CA1", label: "1st Continuous Assessment", max_score: 20 },
      { code: "CA2", label: "2nd Continuous Assessment", max_score: 20 },
      { code: "EXAM", label: "Terminal Examination", max_score: 60 },
    ],
  },
  calendar: {
    terms_per_session: 3,
    terms: ["First Term", "Second Term", "Third Term"],
    min_attendance_days_per_term: 60,
  },
  promotion: {
    min_average_pct: 50,
    must_pass_subjects: ["English Language", "Mathematics"],
    min_credits_for_promotion: 5,
  },
  result: {
    show_class_position: true,
    show_subject_position: true,
    require_principal_approval: true,
    allow_scratch_card_unlock: true,
  },
  risk_scoring: {
    attendance_warning_pct: 75,
    attendance_critical_pct: 60,
    academic_drop_threshold_pct: 15,
    fee_overdue_days_warning: 14,
  },
};

export default function SuperAcademicDefaults() {
  const [kind, setKind] = useState("grading");
  const [body, setBody] = useState("{}");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("academic_policy_defaults" as never).select("body").eq("policy_kind", kind).maybeSingle();
      const existing = (data as { body?: Record<string, unknown> } | null)?.body;
      setBody(JSON.stringify(existing && Object.keys(existing).length > 0 ? existing : (NIGERIAN_PRESETS[kind] ?? {}), null, 2));
    })();
  }, [kind]);

  async function save() {
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { toast.error("Invalid JSON"); return; }
    setSaving(true);
    try {
      await superAction("save_academic_default", { policy_kind: kind, body: parsed });
      toast.success("Platform academic default saved & audited");
    } catch {
      /* toasted */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Academic Defaults (NERDC / WAEC)" description="Platform-wide academic policies. Schools inherit these defaults and can override per-tenant from Academic Setup." />
      <Section
        title="Edit Default Policy JSON"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBody(JSON.stringify(NIGERIAN_PRESETS[kind] ?? {}, null, 2));
              toast.message(`Loaded Nigerian standard preset for ${kind}`);
            }}
          >
            <Sparkles className="size-3.5 mr-1.5" />Load WAEC / NERDC Preset
          </Button>
        }
      >
        <div className="space-y-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map(k => <SelectItem key={k} value={k} className="capitalize">{k.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea rows={18} className="font-mono text-xs" value={body} onChange={e => setBody(e.target.value)} />
          <Button onClick={() => void save()} disabled={saving}><Save className="size-3.5 mr-1.5" />{saving ? "Saving…" : "Save Default Policy"}</Button>
        </div>
      </Section>
    </div>
  );
}