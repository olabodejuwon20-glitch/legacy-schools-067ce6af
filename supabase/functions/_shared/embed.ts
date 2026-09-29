// Shared embedding helper. Calls Lovable AI Gateway /embeddings.
// Returns 1536-dim vectors via openai/text-embedding-3-small (matches knowledge_chunks column).
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

export async function embedTexts(inputs: string[], model = "openai/text-embedding-3-small"): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (geminiKey) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/embeddings", {
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
    return (data.data ?? []).map((d: any) => {
      const emb: number[] = d.embedding ?? [];
      if (emb.length === 1536) return emb;
      if (emb.length > 1536) return emb.slice(0, 1536);
      return [...emb, ...new Array(1536 - emb.length).fill(0)];
    });
  }

  const endpoint = !lovableKey && openaiKey ? "https://api.openai.com/v1/embeddings" : EMBED_URL;
  const apiKey = (!lovableKey && openaiKey ? openaiKey : lovableKey) ?? "";
  const resolvedModel = !lovableKey && openaiKey ? model.replace(/^openai\//, "") : model;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: resolvedModel, input: inputs }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    console.error("[embed] gateway_failed", r.status, text.slice(0, 300));
    throw new Error("AI search is temporarily unavailable. Please try again later.");
  }
  const data = await r.json();
  return (data.data ?? []).map((d: any) => d.embedding as number[]);
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