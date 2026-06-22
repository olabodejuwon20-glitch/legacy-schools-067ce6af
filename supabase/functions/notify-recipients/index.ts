import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { school_id, title, body: msg, audience = "all" } = body ?? {};
    if (!school_id || !title || !msg) return json({ error: "missing fields" }, 400);
    if (!["all", "admin", "teacher", "student", "parent"].includes(audience))
      return json({ error: "bad audience" }, 400);

    // verify caller is school admin or super
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user: user.id });
    const { data: isAdmin } = await admin.rpc("is_school_admin", { _school: school_id, _user: user.id });
    if (!isSuper && !isAdmin) return json({ error: "forbidden" }, 403);

    // create broadcast conversation
    const { data: conv, error: cErr } = await admin
      .from("conversations")
      .insert({ school_id, kind: "broadcast", title, created_by: user.id, last_message_preview: msg.slice(0, 140), last_message_at: new Date().toISOString() })
      .select("id")
      .single();
    if (cErr) {
      console.error("[notify-recipients] conversation_create_failed", cErr);
      return json({ error: "We couldn't send this notification. Please try again." }, 500);
    }

    // resolve recipients
    let q = admin.from("memberships").select("user_id").eq("school_id", school_id).eq("status", "active");
    if (audience !== "all") q = q.eq("role", audience);
    const { data: members, error: mErr } = await q;
    if (mErr) {
      console.error("[notify-recipients] recipient_lookup_failed", mErr);
      return json({ error: "We couldn't send this notification. Please try again." }, 500);
    }

    const userIds = Array.from(new Set([...(members ?? []).map((m: any) => m.user_id), user.id]));
    const participants = userIds.map((uid) => ({ conversation_id: conv!.id, user_id: uid }));
    if (participants.length) {
      const { error: pErr } = await admin.from("conversation_participants").insert(participants);
      if (pErr) {
        console.error("[notify-recipients] participant_insert_failed", pErr);
        return json({ error: "We couldn't send this notification. Please try again." }, 500);
      }
    }

    // initial message
    await admin.from("conversation_messages").insert({
      conversation_id: conv!.id, school_id, sender_id: user.id, body: msg, kind: "text",
    });

    return json({ ok: true, conversation_id: conv!.id, recipients: participants.length });
  } catch (e) {
    console.error('[notify-recipients] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}