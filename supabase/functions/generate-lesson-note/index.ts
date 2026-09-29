import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { callAiGateway } from "../_shared/ai-call.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json();
    const { title, subject, grade_level, topic, duration_min, objectives, notes, school_id } = body;
    if (!subject || !topic) {
      return new Response(JSON.stringify({ error: "subject and topic are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: must be active teacher/admin of the provided school
    const userId = claimsData.claims.sub as string;
    if (!school_id || typeof school_id !== "string") {
      return new Response(JSON.stringify({ error: "school_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: mem } = await admin.from("memberships")
      .select("role").eq("school_id", school_id).eq("user_id", userId)
      .eq("status", "active").maybeSingle();
    if (!mem || !["teacher", "admin"].includes(mem.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = {
      role: "system",
      content:
        "You are a curriculum specialist writing professional, classroom-ready lesson notes for K-12 teachers. " +
        "Produce well-structured Markdown with these sections (in order): " +
        "Title, Subject & Class, Duration, Topic, Learning Objectives (3-5 bullets, measurable), " +
        "Prior Knowledge, Instructional Materials, Introduction (5 min), " +
        "Step-by-Step Presentation (numbered, with teacher activity and student activity), " +
        "Chalkboard Summary, Evaluation (5 questions), Assignment, Conclusion. " +
        "Be specific, age-appropriate and pedagogically sound. Use clear, concise English.",
    };
    const user = {
      role: "user",
      content: [
        `Title: ${title || `${subject} — ${topic}`}`,
        `Subject: ${subject}`,
        grade_level ? `Class / Grade: ${grade_level}` : null,
        duration_min ? `Duration: ${duration_min} minutes` : null,
        `Topic: ${topic}`,
        objectives ? `Teacher's intended objectives: ${objectives}` : null,
        notes ? `Additional notes: ${notes}` : null,
      ].filter(Boolean).join("\n"),
    };

    const res = await callAiGateway({ model: "google/gemini-2.5-flash", messages: [sys, user] });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("[generate-lesson-note upstream]", res.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-lesson-note]", e);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});