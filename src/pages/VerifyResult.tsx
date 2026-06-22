import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { friendlyInvokeError } from "@/lib/errors";

type Snapshot = {
  school: { name: string | null; address: string | null; phone: string | null; email: string | null; logo_url: string | null };
  student: { full_name: string | null; admission_no: string | null; class: string | null; gender: string | null; dob: string | null };
  term: string | null;
  session: string | null;
  results: Array<{ subject: string; score: number; grade: string; remark: string }>;
  average: number;
  overall_grade: string;
  issued_at: string;
};

export default function VerifyResult() {
  const { id } = useParams();
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setState("invalid"); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("public-verify-result", {
        body: { id },
      });
      if (error) {
        const msg = await friendlyInvokeError(error, "This result could not be verified.");
        if (/invalid verification link|not found/i.test(msg)) setState("invalid");
        else setState("invalid");
        return;
      }
      if ((data as any)?.error || !(data as any)?.snapshot) { setState("invalid"); return; }
      setSnap((data as any).snapshot as Snapshot);
      setIssuedAt((data as any).created_at ?? null);
      setState("ok");
    })();
  }, [id]);

  if (state === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Verifying result…</div>
      </div>
    );
  }

  if (state === "invalid" || !snap) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <SEO title="Result not verified" description="This result could not be verified." path={`/verify/${id ?? ""}`} />
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <ShieldAlert className="size-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">We can't verify this result</h1>
          <p className="text-sm text-muted-foreground">No matching record was found. The link may be invalid, the result may have been revoked, or the document is not authentic.</p>
          <Link to="/" className="text-sm text-primary underline">Go to home</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <SEO title={`Verified result — ${snap.student.full_name ?? "Student"}`} description={`Authentic result issued by ${snap.school.name ?? "the school"}.`} path={`/verify/${id ?? ""}`} />
      <div className="max-w-2xl mx-auto space-y-5">
        <Card className="p-6 border-success/40 bg-success/5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-8 text-success" />
            <div>
              <h1 className="text-xl font-semibold">Verified authentic result</h1>
              <p className="text-sm text-muted-foreground">Issued by <span className="font-medium text-foreground">{snap.school.name ?? "the school"}</span> on {issuedAt ? new Date(issuedAt).toLocaleString() : ""}.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            {snap.school.logo_url && <img src={snap.school.logo_url} alt={snap.school.name ?? "School"} className="size-14 rounded object-cover" />}
            <div className="flex-1">
              <h2 className="font-semibold">{snap.school.name}</h2>
              {snap.school.address && <p className="text-xs text-muted-foreground">{snap.school.address}</p>}
              <p className="text-xs text-muted-foreground">{[snap.school.phone, snap.school.email].filter(Boolean).join(" • ")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Detail label="Student name" value={snap.student.full_name} />
            <Detail label="Admission no." value={snap.student.admission_no} />
            <Detail label="Class" value={snap.student.class} />
            <Detail label="Gender" value={snap.student.gender} />
            <Detail label="Term" value={snap.term} />
            <Detail label="Session" value={snap.session} />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Results</h3>
            <div className="overflow-x-auto rounded border border-border">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-2">Subject</th><th className="text-right p-2">Score</th><th className="text-center p-2">Grade</th><th className="text-left p-2">Remark</th></tr>
                </thead>
                <tbody>
                  {snap.results.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 font-medium">{r.subject}</td>
                      <td className="p-2 text-right tabular-nums">{r.score}%</td>
                      <td className="p-2 text-center"><Badge variant="secondary">{r.grade}</Badge></td>
                      <td className="p-2 text-muted-foreground">{r.remark}</td>
                    </tr>
                  ))}
                  {snap.results.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No subjects recorded.</td></tr>}
                </tbody>
              </table></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2 border-t border-border">
            <Detail label="Average" value={`${snap.average}%`} />
            <Detail label="Overall grade" value={snap.overall_grade} />
            <Detail label="Subjects" value={String(snap.results.length)} />
          </div>

          <p className="text-xs text-muted-foreground pt-2">This page only displays verification details for the result slip. It does not expose login credentials or private records.</p>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}