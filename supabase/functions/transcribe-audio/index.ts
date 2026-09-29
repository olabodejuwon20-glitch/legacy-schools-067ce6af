import { createClient } from "jsr:@supabase/supabase-js@2";
import { callAiGateway } from "../_shared/ai-call.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { audio_base64, mime_type = "audio/webm", school_id } = await req.json();
    if (!audio_base64 || typeof audio_base64 !== "string") {
      return new Response(JSON.stringify({ error: "audio_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!school_id || typeof school_id !== "string") {
      return new Response(JSON.stringify({ error: "school_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    // Require active membership in the given school (any role) so transcription
    // credits are scoped to school members only.
    const { data: mem } = await admin.from("memberships")
      .select("role").eq("school_id", school_id).eq("user_id", userRes.user.id)
      .eq("status", "active").maybeSingle();
    if (!mem) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (audio_base64.length > 12_000_000) {
      return new Response(JSON.stringify({ error: "audio too large (max ~9MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await callAiGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You transcribe audio verbatim. Output ONLY the transcript, no preamble." },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio." },
            { type: "input_audio", input_audio: { data: audio_base64, format: mime_type.includes("mp3") ? "mp3" : "webm" } },
          ],
        },
      ],
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("[transcribe upstream]", r.status, t);
      const msg = r.status === 429 ? "Rate limit reached." : r.status === 402 ? "AI credits exhausted." : "Transcription failed.";
      return new Response(JSON.stringify({ error: msg }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const transcript = (data.choices?.[0]?.message?.content ?? "").trim();
    return new Response(JSON.stringify({ transcript }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[transcribe-audio]", e);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});