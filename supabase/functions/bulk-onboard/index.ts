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
const randomPin = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (100000 + (buf[0] % 900000)).toString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Not authenticated" }, 401);

    const { schoolId, role, rows } = await req.json();
    if (!schoolId || !role || !Array.isArray(rows)) return json({ error: "Bad payload" }, 400);
    if (!["student", "teacher", "parent"].includes(role)) return json({ error: "Invalid role" }, 400);

    // verify caller is admin of this school
    const { data: mem } = await admin.from("memberships")
      .select("role").eq("school_id", schoolId).eq("user_id", user.id).eq("role", "admin").eq("status", "active").maybeSingle();
    if (!mem) return json({ error: "Only admins of this school can bulk onboard" }, 403);

    const { data: school } = await admin.from("schools").select("slug").eq("id", schoolId).single();
    if (!school) return json({ error: "School not found" }, 404);

    const results: { phone: string; ok: boolean; pin?: string; error?: string }[] = [];
    for (const row of rows) {
      const fullName = (row.full_name ?? row.name ?? "").toString().trim();
      const phone = normPhone((row.phone ?? "").toString());
      if (!fullName || !phone || phone.length < 6) {
        results.push({ phone, ok: false, error: "missing name or phone" });
        continue;
      }
      const email = fakeEmail(phone, school.slug);
      const pin = randomPin();
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: pin, email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
      let uid: string | undefined = created?.user?.id;
      if (cErr) {
        if (/already/i.test(cErr.message)) {
          const { data: existing } = await admin.rpc("auth_user_id_by_email", { _email: email });
          uid = existing ?? undefined;
        }
        if (!uid) { results.push({ phone, ok: false, error: cErr.message }); continue; }
      }
      await admin.from("profiles").upsert({ id: uid, full_name: fullName, email, phone });
      const { error: mErr } = await admin.from("memberships").upsert(
        { school_id: schoolId, user_id: uid, role, status: "active", bio_completed: false, must_change_pin: true },
        { onConflict: "school_id,user_id,role" } as any,
      );
      if (mErr) { results.push({ phone, ok: false, error: mErr.message }); continue; }
      results.push({ phone, ok: true, pin });
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error('[bulk-onboard] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});