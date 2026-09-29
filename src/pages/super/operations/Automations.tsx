import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Section, Skel, EmptyState, MetricCard } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Sparkles, Clock, CheckCircle2, Trash2, Rocket, Bell, Radio, BrainCircuit, Workflow, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { superAction, timeAgo } from "@/lib/super";

type JobSpec = {
  key: string;
  name: string;
  schedule: string;
  kind: "RPC" | "Edge Function";
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const JOBS: JobSpec[] = [
  {
    key: "trash_and_errors_maintenance",
    name: "30-Day Trash & Error Retention Purge",
    schedule: "Daily · 02:00 UTC",
    kind: "RPC",
    description: "Permanently purges soft-deleted records older than 30 days and prunes resolved client_errors.",
    icon: Trash2,
  },
  {
    key: "pilot-alerts-scan",
    name: "Pilot Expiry & Conversion Scanner",
    schedule: "Daily · 07:00 UTC",
    kind: "Edge Function",
    description: "Scans active school pilots ending within 7 days and flags overdue trials for follow-up.",
    icon: Rocket,
  },
  {
    key: "parent-alerts-scan",
    name: "Parent Attendance & Fee Digest Scanner",
    schedule: "Weekdays · 16:00 WAT",
    kind: "Edge Function",
    description: "Dispatches automated absence alerts and term fee reminders to parents across active schools.",
    icon: Bell,
  },
  {
    key: "broadcast-dispatch",
    name: "Broadcast Queue Dispatcher",
    schedule: "Every 5 mins",
    kind: "Edge Function",
    description: "Drains queued platform and school broadcast_jobs in rate-limited batches.",
    icon: Radio,
  },
  {
    key: "super-daily-intel",
    name: "Super Admin Daily Intelligence Digest",
    schedule: "Daily · 06:30 WAT",
    kind: "Edge Function",
    description: "Computes 24h signups, NGN collections, error spikes, and churn signals for platform leadership.",
    icon: BrainCircuit,
  },
  {
    key: "automation-runner",
    name: "Tenant Workflow Automation Runner",
    schedule: "Hourly",
    kind: "Edge Function",
    description: "Evaluates school-defined automation rules (fee follow-ups, grading nudges, escalation triggers).",
    icon: Workflow,
  },
];

type AuditRun = {
  id: string;
  action: string;
  actor: string;
  payload: { job_key?: string; duration_ms?: number; summary?: Record<string, unknown> } | null;
  created_at: string;
};

export default function OperationsAutomations() {
  const [runs, setRuns] = useState<AuditRun[] | null>(null);
  const [runningKey, setRunningKey] = useState<string | null>(null);

  async function loadRuns() {
    const { data } = await supabase
      .from("platform_audit")
      .select("id, action, actor, payload, created_at")
      .in("action", ["run_platform_automation", "run_trash_maintenance"])
      .order("created_at", { ascending: false })
      .limit(30);
    setRuns((data as AuditRun[]) ?? []);
  }

  useEffect(() => { void loadRuns(); }, []);

  async function triggerJob(job: JobSpec) {
    setRunningKey(job.key);
    try {
      const res = await superAction<{ duration_ms?: number }>("run_platform_automation", { job_key: job.key });
      toast.success(`Executed ${job.name}${res?.duration_ms ? ` in ${res.duration_ms}ms` : ""}`);
      await loadRuns();
    } catch {
      /* superAction toasts */
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Registered Jobs" value={JOBS.length} icon={<Sparkles className="size-4 text-info" />} />
        <MetricCard label="Recent Manual / Logged Runs" value={runs?.length ?? "—"} icon={<CheckCircle2 className="size-4 text-success" />} />
        <MetricCard
          label="Last Execution"
          value={runs && runs.length > 0 ? timeAgo(runs[0].created_at) : "None yet"}
          icon={<Clock className="size-4" />}
        />
      </div>

      <Section
        title="Platform Scheduled Jobs & Runners"
        description="Trigger any background maintenance job or edge scanner on demand. Every manual execution is recorded in the platform audit trail."
        actions={
          <Button size="sm" variant="outline" onClick={() => void loadRuns()}>
            <RefreshCw className="size-3.5 mr-1.5" />Refresh history
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {JOBS.map(job => {
            const Icon = job.icon;
            const isRunning = runningKey === job.key;
            const lastRun = (runs ?? []).find(r =>
              r.payload?.job_key === job.key || (job.key === "trash_and_errors_maintenance" && r.action === "run_trash_maintenance")
            );
            return (
              <div key={job.key} className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-muted grid place-items-center text-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{job.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{job.key}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{job.kind}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{job.description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">{job.schedule}</span>
                    {lastRun && <span className="ml-2">· Last run {timeAgo(lastRun.created_at)}</span>}
                  </div>
                  <Button size="sm" className="h-7 text-xs" disabled={!!runningKey} onClick={() => void triggerJob(job)}>
                    <Play className="size-3 mr-1" />
                    {isRunning ? "Running…" : "Run now"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Recent Automation Execution Log" description="Live audit trail of manual and system-triggered maintenance runs.">
        {!runs ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-9" />)}</div>
        ) : runs.length === 0 ? (
          <EmptyState icon={<Clock className="size-5 text-muted-foreground" />} title="No runs logged yet" description="Click 'Run now' on any job above to execute and record a run." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Result Summary</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(r => {
                  const jobKey = r.payload?.job_key ?? (r.action === "run_trash_maintenance" ? "trash_and_errors_maintenance" : r.action);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">{jobKey}</TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {r.payload?.duration_ms !== undefined ? `${r.payload.duration_ms}ms` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground max-w-md truncate">
                        {r.payload?.summary ? JSON.stringify(r.payload.summary) : "ok"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
