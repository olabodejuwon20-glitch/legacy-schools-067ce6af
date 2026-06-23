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
const isPin = (s: string) => /^\d{6}$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json();
    const fullName = (body.fullName ?? "").toString().trim();
    const phone = normPhone((body.phone ?? "").toString());
    const code = (body.code ?? "").toString().trim().toUpperCase();
    const pin = (body.pin ?? "").toString().trim();
    const schoolSlug = (body.schoolSlug ?? "").toString().trim().toLowerCase();
    const bio = body.bio ?? {};

    if (!fullName) return json({ error: "Full name is required" }, 400);
    if (!phone || phone.length < 6) return json({ error: "Invalid phone" }, 400);
    if (!isPin(pin)) return json({ error: "PIN must be 6 digits" }, 400);
    if (!code) return json({ error: "Code is required" }, 400);
    if (!schoolSlug) return json({ error: "Open the correct school portal to join." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: invite } = await admin.from("invite_codes").select("school_id, role, admin_slot, expires_at, uses, max_uses").eq("code", code).maybeSingle();
    if (!invite) return json({ error: "Invalid code" }, 400);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return json({ error: "Code expired" }, 400);
    if (invite.uses >= invite.max_uses) return json({ error: "Code exhausted" }, 400);

    const { data: school } = await admin.from("schools").select("id,slug,name").eq("id", invite.school_id).single();
    if (!school) return json({ error: "School not found" }, 400);
    if (school.slug !== schoolSlug) {
      return json({ error: "Invalid or expired onboarding code." }, 403);
    }

    const email = fakeEmail(phone, school.slug);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: pin, email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    });
    if (cErr) {
      if (/already/i.test(cErr.message)) return json({ error: "We couldn't complete your sign-up. Please check your details and try again." }, 400);
      console.error("[join-with-code] create_user_failed", cErr);
      return json({ error: "We couldn't complete your sign-up. Please check your details and try again." }, 400);
    }
    const uid = created.user!.id;

    await admin.from("profiles").upsert({
      id: uid, full_name: fullName, email, phone,
      gender: bio.gender || null, dob: bio.dob || null, address: bio.address || null, photo_url: bio.photo_url || null,
    });
    await admin.from("memberships").upsert(
      {
        school_id: school.id, user_id: uid, role: invite.role,
        admin_slot: invite.role === "admin" ? (invite.admin_slot ?? null) : null,
        status: "active",
        bio_completed: true, must_change_pin: false,
        profile_data: bio.profile_data ?? {},
      },
      { onConflict: "school_id,user_id,role" } as any,
    );
    await admin.from("invite_codes").update({ uses: invite.uses + 1 }).eq("code", code);

    return json({ ok: true, email, schoolSlug: school.slug, role: invite.role });
  } catch (e) {
    console.error('[join-with-code] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});