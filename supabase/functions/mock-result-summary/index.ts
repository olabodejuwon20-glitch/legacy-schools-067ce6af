import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) return json({ error: "AI analysis is temporarily unavailable. Please try again later." }, 500);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { session_id } = await req.json();
    if (!session_id) return json({ error: "session_id required" }, 400);

    const { data: session, error: sErr } = await admin.from("mock_sessions")
      .select("*").eq("id", session_id).maybeSingle();
    if (sErr || !session) return json({ error: "Session not found" }, 404);
    if (session.student_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (!session.submitted_at) return json({ error: "Session not submitted" }, 400);

    // Return cached summary if present (older cached payloads lack per_topic — recompute those)
    if (session.ai_summary && Array.isArray((session.ai_summary as any).per_topic)) {
      return json(session.ai_summary);
    }
    const cached = session.ai_summary as any | null;

    const [{ data: subs }, { data: answers }] = await Promise.all([
      admin.from("mock_session_subjects").select("subject_id,score,answered_count").eq("session_id", session_id),
      admin.from("mock_answers").select("question_id,subject_id,selected_index").eq("session_id", session_id),
    ]);
    const subjectIds = (subs ?? []).map((s: any) => s.subject_id);
    const { data: subjects } = await admin.from("mock_subjects")
      .select("id,name,code,color").in("id", subjectIds.length ? subjectIds : ["00000000-0000-0000-0000-000000000000"]);
    const subjMap = Object.fromEntries((subjects ?? []).map((s: any) => [s.id, s]));

    const perSubject = (subs ?? []).map((s: any) => {
      const meta = subjMap[s.subject_id] || {};
      const total = 20; // bank default
      const pct = total ? Math.round(((s.score ?? 0) / total) * 100) : 0;
      return { id: s.subject_id, name: meta.name ?? "Subject", code: meta.code, color: meta.color, score: s.score ?? 0, total, percentage: pct, answered: s.answered_count ?? 0 };
    }).sort((a: any, b: any) => b.percentage - a.percentage);

    const totalQ = session.total_questions ?? perSubject.reduce((a, b) => a + b.total, 0);
    const totalScore = session.total_score ?? perSubject.reduce((a, b) => a + b.score, 0);
    const overallPct = totalQ ? Math.round((totalScore / totalQ) * 100) : 0;
    const modeLabel = session.mode === "jamb_sim" ? "JAMB" : "NECO";
    const jambProjection = session.mode === "jamb_sim" ? Math.round(overallPct * 4) : null;

    const prompt = `You are an encouraging Nigerian exam coach. A student just finished a ${modeLabel} CBT mock.

Overall: ${totalScore}/${totalQ} (${overallPct}%)
${jambProjection !== null ? `Projected JAMB score: ${jambProjection}/400` : ""}

Per-subject results:
${perSubject.map((s) => `- ${s.name}: ${s.score}/${s.total} (${s.percentage}%)`).join("\n")}

Write a personalised result analysis in markdown with these sections:
## Overall Performance
(2-3 sentences, encouraging but honest)
## Strengths
(bullet list of strongest 2-3 subjects with brief praise)
## Areas to Improve
(bullet list of weakest 2-3 subjects with one specific study tip each)
## Next Steps
(3 concrete actions for the next week — be specific, mention practice questions, library topics, AI tutor)

Keep it warm, motivating, and under 400 words. Avoid generic platitudes.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a supportive exam coach who writes well-structured, motivating feedback in markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (aiRes.status === 429) return json({ error: "Rate limited, try again shortly" }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[mock-result-summary] AI error", aiRes.status, txt);
      return json({ error: "AI request failed" }, 500);
    }
    const aiJson = await aiRes.json();
    const markdown = aiJson?.choices?.[0]?.message?.content ?? "No analysis available.";

    const payload = {
      mode: session.mode,
      total_score: totalScore,
      total_questions: totalQ,
      percentage: overallPct,
      jamb_projection: jambProjection,
      per_subject: perSubject,
      markdown,
      generated_at: new Date().toISOString(),
    };

    await admin.from("mock_sessions").update({ ai_summary: payload }).eq("id", session_id);
    return json(payload);
  } catch (e) {
    console.error("[mock-result-summary] error", e);
    return json({ error: "An internal error occurred" }, 500);
  }
});