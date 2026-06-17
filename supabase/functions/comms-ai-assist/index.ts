// Communication AI Assist — light intents used by the Composer / Templates UI.
// POST { school_id, intent, text, options? }  intent: "draft" | "improve" | "translate" | "summarize"
import { corsHeaders, aiCall } from "../_shared/ai-call.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEMS: Record<string, string> = {
  draft: "You draft clear, friendly school communications. Output plain message body only (no preamble).",
  improve: "You rewrite school messages to be clearer, warmer, and more professional. Keep meaning, tighten tone. Output the rewritten message only.",
  translate: "You translate school messages while preserving meaning and tone. Output only the translated text.",
  summarize: "You summarize school message threads into 2-4 bullet points capturing key decisions / action items.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await admin.auth.getClaims(token);
    const uid = claims?.claims?.sub as string | undefined;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const { school_id, intent, text, options } = await req.json();
    if (!school_id || !intent || !text) return json({ error: "Missing fields" }, 400);
    const system = SYSTEMS[intent];
    if (!system) return json({ error: "Unknown intent" }, 400);

    // Tenant check.
    const { data: isMember } = await admin.rpc("is_member", {
      _school: school_id, _user: uid,
    });
    if (!isMember) return json({ error: "Forbidden" }, 403);

    const userPrompt = intent === "translate"
      ? `Translate to ${options?.language ?? "English"}:\n\n${text}`
      : intent === "draft"
        ? `Draft a school message. Intent: ${options?.purpose ?? "general"}.\n\nContext / notes:\n${text}`
        : text;

    const r = await aiCall({
      schoolId: school_id, userId: uid, kind: `comms_${intent}`,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });
    return json({ ok: true, text: r.reply });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = msg.includes("402") ? 402 : msg.includes("429") ? 429 : 500;
    return json({ error: msg }, code);
  }
});
