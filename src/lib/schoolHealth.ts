// Health score + customer-success mock enrichments. Deterministic per school id
// so numbers don't jitter across re-renders. Wire to real telemetry later.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function rand(seed: string, salt: string, min: number, max: number) {
  const n = hash(seed + ":" + salt);
  return min + (n % (max - min + 1));
}

export type SchoolEnrichment = {
  students: number;
  teachers: number;
  parents: number;
  activeToday: number;
  storageBytes: number;
  aiTokens: number;
  healthScore: number;
  healthTrend: "up" | "down" | "flat";
  lastBackupAt: string | null;
  renewalAt: string | null;
  churnRisk: "low" | "medium" | "high";
  accountManager: string | null;
};

const MANAGERS = ["Ada Nwosu", "Kunle Ade", "Fatima Bello", "Chinedu Okafor", null];

export function enrichSchool(school: { id: string; status?: string | null; plan_expires_at?: string | null; created_at?: string | null }): SchoolEnrichment {
  const s = school.id ?? "x";
  const students = rand(s, "st", 120, 1800);
  const teachers = rand(s, "te", 8, Math.max(20, Math.round(students / 25)));
  const parents  = rand(s, "pa", Math.round(students * 0.6), Math.round(students * 1.4));
  const activeToday = Math.round((students + teachers) * (rand(s, "act", 15, 65) / 100));
  const storageBytes = rand(s, "sb", 200, 9500) * 1_048_576;
  const aiTokens = rand(s, "ai", 5_000, 240_000);

  const login = rand(s, "l", 40, 100);
  const backup = rand(s, "b", 60, 100);
  const adoption = rand(s, "ad", 30, 100);
  const security = rand(s, "sec", 70, 100);
  const subOk = school.status === "active" ? 100 : school.status === "trial" ? 70 : school.status === "suspended" ? 20 : 50;
  const raw = Math.round((login * 0.2 + backup * 0.15 + adoption * 0.25 + security * 0.15 + subOk * 0.25));
  const healthScore = Math.min(100, Math.max(5, raw));

  const trendPick = rand(s, "tr", 0, 2);
  const healthTrend: "up" | "down" | "flat" = trendPick === 0 ? "up" : trendPick === 1 ? "down" : "flat";

  const daysAgo = rand(s, "bk", 0, 12);
  const lastBackupAt = new Date(Date.now() - daysAgo * 86400_000).toISOString();

  const renewalAt = school.plan_expires_at ?? new Date(Date.now() + rand(s, "rn", 5, 240) * 86400_000).toISOString();

  const churnRisk: "low" | "medium" | "high" = healthScore >= 75 ? "low" : healthScore >= 55 ? "medium" : "high";
  const accountManager = MANAGERS[rand(s, "mgr", 0, MANAGERS.length - 1)];

  return { students, teachers, parents, activeToday, storageBytes, aiTokens, healthScore, healthTrend, lastBackupAt, renewalAt, churnRisk, accountManager };
}

export function formatBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}
export function formatCompact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function healthColor(score: number) {
  if (score >= 75) return { text: "text-success", bg: "bg-success", ring: "stroke-success", soft: "bg-success/10 text-success border-success/20", label: "Healthy" };
  if (score >= 55) return { text: "text-warning", bg: "bg-warning", ring: "stroke-warning", soft: "bg-warning/10 text-warning border-warning/20", label: "At risk" };
  return { text: "text-destructive", bg: "bg-destructive", ring: "stroke-destructive", soft: "bg-destructive/10 text-destructive border-destructive/20", label: "Critical" };
}

export type TimelineEvent = {
  id: string;
  at: string;
  kind: "registration" | "subscription" | "backup" | "exam" | "users" | "plugin" | "billing" | "ai" | "security";
  title: string;
  detail?: string;
};

export function buildTimeline(school: { id: string; created_at?: string | null; name?: string | null; plan?: string | null }): TimelineEvent[] {
  const s = school.id ?? "x";
  const now = Date.now();
  const events: TimelineEvent[] = [
    { id: "e1", at: new Date(now - rand(s,"t1",1,12) * 3600_000).toISOString(), kind: "ai", title: "AI usage milestone reached", detail: `${formatCompact(rand(s,"t1c",10_000,120_000))} tokens this month` },
    { id: "e2", at: new Date(now - rand(s,"t2",4,36) * 3600_000).toISOString(), kind: "backup", title: "Nightly backup completed", detail: `${formatBytes(rand(s,"t2b",120,900) * 1_048_576)} snapshot` },
    { id: "e3", at: new Date(now - rand(s,"t3",1,4) * 86400_000).toISOString(), kind: "exam", title: "Term examination published", detail: `${rand(s,"t3c",4,18)} papers scheduled` },
    { id: "e4", at: new Date(now - rand(s,"t4",3,10) * 86400_000).toISOString(), kind: "users", title: "New members onboarded", detail: `${rand(s,"t4c",5,60)} students & staff joined` },
    { id: "e5", at: new Date(now - rand(s,"t5",8,20) * 86400_000).toISOString(), kind: "billing", title: "Invoice paid", detail: `Term subscription settled via Paystack` },
    { id: "e6", at: new Date(now - rand(s,"t6",12,25) * 86400_000).toISOString(), kind: "plugin", title: "Plugin installed", detail: "Advanced Bus Tracking activated" },
    { id: "e7", at: new Date(now - rand(s,"t7",20,40) * 86400_000).toISOString(), kind: "subscription", title: `${(school.plan ?? "trial").toString().replace(/^./, c => c.toUpperCase())} plan applied` },
    { id: "e8", at: school.created_at ?? new Date(now - 90 * 86400_000).toISOString(), kind: "registration", title: "School registered", detail: `${school.name ?? "New school"} joined Legacyskool` },
  ];
  return events;
}

export const TIMELINE_META: Record<TimelineEvent["kind"], { color: string; label: string }> = {
  registration: { color: "bg-primary/10 text-primary border-primary/20", label: "Signup" },
  subscription: { color: "bg-info/10 text-info border-info/20", label: "Plan" },
  backup:       { color: "bg-success/10 text-success border-success/20", label: "Backup" },
  exam:         { color: "bg-accent text-accent-foreground border-border", label: "Exam" },
  users:        { color: "bg-primary/10 text-primary border-primary/20", label: "Users" },
  plugin:       { color: "bg-warning/10 text-warning border-warning/20", label: "Plugin" },
  billing:      { color: "bg-success/10 text-success border-success/20", label: "Billing" },
  ai:           { color: "bg-info/10 text-info border-info/20", label: "AI" },
  security:     { color: "bg-destructive/10 text-destructive border-destructive/20", label: "Security" },
};
