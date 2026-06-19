import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const normPhone = (p: string) => p.replace(/[^\d+]/g, "");
const fakeEmail = (phone: string, slug: string) => `p${normPhone(phone).replace(/\+/g, "")}.${slug}@members.edusmart.local`;

// Member sign-in only. Identity = phone + PIN, scoped to a school slug.
// Optionally validates name.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json();
    const fullName = (body.fullName ?? "").toString().trim().toLowerCase();
    const phone = normPhone((body.phone ?? "").toString());
    const schoolSlug = (body.schoolSlug ?? "").toString().trim().toLowerCase();
    if (!phone || phone.length < 6) return json({ error: "Invalid phone" }, 400);
    if (!schoolSlug) return json({ error: "Missing school" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    // Generic error for all enumeration paths to avoid leaking which phones / schools are registered.
    const GENERIC = { error: "Invalid credentials" };

    const { data: school } = await admin.from("schools").select("id,slug").eq("slug", schoolSlug).maybeSingle();
    if (!school) return json(GENERIC, 400);

    const email = fakeEmail(phone, school.slug);
    // O(1) lookup via SECURITY DEFINER helper; avoids paginating all auth users.
    const { data: uid } = await admin.rpc("auth_user_id_by_email", { _email: email });
    if (!uid) return json(GENERIC, 400);

    const { data: mem } = await admin.from("memberships")
      .select("must_change_pin").eq("user_id", uid).eq("school_id", school.id).eq("status", "active").maybeSingle();
    if (!mem) return json(GENERIC, 400);

    if (fullName) {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      if (prof?.full_name && prof.full_name.trim().toLowerCase() !== fullName) {
        return json(GENERIC, 400);
      }
    }

    // Role is intentionally omitted — it is resolved post sign-in from memberships.
    return json({ ok: true, email, mustChangePin: !!mem.must_change_pin });
  } catch (e) {
    console.error("[phone-auth] error:", e);
    return json({ error: "An internal error occurred" }, 500);
  }
});
