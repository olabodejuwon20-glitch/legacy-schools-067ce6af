import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYS = `You are a warm, professional Nigerian secondary-school teacher writing a brief end-of-term report comment.
Rules:
- 2 to 4 sentences, under 80 words.
- Address the student by first name.
- Reference the actual subject(s) and average score when given.
- Acknowledge a clear strength AND one growth area.
- Encouraging tone, never harsh. No emojis. No bullet points.
Return ONLY JSON: {"comment":"..."}`;

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

    const body = await req.json().catch(() => ({}));
    const { student_id, school_id, subject, term } = body ?? {};
    if (!student_id || !school_id) return json({ error: "student_id and school_id required" }, 400);

    const admin = createClient(url, service);
    const { data: roleOk } = await admin.rpc("has_school_role", { _school: school_id, _user: user.id, _role: "teacher" });
    const { data: isAdmin } = await admin.rpc("is_school_admin", { _school: school_id, _user: user.id });
    if (!roleOk && !isAdmin) return json({ error: "Forbidden" }, 403);

    // Tenant-isolate: confirm the target student is actually a member of the caller's school
    // before pulling any profile / attendance data with the service-role client.
    const { data: studentMembership } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", student_id)
      .eq("school_id", school_id)
      .eq("role", "student")
      .eq("status", "active")
      .maybeSingle();
    if (!studentMembership) return json({ error: "Student not found in this school" }, 404);

    const [{ data: profile }, { data: results }, { data: attendance }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", student_id).maybeSingle(),
      admin.from("results").select("subject,score,grade,term").eq("student_id", student_id).eq("school_id", school_id).order("created_at", { ascending: false }).limit(40),
      admin.from("attendance").select("status").eq("student_id", student_id).eq("school_id", school_id).limit(200),
    ]);

    const filtered = (results ?? []).filter((r: any) =>
      (!subject || r.subject === subject) && (!term || r.term === term));
    if (!filtered.length) return json({ error: "No results found for this student" }, 404);

    const bySubject: Record<string, number[]> = {};
    filtered.forEach((r: any) => { (bySubject[r.subject] ||= []).push(Number(r.score)); });
    const summary = Object.entries(bySubject).map(([sub, arr]) =>
      ({ subject: sub, average: Math.round(arr.reduce((a,b)=>a+b,0) / arr.length), count: arr.length }));
    const att = attendance ?? [];
    const present = att.filter((a: any) => a.status === "present").length;
    const attPct = att.length ? Math.round((present / att.length) * 100) : null;
    const firstName = (profile?.full_name ?? "Student").split(" ")[0];

    const userPrompt = `Student: ${firstName}
${term ? `Term: ${term}\n` : ""}${attPct != null ? `Attendance: ${attPct}%\n` : ""}Subject performance:
${summary.map(s => `- ${s.subject}: ${s.average}% (${s.count} entries)`).join("\n")}

Write the comment now.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (r.status === 429) return json({ error: "AI is busy, please try again in a moment." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted. Top up in workspace settings." }, 402);
    if (!r.ok) return json({ error: "AI is temporarily unavailable. Please try again shortly." }, 502);

    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { /* fall through */ }
    const comment = String(parsed?.comment ?? "").trim();
    if (!comment) return json({ error: "AI returned empty comment" }, 502);

    return json({ comment, student: firstName, summary, attendance_pct: attPct });
  } catch (e) {
    console.error("[generate-report-comment] error", e);
    return json({ error: "We couldn't generate the comment. Please try again." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}