// supabase/functions/assistant/index.ts
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/** Helper: vector similarity search using pgvector */
async function searchDocs(query: string, topK = 5): Promise<string> {
  // 1️⃣ embed the query using Gemini embedding model
  const gemini = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
  const embedModel = gemini.getGenerativeModel({ model: 'gemini-1.5-pro-embedding' });
  const embedRes = await embedModel.embedContent({
    role: 'user',
    parts: [{ text: query }],
  });
  const queryVector = embedRes.embedding?.values ?? [];

  // 2️⃣ call pgvector stored procedure "match_documents"
  const { data, error } = await supabase.rpc('match_documents', {
    query_vector: queryVector,
    match_count: topK,
  });
  if (error) throw error;
  // Concatenate the retrieved chunks
  return (data as any[]).map((d) => d.content).join('\n---\n');
}

/** Main handler */
export async function handler(req: Request) {
  const { action, payload } = await req.json();
  const allowed = ['ask', 'createTask', 'escalate'];
  if (!allowed.includes(action)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 403 });
  }

  // -------------------------------------------------
  // 1️⃣ Answer a question (RAG)
  // -------------------------------------------------
  if (action === 'ask') {
    const { question } = payload;
    const context = await searchDocs(question);
    const gemini = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const res = await model.generateContent(
      `You are the Super‑Admin Assistant for LegacySKool. Use ONLY the context below and your product knowledge to answer the user's question.

Context:
${context}

Question: ${question}
Answer concisely and include any relevant Supabase Dashboard navigation paths.`
    );
    const answer = res.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, I could not generate an answer.';
    return new Response(JSON.stringify({ answer }), { status: 200 });
  }

  // -------------------------------------------------
  // 2️⃣ Create a task in the `tasks` table
  // -------------------------------------------------
  if (action === 'createTask') {
    const { title, description, assignee = null, requestorId } = payload;
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, description, assignee, created_by: requestorId, status: 'open' });
    if (error) throw error;
    return new Response(JSON.stringify({ taskId: data[0].id }), { status: 201 });
  }

  // -------------------------------------------------
  // 3️⃣ Escalate to manager via webhook (Slack, Teams, etc.)
  // -------------------------------------------------
  if (action === 'escalate') {
    const { message, managerWebhook, requestorEmail } = payload;
    await fetch(managerWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🤖 Assistant request from ${requestorEmail}:\n${message}` }),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Fallback – should never hit because of the guard above
  return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400 });
}
