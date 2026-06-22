import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const school_id = body?.school_id as string | undefined;
    if (!school_id) return json({ error: "school_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc("is_school_admin", { _school_id: school_id, _user_id: u.user.id });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const { data: rows } = await admin
      .from("attendance")
      .select("student_id,status,date")
      .eq("school_id", school_id)
      .gte("date", since);

    const absences = new Map<string, number>();
    (rows ?? []).forEach((r: any) => {
      if (r.status === "absent") absences.set(r.student_id, (absences.get(r.student_id) ?? 0) + 1);
    });

    const flagged = [...absences.entries()].filter(([, c]) => c >= 3).map(([sid, c]) => ({ sid, c }));
    if (!flagged.length) return json({ created: 0, scanned: rows?.length ?? 0 });

    const { data: links } = await admin
      .from("parent_links")
      .select("parent_user_id,student_user_id")
      .eq("school_id", school_id)
      .eq("receives_attendance", true)
      .in("student_user_id", flagged.map((f) => f.sid));

    const weekKey = since;
    const alerts = (links ?? []).map((l: any) => {
      const count = absences.get(l.student_user_id) ?? 0;
      return {
        school_id,
        student_id: l.student_user_id,
        parent_id: l.parent_user_id,
        kind: "attendance",
        severity: count >= 5 ? "high" : "warn",
        signal: { absences_14d: count },
        draft_message: `Your ward has ${count} recorded absences in the last 14 days. Please contact the school if needed.`,
        status: "pending",
        dedupe_key: `att:${l.student_user_id}:${weekKey}`,
      };
    });

    if (!alerts.length) return json({ created: 0, flagged: flagged.length });
    const { error, count } = await admin.from("parent_alerts").upsert(alerts, { onConflict: "school_id,dedupe_key", ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.error("[parent-alerts-scan] upsert_failed", error);
      return json({ error: "We couldn't scan parent alerts. Please try again." }, 500);
    }
    return json({ created: count ?? alerts.length, flagged: flagged.length });
  } catch (e) {
    console.error("[parent-alerts-scan] error", e);
    return json({ error: "We couldn't scan parent alerts. Please try again." }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}