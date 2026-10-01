import { Link } from "react-router-dom";
import { Gift, ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { mailtoRefer, waLink, SUPPORT_EMAIL } from "@/lib/contact";

export default function Refer() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Refer a school — LegacySKool" description="Know a school that should be on LegacySKool? Refer them and earn pilot credits." path="/refer" />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
        <div className="mt-6 flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center"><Gift className="size-6" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Refer a school</h1>
            <p className="text-sm text-muted-foreground mt-1">Know a school that should be running on LegacySKool? Tell us about them.</p>
          </div>
        </div>
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <p className="text-sm">Share the school's name and a contact — we'll handle the rest. When they onboard, both schools get a pilot credit.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild><a href={mailtoRefer()}><Mail className="size-4 mr-1.5" /> Refer by email</a></Button>
            <Button variant="outline" asChild><a href={waLink("Hi LegacySKool, I'd like to refer a school.")} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 mr-1.5" /> Refer on WhatsApp</a></Button>
          </div>
          <p className="text-xs text-muted-foreground mt-5">Or write to <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
        </div>
      </div>
    </div>
  );
}