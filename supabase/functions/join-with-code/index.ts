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
    const preview = body.preview === true;
    const fullName = (body.fullName ?? "").toString().trim();
    const phone = normPhone((body.phone ?? "").toString());
    const code = (body.code ?? "").toString().trim().toUpperCase();
    const pin = (body.pin ?? "").toString().trim();
    const schoolSlug = (body.schoolSlug ?? "").toString().trim().toLowerCase();
    const selectedRole = (body.role ?? "").toString().trim().toLowerCase() || null;
    const customRoleKey = (body.customRoleKey ?? "").toString().trim() || null;
    const bio = body.bio ?? {};

    if (!preview) {
      if (!fullName) return json({ error: "Full name is required" }, 400);
      if (!phone || phone.length < 6) return json({ error: "Invalid phone" }, 400);
      if (!isPin(pin)) return json({ error: "PIN must be 6 digits" }, 400);
    }
    if (!code) return json({ error: "Code is required" }, 400);
    if (!schoolSlug) return json({ error: "Open the correct school portal to join." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: invite } = await admin.from("invite_codes")
      .select("id, school_id, role, admin_slot, expires_at, uses, max_uses, revoked_at")
      .eq("code", code).maybeSingle();
    if (!invite) return json({ error: "Invalid code" }, 400);
    if (invite.revoked_at) return json({ error: "This code has been revoked. Ask your school for a new one." }, 400);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return json({ error: "Code expired" }, 400);
    if (invite.uses >= invite.max_uses) return json({ error: "Code exhausted" }, 400);

    const { data: school } = await admin.from("schools").select("id,slug,name").eq("id", invite.school_id).single();
    if (!school) return json({ error: "School not found" }, 400);
    if (school.slug !== schoolSlug) {
      return json({ error: "Invalid or expired onboarding code." }, 403);
    }

    // Resolve custom role (if any) against this school's enabled custom roles
    let customRole: { key: string; label: string; base_role: string } | null = null;
    if (customRoleKey) {
      const { data: cr } = await admin.from("school_custom_roles")
        .select("key,label,base_role,enabled")
        .eq("school_id", school.id).eq("key", customRoleKey).maybeSingle();
      if (!cr || cr.enabled === false) {
        return json({ error: "That role isn't available for this school." }, 400);
      }
      customRole = { key: cr.key, label: cr.label, base_role: cr.base_role };
      // Custom role's base must match the invite's role to prevent privilege jumps
      if (cr.base_role !== invite.role) {
        return json({ error: "This code doesn't match the selected role." }, 400);
      }
    } else if (selectedRole && selectedRole !== invite.role) {
      return json({ error: "This code doesn't match the selected role." }, 400);
    }

    if (preview) {
      return json({ ok: true, role: invite.role, customRole, schoolSlug: school.slug, schoolName: school.name });
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
    const incomingProfileData = (bio.profile_data && typeof bio.profile_data === "object") ? bio.profile_data : {};
    const mergedProfileData = {
      ...incomingProfileData,
      selected_role: selectedRole ?? invite.role,
      custom_role_key: customRole?.key ?? null,
      custom_role_label: customRole?.label ?? null,
    };
    await admin.from("memberships").upsert(
      {
        school_id: school.id, user_id: uid, role: invite.role,
        admin_slot: invite.role === "admin" ? (invite.admin_slot ?? null) : null,
        status: "active",
        bio_completed: true, must_change_pin: false,
        profile_data: mergedProfileData,
      },
      { onConflict: "school_id,user_id,role" } as any,
    );
    await admin.from("invite_codes").update({ uses: invite.uses + 1 }).eq("code", code);

    // Audit
    try {
      await admin.from("onboarding_events").insert({
        school_id: school.id, code_id: (invite as any).id, user_id: uid, role: invite.role,
        event: "joined", metadata: { phone, full_name: fullName, custom_role: customRole?.key ?? null },
      });
    } catch (_) { /* best-effort */ }

    return json({ ok: true, email, schoolSlug: school.slug, role: invite.role, customRole });
  } catch (e) {
    console.error('[join-with-code] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});