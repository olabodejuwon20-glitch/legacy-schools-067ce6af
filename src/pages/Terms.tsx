import { Link } from "react-router-dom";
import { ScrollText, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { SUPPORT_EMAIL } from "@/lib/contact";

export default function Terms() {
  const sections = [
    {
      t: "1. Acceptance of terms",
      d: "By creating a LegacySKool account or using the platform on behalf of a school, you agree to these Terms of Service. If you do not agree, do not use the platform.",
    },
    {
      t: "2. Who can use LegacySKool",
      d: "LegacySKool is provided to registered schools, their authorised administrators, staff, students and parents. Each school is responsible for the accuracy of the accounts it creates and the activity that happens under those accounts.",
    },
    {
      t: "3. School data ownership",
      d: "Schools retain full ownership of all data they upload — student records, results, attendance, payments and files. LegacySKool processes this data only to deliver the service and never sells it.",
    },
    {
      t: "4. Acceptable use",
      d: "You agree not to misuse the platform: no attempting to breach security, no uploading malicious content, no harassment of other users, no scraping of question banks, and no use of the system to defraud parents or students.",
    },
    {
      t: "5. Payments & fees",
      d: "Subscription fees, pilot pricing and transaction charges are agreed in writing with each school. Online fee collection is processed by Paystack; their terms also apply. Refunds are handled per the pilot agreement.",
    },
    {
      t: "6. Availability & support",
      d: "We aim for high availability but do not guarantee uninterrupted service. Scheduled maintenance is announced in advance. Support is available via email and WhatsApp within working hours.",
    },
    {
      t: "7. Termination",
      d: "A school may stop using LegacySKool at any time. We may suspend accounts that violate these terms. On termination we will export your data on request and delete it within 30 days.",
    },
    {
      t: "8. Limitation of liability",
      d: "LegacySKool is provided on an 'as is' basis. We are not liable for indirect or consequential losses arising from use of the platform. Our total liability is limited to the fees paid in the prior 12 months.",
    },
    {
      t: "9. Changes to these terms",
      d: "We may update these terms as the product evolves. Material changes will be communicated to school administrators by email at least 14 days before they take effect.",
    },
    {
      t: "10. Governing law",
      d: "These terms are governed by the laws of the Federal Republic of Nigeria. Disputes will be resolved in the courts of Lagos State.",
    },
  ];
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Terms of Service — LegacySKool" description="The terms that govern the use of the LegacySKool school operating system." path="/terms" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center"><ScrollText className="size-6" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mt-1">Last updated: May 2026</p>
          </div>
        </div>
        <div className="mt-8 space-y-5">
          {sections.map(s => (
            <section key={s.t} className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold">{s.t}</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.d}</p>
            </section>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-8">Questions? Contact <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </div>
    </div>
  );
}