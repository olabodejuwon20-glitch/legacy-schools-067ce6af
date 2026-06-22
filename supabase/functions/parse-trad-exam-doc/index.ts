import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYS = `You extract exam questions from a Nigerian school exam paper document.
Return ONLY valid JSON of the form:
{"questions":[
  {"type":"mcq","prompt":"...","options":["A","B","C","D"],"correct_index":0,"marks":1,"explanation":"..."},
  {"type":"theory","prompt":"...","model_answer":"...","marks":5}
]}
- Preserve question order.
- For MCQ, always include exactly 4 options. If the correct answer is unknown, set correct_index to 0.
- For theory questions, omit options/correct_index. Provide a brief model_answer when derivable.
- Default marks: MCQ=1, theory=5 unless explicitly stated.
- Strip question numbers (1., a), i.) from the prompt.
- Do not invent questions; only extract what is in the document.`;

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
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      console.error("[parse-trad-exam-doc] LOVABLE_API_KEY missing");
      return json({ error: "AI extraction is temporarily unavailable. Please try again later." }, 500);
    }

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    const user = u?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { upload_id } = await req.json();
    if (!upload_id) return json({ error: "upload_id required" }, 400);

    const admin = createClient(url, service);
    const { data: upload, error: upErr } = await admin
      .from("trad_exam_uploads")
      .select("id, school_id, exam_id, file_path, mime, uploaded_by")
      .eq("id", upload_id)
      .maybeSingle();
    if (upErr || !upload) return json({ error: "Upload not found" }, 404);

    // Authorization: teacher (author) or school admin
    const { data: isAdmin } = await admin.rpc("is_school_admin", {
      _school: upload.school_id, _user: user.id,
    });
    const { data: exam } = await admin
      .from("trad_exams").select("author_id").eq("id", upload.exam_id).maybeSingle();
    if (!isAdmin && exam?.author_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Download file from storage
    const { data: blob, error: dlErr } = await admin.storage
      .from("trad-exam-assets").download(upload.file_path);
    if (dlErr || !blob) {
      await admin.from("trad_exam_uploads").update({ status: "failed", error: dlErr?.message ?? "download failed" }).eq("id", upload_id);
      return json({ error: "Download failed" }, 500);
    }
    const buf = new Uint8Array(await blob.arrayBuffer());
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);

    const mime = upload.mime || "application/pdf";
    const fileBlock =
      mime.includes("pdf")
        ? { type: "file" as const, file: { filename: "paper.pdf", file_data: `data:application/pdf;base64,${b64}` } }
        : { type: "file" as const, file: { filename: "paper.docx", file_data: `data:${mime};base64,${b64}` } };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: [
              { type: "text", text: "Extract every question from this exam paper. Return only the JSON." },
              fileBlock,
            ] },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      await admin.from("trad_exam_uploads").update({ status: "failed", error: `AI ${aiRes.status}: ${errText.slice(0, 500)}` }).eq("id", upload_id);
      if (aiRes.status === 429) return json({ error: "Rate limit – try again shortly" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI extraction failed. Please try again." }, 500);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof content === "string" ? JSON.parse(content) : content; } catch {
      await admin.from("trad_exam_uploads").update({ status: "failed", error: "Invalid JSON from model" }).eq("id", upload_id);
      return json({ error: "Model returned invalid JSON" }, 500);
    }
    const questions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];

    // Determine starting position
    const { count: existing } = await admin
      .from("trad_exam_questions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", upload.exam_id);
    const startPos = existing ?? 0;

    const rows = questions.map((q, i) => {
      const type = q.type === "theory" ? "theory" : "mcq";
      return {
        school_id: upload.school_id,
        exam_id: upload.exam_id,
        position: startPos + i,
        type,
        prompt: String(q.prompt ?? "").slice(0, 4000),
        options: type === "mcq" ? (Array.isArray(q.options) ? q.options.slice(0, 4).map((o: any) => String(o)) : []) : null,
        correct_index: type === "mcq" ? (Number.isInteger(q.correct_index) ? q.correct_index : 0) : null,
        model_answer: type === "theory" ? (q.model_answer ? String(q.model_answer) : null) : null,
        marks: Number(q.marks) > 0 ? Number(q.marks) : (type === "mcq" ? 1 : 5),
        explanation: q.explanation ? String(q.explanation) : null,
        ai_generated: true,
      };
    }).filter(r => r.prompt.length > 0);

    if (rows.length > 0) {
      const { error: insErr } = await admin.from("trad_exam_questions").insert(rows);
      if (insErr) {
        console.error("[parse-trad-exam-doc] insert error", insErr);
        await admin.from("trad_exam_uploads").update({ status: "failed", error: "insert_failed" }).eq("id", upload_id);
        return json({ error: "Failed to save parsed questions" }, 500);
      }
    }

    await admin.from("trad_exam_uploads").update({
      status: "parsed",
      parse_meta: { count: rows.length },
      error: null,
    }).eq("id", upload_id);

    return json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("[parse-trad-exam-doc]", e);
    return json({ error: "An internal error occurred" }, 500);
  }
});