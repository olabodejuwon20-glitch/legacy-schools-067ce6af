import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import verifyResultTool from "./tools/verify-result";

// Build the OAuth issuer from the Supabase project ref (Vite inlines this at
// build time so the module stays import-safe). Never derive the issuer from
// SUPABASE_URL — on Lovable Cloud that is a .lovable.cloud proxy and mcp-js
// rejects any token whose configured issuer doesn't match the discovery
// document's issuer.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "legacykool-mcp",
  title: "LegacyKool MCP",
  version: "0.1.0",
  instructions:
    "Tools for LegacyKool, a school management platform. Use `echo` to confirm connectivity, and `verify_result` to check whether a printed result slip (by its verification UUID) is authentic.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool, verifyResultTool],
});