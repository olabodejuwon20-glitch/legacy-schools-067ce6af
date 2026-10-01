// Supabase Edge Function: send-email
// Resilient dual-provider email dispatcher with Brevo and Resend support

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
    const body = await req.json().catch(() => ({}));
    const { to, subject, html, text, from } = body as {
      to?: string;
      subject?: string;
      html?: string;
      text?: string;
      from?: string;
    };

    if (!to || !subject || (!html && !text)) {
      return json({ error: "Missing required fields: to, subject, and body (html/text)" }, 400);
    }

    const finalHtml = (html || text || "")
      .replace(/\{SUPPORT_EMAIL\}/g, SUPPORT_EMAIL)
      .replace(/\{YEAR\}/g, String(new Date().getFullYear()));

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    // 1. Try Brevo first if configured
    if (brevoKey) {
      try {
        const senderEmail = from || Deno.env.get("BREVO_SENDER_EMAIL") || SUPPORT_EMAIL;
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: "LegacySKool",
              email: senderEmail,
            },
            to: [{ email: to }],
            subject,
            htmlContent: finalHtml,
            textContent: text,
          }),
        });

        const brevoData = await brevoRes.json().catch(() => ({}));
        if (brevoRes.ok) {
          return json({ ok: true, provider: "brevo", id: (brevoData as any)?.messageId || "ok" });
        }
        console.warn("[send-email] Brevo failed, checking Resend fallback:", brevoRes.status, brevoData);
      } catch (brevoErr) {
        console.warn("[send-email] Brevo call threw error, checking Resend fallback:", brevoErr);
      }
    }

    // 2. Try Resend fallback if configured
    if (resendKey) {
      try {
        const senderFrom = from || Deno.env.get("RESEND_FROM") || Deno.env.get("RESEND_SENDER_EMAIL") || "LegacySKool <onboarding@resend.dev>";
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: senderFrom,
            to: [to],
            subject,
            html: finalHtml,
            text,
          }),
        });

        const resendData = await resendRes.json().catch(() => ({}));
        if (resendRes.ok) {
          return json({ ok: true, provider: "resend", id: (resendData as any)?.id || "ok" });
        }
        console.error("[send-email] Resend failed:", resendRes.status, resendData);
      } catch (resendErr) {
        console.error("[send-email] Resend call threw error:", resendErr);
      }
    }

    if (!brevoKey && !resendKey) {
      console.warn("[send-email] Neither BREVO_API_KEY nor RESEND_API_KEY configured in environment");
      return json({
        ok: false,
        warning: "NO_EMAIL_API_KEY_CONFIGURED",
        message: "Add BREVO_API_KEY or RESEND_API_KEY to Supabase Secrets.",
      }, 200);
    }

    return json({ error: "Email delivery failed across all available providers" }, 502);
  } catch (err: any) {
    console.error("[send-email] Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
