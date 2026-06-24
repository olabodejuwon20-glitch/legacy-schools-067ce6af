import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  GraduationCap, Users, Sparkles, ArrowRight, Building2,
  LogIn, UserPlus, ClipboardCheck, Wallet,
  Star, Quote, CheckCircle2, Mail, MessageCircle,
  Award, ListChecks, Phone, Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useSchool } from "@/contexts/SchoolContext";
import { schoolPath, getCurrentSchoolSlug } from "@/lib/tenant";
import SEO from "@/components/SEO";
import PortalDemo from "@/components/landing/PortalDemo";
import WhatsAppFab from "@/components/landing/WhatsAppFab";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_SLA, mailtoOnboard, waLink } from "@/lib/contact";
import { formatNaira, revenueForSchool, type PlanPricing } from "@/lib/pricing";

export default function Landing() {
  const navigate = useNavigate();
  const { user, school } = useSchool();
  const slug = school?.slug ?? getCurrentSchoolSlug();
  const [studentCount, setStudentCount] = useState(250);

  const planPricing: PlanPricing[] = [
    { plan: "starter", label: "Starter", term_price_kobo: 2500000, included_students: 150, extra_student_kobo: 5000, sort_order: 1 },
    { plan: "standard", label: "Standard", term_price_kobo: 4500000, included_students: 400, extra_student_kobo: 4500, sort_order: 2 },
    { plan: "premium", label: "Premium", term_price_kobo: 8000000, included_students: 800, extra_student_kobo: 4000, sort_order: 3 },
  ];

  const calculatorRows = useMemo(() => {
    return planPricing.map((plan) => ({
      ...plan,
      revenue: revenueForSchool({
        plan: plan.plan,
        studentCount,
        addons: [],
        planPricing,
      }),
    }));
  }, [studentCount]);

  const bestFit = calculatorRows.reduce((best, current) => {
    if (!best) return current;
    return current.revenue.termKobo < best.revenue.termKobo ? current : best;
  }, calculatorRows[0]);

  const setStudentCountValue = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setStudentCount(0);
      return;
    }
    setStudentCount(Math.min(5000, Math.max(0, parsed)));
  };

  // The 5 core pillars, in priority order.
  const pillars = [
    { n: "01", icon: ListChecks,    title: "CBT & exam simulation",       desc: "Run school exams and JAMB / NECO / WAEC mocks online — auto-graded, with real past questions\u00a0\u00a0" },
    { n: "02", icon: ClipboardCheck, title: "Attendance & student records", desc: "Daily attendance, classes, enrollments and a single source of truth for every student." },
    { n: "03", icon: Award,         title: "Digital CA, tests & results",  desc: "Continuous assessment, term tests, automated report cards and QR-verifiable result slips." },
    { n: "04", icon: Wallet,        title: "Online payments",             desc: "Issue invoices, collect fees online via Paystack, track collections and reconcile in one place." },
    { n: "05", icon: Sparkles,      title: "AI for teachers & students",   desc: "Lesson-note generator, an AI study tutor and AI-assisted school operations — built in." },
    { n: "06", icon: Library,       title: "Digital library & resources", desc: "A shared library of lesson notes, past questions, textbooks and study material — searchable for teachers and students." },
  ];

  const stories = [
    { school: "Greenfield Academy", stat: "+38%", label: "exam pass-rate in one term", body: "Replaced paper registers and result sheets across 24 classrooms." },
    { school: "St. Mary's College", stat: "12 hrs", label: "saved per teacher weekly", body: "Automated grading and report cards freed teachers for teaching." },
    { school: "Bright Stars School", stat: "98%", label: "fee collection rate", body: "Parents now pay on time with reminders and digital receipts." },
  ];

  const reviews = [
    { name: "Mrs. Adeyemi", role: "Head, Greenfield Academy", body: "Onboarding 600 students took an afternoon. The portal feels like ours, not a tool." },
    { name: "Mr. Okonkwo",  role: "Principal, St. Mary's", body: "Exam day used to be chaos. Now everything — questions, scoring, results — runs itself." },
    { name: "Ama Boateng",  role: "Parent",              body: "I see my daughter's attendance and results the moment they're posted. Game-changer." },
  ];

  const partners = ["Greenfield", "St. Mary's", "Bright Stars", "Unity High", "Heritage", "Crestview"];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Legacyskool — CBT exams, attendance, results & school payments"
        description="The school operating system for Africa: CBT and JAMB/NECO simulation, attendance, digital results, online fee collection and AI for teachers and students."
        path="/"
      />
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="grid place-items-center size-9 rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-5" /></div>
            <span className="font-display font-bold text-base sm:text-lg tracking-tight truncate">Legacyskool</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#pillars" className="hover:text-foreground">What we do</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#stories" className="hover:text-foreground">Success stories</a>
            <a href="#about" className="hover:text-foreground">About</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user
              ? <Button size="sm" onClick={() => navigate(schoolPath(slug, "/app"))}>Open dashboard</Button>
              : <>
                  <Button size="sm" variant="outline" className="px-2 sm:px-3" onClick={() => navigate("/signin")}><LogIn className="size-4 sm:mr-1.5" /><span className="hidden sm:inline">Sign in</span></Button>
                  <Button size="sm" className="px-2.5 sm:px-3" onClick={() => navigate("/register")}><UserPlus className="size-4 sm:mr-1.5" /><span className="hidden sm:inline">Get started</span><span className="sm:hidden">Start</span></Button>
                </>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40"
          style={{ backgroundImage: "radial-gradient(circle at 15% 10%, hsl(var(--admin)/0.25), transparent 40%), radial-gradient(circle at 85% 0%, hsl(var(--student)/0.25), transparent 45%), radial-gradient(circle at 50% 100%, hsl(var(--teacher)/0.2), transparent 50%)" }} />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-14 sm:pb-16 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl bg-secondary/80 text-secondary-foreground border border-border">
              <Sparkles className="size-3.5 text-primary" />
              <div className="text-left">
                The complete school operating system<br />
                Built for African schools
              </div>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 leading-[1.05] text-left px-0 my-0 py-0 break-words">
              Exams, attendance, results and fees —<br />
              <span className="bg-gradient-to-r from-[hsl(var(--admin))] via-[hsl(var(--student))] to-[hsl(var(--teacher))] bg-clip-text text-transparent">run your school from one place.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-5 sm:mt-6 max-w-lg">
              CBT and JAMB/NECO simulation, attendance, digital result cards, online payments and AI tools for teachers and students — all in one secure portal.
            </p>
             <div className="mt-7 sm:mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                 <a href={mailtoOnboard()}>Request Onboarding <ArrowRight className="size-4 ml-1.5" /></a>
              </Button>
               <Button size="lg" variant="outline" onClick={() => navigate("/signin")}>
                 Sign in
              </Button>
               <Button size="lg" variant="ghost" asChild>
                 <Link to="/refer">Refer a School</Link>
               </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Fair pricing model</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Setup in minutes</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Onboarding support included</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-transparent to-primary/10 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur shadow-card p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {pillars.slice(0, 4).map((p) => (
                  <div key={p.title} className="rounded-xl border border-border/60 p-3 sm:p-4 bg-background/40">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center"><p.icon className="size-5" /></div>
                    <div className="mt-3 font-semibold text-sm">{p.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Trusted by schools across Africa</div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-12 gap-y-3 opacity-70">
            {partners.map(p => (
              <span key={p} className="font-display font-semibold text-base sm:text-lg text-muted-foreground">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars — what we do, in priority order */}
      <section id="pillars" className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Five things every school needs. We do all five.</h2>
            <p className="text-muted-foreground mt-3">Built in the order schools actually feel the pain — exams first, attendance and results next, then fees, then AI on top.</p>
          </div>
          <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {pillars.map((p) => (
              <Card key={p.title} className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><p.icon className="size-5" /></div>
                  <span className="font-display font-bold text-xl text-muted-foreground/60">{p.n}</span>
                </div>
                <div className="mt-4 font-semibold">{p.title}</div>
                <p className="text-sm text-muted-foreground mt-1.5">{p.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive portal demo */}
      <PortalDemo />

      <section id="pricing" className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-[1.05fr_1.3fr] gap-8 lg:gap-12 items-start">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pricing calculator</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-3">Estimate your termly and annual school cost.</h2>
              <p className="text-muted-foreground mt-3 max-w-xl">Adjust your student count to compare plans instantly. The calculator includes each plan's student allowance and extra-student pricing.</p>

              <div className="mt-8 rounded-xl border border-border bg-background p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Students on roll</div>
                    <div className="text-xs text-muted-foreground mt-1">Use the slider or type the number directly.</div>
                  </div>
                  <div className="w-full sm:w-40">
                    <Input
                      type="number"
                      min={0}
                      max={5000}
                      value={studentCount}
                      onChange={(e) => setStudentCountValue(e.target.value)}
                    />
                  </div>
                </div>

                <Slider
                  min={0}
                  max={5000}
                  step={10}
                  value={[studentCount]}
                  onValueChange={([value]) => setStudentCount(value ?? 0)}
                />

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-border bg-card px-3 py-3">
                    <div className="text-xs text-muted-foreground">Best fit</div>
                    <div className="font-semibold mt-1">{bestFit.label}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-3 py-3">
                    <div className="text-xs text-muted-foreground">Termly</div>
                    <div className="font-semibold mt-1">{formatNaira(bestFit.revenue.termKobo)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-3 py-3">
                    <div className="text-xs text-muted-foreground">Annual</div>
                    <div className="font-semibold mt-1">{formatNaira(bestFit.revenue.annualKobo)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {calculatorRows.map((plan) => (
                <Card key={plan.plan} className={`p-5 sm:p-6 ${plan.plan === bestFit.plan ? "border-primary ring-2 ring-primary/15" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{plan.label}</h3>
                        {plan.plan === bestFit.plan && <span className="text-xs font-medium rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">Recommended</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Includes {plan.included_students.toLocaleString()} students, then {formatNaira(plan.extra_student_kobo)} per extra student each term.</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-bold">{formatNaira(plan.revenue.termKobo)}</div>
                      <div className="text-xs text-muted-foreground">per term</div>
                    </div>
                  </div>

                  <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/50 px-3 py-3">
                      <div className="text-xs text-muted-foreground">Base plan</div>
                      <div className="font-medium mt-1">{formatNaira(plan.revenue.basePlanKobo)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-3">
                      <div className="text-xs text-muted-foreground">Extra students</div>
                      <div className="font-medium mt-1">{plan.revenue.extraStudents.toLocaleString()} · {formatNaira(plan.revenue.extraStudentKobo)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-3">
                      <div className="text-xs text-muted-foreground">Annual prepay</div>
                      <div className="font-medium mt-1">{formatNaira(plan.revenue.annualKobo)}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">From sign-up to first exam in one afternoon</h2>
            <p className="text-muted-foreground mt-3">Our onboarding team helps every new school go live — you're never doing it alone.</p>
          </div>
          <div className="mt-10 sm:mt-12 grid md:grid-cols-3 gap-5">
            {[
              { n: "01", icon: Building2, t: "Register your school",     d: "Sign up as the admin or request our team to walk you through it." },
              { n: "02", icon: Users,     t: "Onboard staff & students", d: "Bulk-upload from a CSV, or generate role-based join codes." },
              { n: "03", icon: ListChecks, t: "Run exams, attendance, results & fees", d: "Everything is set up — start using the five pillars on day one." },
            ].map(s => (
              <div key={s.n} className="rounded-xl border border-border bg-background p-6">
                <div className="flex items-center justify-between">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><s.icon className="size-5" /></div>
                  <span className="font-display font-bold text-2xl text-muted-foreground">{s.n}</span>
                </div>
                <div className="mt-4 font-semibold">{s.t}</div>
                <p className="text-sm text-muted-foreground mt-1.5">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success stories */}
      <section id="stories" className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Schools winning with Legacyskool</h2>
            <p className="text-muted-foreground mt-3">Real results from real schools.</p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {stories.map(s => (
              <Card key={s.school} className="p-6">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.school}</div>
                <div className="font-display text-4xl font-bold mt-2 bg-gradient-to-r from-[hsl(var(--admin))] to-[hsl(var(--student))] bg-clip-text text-transparent">{s.stat}</div>
                <div className="text-sm font-medium mt-1">{s.label}</div>
                <p className="text-sm text-muted-foreground mt-3">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Loved by educators and parents</h2>
            <div className="mt-3 flex items-center justify-center gap-1 text-warning">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="size-4 fill-current" />)}
              <span className="ml-2 text-sm text-muted-foreground">4.9 average from 200+ reviews</span>
            </div>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {reviews.map(r => (
              <Card key={r.name} className="p-6">
                <Quote className="size-5 text-primary/60" />
                <p className="text-sm mt-3 leading-relaxed">"{r.body}"</p>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About / mission */}
      <section id="about" className="border-b border-border/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">About Legacyskool</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-3">We're building the operating system for African schools.</h2>
          </div>
          <div className="mt-8 grid md:grid-cols-2 gap-6 text-muted-foreground leading-relaxed">
            <p>
              Legacyskool was started by educators and engineers who watched schools drown in paper registers, leaked exam papers, missing report cards and uncollected fees. We replace all of that with one secure portal that any school — from 50 students to 5,000 — can run on day one.
            </p>
            <p>
               Every module we ship is built with a real school co-piloting the design, so what you see is shaped by the people who actually use it — not a template borrowed from another market.
            </p>
            <p>
              We believe African schools deserve software that respects their bandwidth, their budgets and their workflows. That's why Legacyskool works on low-end Android phones, gracefully handles patchy networks, and offers pilot pricing so even small schools can go digital from term one.
            </p>
            <p>
              Beyond the platform, we run onboarding clinics, train staff on the ground and stand beside every school through their first exam cycle. The goal isn't to sell software — it's to leave each school more organised, more transparent and more trusted by its parents than we found it.
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-3 gap-4 text-center">
            {[
              { k: "120+", v: "Schools onboarded" },
              { k: "85k+", v: "Students managed" },
              { k: "4.9/5", v: "Average school rating" },
            ].map(s => (
              <div key={s.v} className="rounded-xl border border-border bg-card p-5">
                <div className="font-display text-3xl font-bold bg-gradient-to-r from-[hsl(var(--admin))] to-[hsl(var(--student))] bg-clip-text text-transparent">{s.k}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Support */}
      <section id="contact" className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Talk to a human.</h2>
            <p className="text-muted-foreground mt-3">Email, WhatsApp or book a call — Our Support Team will help you scope onboarding, pricing and pilots.</p>
            <div className="mt-5 text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success" /> {SUPPORT_SLA}
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /> <a className="hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
              <li className="flex items-center gap-2"><MessageCircle className="size-4 text-muted-foreground" /> <a className="hover:underline" href={waLink()} target="_blank" rel="noopener noreferrer">WhatsApp us</a></li>
              <li className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> {SUPPORT_WHATSAPP_DISPLAY}</li>
            </ul>
          </div>
          <Card className="p-6 sm:p-8">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Pilot programme</div>
            <h3 className="font-display text-2xl font-bold mt-2">Early-school pricing available</h3>
            <p className="text-sm text-muted-foreground mt-2">Pilot schools get hands-on onboarding, training for staff and a discount for the first session.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild><a href={mailtoOnboard()}>Request Onboarding <ArrowRight className="size-4 ml-1.5" /></a></Button>
              <Button variant="outline" asChild><Link to="/refer">Refer a school</Link></Button>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-gradient-to-br from-[hsl(var(--admin))] via-[hsl(var(--student))] to-[hsl(var(--teacher))] text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Ready to run your school the modern way?</h2>
          <p className="mt-3 text-white/90 max-w-xl mx-auto">Pilot pricing is open. Talk to our team or sign up and start exploring today.</p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Button size="lg" variant="secondary" asChild><a href={mailtoOnboard()}>Request Onboarding <ArrowRight className="size-4 ml-1.5" /></a></Button>
            <Button size="lg" variant="outline" className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white" onClick={() => navigate("/signin")}>Sign in</Button>
            <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" asChild><Link to="/refer">Refer a School</Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-xs text-muted-foreground flex flex-col sm:flex-row gap-3 justify-between">
          <span>© 2026 Legacyskool. All rights reserved.</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="#pillars" className="hover:text-foreground">What we do</a>
            <a href="#about" className="hover:text-foreground">About</a>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/refer" className="hover:text-foreground">Refer</Link>
            <Link to="/signin" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>

      <WhatsAppFab />
    </div>
  );
}
