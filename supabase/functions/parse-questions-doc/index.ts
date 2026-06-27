import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYS = `You are a strict exam-paper parser for a Nigerian school platform.
Convert the supplied document into the platform's standard MCQ format.
The source may be a scanned/photographed paper or a DOCX whose questions are embedded as images.
In that case perform OCR on every page/image, preserving question order, and then extract questions.
Return ONLY valid JSON of the form:
{"questions":[
  {"prompt":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"..."}
]}
Rules:
- ALWAYS produce 4 options per question. If the source has fewer, add plausible distractors. If more, keep the best 4.
- correct_index is 0-3. If the answer key is not present, set 0 and add "(answer not provided in source)" to explanation.
- Strip leading numbering like "1.", "(a)", "i)" from the prompt.
- Skip non-question content (instructions, headers, page numbers).
- Do not invent questions that are not in the document.
- For low-quality scans, do your best to reconstruct legible text; mark uncertain words with [?].
- Keep prompts under 1000 chars and each option under 300 chars.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Please sign in and try again." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "AI extraction is temporarily unavailable. Please try again later." }, 503);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in and try again." }, 401);

    const body = await req.json().catch(() => ({}));
    const filename: string = String(body?.filename ?? "paper");
    const mime: string = String(body?.mime ?? "application/pdf");
    const file_b64: string | undefined = body?.file_b64;
    const text: string | undefined = body?.text;
    const images_b64: string[] | undefined = Array.isArray(body?.images_b64) ? body.images_b64 : undefined;

    if (!file_b64 && !text && !(images_b64 && images_b64.length)) {
      return json({ error: "Provide a file, image(s), or text to parse." }, 400);
    }

    // Cap input size to protect quota (~8MB base64)
    if (file_b64 && file_b64.length > 8_000_000) {
      return json({ error: "File is too large. Please upload a document under 6MB." }, 413);
    }
    if (text && text.length > 200_000) {
      return json({ error: "Pasted text is too long. Please trim it." }, 413);
    }
    if (images_b64) {
      if (images_b64.length > 20) return json({ error: "Please upload at most 20 images at once." }, 413);
      const total = images_b64.reduce((s, b) => s + (b?.length || 0), 0);
      if (total > 16_000_000) return json({ error: "Images are too large. Please reduce size or count." }, 413);
    }

    const userContent: any[] = [
      { type: "text", text: "OCR the source if it is a scan or image, then extract every multiple-choice question. Return only the JSON." },
    ];
    if (file_b64) {
      userContent.push({
        type: "file",
        file: { filename, file_data: `data:${mime};base64,${file_b64}` },
      });
    }
    if (images_b64 && images_b64.length) {
      for (const b of images_b64) {
        const isData = b.startsWith("data:");
        userContent.push({
          type: "image_url",
          image_url: { url: isData ? b : `data:image/png;base64,${b}` },
        });
      }
    }
    if (text) {
      userContent.push({ type: "text", text });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Too many requests right now. Please retry shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI quota exhausted for this school." }, 402);
      console.error("[parse-questions-doc] ai status", aiRes.status);
      return json({ error: "AI extraction failed. Please try again." }, 502);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof content === "string" ? JSON.parse(content) : content; } catch {
      return json({ error: "Could not understand the document. Try a clearer file or paste the text." }, 422);
    }
    const raw: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];

    const questions = raw.map((q: any) => {
      const opts = Array.isArray(q?.options) ? q.options.map((o: any) => String(o ?? "").slice(0, 300)) : [];
      while (opts.length < 4) opts.push("");
      const ci = Number.isInteger(q?.correct_index) ? q.correct_index : 0;
      return {
        prompt: String(q?.prompt ?? "").slice(0, 1000).trim(),
        options: opts.slice(0, 4),
        correct_index: Math.max(0, Math.min(3, ci)),
        explanation: q?.explanation ? String(q.explanation).slice(0, 500) : null,
      };
    }).filter((q) => q.prompt.length > 0 && q.options.filter((o: string) => o.trim()).length >= 2);

    return json({ ok: true, questions });
  } catch (e) {
    console.error("[parse-questions-doc]", e);
    return json({ error: "Something went wrong while parsing. Please try again." }, 500);
  }
});