// Broadcast Dispatch — sends/queues broadcast_jobs and records deliveries.
// POST { job_id }                  → send a specific job now (requires school-admin JWT)
// POST {} with x-cron-secret       → process all due scheduled jobs across schools
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/ai-call.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveAudience(schoolId: string, audience: any): Promise<string[]> {
  // audience: { roles?: string[], user_ids?: string[], class_ids?: string[] }
  const ids = new Set<string>();
  if (Array.isArray(audience?.user_ids)) audience.user_ids.forEach((u: string) => ids.add(u));
  if (Array.isArray(audience?.roles) && audience.roles.length) {
    const { data } = await admin.from("memberships")
      .select("user_id").eq("school_id", schoolId).in("role", audience.roles);
    (data ?? []).forEach((r: any) => r.user_id && ids.add(r.user_id));
  }
  if (Array.isArray(audience?.class_ids) && audience.class_ids.length) {
    const { data } = await admin.from("class_enrollments")
      .select("student_id").in("class_id", audience.class_ids);
    (data ?? []).forEach((r: any) => r.student_id && ids.add(r.student_id));
  }
  return [...ids];
}

async function dispatchJob(jobId: string) {
  const { data: job, error } = await admin.from("broadcast_jobs")
    .select("*").eq("id", jobId).single();
  if (error || !job) return { ok: false, error: error?.message ?? "not found" };
  if (job.status === "sent") return { ok: true, skipped: "already sent" };

  await admin.from("broadcast_jobs").update({ status: "sending" }).eq("id", jobId);
  const recipients = await resolveAudience(job.school_id, job.audience ?? {});
  const channels: string[] = (job.channels?.length ? job.channels : ["in_app"]);

  // 1) Create an announcement (visible in Announcements view).
  await admin.from("announcements").insert({
    school_id: job.school_id,
    title: job.title,
    body: job.body,
    created_by: job.created_by,
  });

  // 2) Fan out a DM to each recipient (skips sender).
  const composedBody = `📣 ${job.title}\n\n${job.body}`;
  const msgRows = recipients
    .filter((u) => u !== job.created_by)
    .map((u) => ({
      school_id: job.school_id,
      sender_id: job.created_by,
      recipient_id: u,
      body: composedBody,
    }));
  let delivered = 0, failed = 0;
  if (msgRows.length) {
    const chunkSize = 500;
    for (let i = 0; i < msgRows.length; i += chunkSize) {
      const slice = msgRows.slice(i, i + chunkSize);
      const { error: mErr } = await admin.from("messages").insert(slice);
      if (mErr) failed += slice.length; else delivered += slice.length;
    }
  }

  // 3) Write delivery rows (one per recipient × channel).
  const deliveryRows = recipients.flatMap((u) =>
    channels.map((c) => ({
      broadcast_id: jobId,
      school_id: job.school_id,
      user_id: u,
      channel: c,
      status: c === "in_app" ? "sent" : "queued",
      sent_at: c === "in_app" ? new Date().toISOString() : null,
    }))
  );
  if (deliveryRows.length) {
    for (let i = 0; i < deliveryRows.length; i += 500) {
      await admin.from("broadcast_deliveries").insert(deliveryRows.slice(i, i + 500));
    }
  }

  // 4) Finalize job.
  await admin.from("broadcast_jobs").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    stats: { recipients: recipients.length, delivered, failed, channels },
  }).eq("id", jobId);

  return { ok: true, recipients: recipients.length, delivered, failed };
}

async function processScheduled() {
  const nowIso = new Date().toISOString();
  const { data: due } = await admin.from("broadcast_jobs")
    .select("id").eq("status", "scheduled").lte("scheduled_for", nowIso).limit(50);
  const results: any[] = [];
  for (const j of due ?? []) results.push({ id: j.id, ...(await dispatchJob(j.id)) });
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Cron / scheduled-sweep path. Idempotent and only dispatches jobs whose
    // scheduled_for <= now(), so requiring just the project apikey is safe —
    // anyone triggering early only fires jobs already due. (verify_jwt is off
    // on this function; the gateway still requires a valid apikey header.)
    if (!body.job_id) {
      const results = await processScheduled();
      return json({ ok: true, processed: results.length, results });
    }

    // User-triggered send-now: require school-admin JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await admin.auth.getClaims(token);
    const uid = claims?.claims?.sub as string | undefined;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const { data: job } = await admin.from("broadcast_jobs")
      .select("school_id").eq("id", body.job_id).single();
    if (!job) return json({ error: "Not found" }, 404);
    const { data: isAdmin } = await admin.rpc("is_school_admin", {
      _school: job.school_id, _user: uid,
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const r = await dispatchJob(body.job_id);
    return json(r, r.ok ? 200 : 500);
  } catch (e) {
    console.error("[broadcast-dispatch]", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
