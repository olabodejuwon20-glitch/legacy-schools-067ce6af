import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Map our internal subject code -> ALOC subject slug
const ALOC_SUBJECT: Record<string, string> = {
  math: "mathematics",
  english: "english",
  physics: "physics",
  chemistry: "chemistry",
  biology: "biology",
  economics: "economics",
  government: "government",
  literature: "literature-in-english",
  crs: "christian-religious-studies",
  irs: "islamic-religious-studies",
  geography: "geography",
  agric: "agricultural-science",
  civic: "civic-education",
  fmath: "further-mathematics",
  commerce: "commerce",
};

function decodeHtml(s: string): string {
  return (s || "")
    .replace(/<sup>(.*?)<\/sup>/gi, "^$1")
    .replace(/<sub>(.*?)<\/sub>/gi, "_$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?p>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = Deno.env.get("Aloc_Access_Token");
    if (!token) return json({ error: "ALOC token missing" }, 500);

    const { school_id, mode, subject_ids } = await req.json();
    if (!school_id || !Array.isArray(subject_ids) || !subject_ids.length) {
      return json({ error: "school_id and subject_ids required" }, 400);
    }
    const examType = mode === "jamb_sim" ? "utme" : "wassce";

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    // Auth: require signed-in school admin or teacher for the supplied school
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: membership } = await admin
      .from("memberships")
      .select("role,status")
      .eq("school_id", school_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership || !["admin", "teacher", "student"].includes(membership.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: subs, error: sErr } = await admin
      .from("mock_subjects")
      .select("id, code, name")
      .eq("school_id", school_id)
      .in("id", subject_ids);
    if (sErr) throw sErr;

    let totalInserted = 0;
    for (const subj of subs ?? []) {
      const alocCode = ALOC_SUBJECT[subj.code];
      if (!alocCode) continue;

      // Pull 20 questions (ALOC /m endpoint returns up to 20 per call)
      const r = await fetch(
        `https://questions.aloc.com.ng/api/v2/m/20?subject=${alocCode}&type=${examType}`,
        { headers: { AccessToken: token, Accept: "application/json" } },
      );
      if (!r.ok) { console.warn(`ALOC ${subj.code} ${r.status}`); continue; }
      const body = await r.json();
      const items: any[] = Array.isArray(body?.data) ? body.data : (body?.data ? [body.data] : []);
      if (!items.length) continue;

      // Replace existing questions for this subject so the bank stays fresh
      await admin.from("mock_questions").delete().eq("subject_id", subj.id);

      const rows = items.slice(0, 20).map((q, i) => {
        const opt = q.option ?? {};
        const letters = ["a", "b", "c", "d", "e"];
        const opts = letters.map(L => opt[L]).filter(v => v != null && v !== "").map(decodeHtml);
        const correctLetter = String(q.answer ?? "a").toLowerCase().trim();
        const correctIdx = Math.max(0, letters.indexOf(correctLetter));
        return {
          school_id,
          subject_id: subj.id,
          position: i + 1,
          prompt: decodeHtml(q.question ?? ""),
          options: opts,
          correct_index: Math.min(correctIdx, Math.max(0, opts.length - 1)),
          explanation: decodeHtml(q.solution ?? "") || `Past question · ${q.examtype ?? examType} ${q.examyear ?? ""}`.trim(),
        };
      }).filter(r => r.prompt && r.options.length >= 2);

      if (rows.length) {
        const { error: insErr } = await admin.from("mock_questions").insert(rows);
        if (insErr) { console.error("insert", subj.code, insErr.message); continue; }
        totalInserted += rows.length;
      }
    }

    return json({ ok: true, inserted: totalInserted });
  } catch (e) {
    console.error("[fetch-aloc-questions]", e);
    return json({ error: "An internal error occurred" }, 500);
  }
});