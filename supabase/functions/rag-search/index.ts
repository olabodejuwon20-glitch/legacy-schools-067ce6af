// Tenant-scoped semantic search over knowledge_chunks.
// Input: { school_id, query, k?, class_id?, student_id? }
// Output: { results: [{ chunk_id, document_id, title, content, similarity, visibility }] }
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getAuthedUser } from "../_shared/ai-call.ts";
import { embedOne } from "../_shared/embed.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const { school_id, query, k = 6, class_id = null, student_id = null } = await req.json();
    if (!school_id || !query) return jsonResponse({ error: "school_id and query required" }, 400);

    // Verify membership
    const { data: mem } = await admin
      .from("memberships")
      .select("id, role").eq("school_id", school_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!mem) return jsonResponse({ error: "not a member of this school" }, 403);

    // Students can only query their own private docs; ignore any client-supplied student_id.
    const effectiveStudentId =
      mem.role === "student" ? user.id : (student_id ?? null);

    const vec = await embedOne(query);
    const { data, error } = await admin.rpc("match_knowledge_chunks", {
      _school_id: school_id,
      _query_embedding: vec as any,
      _match_count: Math.min(Math.max(k, 1), 20),
      _class_id: class_id,
      _student_id: effectiveStudentId,
    });
    if (error) throw error;

    return jsonResponse({ results: data ?? [] });
  } catch (e: any) {
    console.error("rag-search error", e);
    console.error("[rag-search]", e);
    return jsonResponse({ error: "An internal error occurred" }, 500);
  }
});