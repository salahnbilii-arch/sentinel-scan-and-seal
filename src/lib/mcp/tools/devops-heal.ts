import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { runDevOpsHeal } from "@/lib/agents.server";

export default defineTool({
  name: "devops_heal",
  title: "Diagnose and heal a pipeline failure",
  description:
    "Run the SentinelOps DevOps Agent over a CI/CD or runtime failure log and return the root cause, remediation steps and an automated fix.",
  inputSchema: {
    log: z.string().min(1).describe("Raw CI/CD, container or Kubernetes failure log output."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ log }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const result = await runDevOpsHeal(log);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { result },
    };
  },
});
