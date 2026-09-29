// Shared embedding helper for RAG (knowledge_chunks 1536-dim pgvector column).
// Uses OpenRouter (/api/v1/embeddings with openai/text-embedding-3-small -> native 1536-dim)
// and Direct Google Gemini (text-embedding-004 -> normalized to 1536-dim) with automatic failover.
const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";
const GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/openai/embeddings";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

function normalizeDim1536(emb: number[]): number[] {
  if (emb.length === 1536) return emb;
  if (emb.length > 1536) return emb.slice(0, 1536);
  return [...emb, ...new Array(1536 - emb.length).fill(0)];
}

export async function embedTexts(
  inputs: string[],
  model = "openai/text-embedding-3-small",
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  // 1. OpenRouter Embeddings (native 1536-dim via openai/text-embedding-3-small)
  if (openRouterKey) {
    try {
      const r = await fetch(OPENROUTER_EMBED_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://www.legacyschools.study",
          "X-Title": "Legacyskool OS",
        },
        body: JSON.stringify({
          model: model.includes("/") ? model : `openai/${model}`,
          input: inputs,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        return (data.data ?? []).map((d: any) => normalizeDim1536(d.embedding ?? []));
      }
      const text = await r.text().catch(() => "");
      console.warn("[embed] openrouter_failed", r.status, text.slice(0, 300));
    } catch (err) {
      console.warn("[embed] openrouter_network_error", err);
    }
  }

  // 2. Direct Google Gemini Embeddings fallback (text-embedding-004 padded to 1536-dim)
  if (geminiKey) {
    const r = await fetch(GEMINI_EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-004", input: inputs }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("[embed] gemini_failed", r.status, text.slice(0, 300));
      throw new Error("AI search is temporarily unavailable. Please try again later.");
    }
    const data = await r.json();
    return (data.data ?? []).map((d: any) => normalizeDim1536(d.embedding ?? []));
  }

  // 3. Direct OpenAI Embeddings fallback
  if (openaiKey) {
    const r = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.replace(/^openai\//, ""),
        input: inputs,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("[embed] openai_failed", r.status, text.slice(0, 300));
      throw new Error("AI search is temporarily unavailable. Please try again later.");
    }
    const data = await r.json();
    return (data.data ?? []).map((d: any) => normalizeDim1536(d.embedding ?? []));
  }

  throw new Error("AI search is temporarily unavailable (no embedding provider key configured).");
}

export async function embedOne(input: string, model?: string): Promise<number[]> {
  const [v] = await embedTexts([input], model);
  return v;
}

/** Naive char-based chunker with overlap. */
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + size, clean.length);
    out.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - overlap;
  }
  return out;
}
