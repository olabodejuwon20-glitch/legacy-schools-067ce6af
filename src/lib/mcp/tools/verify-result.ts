import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "verify_result",
  title: "Verify student result slip",
  description:
    "Verify the authenticity of a LegacyKool result slip by its public verification UUID. Returns the published result summary or an error if the code is invalid.",
  inputSchema: {
    verification_id: z
      .string()
      .uuid()
      .describe("The UUID printed on the result slip QR / verification link."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ verification_id }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return {
        content: [{ type: "text", text: "Backend not configured." }],
        isError: true,
      };
    }
    // Forward the caller's verified OAuth token so RLS runs as that user.
    const client = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("verify_result_slip", { _id: verification_id });
    if (error) {
      return {
        content: [{ type: "text", text: `Verification failed: ${error.message}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { result: data },
    };
  },
});