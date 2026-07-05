import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, service);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user: user.id });
  if (!isSuper) return json({ error: "forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const { action, payload = {} } = body ?? {};
  if (!action || typeof action !== "string") return json({ error: "missing action" }, 400);

  const audit = async (school_id: string | null, extra: any = {}) => {
    await admin.from("platform_audit").insert({
      actor: user.id, school_id, action, payload: { ...payload, ...extra },
      ip: req.headers.get("x-forwarded-for") ?? null,
    });
  };

  try {
    switch (action) {
      case "update_school": {
        const { school_id, fields } = payload;
        const allowed = ["name","slug","email","phone","address","motto","logo_url","platform_notice","branding"];
        const update: any = {};
        for (const k of allowed) if (k in fields) update[k] = fields[k];
        const { error } = await admin.from("schools").update(update).eq("id", school_id);
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "set_plan": {
        const { school_id, plan, expires_at } = payload;
        const { error } = await admin.from("schools").update({
          plan, status: "active", plan_started_at: new Date().toISOString(),
          plan_expires_at: expires_at ?? null,
        }).eq("id", school_id);
        if (error) throw error;
        await admin.from("subscriptions").insert({
          school_id, plan, status: "active",
          current_period_end: expires_at ?? null,
          monthly_amount_cents: payload.monthly_amount_cents ?? 0,
        });
        await audit(school_id);
        return json({ ok: true });
      }
      case "suspend_school": {
        const { school_id, reason } = payload;
        const { error } = await admin.from("schools").update({ status: "suspended", suspended_reason: reason ?? null }).eq("id", school_id);
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "reactivate_school": {
        const { school_id } = payload;
        const { error } = await admin.from("schools").update({ status: "active", suspended_reason: null }).eq("id", school_id);
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "delete_school": {
        const { school_id, confirm } = payload;
        if (confirm !== "DELETE") return json({ error: "confirm required" }, 400);
        // Soft delete: mark deleted_at + suspend so the row vanishes from active listings
        // without losing audit history, billing trail, or child records.
        const { error } = await admin.from("schools")
          .update({ deleted_at: new Date().toISOString(), status: "suspended", suspended_reason: "deleted" })
          .eq("id", school_id);
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "assign_module": {
        const { school_id, module_id, config, beta } = payload;
        const { error } = await admin.from("school_modules").upsert({
          school_id, module_id, enabled: true, beta: !!beta, config: config ?? {},
        }, { onConflict: "school_id,module_id" });
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "toggle_module": {
        const { school_id, module_id, enabled } = payload;
        const { error } = await admin.from("school_modules").upsert({
          school_id, module_id, enabled,
        }, { onConflict: "school_id,module_id" });
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "update_module_config": {
        const { school_id, module_id, config } = payload;
        const { error } = await admin.from("school_modules").update({ config }).eq("school_id", school_id).eq("module_id", module_id);
        if (error) throw error;
        await audit(school_id);
        return json({ ok: true });
      }
      case "upsert_module": {
        const { module } = payload;
        const { error } = await admin.from("modules").upsert(module, { onConflict: "slug" });
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      case "archive_module": {
        const { module_id } = payload;
        const { error } = await admin.from("modules").update({ status: "archived" }).eq("id", module_id);
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      case "broadcast_announcement": {
        const { title, body: msg, priority, audience, target, scheduled_for } = payload;
        const { error } = await admin.from("platform_announcements").insert({
          title, body: msg, priority: priority ?? "normal",
          audience: audience ?? "all", target: target ?? {},
          scheduled_for: scheduled_for ?? null, created_by: user.id,
        });
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      case "update_ticket": {
        const { ticket_id, status, priority, assignee } = payload;
        const update: any = {};
        if (status) update.status = status;
        if (priority) update.priority = priority;
        if (assignee !== undefined) update.assignee = assignee;
        const { error } = await admin.from("support_tickets").update(update).eq("id", ticket_id);
        if (error) throw error;
        await audit(null, { ticket_id });
        return json({ ok: true });
      }
      case "reply_ticket": {
        const { ticket_id, message, internal } = payload;
        const { error } = await admin.from("support_messages").insert({
          ticket_id, author: user.id, body: message, internal: !!internal,
        });
        if (error) throw error;
        return json({ ok: true });
      }
      case "toggle_maintenance": {
        const { enabled, message } = payload;
        const { error } = await admin.from("platform_settings").update({
          maintenance_mode: enabled, maintenance_message: message ?? null,
        }).eq("id", 1);
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      case "update_settings": {
        const { fields } = payload;
        const allowed = ["brand","smtp","integrations"];
        const update: any = {};
        for (const k of allowed) if (k in fields) update[k] = fields[k];
        const { error } = await admin.from("platform_settings").update(update).eq("id", 1);
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      case "force_logout_user": {
        const { user_id, school_id } = payload;
        const { error } = await admin.auth.admin.signOut(user_id, "global");
        if (error) throw error;
        await admin.from("security_events").insert({ school_id: school_id ?? null, user_id, type: "force_logout" });
        await audit(school_id ?? null, { target_user: user_id });
        return json({ ok: true });
      }
      case "update_module_request": {
        const { request_id, status, module_id } = payload;
        const upd: any = { status };
        if (module_id !== undefined) upd.module_id = module_id;
        const { error } = await admin.from("module_requests").update(upd).eq("id", request_id);
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      case "grant_super": {
        const { user_id } = payload;
        const { error } = await admin.from("user_roles").insert({ user_id, role: "super_admin" });
        if (error && !error.message.includes("duplicate")) throw error;
        await audit(null, { target_user: user_id });
        return json({ ok: true });
      }
      case "revoke_super": {
        const { user_id } = payload;
        const { error } = await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "super_admin");
        if (error) throw error;
        await audit(null, { target_user: user_id });
        return json({ ok: true });
      }
      case "set_membership_status": {
        const { membership_id, status } = payload;
        const { error } = await admin.from("memberships").update({ status }).eq("id", membership_id);
        if (error) throw error;
        await audit(null, { membership_id });
        return json({ ok: true });
      }
      case "force_pin_reset": {
        const { membership_id } = payload;
        const { error } = await admin.from("memberships").update({ must_change_pin: true }).eq("id", membership_id);
        if (error) throw error;
        await audit(null, { membership_id });
        return json({ ok: true });
      }
      case "delete_announcement": {
        const { id } = payload;
        const { error } = await admin.from("platform_announcements")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        await audit(null, { id });
        return json({ ok: true });
      }
      case "soft_delete": {
        const { table, id, confirm } = payload;
        if (confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);
        const allowed = ["schools","memberships","announcements","platform_announcements","broadcast_jobs","support_tickets","client_errors"];
        if (!allowed.includes(table)) return json({ error: "invalid_table" }, 400);
        const { error } = await admin.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        await audit(null, { table, id });
        return json({ ok: true });
      }
      case "restore_deleted": {
        const { table, id } = payload;
        const allowed = ["schools","memberships","announcements","platform_announcements","broadcast_jobs","support_tickets","client_errors"];
        if (!allowed.includes(table)) return json({ error: "invalid_table" }, 400);
        const { error } = await admin.from(table).update({ deleted_at: null }).eq("id", id);
        if (error) throw error;
        await audit(null, { table, id });
        return json({ ok: true });
      }
      case "purge_now": {
        const { table, id, confirm } = payload;
        if (confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);
        const allowed = ["schools","memberships","announcements","platform_announcements","broadcast_jobs","support_tickets","client_errors"];
        if (!allowed.includes(table)) return json({ error: "invalid_table" }, 400);
        const { error } = await admin.from(table).delete().eq("id", id).not("deleted_at", "is", null);
        if (error) throw error;
        await audit(null, { table, id, hard: true });
        return json({ ok: true });
      }
      case "run_trash_maintenance": {
        const { error } = await admin.rpc("trash_and_errors_maintenance");
        if (error) throw error;
        await audit(null);
        return json({ ok: true });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error('[super-action] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});