import { Link } from "react-router-dom";
import { ShieldCheck, Lock, Database, Trash2, KeyRound, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { SUPPORT_EMAIL } from "@/lib/contact";

export default function Privacy() {
  const items = [
    { icon: Lock, t: "Bank-grade encryption in transit & at rest", d: "All traffic is protected with industry-standard encryption in transit and secure encrypted storage at rest." },
    { icon: Database, t: "Automated daily backups", d: "Your school's data is backed up daily with point-in-time recovery available for the last 7 days." },
    { icon: KeyRound, t: "Role-based access control", d: "Admins, teachers, students and parents only see what their role allows. Strict access policies ensure your school records stay private." },
    { icon: Trash2, t: "Data deletion on request", d: `Email ${SUPPORT_EMAIL} from a verified admin address and we will permanently delete your school's data within 30 days.` },
  ];
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Privacy & Data Protection — LegacySKool" description="How LegacySKool protects your school's data: encryption, backups, access control and data deletion." path="/privacy" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center"><ShieldCheck className="size-6" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Privacy & Data Protection</h1>
            <p className="text-sm text-muted-foreground mt-1">Your school's data is yours. Here's how we protect it.</p>
          </div>
        </div>
        <div className="mt-8 space-y-4">
          {items.map(i => (
            <div key={i.t} className="rounded-xl border border-border bg-card p-5 flex gap-4">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0"><i.icon className="size-5" /></div>
              <div>
                <div className="font-semibold">{i.t}</div>
                <p className="text-sm text-muted-foreground mt-1">{i.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-8">Questions? Contact <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </div>
    </div>
  );
}