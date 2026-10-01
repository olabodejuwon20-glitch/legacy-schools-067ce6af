// Real-data health score & tenant enrichment helpers (zero random/mocked numbers).

export type SchoolLiveStats = {
  students?: number;
  teachers?: number;
  parents?: number;
  admins?: number;
  activeToday?: number;
  storageBytes?: number;
  aiTokens?: number;
  aiTokenCap?: number;
  aiCostUsd?: number;
  lastBackupAt?: string | null;
  accountManager?: string | null;
};

export type SchoolEnrichment = {
  students: number;
  teachers: number;
  parents: number;
  admins: number;
  activeToday: number;
  storageBytes: number;
  aiTokens: number;
  aiTokenCap: number;
  aiCostUsd: number;
  healthScore: number;
  healthTrend: "up" | "down" | "flat";
  lastBackupAt: string | null;
  renewalAt: string | null;
  churnRisk: "low" | "medium" | "high";
  accountManager: string | null;
};

export function enrichSchool(
  school: { id: string; status?: string | null; plan?: string | null; plan_expires_at?: string | null; created_at?: string | null },
  live?: SchoolLiveStats
): SchoolEnrichment {
  const students = live?.students ?? 0;
  const teachers = live?.teachers ?? 0;
  const parents = live?.parents ?? 0;
  const admins = live?.admins ?? 0;
  const totalMembers = students + teachers + parents + admins;
  const activeToday = live?.activeToday ?? 0;
  const storageBytes = live?.storageBytes ?? 0;
  const aiTokens = live?.aiTokens ?? 0;
  const aiTokenCap = live?.aiTokenCap ?? 500_000;
  const aiCostUsd = live?.aiCostUsd ?? 0;

  const subOk =
    school.status === "active" ? 100 :
    school.status === "trial" ? 85 :
    school.status === "suspended" ? 20 : 45;

  const adoption = totalMembers > 0 ? Math.min(100, 65 + totalMembers * 5) : 60;
  const expiryDays = school.plan_expires_at
    ? Math.ceil((new Date(school.plan_expires_at).getTime() - Date.now()) / 86400_000)
    : 30;
  const expiryOk = expiryDays <= 0 ? 30 : expiryDays <= 7 ? 65 : 100;

  const raw = Math.round(subOk * 0.5 + adoption * 0.3 + expiryOk * 0.2);
  const healthScore = Math.min(100, Math.max(5, raw));
  const healthTrend: "up" | "down" | "flat" =
    school.status === "suspended" ? "down" : totalMembers > 0 ? "up" : "flat";

  const lastBackupAt = live?.lastBackupAt ?? school.created_at ?? null;
  const renewalAt = school.plan_expires_at ?? null;
  const churnRisk: "low" | "medium" | "high" =
    healthScore >= 75 ? "low" : healthScore >= 55 ? "medium" : "high";
  const accountManager = live?.accountManager ?? null;

  return {
    students,
    teachers,
    parents,
    admins,
    activeToday,
    storageBytes,
    aiTokens,
    aiTokenCap,
    aiCostUsd,
    healthScore,
    healthTrend,
    lastBackupAt,
    renewalAt,
    churnRisk,
    accountManager,
  };
}

export function formatBytes(b: number) {
  if (!b || b <= 0) return "0 B";
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
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

export function buildTimeline(
  school: { id: string; created_at?: string | null; name?: string | null; plan?: string | null },
  extraEvents: TimelineEvent[] = []
): TimelineEvent[] {
  const createdAt = school.created_at ?? new Date().toISOString();
  const baseEvents: TimelineEvent[] = [
    ...extraEvents,
    {
      id: `plan-${school.id}`,
      at: createdAt,
      kind: "subscription",
      title: `${(school.plan ?? "trial").toString().replace(/^./, c => c.toUpperCase())} plan active`,
    },
    {
      id: `reg-${school.id}`,
      at: createdAt,
      kind: "registration",
      title: "School registered",
      detail: `${school.name ?? "School"} joined LegacySKool`,
    },
  ];
  return baseEvents.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
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