import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORT_EMAIL = "nexolabsa@gmail.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectTo } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return json({ error: "Email address is required" }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

    // Generate recovery link securely without depending on Supabase's internal SMTP
    const redirectUrl = redirectTo || `${req.headers.get("origin") || "https://legacy-schools-067ce6af.vercel.app"}/reset-password`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: { redirectTo: redirectUrl },
    });

    if (linkErr) {
      console.warn("[request-password-reset] generateLink failed or user not found:", linkErr.message);
      // Preserve email enumeration protection: return success even if user not found
      return json({ ok: true, message: "If your email is registered, you will receive a reset link." });
    }

    const resetLink = linkData?.properties?.action_link;
    if (!resetLink) {
      return json({ error: "Could not generate recovery link" }, 500);
    }

    // Build branded HTML email
    const subject = "Reset your LegacySKool password";
    const emailHtml = `<!doctype html>
<html>
<head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f6f7f9;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <tr>
      <td style="padding:28px 32px 20px;text-align:center;background:#2563eb;color:#ffffff;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">LegacySKool</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">School Management Platform</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin-top:0;color:#0f172a;font-size:18px;">Reset your password</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your <strong>LegacySKool</strong> administrator account.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;box-shadow:0 2px 4px rgba(37,99,235,0.2);">Reset Password</a>
        </div>
        <p style="font-size:12px;color:#64748b;">This link will expire in 60 minutes. If you did not ask to reset your password, you can safely ignore this message. Your account remains secure and your current password will not change.</p>
        <p style="margin-top:24px;font-size:13px;">Need assistance? Reply directly or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
        <p style="margin:0;">© ${new Date().getFullYear()} LegacySKool. All rights reserved.</p>
        <p style="margin:4px 0 0;">Support: <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    let emailSent = false;
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // 1. Try Brevo
    if (brevoKey) {
      try {
        const sender = Deno.env.get("BREVO_SENDER_EMAIL") || SUPPORT_EMAIL;
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "LegacySKool", email: sender },
            to: [{ email: cleanEmail }],
            subject,
            htmlContent: emailHtml,
          }),
        });
        if (r.ok) {
          emailSent = true;
          console.log("[request-password-reset] Brevo email dispatched to", cleanEmail);
        } else {
          console.warn("[request-password-reset] Brevo failed:", await r.text());
        }
      } catch (e) {
        console.warn("[request-password-reset] Brevo exception:", e);
      }
    }

    // 2. Try Resend fallback
    if (!emailSent && resendKey) {
      try {
        const from = Deno.env.get("RESEND_FROM") || Deno.env.get("RESEND_SENDER_EMAIL") || "LegacySKool <onboarding@resend.dev>";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [cleanEmail],
            subject,
            html: emailHtml,
          }),
        });
        if (r.ok) {
          emailSent = true;
          console.log("[request-password-reset] Resend email dispatched to", cleanEmail);
        } else {
          console.warn("[request-password-reset] Resend failed:", await r.text());
        }
      } catch (e) {
        console.warn("[request-password-reset] Resend exception:", e);
      }
    }

    return json({ ok: true, emailSent, message: "Password reset link processed" });
  } catch (err: any) {
    console.error("[request-password-reset] Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
