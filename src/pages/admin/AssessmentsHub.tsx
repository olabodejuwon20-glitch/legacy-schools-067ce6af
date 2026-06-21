import { Link } from "react-router-dom";
import { ScrollText, ClipboardList, ClipboardCheck, ShieldCheck, FileBarChart, Gauge } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import SEO from "@/components/SEO";

const ITEMS = [
  { to: "trad-exams",            icon: ScrollText,     title: "Exams",            desc: "Manage exam sessions, papers and timetables." },
  { to: "exam-committee",        icon: ClipboardList,  title: "Exam Committee",   desc: "Plan, schedule and coordinate exam papers across classes." },
  { to: "proctoring",            icon: ClipboardCheck, title: "Proctoring",       desc: "Live monitoring, lockdown and violation evidence." },
  { to: "trad-exams-approvals",  icon: ShieldCheck,    title: "Approvals",        desc: "Review and sign-off scored exams before publishing." },
  { to: "trad-exams-results",    icon: FileBarChart,   title: "Results",          desc: "Publish, unlock and audit exam results." },
  { to: "exam-appeals",          icon: Gauge,          title: "Exam Appeals",     desc: "Handle student appeals through the multi-level workflow." },
];

export default function AssessmentsHub() {
  const { school } = useSchool();
  return (
    <>
      <SEO title="Assessments" description="Exams, proctoring, approvals and results." path="/admin/assessments" />
      <SectionCard title="Assessments" description="Plan, run and audit every exam from one place.">
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