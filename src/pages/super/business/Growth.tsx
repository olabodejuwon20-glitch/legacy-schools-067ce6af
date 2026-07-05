import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, MetricCard } from "@/components/super/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, LinkIcon, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Ev = { id: string; school_id: string | null; event: string; role: string | null; created_at: string };
type Code = { id: string; school_id: string; code: string; role: string; uses: number; max_uses: number | null; expires_at: string | null; revoked_at: string | null; created_at: string };
type Attempt = { id: string; user_id: string | null; code: string; success: boolean; created_at: string };
type School = { id: string; name: string };

const FUNNEL_STEPS = ["signup_started", "signup_completed", "onboarding_started", "onboarding_completed", "first_activation"];

export default function BusinessGrowth() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    (async () => {
      const [e, c, a, s] = await Promise.all([
        supabase.from("onboarding_events").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("invite_codes").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("invite_redeem_attempts").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("schools").select("id, name"),
      ]);
      setEvents((e.data as Ev[]) ?? []);
      setCodes((c.data as Code[]) ?? []);
      setAttempts((a.data as Attempt[]) ?? []);
      setSchools((s.data as School[]) ?? []);
    })();
  }, []);

  const funnel = useMemo(() => {
    const list = events ?? [];
    const counts: { step: string; count: number }[] = [];
    let prev = 0;
    FUNNEL_STEPS.forEach((step, i) => {
      const c = list.filter(x => x.event === step).length;
      counts.push({ step, count: c });
      if (i === 0) prev = c;
    });
    const top = counts[0]?.count || 0;
    return counts.map(x => ({ ...x, pct: top > 0 ? Math.round((x.count / top) * 100) : 0 }));
  }, [events]);

  const signupTrend = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); buckets[d.toISOString().slice(0, 10)] = 0; }
    (events ?? []).filter(x => x.event === "signup_completed").forEach(x => {
      const k = x.created_at.slice(0, 10); if (k in buckets) buckets[k] += 1;
    });
    return Object.entries(buckets).map(([date, value]) => ({ date: date.slice(5), value }));
  }, [events]);

  const kpis = useMemo(() => {
    const list = events ?? [];
    const signups = list.filter(x => x.event === "signup_completed").length;
    const activations = list.filter(x => x.event === "first_activation").length;
    const totalRedeems = attempts.length;
    const success = attempts.filter(a => a.success).length;
    const redeemRate = totalRedeems > 0 ? Math.round((success / totalRedeems) * 100) : 0;
    const totalCodeUses = codes.reduce((a, c) => a + (c.uses || 0), 0);
    const totalCodeCap = codes.reduce((a, c) => a + (c.max_uses ?? c.uses ?? 0), 0);
    const codeUsage = totalCodeCap > 0 ? Math.round((totalCodeUses / totalCodeCap) * 100) : 0;
    const activationRate = signups > 0 ? Math.round((activations / signups) * 100) : 0;
    return { signups, activations, activationRate, redeemRate, codeUsage, totalRedeems };
  }, [events, attempts, codes]);

  const roleMix = useMemo(() => {
    const m = new Map<string, number>();
    codes.forEach(c => m.set(c.role, (m.get(c.role) ?? 0) + (c.uses || 0)));
    return Array.from(m.entries()).map(([role, uses]) => ({ role, uses })).sort((a, b) => b.uses - a.uses);
  }, [codes]);

  const schoolName = (id: string | null) => id ? (schools.find(s => s.id === id)?.name ?? "—") : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Signups (all-time)" value={kpis.signups} icon={<UserPlus className="size-4" />} />
        <MetricCard label="Activation rate" value={`${kpis.activationRate}%`} icon={<TrendingUp className="size-4" />} />
        <MetricCard label="Invite redemptions" value={kpis.totalRedeems} icon={<LinkIcon className="size-4" />} />
        <MetricCard label="Redemption success" value={`${kpis.redeemRate}%`} icon={<CheckCircle2 className="size-4" />} />
        <MetricCard label="Code cap used" value={`${kpis.codeUsage}%`} icon={<TrendingUp className="size-4" />} />
      </div>

      <Section title="Signups — last 30 days">
        {events === null ? <Skel className="h-48" /> : signupTrend.every(t => t.value === 0) ? (
          <EmptyState icon={<UserPlus className="size-6" />} title="No signups tracked yet" description="Instrument `onboarding_events` with 'signup_completed' to see the funnel." />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#signupFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Onboarding funnel" description="Drop-off from signup to activation">
          {events === null ? <Skel className="h-48" /> : funnel.every(f => f.count === 0) ? (
            <EmptyState icon={<TrendingUp className="size-6" />} title="No funnel data yet" />
          ) : (
            <div className="space-y-3">
              {funnel.map(f => (
                <div key={f.step}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize">{f.step.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">{f.count} <span className="opacity-60">({f.pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Invite codes by role" description="Redemptions per role">
          {codes.length === 0 ? (
            <EmptyState icon={<LinkIcon className="size-6" />} title="No invite codes yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Role</TableHead><TableHead className="text-right">Uses</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {roleMix.map(r => (
                  <TableRow key={r.role}>
                    <TableCell className="capitalize">{r.role}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.uses}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>

      <Section title="Recent redemption attempts" description="Latest 20">
        {attempts.length === 0 ? (
          <EmptyState icon={<LinkIcon className="size-6" />} title="No redemption attempts yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.slice(0, 20).map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>
                    {a.success ? (
                      <span className="inline-flex items-center gap-1 text-success text-xs"><CheckCircle2 className="size-3" /> success</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive text-xs"><XCircle className="size-3" /> failed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Recent invite codes" description="Latest 10 codes issued">
        {codes.length === 0 ? <EmptyState icon={<LinkIcon className="size-6" />} title="No codes yet" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Uses</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.slice(0, 10).map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="text-xs">{schoolName(c.school_id)}</TableCell>
                  <TableCell className="text-xs capitalize">{c.role}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}