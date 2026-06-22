import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "school";
const rand2 = () => {
  const a = "abcdefghijklmnopqrstuvwxyz";
  return a[Math.floor(Math.random() * 26)] + a[Math.floor(Math.random() * 26)];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { schoolName, fullName, email, password } = await req.json();
    if (!schoolName || !fullName || !email || !password) return json({ error: "All fields required" }, 400);
    if (String(password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    // collision-safe slug
    const base = slugify(schoolName);
    let slug = "";
    for (let i = 0; i < 8; i++) {
      const candidate = `${base}-${rand2()}`;
      const { data } = await admin.from("schools").select("id").eq("slug", candidate).maybeSingle();
      if (!data) { slug = candidate; break; }
    }
    if (!slug) return json({ error: "Could not allocate slug" }, 500);

    // create user
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (cErr) {
      if (/already/i.test(cErr.message)) return json({ error: "An account with this email already exists. Sign in instead." }, 400);
      console.error("[register-school] create_user_failed", cErr);
      return json({ error: "We couldn't create the admin account. Please check your details and try again." }, 400);
    }
    const uid = created.user!.id;
    await admin.from("profiles").upsert({ id: uid, full_name: fullName, email });

    // create school
    const { data: school, error: sErr } = await admin.from("schools")
      .insert({ name: schoolName, slug, created_by: uid }).select("id,slug,name").single();
    if (sErr) {
      console.error("[register-school] create_school_failed", sErr);
      return json({ error: "We couldn't create the school. Please check your details and try again." }, 400);
    }

    // make admin (bootstrap trigger may already do this; upsert to be safe)
    await admin.from("memberships").upsert(
      { school_id: school.id, user_id: uid, role: "admin", status: "active", bio_completed: true },
      { onConflict: "school_id,user_id,role" } as any,
    );

    return json({ ok: true, slug: school.slug, schoolId: school.id, email });
  } catch (e) {
    console.error('[register-school] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});