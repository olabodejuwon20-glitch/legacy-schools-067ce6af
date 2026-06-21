import { Link } from "react-router-dom";
import { Brain, ShieldAlert, BookMarked, Activity, Sparkles } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import SEO from "@/components/SEO";

const ITEMS = [
  { to: "copilot",        icon: Brain,       title: "Copilot",         desc: "Ask anything about your school — backed by live data." },
  { to: "parent-alerts",  icon: ShieldAlert, title: "Parent Alerts",   desc: "AI-drafted alerts for attendance, grades and fees." },
  { to: "knowledge",      icon: BookMarked,  title: "Knowledge",       desc: "Curate the documents the AI can reason over." },
  { to: "ai-activity",    icon: Activity,    title: "AI Activity",     desc: "Usage, latency and spend by feature." },
  { to: "ai-settings",    icon: Sparkles,    title: "AI Settings",     desc: "Budgets, feature toggles and governance for AI." },
];

export default function AIOpsHub() {
  const { school } = useSchool();
  return (
    <>
      <SEO title="AI Operation Center" description="Copilot, alerts, knowledge and governance." path="/admin/ai-ops" />
      <SectionCard title="AI Operation Center" description="Every AI surface in one place — ask, monitor, govern.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ITEMS.map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={schoolPath(school?.slug, `/app/admin/${to}`)}
              className="group rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-muted/40 transition flex flex-col gap-2">
              <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center"><Icon className="size-5" /></div>
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
}