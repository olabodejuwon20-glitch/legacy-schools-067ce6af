// Shared Lovable AI Gateway helper used by every AI edge function.
// Handles: auth context, per-school quota check, model routing, retries,
// 402/429 surfacing, and writes a row to public.ai_jobs with cost + tokens.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { cacheKey, getCached, putCached } from "./ai-cache.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Rough per-1k-token pricing in USD (approximate, used only for budget tracking).
const PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash":        { in: 0.000075, out: 0.0003 },
  "google/gemini-2.5-flash-lite":   { in: 0.00004,  out: 0.00015 },
  "google/gemini-2.5-pro":          { in: 0.00125,  out: 0.005 },
  "google/gemini-3-flash-preview":  { in: 0.0001,   out: 0.0004 },
  "openai/gpt-5":                   { in: 0.0025,   out: 0.01 },
  "openai/gpt-5-mini":              { in: 0.00025,  out: 0.001 },
  "openai/gpt-5.4-mini":            { in: 0.0003,   out: 0.0012 },
};

export interface AiCallOptions {
  schoolId: string;
  userId?: string | null;
  kind: string;                       // e.g. "lesson_plan", "mark_essay", "principal_query"
  model?: string;                     // default: gemini-3-flash-preview
  /** Caller's role — used to pick a per-role override from ai_model_routing. */
  role?: "admin" | "teacher" | "student" | "parent" | "default";
  messages: any[];
  tools?: any[];
  tool_choice?: any;
  reasoning?: { effort: string };
  temperature?: number;
  stream?: boolean;
  inputForLog?: any;                  // stored on ai_jobs.input
  /** Skip writing to ai_jobs (rare; e.g. for ephemeral diagnostics). */
  skipLog?: boolean;
  /** Bypass the cache (force a fresh model call). */
  skipCache?: boolean;
  /** Override TTL for the cached response, in days. */
  cacheTtlDays?: number;
  /** Extra scope mixed into the cache key (e.g. { class_id, locale }). */
  cacheScope?: Record<string, any>;
}

export interface AiCallResult {
  reply: string;
  toolCalls?: any[];
  raw: any;
  jobId: string | null;
  usage: { prompt: number; completion: number; total: number };
  costUsd: number;
  model: string;
}

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _admin;
}

export function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Resolve the authenticated Supabase user from the request's bearer token. */
export async function getAuthedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data } = await userClient.auth.getUser();
  return data?.user ?? null;
}

function priceFor(model: string, prompt: number, completion: number) {
  const p = PRICING[model] ?? { in: 0.0001, out: 0.0004 };
  return (prompt / 1000) * p.in + (completion / 1000) * p.out;
}

/** Check the school still has budget. Returns null if OK, or a message if blocked. */
export async function checkQuota(schoolId: string): Promise<string | null> {
  const { data } = await admin()
    .from("school_ai_quotas")
    .select("enabled, monthly_token_cap, monthly_cost_cap_usd, tokens_used, cost_used_usd, period_start")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!data) return null;                     // no row = uses default cap, fine
  if (!data.enabled) return "AI features disabled for this school.";
  // Reset window check is handled by bump_ai_quota; here we only block when current window is over cap.
  const now = new Date();
  const periodStart = new Date(data.period_start);
  const sameMonth =
    periodStart.getUTCFullYear() === now.getUTCFullYear() &&
    periodStart.getUTCMonth() === now.getUTCMonth();
  if (!sameMonth) return null;                // new month, counter will reset on next bump
  if (Number(data.tokens_used) >= Number(data.monthly_token_cap)) {
    return "Monthly AI token budget reached. Ask your school admin to top up.";
  }
  if (Number(data.cost_used_usd) >= Number(data.monthly_cost_cap_usd)) {
    return "Monthly AI cost budget reached. Ask your school admin to top up.";
  }
  return null;
}

/**
 * Resolve which model to use for (schoolId, kind, role) from ai_model_routing.
 * Falls back to role='default' for the kind, then to the system default.
 */
export async function resolveModel(
  schoolId: string,
  kind: string,
  role: string = "default",
  fallback = "google/gemini-3-flash-preview",
): Promise<string> {
  try {
    const { data } = await admin()
      .from("ai_model_routing")
      .select("role, model")
      .eq("school_id", schoolId)
      .eq("task_kind", kind)
      .in("role", [role, "default"]);
    if (data && data.length) {
      const exact = data.find((r: any) => r.role === role);
      if (exact) return exact.model;
      const def = data.find((r: any) => r.role === "default");
      if (def) return def.model;
    }
  } catch (_) { /* ignore */ }
  return fallback;
}

/**
 * Non-streaming AI call. Logs to ai_jobs. Returns the reply text + tool calls.
 * Throws on gateway error (caller converts to HTTP response).
 */
export async function aiCall(opts: AiCallOptions): Promise<AiCallResult> {
  const model = opts.model
    ?? await resolveModel(opts.schoolId, opts.kind, opts.role ?? "default");
  const t0 = Date.now();

  // Enforce per-school AI quota before any spend
  const blocked = await checkQuota(opts.schoolId);
  if (blocked) {
    const e: any = new Error(blocked); e.status = 402; throw e;
  }

  // Cache lookup (skip for streaming or when explicitly bypassed).
  const cacheable = !opts.stream && !opts.skipCache;
  let key: string | null = null;
  if (cacheable) {
    try {
      key = await cacheKey(opts.kind, model, opts.messages, {
        ...(opts.cacheScope ?? {}),
        school_id: opts.schoolId,
        tools: opts.tools ?? null,
        tool_choice: opts.tool_choice ?? null,
        temperature: opts.temperature ?? null,
        reasoning: opts.reasoning ?? null,
      });
      const hit = await getCached(key);
      if (hit) {
        let jobId: string | null = null;
        if (!opts.skipLog) {
          const { data: job } = await admin()
            .from("ai_jobs")
            .insert({
              school_id: opts.schoolId,
              user_id: opts.userId ?? null,
              kind: opts.kind,
              status: "done",
              model,
              input: opts.inputForLog ?? null,
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
              cost_usd: 0,
              latency_ms: Date.now() - t0,
              finished_at: new Date().toISOString(),
              output: { cached: true, reply: String(hit.response?.reply ?? "").slice(0, 4000) },
            })
            .select("id")
            .single();
          jobId = job?.id ?? null;
        }
        return {
          reply: hit.response?.reply ?? "",
          toolCalls: hit.response?.toolCalls ?? undefined,
          raw: { cached: true, ...hit.response?.raw },
          jobId,
          usage: { prompt: 0, completion: 0, total: 0 },
          costUsd: 0,
          model,
        };
      }
    } catch (_) { /* ignore — fall through to live call */ }
  }

  // Insert queued job row (best-effort)
  let jobId: string | null = null;
  if (!opts.skipLog) {
    const { data: job } = await admin()
      .from("ai_jobs")
      .insert({
        school_id: opts.schoolId,
        user_id: opts.userId ?? null,
        kind: opts.kind,
        status: "running",
        model,
        input: opts.inputForLog ?? null,
      })
      .select("id")
      .single();
    jobId = job?.id ?? null;
  }

  try {
    const body: any = {
      model,
      messages: opts.messages,
      stream: false,
    };
    if (opts.tools) body.tools = opts.tools;
    if (opts.tool_choice) body.tool_choice = opts.tool_choice;
    if (opts.reasoning) body.reasoning = opts.reasoning;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;

    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      const err =
        r.status === 429 ? "Rate limit reached. Please try again in a moment."
        : r.status === 402 ? "AI is temporarily unavailable. Please try again later."
        : "AI is temporarily unavailable. Please try again later.";
      if (jobId) {
        await admin().from("ai_jobs").update({
          status: "error", error: err,
          finished_at: new Date().toISOString(), latency_ms: Date.now() - t0,
        }).eq("id", jobId);
      }
      const e: any = new Error(err); e.status = r.status; throw e;
    }

    const data = await r.json();
    const msg = data.choices?.[0]?.message ?? {};
    const reply: string = msg.content ?? "";
    const toolCalls = msg.tool_calls ?? undefined;
    const usage = {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    };
    const costUsd = priceFor(model, usage.prompt, usage.completion);

    if (jobId) {
      await admin().from("ai_jobs").update({
        status: "done",
        prompt_tokens: usage.prompt,
        completion_tokens: usage.completion,
        total_tokens: usage.total,
        cost_usd: costUsd,
        latency_ms: Date.now() - t0,
        finished_at: new Date().toISOString(),
        output: { reply: reply.slice(0, 4000), tool_calls: toolCalls ?? null },
      }).eq("id", jobId);
    }
    // Persist to cache (best-effort).
    if (cacheable && key) {
      try {
        await putCached(key, opts.schoolId, opts.kind, model,
          { reply, toolCalls: toolCalls ?? null },
          { prompt: usage.prompt, completion: usage.completion },
          costUsd, opts.cacheTtlDays);
      } catch (_) { /* ignore */ }
    }
    // Best-effort quota bump
    try {
      await admin().rpc("bump_ai_quota", {
        _school_id: opts.schoolId,
        _tokens: usage.total,
        _cost: costUsd,
      });
    } catch (_) { /* ignore */ }

    return { reply, toolCalls, raw: data, jobId, usage, costUsd, model };
  } catch (e: any) {
    if (jobId && !e.status) {
      await admin().from("ai_jobs").update({
        status: "error", error: String(e?.message || e).slice(0, 500),
        finished_at: new Date().toISOString(), latency_ms: Date.now() - t0,
      }).eq("id", jobId);
    }
    throw e;
  }
}