import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const THRESHOLDS = [30, 14, 7, 3, 1];

function bodyFor(days: number, schoolName: string) {
  if (days === 1) return `Your 60-Day Pilot Program for ${schoolName} expires tomorrow. Upgrade now to keep adding new records and unlock premium features.`;
  return `Your 60-Day Pilot Program for ${schoolName} has ${days} day${days === 1 ? "" : "s"} remaining. Upgrade before it ends and lock in 20% off your first annual term.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    // 1. Expire any past-due pilots
    const { data: expired } = await admin
      .from("schools")
      .update({ pilot_status: "expired" })
      .lte("pilot_ends_at", new Date().toISOString())
      .eq("pilot_status", "active")
      .select("id, name");

    let expiredAnnounced = 0;
    for (const s of expired ?? []) {
      await admin.from("platform_announcements").insert({
        title: "Your 60-Day Pilot Program has ended",
        body: `The pilot for ${s.name} has expired. Your data is preserved and read-only. Upgrade to resume creating new students, classes, exams and attendance.`,
        priority: "high",
        audience: "admins",
        target: { school_id: s.id },
      });
      expiredAnnounced++;
    }

    // 2. Active pilots — send threshold alerts
    const { data: active } = await admin
      .from("schools")
      .select("id, name, pilot_ends_at, pilot_alerts_sent")
      .eq("pilot_status", "active")
      .not("pilot_ends_at", "is", null);

    let alertsSent = 0;
    for (const s of active ?? []) {
      const days = Math.max(0, Math.ceil((new Date(s.pilot_ends_at).getTime() - Date.now()) / 86400_000));
      const sent = (s.pilot_alerts_sent as Record<string, string>) ?? {};
      for (const t of THRESHOLDS) {
        if (days <= t && !sent[String(t)]) {
          await admin.from("platform_announcements").insert({
            title: `Pilot program · ${t} day${t === 1 ? "" : "s"} remaining`,
            body: bodyFor(t, s.name),
            priority: t <= 7 ? "high" : "normal",
            audience: "admins",
            target: { school_id: s.id },
          });
          sent[String(t)] = new Date().toISOString();
          alertsSent++;
        }
      }
      await admin.from("schools").update({ pilot_alerts_sent: sent }).eq("id", s.id);
    }

    return json({ ok: true, expired: expired?.length ?? 0, expired_announced: expiredAnnounced, alerts_sent: alertsSent });
  } catch (e) {
    console.error("[pilot-alerts-scan]", e);
    return json({ error: String(e) }, 500);
  }
});