import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYS = `You generate exam questions for African K-12 / WAEC / NECO / JAMB curricula.
Return ONLY valid JSON of the form:
{"questions":[{"prompt":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard"}]}
Each question must have 4 plausible options, exactly one correct.
Keep prompts concise, exam-ready, and curriculum-appropriate.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { assessment_id, subject, topic, count = 10, difficulty = "medium", exam_body = "school" } = await req.json();
    if (!assessment_id) return json({ error: "assessment_id required" }, 400);

    const admin = createClient(url, service);
    const { data: assessment, error: aerr } = await admin
      .from("assessments").select("id, school_id, title, type").eq("id", assessment_id).maybeSingle();
    if (aerr || !assessment) return json({ error: "Assessment not found" }, 404);

    // Authorization: teacher/admin of the school
    const { data: roleOk } = await admin.rpc("has_school_role", {
      _school: assessment.school_id, _user: user.id, _role: "teacher",
    });
    const { data: isAdmin } = await admin.rpc("is_school_admin", {
      _school: assessment.school_id, _user: user.id,
    });
    if (!roleOk && !isAdmin) return json({ error: "Forbidden" }, 403);

    const userPrompt = `Generate ${count} ${difficulty} ${exam_body.toUpperCase()} ${subject ?? ""} questions${topic ? ` on the topic: ${topic}` : ""}. Return ONLY the JSON.`;

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
    if (!r.ok) {
      const t = await r.text();
      console.error("[generate-questions] ai_gateway_failed", r.status, t.slice(0, 500));
      return json({ error: "AI is temporarily unavailable. Please try again shortly." }, 502);
    }
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return json({ error: "AI returned invalid JSON" }, 502); }
    const qs = Array.isArray(parsed?.questions) ? parsed.questions : [];
    if (!qs.length) return json({ error: "No questions generated" }, 502);

    const rows = qs.slice(0, count).map((q: any) => ({
      school_id: assessment.school_id,
      assessment_id,
      type: "mcq",
      prompt: String(q.prompt ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.slice(0, 6) : [],
      correct: Number.isFinite(q.correct_index) ? q.correct_index : 0,
      points: 1,
      difficulty: ["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : difficulty,
      topic: q.topic ?? topic ?? null,
      subject_code: subject ?? null,
      exam_body,
      explanation: q.explanation ?? null,
      ai_generated: true,
      created_by: user.id,
    })).filter((r: any) => r.prompt && r.options.length >= 2);

    const { data: inserted, error: ierr } = await admin
      .from("questions_v2").insert(rows).select("id");
    if (ierr) {
      console.error("[generate-questions] insert_failed", ierr);
      return json({ error: "We couldn't save the generated questions. Please try again." }, 500);
    }

    return json({ inserted: inserted?.length ?? 0 });
  } catch (e) {
    console.error("[generate-questions] error", e);
    return json({ error: "We couldn't generate questions. Please try again." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}