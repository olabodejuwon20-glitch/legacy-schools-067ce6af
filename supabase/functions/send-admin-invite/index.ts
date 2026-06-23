import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function renderHtml(opts: {
  invite_url: string; code: string; role_name: string;
  school_name: string; inviter_name: string;
}) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
        <tr><td style="padding:28px 28px 0">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">${escapeHtml(opts.school_name)}</div>
          <h1 style="margin:8px 0 6px;font-size:22px">You've been invited as ${escapeHtml(opts.role_name)}</h1>
          <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.55">${escapeHtml(opts.inviter_name)} has invited you to join <strong>${escapeHtml(opts.school_name)}</strong> on Legacy Schools as <strong>${escapeHtml(opts.role_name)}</strong>.</p>
        </td></tr>
        <tr><td style="padding:22px 28px 6px" align="center">
          <a href="${opts.invite_url}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:6px 28px 22px">
          <p style="margin:14px 0 4px;color:#6b7280;font-size:12px">Or use this one-time code on the join page:</p>
          <div style="font-family:'SF Mono',Menlo,monospace;background:#f3f4f6;padding:10px 12px;border-radius:8px;font-size:14px;letter-spacing:.04em">${escapeHtml(opts.code)}</div>
          <p style="margin:18px 0 0;color:#9ca3af;font-size:11px">If you didn't expect this invitation, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { to, invite_url, code, role_name, school_name, inviter_name } = body as Record<string, string>;
    if (!to || !invite_url || !code) return json({ error: "missing_params" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "invalid_email" }, 400);

    const subject = `You're invited to ${school_name || "the workspace"} as ${role_name || "an admin"}`;
    const html = renderHtml({
      invite_url, code,
      role_name: role_name || "Admin",
      school_name: school_name || "your school",
      inviter_name: inviter_name || "Your colleague",
    });
    const text = `${inviter_name || "A colleague"} invited you to join ${school_name || "the workspace"} as ${role_name || "Admin"}.\n\nAccept: ${invite_url}\nOr use code: ${code}\n`;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Try Lovable Emails queue (preferred when email infra is set up)
    try {
      const { error: qErr } = await admin.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        message: {
          to,
          subject,
          html,
          text,
          purpose: "transactional",
          template_name: "admin_invite",
          idempotency_key: `invite_${code}`,
        },
      } as any);
      if (!qErr) return json({ ok: true, channel: "queue" });
      console.log("[send-admin-invite] queue unavailable:", qErr.message);
    } catch (e) {
      console.log("[send-admin-invite] queue threw:", String(e));
    }

    // 2) Fall back to Resend if a key is configured
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const from = Deno.env.get("RESEND_FROM") || "Legacy Schools <onboarding@resend.dev>";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("[send-admin-invite] resend failed", r.status, data);
        return json({ error: "send_failed", details: data }, 502);
      }
      return json({ ok: true, channel: "resend", id: (data as any)?.id });
    }

    return json({
      error: "email_not_configured",
      message: "Email delivery isn't set up yet. Share the invite link manually until an email domain is configured.",
    }, 503);
  } catch (e) {
    console.error("[send-admin-invite]", e);
    return json({ error: "internal_error" }, 500);
  }
});