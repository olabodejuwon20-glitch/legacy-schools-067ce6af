// Shared Direct Gemini + OpenRouter AI Gateway helper used by every AI edge function.
// Handles: auth context, per-school quota check, model routing, Direct Gemini -> OpenRouter
// automatic failover, 402/429 surfacing, response caching, and writes a row to public.ai_jobs.
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { cacheKey, getCached, putCached } from "./ai-cache.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_OPENAI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// Rough per-1k-token pricing in USD (fallback when provider response omits usage.cost).
const PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash":        { in: 0.00015,  out: 0.0006 },
  "google/gemini-2.5-flash-lite":   { in: 0.000075, out: 0.0003 },
  "google/gemini-2.5-pro":          { in: 0.00125,  out: 0.005 },
  "google/gemini-3-flash-preview":  { in: 0.00015,  out: 0.0006 },
  "openai/gpt-4o-mini":             { in: 0.00015,  out: 0.0006 },
  "openai/gpt-4o":                  { in: 0.0025,   out: 0.01 },
  "openai/gpt-5-nano":              { in: 0.00015,  out: 0.0006 },
  "openai/gpt-5-mini":              { in: 0.00025,  out: 0.001 },
  "openai/gpt-5":                   { in: 0.0025,   out: 0.01 },
  "anthropic/claude-3.5-sonnet":    { in: 0.003,    out: 0.015 },
};

export interface AiCallOptions {
  schoolId: string;
  userId?: string | null;
  kind: string;                       // e.g. "lesson_plan", "mark_essay", "principal_query"
  model?: string;                     // default: google/gemini-2.5-flash
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

/** Check whether at least one upstream AI provider key is configured. */
export function hasAiKey(): boolean {
  return Boolean(
    Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_AI_API_KEY") ||
    Deno.env.get("OPENROUTER_API_KEY") ||
    Deno.env.get("OPENAI_API_KEY"),
  );
}

/** Parse JSON safely even when a model wraps output in ```json ... ``` fences. */
export function parseAiJson<T = any>(raw: string | unknown, fallback: T = {} as T): T {
  if (!raw) return fallback;
  if (typeof raw === "object") return raw as T;
  const text = String(raw).trim();
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through
      }
    }
    return fallback;
  }
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
  const p = PRICING[model] ?? { in: 0.00015, out: 0.0006 };
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
 * Falls back to role='default' for the kind, then to google/gemini-2.5-flash.
 */
export async function resolveModel(
  schoolId: string,
  kind: string,
  role: string = "default",
  fallback = "google/gemini-2.5-flash",
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

/** Normalize legacy model aliases for OpenRouter (vendor/model format). */
function normalizeOpenRouterModel(rawModel: string): string {
  const m = rawModel.trim();
  if (!m) return "google/gemini-2.5-flash";
  if (m === "google/gemini-3-flash-preview" || m === "gemini-3-flash-preview") {
    return "google/gemini-2.5-flash";
  }
  if (m === "openai/gpt-5-nano" || m === "openai/gpt-5-mini" || m === "openai/gpt-5.4-mini") {
    return "openai/gpt-4o-mini";
  }
  if (m === "openai/gpt-5" || m === "openai/gpt-5.4" || m === "openai/gpt-5.5") {
    return "openai/gpt-4o";
  }
  if (!m.includes("/")) {
    if (m.startsWith("gemini")) return `google/${m}`;
    if (m.startsWith("gpt-")) return `openai/${m}`;
    if (m.startsWith("claude-")) return `anthropic/${m}`;
  }
  return m;
}

/** Normalize model ID for Google's direct OpenAI-compatible Gemini endpoint. */
function normalizeDirectGeminiModel(rawModel: string): string {
  const clean = rawModel
    .trim()
    .replace(/^google\//, "")
    .replace(/^gemini-3-flash-preview$/, "gemini-2.5-flash");
  if (clean.startsWith("gemini-")) return clean;
  return "gemini-2.5-flash";
}

/** Detect if messages contain multimodal file blocks (e.g. PDF/DOCX base64) or audio blocks. */
function hasSpecialMultimodalBlocks(messages: any[]): boolean {
  if (!Array.isArray(messages)) return false;
  for (const msg of messages) {
    if (!Array.isArray(msg?.content)) continue;
    for (const part of msg.content) {
      if (part?.type === "file" || part?.type === "input_audio") return true;
    }
  }
  return false;
}

/**
 * Dual-engine AI Gateway caller:
 * - Uses Direct Google Gemini (`GEMINI_API_KEY` / `GOOGLE_AI_API_KEY`) for standard Gemini requests
 * - Uses OpenRouter (`OPENROUTER_API_KEY`) to assist Gemini:
 *   1. Automatic failover whenever Direct Gemini is unconfigured, rate-limited (429), or errors (4xx/5xx)
 *   2. Primary handler for multimodal document/audio blocks (`file`, `input_audio`) and non-Google models (`openai/*`, `anthropic/*`)
 *   3. Built-in OpenRouter model fallback array (`google/gemini-2.5-flash` -> `google/gemini-2.5-flash-lite` -> `openai/gpt-4o-mini`)
 */
export async function callAiGateway(payload: Record<string, any>): Promise<Response> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  const rawModel = String(payload.model || "google/gemini-2.5-flash");
  const isGeminiModel = rawModel.startsWith("google/") || rawModel.startsWith("gemini");
  const needsOpenRouterMultimodal = hasSpecialMultimodalBlocks(payload.messages);

  // 1. Try Direct Gemini first if GEMINI_API_KEY is configured, model is Gemini, and no special file/audio blocks
  if (geminiKey && isGeminiModel && !needsOpenRouterMultimodal) {
    const geminiBody: Record<string, any> = {
      ...payload,
      model: normalizeDirectGeminiModel(rawModel),
    };
    if (geminiBody.reasoning) delete geminiBody.reasoning;

    try {
      const geminiRes = await fetch(GEMINI_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${geminiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiBody),
      });

      if (geminiRes.ok || !openRouterKey) {
        return geminiRes;
      }
      console.warn(
        `[ai-gateway] Direct Gemini returned ${geminiRes.status}; failing over to OpenRouter assistant.`,
      );
    } catch (err) {
      if (!openRouterKey) throw err;
      console.warn("[ai-gateway] Direct Gemini network error; failing over to OpenRouter assistant:", err);
    }
  }

  // 2. OpenRouter AI Gateway (assists Gemini + handles multi-vendor routing & fallbacks)
  if (openRouterKey) {
    const primaryModel = normalizeOpenRouterModel(rawModel);
    const fallbackModels = [
      primaryModel,
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "openai/gpt-4o-mini",
    ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

    const openRouterBody: Record<string, any> = {
      ...payload,
      model: primaryModel,
      models: fallbackModels.slice(0, 3),
    };

    return fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.legacyschools.study",
        "X-Title": "Legacyskool OS",
      },
      body: JSON.stringify(openRouterBody),
    });
  }

  // 3. Direct Gemini fallback even for special multimodal blocks if OpenRouter is not configured
  if (geminiKey) {
    const geminiBody: Record<string, any> = {
      ...payload,
      model: normalizeDirectGeminiModel(rawModel),
    };
    if (geminiBody.reasoning) delete geminiBody.reasoning;
    return fetch(GEMINI_OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiBody),
    });
  }

  // 4. Direct OpenAI fallback if only OPENAI_API_KEY is present
  if (openaiKey) {
    const resolvedModel = rawModel.startsWith("openai/")
      ? rawModel.replace(/^openai\//, "")
      : "gpt-4o-mini";
    return fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, model: resolvedModel }),
    });
  }

  return new Response(
    JSON.stringify({ error: "No AI provider key configured (set GEMINI_API_KEY or OPENROUTER_API_KEY)." }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
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

    const r = await callAiGateway(body);

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("[aiCall] upstream error", r.status, text.slice(0, 400));
      const err =
        r.status === 429 ? "Rate limit reached. Please try again in a moment."
        : r.status === 402 ? "AI credits exhausted. Please top up your AI gateway balance."
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
    const resolvedModel = String(data.model || model);
    const msg = data.choices?.[0]?.message ?? {};
    const reply: string = msg.content ?? "";
    const toolCalls = msg.tool_calls ?? undefined;
    const usage = {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    };
    const costUsd = typeof data.usage?.cost === "number"
      ? Number(data.usage.cost)
      : priceFor(resolvedModel, usage.prompt, usage.completion);

    if (jobId) {
      await admin().from("ai_jobs").update({
        status: "done",
        model: resolvedModel,
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
        await putCached(key, opts.schoolId, opts.kind, resolvedModel,
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

    return { reply, toolCalls, raw: data, jobId, usage, costUsd, model: resolvedModel };
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
