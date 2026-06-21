import { Link } from "react-router-dom";
import { ClipboardCheck, Ticket, Upload } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath } from "@/lib/tenant";
import { SectionCard } from "@/components/dashboard/SectionCard";
import SEO from "@/components/SEO";

const ITEMS = [
  { to: "enrollments", icon: ClipboardCheck, title: "Enrollments", desc: "Approve admissions, place students into classes, and track each cohort." },
  { to: "invites",     icon: Ticket,         title: "Invites",     desc: "Generate one-time onboarding codes for new students and parents." },
  { to: "bulk",        icon: Upload,         title: "Bulk Upload", desc: "Onboard a whole class from a CSV — fast first-day setup." },
];

export default function AdmissionHub() {
  const { school } = useSchool();
  return (
    <>
      <SEO title="Admission" description="Enrollment, invites and bulk onboarding." path="/admin/admission" />
      <SectionCard title="Admission" description="Everything you need to bring new students and parents into the school.">
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