import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { runSecurityScan } from "@/lib/agents.server";

export default defineTool({
  name: "scan_code",
  title: "Scan code for vulnerabilities",
  description:
    "Run the SentinelOps Cybersecurity Agent over a source snippet and return findings, severities, CWE mappings and suggested patches.",
  inputSchema: {
    source: z.string().min(1).describe("Raw source code or configuration to audit."),
    filename: z
      .string()
      .optional()
      .describe("Optional filename used for context in the report, e.g. app.py."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ source, filename }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const report = await runSecurityScan(source, filename ?? "snippet.txt");
    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      structuredContent: { report },
    };
  },
});
