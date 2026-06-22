import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STUDENT_SYS = `You are Legacy Tutor — a warm, sharp study companion for Nigerian K-12 / WAEC / NECO / JAMB students.
- Explain clearly with worked examples and analogies.
- Use short paragraphs, bullet points, and LaTeX-style math when helpful.
- Encourage active recall: end answers with a quick check-question when natural.
- If the student attaches an image, read it carefully before answering.
- Be concise unless asked for depth.
- When the student's curriculum context (subjects, grade level, recent topics) is provided in a system note, tailor examples and vocabulary to it. Reference the syllabus they actually study.`;

const TEACHER_SYS = `You are Legacy Co-Teacher — an assistant for educators.
Help with lesson plans, scheme of work, rubrics, exam-question generation, marking guides,
parent-communication wording, and pedagogy advice. Use a professional, supportive tone.
Always structure outputs (headings, bullets) so the teacher can paste them into their tools.`;

function sysFor(role: string | undefined) {
  return role === "teacher" ? TEACHER_SYS : STUDENT_SYS;
}

// Pulls a light-weight curriculum snapshot for a student.
async function loadStudentContext(admin: any, user_id: string, school_id: string) {
  const [{ data: enrollments }, { data: recentResults }, { data: recentAR }, { data: upcomingExams }, { data: mastery }] = await Promise.all([
    admin.from("class_enrollments")
      .select("classes(name, subject, grade_level)")
      .eq("student_id", user_id).eq("school_id", school_id),
    admin.from("results")
      .select("subject, score, grade, term, created_at")
      .eq("student_id", user_id).eq("school_id", school_id)
      .order("created_at", { ascending: false }).limit(20),
    admin.from("assessment_results")
      .select("per_topic, score, created_at")
      .eq("student_id", user_id)
      .order("created_at", { ascending: false }).limit(5),
    admin.from("exams")
      .select("title, subject, scheduled_at")
      .eq("school_id", school_id).not("scheduled_at", "is", null)
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", new Date(Date.now() + 14 * 86400e3).toISOString())
      .order("scheduled_at").limit(10),
    admin.from("student_topic_mastery")
      .select("subject_code, topic, attempts, correct, ema_mastery, last_attempt_at")
      .eq("school_id", school_id).eq("student_id", user_id)
      .order("ema_mastery", { ascending: true }).limit(20),
  ]);

  const subjects = Array.from(new Set(
    (enrollments ?? []).map((e: any) => e.classes?.subject).filter(Boolean)
  ));
  const level = (enrollments ?? []).map((e: any) => e.classes?.grade_level).filter(Boolean)[0] ?? null;

  // Weak topics from per_topic JSON across last attempts
  const topicAgg: Record<string, { correct: number; total: number }> = {};
  for (const ar of recentAR ?? []) {
    const pt = (ar as any).per_topic;
    if (!pt || typeof pt !== "object") continue;
    for (const [topic, v] of Object.entries(pt)) {
      const vv = v as any;
      const c = Number(vv?.correct ?? 0);
      const t = Number(vv?.total ?? 0);
      if (!t) continue;
      topicAgg[topic] = topicAgg[topic] ?? { correct: 0, total: 0 };
      topicAgg[topic].correct += c;
      topicAgg[topic].total += t;
    }
  }
  // Prefer the persistent mastery rollup; fall back to per-attempt aggregation.
  let weakTopics: { topic: string; mastery: number; total: number; subject_code?: string | null }[];
  if (mastery && mastery.length) {
    weakTopics = mastery
      .filter((m: any) => Number(m.attempts) >= 2)
      .slice(0, 6)
      .map((m: any) => ({
        topic: m.topic,
        subject_code: m.subject_code,
        mastery: Number(m.ema_mastery),
        total: Number(m.attempts),
      }));
  } else {
    weakTopics = Object.entries(topicAgg)
      .map(([topic, a]) => ({ topic, mastery: a.total ? a.correct / a.total : 0, total: a.total }))
      .filter(t => t.total >= 2)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 6);
  }

  return {
    subjects,
    level,
    weakTopics,
    recentResults: (recentResults ?? []).slice(0, 10),
    upcomingExams: upcomingExams ?? [],
  };
}

function contextNote(ctx: Awaited<ReturnType<typeof loadStudentContext>>) {
  if (!ctx.subjects.length && !ctx.weakTopics.length) return "";
  const parts: string[] = [];
  if (ctx.level) parts.push(`Grade level: ${ctx.level}`);
  if (ctx.subjects.length) parts.push(`Subjects: ${ctx.subjects.join(", ")}`);
  if (ctx.weakTopics.length) {
    parts.push(`Weak topics (mastery): ${ctx.weakTopics.map(t => `${t.topic} ${Math.round(t.mastery * 100)}%`).join("; ")}`);
  }
  if (ctx.upcomingExams.length) {
    parts.push(`Upcoming exams: ${ctx.upcomingExams.map((e: any) => `${e.title} (${e.subject}, ${new Date(e.scheduled_at).toDateString()})`).join("; ")}`);
  }
  return `Student context — ${parts.join(" | ")}`;
}

async function callGateway(body: any, stream = false) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", stream, ...body }),
  });
}

function gatewayError(status: number) {
  if (status === 429) return "Rate limit reached. Please wait a moment.";
  if (status === 402) return "AI credits exhausted. Please top up.";
  return "AI service error.";
}

// Build multimodal content from text + attachments[]
function buildUserContent(text: string, attachments: any[] | undefined) {
  const parts: any[] = [];
  if (text) parts.push({ type: "text", text });
  for (const att of attachments ?? []) {
    if (att?.type === "image" && att?.url) {
      parts.push({ type: "image_url", image_url: { url: att.url } });
    } else if (att?.type === "file" && att?.name) {
      parts.push({ type: "text", text: `[Attached file: ${att.name}]` });
    } else if (att?.type === "audio" && att?.transcript) {
      parts.push({ type: "text", text: `[Voice note transcript] ${att.transcript}` });
    }
  }
  return parts.length === 1 && parts[0].type === "text" ? text : parts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(url, service);

    const body = await req.json();
    const {
      conversation_id,
      school_id,
      message,
      attachments = [],
      skill = null, // "quiz" | "summarize" | "explain_exam" | "plan_week" | null
      skill_input = {},
    } = body ?? {};

    if (!conversation_id || !school_id) {
      return new Response(JSON.stringify({ error: "missing conversation_id or school_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive role from verified membership — never trust client-supplied role.
    const { data: callerMem } = await admin.from("memberships")
      .select("role").eq("school_id", school_id).eq("user_id", user.id)
      .eq("status", "active").maybeSingle();
    if (!callerMem) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const portalRole = callerMem.role === "teacher" ? "teacher" : "student";

    // Verify conversation ownership
    const { data: conv } = await admin
      .from("ai_conversations")
      .select("id, user_id, school_id, title")
      .eq("id", conversation_id)
      .maybeSingle();
    if (!conv || conv.user_id !== user.id || conv.school_id !== school_id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- SKILL ROUTES (non-streaming) ----------
    if (skill) {
      let injected = "";
      if (skill === "explain_exam") {
        const { data: attempt } = await admin
          .from("exam_attempts").select("id, exam_id, score, submitted_at")
          .eq("student_id", user.id).order("submitted_at", { ascending: false, nullsFirst: false })
          .limit(1).maybeSingle();
        if (attempt?.id) {
          const { data: review } = await admin.rpc("get_exam_review", { _attempt_id: attempt.id });
          const wrong = (review ?? []).filter((r: any) => !r.q_is_correct);
          injected = `Student's most recent exam (score ${attempt.score ?? "?"}). Wrong answers:\n` +
            wrong.slice(0, 8).map((r: any, i: number) =>
              `${i + 1}. ${r.q_prompt}\nOptions: ${JSON.stringify(r.q_options)}\nChose: ${r.q_selected_index ?? "blank"} | Correct: ${r.q_correct_index}`
            ).join("\n\n");
        } else {
          injected = "No recent exam attempts found.";
        }
      } else if (skill === "plan_week") {
        const { data: enrollments } = await admin
          .from("class_enrollments").select("class_id, classes(name, subject)")
          .eq("student_id", user.id).eq("school_id", school_id);
        const { data: exams } = await admin
          .from("exams").select("title, subject, scheduled_at")
          .eq("school_id", school_id).not("scheduled_at", "is", null)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at").limit(10);
        injected = `Subjects: ${(enrollments ?? []).map((e: any) => e.classes?.subject || e.classes?.name).filter(Boolean).join(", ") || "none"}.\n` +
          `Upcoming exams: ${(exams ?? []).map((e: any) => `${e.title} (${e.subject}, ${new Date(e.scheduled_at).toDateString()})`).join("; ") || "none"}.`;
      } else if (skill === "recommend") {
        const ctx = await loadStudentContext(admin, user.id, school_id);
        injected = contextNote(ctx) || "No curriculum data on record yet.";
      } else if (skill === "adaptive_practice") {
        const ctx = await loadStudentContext(admin, user.id, school_id);
        const weakest = ctx.weakTopics[0];
        if (weakest) {
          injected = `Weakest topic: ${weakest.topic}${(weakest as any).subject_code ? ` (${(weakest as any).subject_code})` : ""} — current mastery ${Math.round(weakest.mastery * 100)}% over ${weakest.total} attempts.`;
          skill_input.topic = skill_input.topic || weakest.topic;
          skill_input.count = skill_input.count || 5;
        } else {
          injected = "No mastery data yet — pick any topic to start a 5-question booster.";
        }
      }

      const prompts: Record<string, string> = {
        quiz: `Generate a ${skill_input.count || 5}-question multiple-choice quiz on: ${skill_input.topic || message || "general study"}.
Difficulty: ${skill_input.difficulty || "mixed"}. Reading level: ${skill_input.level || "age-appropriate"}.
Render each as: question, then **A) B) C) D)** options, then on a new line "Answer: X — short explanation". Number 1–${skill_input.count || 5}.`,
        summarize: `Summarize the attached note into: (1) a 5-bullet summary, (2) 5 flashcards (Q → A). Use clear headings.`,
        explain_exam: `Walk the student through their wrong answers below. For each: state the right answer, explain why, then one tip to avoid the mistake.\n\n${injected}`,
        plan_week: `Build a Mon–Sun study schedule (2 focused 45-min sessions/day) using this context:\n${injected}\nFormat as a markdown table: Day | Morning | Evening.`,
        explain_steps: `Teach this step-by-step at a ${skill_input.level || "clear, age-appropriate"} level: "${skill_input.topic || message || "the concept above"}".
Use this exact structure with markdown headings:
### Goal
One sentence on what the student will be able to do.
### Key idea
The core concept in 2–3 sentences with an analogy.
### Step-by-step
Numbered steps (1, 2, 3 …). Each step: what to do, why it works, and one tiny example.
### Worked example
A complete worked problem showing every step.
### Your turn
One short check-question for the student to attempt (do not reveal the answer).
### Common mistake
One sentence on the pitfall to avoid.`,
        recommend: `You are advising a student on what to study next. Use ONLY the curriculum data below — do not invent subjects or scores.
${injected}

Respond with:
### Top 3 priorities
For each: **Topic** — one line on *why* (cite the data, e.g. "mastery 40% on 2 attempts", "exam in 5 days"), then a single concrete next action chosen from:
- "Take a 10-question booster" (mention the topic so they can tap Quiz me)
- "Walk through it step-by-step"
- "Review your last exam mistakes"

### This week's focus
One short paragraph tying the priorities to upcoming exams or weak subjects.

Keep it under 200 words. Be specific and encouraging.`,
        adaptive_practice: `Generate a focused 5-question MCQ booster on the student's weakest topic.
${injected}
Format each as: question, then **A) B) C) D)** options, then on a new line "Answer: X — short explanation".
Number them 1–5. Keep difficulty calibrated to a learner currently scoring around the mastery shown above.`,
      };

      const skillMsgs = [
        { role: "system", content: sysFor(portalRole) },
        { role: "user", content: buildUserContent(prompts[skill] ?? message ?? "", attachments) },
      ];
      const r = await callGateway({ messages: skillMsgs }, false);
      if (!r.ok) {
        return new Response(JSON.stringify({ error: gatewayError(r.status) }), {
          status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const reply = data.choices?.[0]?.message?.content ?? "";

      // Persist user request + assistant reply
      await admin.from("ai_chats").insert([
        { school_id, user_id: user.id, conversation_id, role: "user", content: message || prompts[skill], attachments },
        { school_id, user_id: user.id, conversation_id, role: "assistant", content: reply },
      ]);
      await admin.from("ai_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation_id);

      return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- DEFAULT CHAT (streaming) ----------
    // Lightweight curriculum context for students (so free-form chat stays relevant).
    let ctxNote = "";
    if (portalRole === "student") {
      try {
        const ctx = await loadStudentContext(admin, user.id, school_id);
        ctxNote = contextNote(ctx);
      } catch (e) { console.warn("[ai-tutor] context load failed", e); }
    }

    // Load conversation history
    const { data: history } = await admin
      .from("ai_chats")
      .select("role, content, attachments")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(60);

    const msgs: any[] = [{ role: "system", content: sysFor(portalRole) }];
    if (ctxNote) msgs.push({ role: "system", content: ctxNote });
    for (const h of history ?? []) {
      msgs.push({ role: h.role, content: buildUserContent(h.content, h.attachments as any[]) });
    }
    msgs.push({ role: "user", content: buildUserContent(message ?? "", attachments) });

    // Insert user message immediately
    await admin.from("ai_chats").insert({
      school_id, user_id: user.id, conversation_id, role: "user",
      content: message ?? "", attachments,
    });

    const upstream = await callGateway({ messages: msgs }, true);
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      console.error("[ai-tutor upstream]", upstream.status, text);
      return new Response(JSON.stringify({ error: gatewayError(upstream.status) }), {
        status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tee the stream: forward to client, accumulate to save
    let assistantText = "";
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();
    let buf = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          // Persist assistant + bump conversation
          if (assistantText.trim()) {
            await admin.from("ai_chats").insert({
              school_id, user_id: user.id, conversation_id, role: "assistant",
              content: assistantText,
            });
            // Auto-title if still "New chat"
            if (conv.title === "New chat") {
              const title = (assistantText.split("\n")[0] || message || "Chat")
                .replace(/[#*`>_~]/g, "").trim().slice(0, 60);
              await admin.from("ai_conversations")
                .update({ title, last_message_at: new Date().toISOString() })
                .eq("id", conversation_id);
            } else {
              await admin.from("ai_conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conversation_id);
            }
          }
          controller.close();
          return;
        }
        controller.enqueue(value);
        // Accumulate text from deltas
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (typeof c === "string") assistantText += c;
          } catch { /* partial */ }
        }
      },
      cancel() { reader.cancel(); },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[ai-tutor]", e);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
