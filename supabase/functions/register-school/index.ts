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

    // Send Onboarding Notice Email: "Your School Portal Is Being Prepared"
    let emailSent = false;
    try {
      const brevoKey = Deno.env.get("BREVO_API_KEY");
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const supportEmail = "nexolabsa@gmail.com";
      const subject = "Your School Portal Is Being Prepared";
      const emailHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f6f7f9;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:32px 32px 24px;text-align:center;background:#2563eb;color:#ffffff;">
        <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.02em;">LegacySKool</h1>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.9;">School Management Platform</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin-top:0;font-size:20px;color:#0f172a;">Your school portal is being prepared</h2>
        <p>Hello ${fullName},</p>
        <p>We are currently setting up your new LegacySKool portal for <strong>${schoolName}</strong>. Our system is organizing your digital workspace so everything is perfectly in place for your teachers, students, and parents.</p>
        <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:16px;margin:24px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-weight:600;color:#1e293b;">Estimated preparation time: 30 minutes</p>
          <p style="margin:6px 0 0;font-size:13px;color:#64748b;">We will send you another email with your direct access link the moment your portal is live.</p>
        </div>
        <p>While you wait, you can prepare your class rosters and list of subjects to make setup instant.</p>
        <p style="margin-top:28px;">If you have any questions, reply to this email or reach our support team at <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;font-weight:500;">${supportEmail}</a>.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
        <p style="margin:0;">© ${new Date().getFullYear()} LegacySKool. All rights reserved.</p>
        <p style="margin:4px 0 0;">Dedicated Support: <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;">${supportEmail}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

      if (brevoKey) {
        const sender = Deno.env.get("BREVO_SENDER_EMAIL") || supportEmail;
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "LegacySKool", email: sender },
            to: [{ email }],
            subject,
            htmlContent: emailHtml,
          }),
        });
        if (r.ok) {
          emailSent = true;
          console.log("[register-school] Brevo onboarding email sent to", email);
        } else {
          console.warn("[register-school] Brevo send failed:", await r.text());
        }
      }

      if (!emailSent && resendKey) {
        const from = Deno.env.get("RESEND_FROM") || Deno.env.get("RESEND_SENDER_EMAIL") || "LegacySKool <onboarding@resend.dev>";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [email],
            subject,
            html: emailHtml,
          }),
        });
        if (r.ok) {
          emailSent = true;
          console.log("[register-school] Resend onboarding email sent to", email);
        } else {
          console.warn("[register-school] Resend send failed:", await r.text());
        }
      }
    } catch (mailErr) {
      console.error("[register-school] Could not dispatch welcome email:", mailErr);
    }

    return json({ ok: true, slug: school.slug, schoolId: school.id, email, emailSent });
  } catch (e) {
    console.error('[register-school] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});