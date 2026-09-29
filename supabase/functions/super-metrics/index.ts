import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  const admin = createClient(url, service);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user: userRes.user.id });
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "super_admin").maybeSingle();
  if (!isSuper && !roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [schools, users, subs, mods, tickets, audits, invoices, aiQuotas, errors24h] = await Promise.all([
    admin.from("schools").select("id,name,slug,logo_url,plan,status,plan_expires_at,created_at"),
    admin.from("memberships").select("user_id,role,school_id,created_at"),
    admin.from("subscriptions").select("plan,status,monthly_amount_cents,started_at,current_period_end"),
    admin.from("school_modules").select("module_id,school_id,enabled"),
    admin.from("support_tickets").select("id,status,priority,subject,created_at"),
    admin.from("platform_audit").select("id,action,created_at,actor,school_id").order("created_at", { ascending: false }).limit(20),
    admin.from("invoices").select("id,school_id,amount_cents,amount_kobo,status,issued_at,paid_at"),
    admin.from("school_ai_quotas").select("school_id,monthly_token_cap,monthly_cost_cap_usd,tokens_used,cost_used_usd,enabled"),
    admin.from("client_errors").select("id,resolution_status").gte("created_at", since24h),
  ]);

  const schoolsList = schools.data ?? [];
  const membersList = users.data ?? [];
  const subsList = subs.data ?? [];
  const ticketsList = tickets.data ?? [];
  const modsList = mods.data ?? [];
  const invoicesList = invoices.data ?? [];
  const quotasList = aiQuotas.data ?? [];
  const errsList = errors24h.data ?? [];

  const uniqUsers = new Set(membersList.map((m: any) => m.user_id)).size;
  const studentsCount = membersList.filter((m: any) => m.role === "student").length;
  const teachersCount = membersList.filter((m: any) => m.role === "teacher").length;
  const parentsCount = membersList.filter((m: any) => m.role === "parent").length;
  const adminsCount = membersList.filter((m: any) => m.role === "admin").length;

  // Monthly revenue from active subscriptions + paid invoices in last 30d
  const subMrr = subsList.filter((s: any) => s.status === "active").reduce((sum: number, s: any) => sum + (s.monthly_amount_cents ?? 0), 0);
  const since30d = Date.now() - 30 * 86400_000;
  const paidInv30d = invoicesList
    .filter((inv: any) => inv.status === "paid" && inv.paid_at && new Date(inv.paid_at).getTime() >= since30d)
    .reduce((sum: number, inv: any) => sum + Number(inv.amount_cents ?? inv.amount_kobo ?? 0), 0);
  const mrr = subMrr || paidInv30d;

  const now = new Date();
  const schoolsThisMonth = schoolsList.filter((s: any) => {
    const c = new Date(s.created_at);
    return c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth();
  }).length;

  // Real 12-month growth and paid revenue buckets
  const months: { label: string; schools: number; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en", { month: "short" });
    const count = schoolsList.filter((s: any) => {
      const c = new Date(s.created_at);
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
    }).length;
    const paidInMonth = invoicesList
      .filter((inv: any) => {
        if (inv.status !== "paid" || !inv.paid_at) return false;
        const p = new Date(inv.paid_at);
        return p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth();
      })
      .reduce((sum: number, inv: any) => sum + Math.round(Number(inv.amount_cents ?? inv.amount_kobo ?? 0) / 100), 0);
    months.push({ label, schools: count, revenue: paidInMonth });
  }

  const moduleUsage: Record<string, number> = {};
  modsList.filter((m: any) => m.enabled).forEach((m: any) => {
    moduleUsage[m.module_id] = (moduleUsage[m.module_id] ?? 0) + 1;
  });

  const expiring = schoolsList
    .filter((s: any) => s.plan_expires_at)
    .map((s: any) => ({ ...s, days: Math.ceil((new Date(s.plan_expires_at).getTime() - Date.now()) / 86400000) }))
    .filter((s: any) => s.days <= 30)
    .sort((a: any, b: any) => a.days - b.days)
    .slice(0, 6);

  // Per-school member counts for leaderboard
  const membersBySchool: Record<string, number> = {};
  membersList.forEach((m: any) => {
    if (m.school_id) membersBySchool[m.school_id] = (membersBySchool[m.school_id] ?? 0) + 1;
  });

  const recentSchools = [...schoolsList]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)
    .map((s: any) => ({ ...s, member_count: membersBySchool[s.id] ?? 0 }));

  const tokensMonth = quotasList.reduce((sum: number, q: any) => sum + Number(q.tokens_used ?? 0), 0);
  const tokensCap = quotasList.reduce((sum: number, q: any) => sum + Number(q.monthly_token_cap ?? 0), 0);
  const spendCents = Math.round(quotasList.reduce((sum: number, q: any) => sum + Number(q.cost_used_usd ?? 0), 0) * 100);
  const openErrors24h = errsList.filter((e: any) => e.resolution_status !== "resolved").length;

  return new Response(JSON.stringify({
    kpi: {
      total_schools: schoolsList.length,
      active_schools: schoolsList.filter((s: any) => s.status === "active").length,
      schools_this_month: schoolsThisMonth,
      total_users: uniqUsers,
      students_count: studentsCount,
      teachers_count: teachersCount,
      parents_count: parentsCount,
      admins_count: adminsCount,
      mrr_cents: mrr,
      active_subscriptions: subsList.filter((s: any) => s.status === "active").length,
      installed_modules: modsList.filter((m: any) => m.enabled).length,
      open_tickets: ticketsList.filter((t: any) => t.status !== "resolved" && t.status !== "closed").length,
      critical_tickets: ticketsList.filter((t: any) => t.priority === "critical" && t.status !== "resolved").length,
      open_errors_24h: openErrors24h,
    },
    ai_usage: {
      tokens_month: tokensMonth,
      cap: tokensCap,
      spend_cents: spendCents,
    },
    growth: months,
    module_usage: moduleUsage,
    expiring,
    recent_schools: recentSchools,
    recent_audit: audits.data ?? [],
    recent_tickets: ticketsList.slice(0, 5),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});