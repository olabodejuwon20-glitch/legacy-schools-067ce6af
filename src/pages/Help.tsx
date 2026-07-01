import { useState } from "react";
import { BookOpen, GraduationCap, HelpCircle, School as SchoolIcon, Users, Sparkles, NotebookPen, Wallet, Megaphone, ClipboardCheck } from "lucide-react";
import { useSchool, Role } from "@/contexts/SchoolContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

type Article = { q: string; a: string };
type Section = { icon: any; title: string; items: Article[] };

const GUIDE: Record<Role, Section[]> = {
  admin: [
    {
      icon: SchoolIcon, title: "Getting started", items: [
        { q: "How do I finish the initial setup?", a: "Go to Dashboard → if onboarding is incomplete, you’ll be sent to the setup wizard. It captures your school profile, current session/term and creates your starter classes." },
        { q: "Where do I change school name, logo or session?", a: "Settings → School profile. Updates here are reflected on every result slip, invoice and the parent portal." },
      ],
    },
    {
      icon: Users, title: "Inviting people", items: [
        { q: "How do teachers and students join?", a: "Open Invites and create a code for each role. Share the code with the school sign-in link; users redeem it after they create an account." },
        { q: "Can I add students in bulk?", a: "Yes — use Bulk Upload to import a CSV of students. The system creates accounts and enrolls them automatically." },
      ],
    },
    {
      icon: BookOpen, title: "Academics", items: [
        { q: "How do I add classes & assign teachers?", a: "Classes → New class. Pick a teacher, grade level and code. Students self-enroll or you assign them in Enrollments." },
        { q: "Where do exam results come from?", a: "Teachers record CA/exam scores in Gradebook. Reports compiles them into term result slips with QR verification." },
      ],
    },
    {
      icon: Wallet, title: "Fees & payments", items: [
        { q: "How do I issue fees?", a: "Fees & Payments → create a payment type, set the audience (class/level/whole school) and issue invoices. Parents see them in their portal." },
      ],
    },
    {
      icon: Megaphone, title: "Communication", items: [
        { q: "How do I broadcast a notice?", a: "Announcements → New announcement. It appears on every member's dashboard. Use Inbox for direct conversations." },
      ],
    },
  ],
  teacher: [
    {
      icon: ClipboardCheck, title: "Daily teaching", items: [
        { q: "How do I mark attendance?", a: "Attendance → pick a class & date, then mark Present / Absent / Late per student. It syncs to parents automatically." },
        { q: "How do I create a test?", a: "Test Builder → New test. Add MCQ/short questions, set time and proctoring rules, then publish to your class." },
      ],
    },
    {
      icon: NotebookPen, title: "Assignments & gradebook", items: [
        { q: "How are scores recorded?", a: "Gradebook → pick subject and term, then enter CA1/CA2/Exam. The system computes totals for term reports." },
        { q: "What is Lesson Notes for?", a: "Draft lesson notes; admins review and approve them before they appear to students." },
      ],
    },
  ],
  student: [
    {
      icon: GraduationCap, title: "Your studies", items: [
        { q: "Where are my classes and assignments?", a: "My Classes shows the classes you’re enrolled in. Assignments lists what is due, with submission buttons." },
        { q: "How do I take an exam?", a: "Open Exams when a teacher publishes one. Some exams use proctoring — stay on the tab until you submit." },
      ],
    },
    {
      icon: Sparkles, title: "Practice & AI Tutor", items: [
        { q: "What is the NECO/JAMB Mock?", a: "Time-bound mock exams across multiple subjects, scored automatically with explanations after submission." },
        { q: "Can I get help on a topic?", a: "AI Tutor — ask any question and get a step-by-step explanation, tailored to your level." },
      ],
    },
  ],
  parent: [
    {
      icon: Users, title: "Following your child", items: [
        { q: "Where do I see results & attendance?", a: "Academic Records shows result slips per term. Attendance shows daily presence. Both are read-only — no logins are needed for your child." },
        { q: "How do I talk to a teacher?", a: "Teacher Comms → pick the teacher and send a message. Replies appear in your Inbox." },
      ],
    },
    {
      icon: Wallet, title: "Fees", items: [
        { q: "How do I pay school fees?", a: "Fees & Payments shows outstanding invoices. Click Pay to settle online (where enabled) or upload proof of bank transfer." },
      ],
    },
  ],
};

export default function HelpPage() {
  const { activeRole } = useSchool();
  const [tab, setTab] = useState<Role>((activeRole ?? "admin"));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <SEO title="Help Center — Legacyskool guides for schools, teachers & parents" description="Short role-based guides for using Legacyskool: onboarding, exams, attendance, results, fees and communication." path="/help" noindex />
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center"><HelpCircle className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold">Help Center</h1>
          <p className="text-sm text-muted-foreground">Short guides for using the platform. Pick the role that matches what you do.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Role)}>
        <TabsList className="grid grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="teacher">Teacher</TabsTrigger>
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="parent">Parent</TabsTrigger>
        </TabsList>

        {(["admin", "teacher", "student", "parent"] as Role[]).map(role => (
          <TabsContent key={role} value={role} className="space-y-4 pt-4">
            {GUIDE[role].map((section, i) => {
              const Icon = section.icon;
              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className={cn("size-4 text-primary")} /> {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {section.items.map((it, j) => (
                        <AccordionItem key={j} value={`${i}-${j}`}>
                          <AccordionTrigger className="text-sm text-left">{it.q}</AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">{it.a}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Still stuck?</CardTitle>
          <CardDescription>Reach your school administrator from Inbox, or email support — they can help reset PINs, fix enrollments and more.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}