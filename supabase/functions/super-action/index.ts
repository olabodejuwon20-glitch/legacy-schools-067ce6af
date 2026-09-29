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

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const { action, payload = {} } = body ?? {};
  if (!action || typeof action !== "string") return json({ error: "missing action" }, 400);

  const admin = createClient(url, service);

  if (action === "claim_super_admin") {
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "super_admin" }, { onConflict: "user_id,role" });
    if (roleErr) return json({ error: roleErr.message }, 500);
    return json({ ok: true, is_super_admin: true });
  }

  if (action === "self_suspend_30_days") {
    const { scope, school_id, reason } = payload;
    const nowIso = new Date().toISOString();
    if (scope === "school" && school_id) {
      const { data: m } = await admin.from("memberships").select("role").eq("user_id", user.id).eq("school_id", school_id).eq("role", "admin").maybeSingle();
      const { data: s } = await admin.rpc("is_super_admin", { _user: user.id });
      if (!m && !s) return json({ error: "Only a school admin can suspend this school" }, 403);
      const { error } = await admin.from("schools").update({
        status: "suspended",
        suspended_reason: reason ?? "Suspended for 30 days (scheduled for deletion)",
        deleted_at: nowIso,
      }).eq("id", school_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, mode: "suspended_30d" });
    }
    let q = admin.from("memberships").update({ status: "suspended", deleted_at: nowIso }).eq("user_id", user.id);
    if (school_id) q = q.eq("school_id", school_id);
    const { error } = await q;
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, mode: "suspended_30d" });
  }

  if (action === "self_delete_account") {
    const { scope, school_id, confirm } = payload;
    if (confirm !== "DELETE") return json({ error: "Type DELETE to confirm permanent deletion." }, 400);
    if (scope === "school" && school_id) {
      const { data: m } = await admin.from("memberships").select("role").eq("user_id", user.id).eq("school_id", school_id).eq("role", "admin").maybeSingle();
      const { data: s } = await admin.rpc("is_super_admin", { _user: user.id });
      if (!m && !s) return json({ error: "Only a school admin can delete this school" }, 403);
      await admin.from("school_modules").delete().eq("school_id", school_id);
      await admin.from("invite_codes").delete().eq("school_id", school_id);
      await admin.from("memberships").delete().eq("school_id", school_id);
      const { error } = await admin.from("schools").delete().eq("id", school_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, mode: "deleted_permanently" });
    }
    await admin.from("memberships").delete().eq("user_id", user.id);
    await admin.from("user_roles").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, mode: "deleted_permanently" });
  }

  const { data: isSuper } = await admin.rpc("is_super_admin", { _user: user.id });
  if (!isSuper) return json({ error: "forbidden" }, 403);

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
      case "suspend_30_days": {
        const { table, id, reason } = payload;
        const nowIso = new Date().toISOString();
        if (table === "schools") {
          const { error } = await admin.from("schools").update({
            status: "suspended",
            suspended_reason: reason ?? "Suspended for 30 days (auto-purges after 30d)",
            deleted_at: nowIso,
          }).eq("id", id);
          if (error) throw error;
          await audit(id, { mode: "suspend_30_days", reason });
          return json({ ok: true });
        }
        if (table === "memberships") {
          const { error } = await admin.from("memberships").update({
            status: "suspended",
            deleted_at: nowIso,
          }).eq("id", id);
          if (error) throw error;
          await audit(null, { table, id, mode: "suspend_30_days" });
          return json({ ok: true });
        }
        return json({ error: "invalid_table" }, 400);
      }
      case "hard_delete": {
        const { table, id, user_id, confirm } = payload;
        if (confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);
        if (table === "schools") {
          await admin.from("school_modules").delete().eq("school_id", id);
          await admin.from("invite_codes").delete().eq("school_id", id);
          await admin.from("memberships").delete().eq("school_id", id);
          const { error } = await admin.from("schools").delete().eq("id", id);
          if (error) throw error;
          await audit(null, { table: "schools", id, hard: true });
          return json({ ok: true });
        }
        if (table === "memberships") {
          const { error } = await admin.from("memberships").delete().eq("id", id);
          if (error) throw error;
          if (user_id) {
            const { count } = await admin.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", user_id);
            const { data: sup } = await admin.rpc("is_super_admin", { _user: user_id });
            if ((count ?? 0) === 0 && !sup) {
              await admin.from("profiles").delete().eq("id", user_id);
              await admin.auth.admin.deleteUser(user_id);
            }
          }
          await audit(null, { table: "memberships", id, user_id, hard: true });
          return json({ ok: true });
        }
        return json({ error: "invalid_table" }, 400);
      }
      case "provision_sandbox_school": {
        const slug = "internal-sandbox";
        let { data: existing } = await admin.from("schools").select("*").eq("slug", slug).maybeSingle();
        if (!existing) {
          const { data: created, error: cErr } = await admin.from("schools").insert({
            name: "Internal QA Sandbox School",
            slug,
            email: user.email ?? "qa-sandbox@legacyskool.local",
            plan: "enterprise",
            status: "active",
            pilot_status: "converted",
            motto: "Internal Feature Verification & Staging Environment",
            current_session: "2025/2026",
            current_term: "Term 2",
          }).select("*").single();
          if (cErr) throw cErr;
          existing = created;
        } else if (existing.deleted_at || existing.status !== "active") {
          const { data: updated } = await admin.from("schools").update({
            deleted_at: null,
            status: "active",
            suspended_reason: null,
            plan: "enterprise",
          }).eq("id", existing.id).select("*").single();
          if (updated) existing = updated;
        }
        const sid = existing.id;
        for (const role of ["admin", "teacher", "student", "parent"]) {
          await admin.from("memberships").upsert(
            { user_id: user.id, school_id: sid, role, status: "active", deleted_at: null },
            { onConflict: "user_id,school_id,role" }
          );
        }
        const { count: clsCount } = await admin.from("classes").select("id", { count: "exact", head: true }).eq("school_id", sid);
        if ((clsCount ?? 0) === 0) {
          await admin.from("classes").insert([
            { school_id: sid, name: "JSS 1 Sandbox", code: "JSS1-SB", subject: "Mathematics", teacher_id: user.id },
            { school_id: sid, name: "SS 3 Sandbox", code: "SS3-SB", subject: "English Language", teacher_id: user.id },
          ]);
        }
        await audit(sid, { action: "provision_sandbox_school" });
        return json({ ok: true, school: existing });
      }
      case "create_lab_feature": {
        const { slug, name, category, version, description, sandbox_school_id, default_config } = payload;
        if (!slug || !name) return json({ error: "Slug and name are required" }, 400);
        const cfg = {
          ...(default_config ?? {}),
          description: description ?? "",
          lab_stage: "testing",
          checklist: {
            sandbox_mounted: true,
            admin_verified: false,
            teacher_verified: false,
            student_verified: false,
            parent_verified: false,
            rls_verified: false,
          },
          created_in_lab_at: new Date().toISOString(),
        };
        const { data: mod, error } = await admin.from("modules").upsert({
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
          name: name.trim(),
          category: category || "general",
          status: "testing",
          version: version || "0.1.0-rc1",
          global_default: false,
          pricing_model: payload.pricing_model || "included",
          term_price_kobo: Number(payload.term_price_kobo ?? 0),
          monthly_price_cents: 0,
          default_config: cfg,
        }, { onConflict: "slug" }).select("*").single();
        if (error) throw error;
        if (sandbox_school_id && mod?.id) {
          await admin.from("school_modules").upsert({
            school_id: sandbox_school_id,
            module_id: mod.id,
            enabled: true,
            beta: true,
            config: cfg,
          }, { onConflict: "school_id,module_id" });
        }
        await audit(sandbox_school_id ?? null, { module_id: mod?.id, slug });
        return json({ ok: true, module: mod });
      }
      case "update_lab_checklist": {
        const { module_id, checklist, qa_notes } = payload;
        const { data: cur } = await admin.from("modules").select("default_config").eq("id", module_id).single();
        const nextCfg = {
          ...((cur?.default_config as any) ?? {}),
          checklist,
          qa_notes: qa_notes ?? ((cur?.default_config as any)?.qa_notes ?? ""),
          updated_in_lab_at: new Date().toISOString(),
        };
        const { error } = await admin.from("modules").update({ default_config: nextCfg }).eq("id", module_id);
        if (error) throw error;
        await audit(null, { module_id, checklist });
        return json({ ok: true, default_config: nextCfg });
      }
      case "rollout_lab_feature": {
        const { module_id, global_default, enable_all_schools } = payload;
        const { data: mod, error: fErr } = await admin.from("modules").select("*").eq("id", module_id).single();
        if (fErr || !mod) return json({ error: "Module not found" }, 404);
        const nextCfg = {
          ...((mod.default_config as any) ?? {}),
          lab_stage: "approved_production",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        };
        const { error: uErr } = await admin.from("modules").update({
          status: "available",
          global_default: !!global_default,
          default_config: nextCfg,
        }).eq("id", module_id);
        if (uErr) throw uErr;

        if (enable_all_schools) {
          const { data: allSchools } = await admin.from("schools").select("id").is("deleted_at", null).eq("status", "active");
          if (allSchools && allSchools.length > 0) {
            const rows = allSchools.map((s: any) => ({
              school_id: s.id,
              module_id: mod.id,
              enabled: true,
              beta: false,
              config: nextCfg,
            }));
            await admin.from("school_modules").upsert(rows, { onConflict: "school_id,module_id" });
          }
        }
        await audit(null, { module_id: mod.id, slug: mod.slug, rollout: "approved_to_products", enable_all_schools });
        return json({ ok: true, module: { ...mod, status: "available", global_default: !!global_default, default_config: nextCfg } });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error('[super-action] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});