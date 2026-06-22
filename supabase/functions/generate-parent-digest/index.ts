import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYS = `You write a warm, factual weekly summary for a parent about their child's school week.
Rules:
- Write in plain markdown (use ## headings and short bullet lists).
- 120-200 words total.
- Sections: "This week at a glance", "Wins", "Watch-outs" (only if there is something), "Coming up" (only if there are upcoming events).
- Never invent facts. Only use the data provided.
- Address the parent as "you" and the child by first name.
- No emojis.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    const user = u?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { student_id, school_id } = await req.json().catch(() => ({}));
    if (!student_id || !school_id) return json({ error: "student_id and school_id required" }, 400);

    const admin = createClient(url, service);
    // Verify parent is linked to this student
    const { data: link } = await admin
      .from("parent_links")
      .select("student_user_id")
      .eq("school_id", school_id)
      .eq("parent_user_id", user.id)
      .eq("student_user_id", student_id)
      .maybeSingle();
    if (!link) return json({ error: "Forbidden" }, 403);

    const sinceISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const upcomingISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: profile }, { data: results }, { data: attendance }, { data: behavior }, { data: upcoming }, { data: fees }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", student_id).maybeSingle(),
      admin.from("results").select("subject,score,grade,created_at").eq("student_id", student_id).eq("school_id", school_id).gte("created_at", sinceISO).order("created_at", { ascending: false }).limit(20),
      admin.from("attendance").select("status,date").eq("student_id", student_id).gte("date", sinceISO.slice(0,10)).limit(50),
      admin.from("behavior_notes").select("note,type,created_at").eq("student_id", student_id).gte("created_at", sinceISO).limit(20),
      admin.from("exams").select("title,subject,scheduled_at").eq("school_id", school_id).gte("scheduled_at", new Date().toISOString()).lte("scheduled_at", upcomingISO).order("scheduled_at").limit(10),
      admin.from("fees").select("amount,status").eq("student_id", student_id).neq("status","paid"),
    ]);

    const firstName = (profile?.full_name ?? "Your child").split(" ")[0];
    const att = attendance ?? [];
    const present = att.filter((a: any) => a.status === "present").length;
    const absent = att.filter((a: any) => a.status === "absent").length;
    const late = att.filter((a: any) => a.status === "late").length;
    const outstanding = (fees ?? []).reduce((s: number, f: any) => s + Number(f.amount || 0), 0);

    const facts = {
      student: firstName,
      week_window: "last 7 days",
      attendance: { present, absent, late, total: att.length },
      new_results: (results ?? []).map((r: any) => ({ subject: r.subject, score: Math.round(Number(r.score)), grade: r.grade })),
      behavior_notes: (behavior ?? []).map((b: any) => ({ type: b.type, note: b.note })),
      upcoming_events: (upcoming ?? []).map((e: any) => ({ title: e.title, subject: e.subject, when: e.scheduled_at })),
      outstanding_fees_naira: outstanding,
    };

    const userPrompt = `Facts for the digest (JSON):\n${JSON.stringify(facts, null, 2)}\n\nWrite the markdown digest now.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "AI is busy, please try again shortly." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!r.ok) return json({ error: "AI is temporarily unavailable. Please try again shortly." }, 502);

    const data = await r.json();
    const digest = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!digest) return json({ error: "AI returned empty digest" }, 502);

    return json({ digest, facts });
  } catch (e) {
    console.error("[generate-parent-digest] error", e);
    return json({ error: "We couldn't generate the digest. Please try again." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}