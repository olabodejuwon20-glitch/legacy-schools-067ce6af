import { defineTool } from "@lovable.dev/mcp-js";
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
  handler: async ({ verification_id }) => {
    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return {
        content: [{ type: "text", text: "Backend not configured." }],
        isError: true,
      };
    }
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("verify_result_slip", { _id: verification_id });
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