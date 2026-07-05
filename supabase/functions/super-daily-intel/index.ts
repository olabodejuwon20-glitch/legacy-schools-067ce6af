// Super Admin AI Daily Intelligence briefing.
// Gathers platform signals and asks the AI Gateway for a structured JSON report:
// { summary, progress[], problems[], solutions[] } — each item links to a
// super-admin area so the user can jump straight to it from the dashboard.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return j({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user: user.id });
    if (!isSuper) return j({ error: "forbidden" }, 403);

    // ---- Gather platform signals (last 24h & rolling) ----
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString();

    const [
      schoolsAll, schoolsActive, schoolsNew,
      subsActive, trialsExpiring,
      errorsOpen, errorsNew,
      tickets, appeals, violations,
      aiJobs, invoicesPaid,
    ] = await Promise.all([
      admin.from("schools").select("id", { count: "exact", head: true }),
      admin.from("schools").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("schools").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("schools").select("id,name,plan_expires_at").eq("status", "trial").lte("plan_expires_at", soon).order("plan_expires_at", { ascending: true }).limit(5),
      admin.from("client_errors").select("id", { count: "exact", head: true }).eq("resolution_status", "open"),
      admin.from("client_errors").select("id,message,route,created_at").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(5),
      admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin.from("exam_appeals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("assessment_violations_v2").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
      admin.from("ai_jobs").select("total_tokens,cost_usd,status").gte("created_at", dayAgo),
      admin.from("school_invoices").select("amount_cents").eq("status", "paid").gte("paid_at", weekAgo),
    ]);

    const aiTokens = (aiJobs.data ?? []).reduce((s: number, r: any) => s + (r.total_tokens ?? 0), 0);
    const aiCost = (aiJobs.data ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);
    const aiErrors = (aiJobs.data ?? []).filter((r: any) => r.status === "error").length;
    const revenueWeek = (invoicesPaid.data ?? []).reduce((s: number, r: any) => s + (r.amount_cents ?? 0), 0);

    const signals = {
      generated_at: now.toISOString(),
      schools_total: schoolsAll.count ?? 0,
      schools_active: schoolsActive.count ?? 0,
      schools_new_7d: schoolsNew.count ?? 0,
      subscriptions_active: subsActive.count ?? 0,
      trials_expiring_7d: trialsExpiring.data ?? [],
      errors_open: errorsOpen.count ?? 0,
      errors_new_24h: errorsNew.data ?? [],
      support_tickets_open: tickets.count ?? 0,
      appeals_pending: appeals.count ?? 0,
      proctor_violations_24h: violations.count ?? 0,
      ai_tokens_24h: aiTokens,
      ai_cost_usd_24h: Number(aiCost.toFixed(4)),
      ai_errors_24h: aiErrors,
      revenue_cents_7d: revenueWeek,
    };

    // Areas the AI may link items to (kept in sync with SuperLayout NAV).
    const AREAS = [
      { key: "schools", path: "/super/schools", desc: "Tenant/school list, health & details" },
      { key: "subscriptions", path: "/super/subscriptions", desc: "Subscription lifecycle, renewals" },
      { key: "business", path: "/super/business", desc: "MRR, revenue, growth" },
      { key: "operations", path: "/super/operations", desc: "Live errors, system health" },
      { key: "intelligence", path: "/super/intelligence", desc: "Analytics, AI usage, content quality" },
      { key: "security", path: "/super/security", desc: "Security center & audit" },
      { key: "users", path: "/super/users", desc: "Users & roles" },
      { key: "products", path: "/super/products", desc: "Modules & product catalog" },
    ];

    const sys = `You are the Chief-of-Staff AI for a school-OS platform's Super Admin.
Return a concise, executive daily briefing. Be specific, use the numbers provided, no fluff.
Respond ONLY as strict JSON matching this TypeScript type:
{
  "summary": string,               // 1-2 sentence headline of the day
  "progress": Array<{ title: string; detail: string; area: string; path: string }>,   // 2-4 wins
  "problems": Array<{ title: string; detail: string; severity: "low"|"medium"|"high"; area: string; path: string }>, // 2-4 risks
  "solutions": Array<{ title: string; detail: string; action: string; area: string; path: string }>  // 2-4 recommended next actions
}
"path" MUST be one of the AREAS below so the UI can deep-link. Never invent paths.
AREAS: ${JSON.stringify(AREAS)}`;

    const user_msg = `Signals:\n${JSON.stringify(signals, null, 2)}`;

    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user_msg },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      if (r.status === 429) return j({ error: "AI rate limit reached — try again shortly." }, 429);
      if (r.status === 402) return j({ error: "AI credits exhausted — top up in workspace billing." }, 402);
      return j({ error: "AI gateway error", detail: t.slice(0, 300) }, 502);
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let report: any = {};
    try { report = JSON.parse(raw); } catch { report = { summary: raw }; }

    return j({ signals, report, model: MODEL });
  } catch (e: any) {
    return j({ error: e?.message ?? "Internal error" }, 500);
  }
});