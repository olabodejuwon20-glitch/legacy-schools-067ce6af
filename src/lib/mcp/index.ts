import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import verifyResultTool from "./tools/verify-result";

export default defineMcp({
  name: "legacykool-mcp",
  title: "LegacyKool MCP",
  version: "0.1.0",
  instructions:
    "Tools for LegacyKool, a school management platform. Use `echo` to confirm connectivity, and `verify_result` to check whether a printed result slip (by its verification UUID) is authentic.",
  tools: [echoTool, verifyResultTool],
});