import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { runVerification } from "@/lib/verify.server";

export default defineTool({
  name: "formal_verify",
  title: "Verify and sign an artifact",
  description:
    "Scan an artifact, run 5 heuristic obligation checks, and return a SHA-256 digest with an HMAC-SHA256 signature. Heuristic checks, not a formal proof.",
  inputSchema: {
    source: z.string().min(1).describe("Raw source code or configuration to verify."),
    artifactName: z
      .string()
      .optional()
      .describe("Optional artifact name recorded in the signed result."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ source, artifactName }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const artifact = await runVerification(source, artifactName ?? "artifact.txt");
    return {
      content: [{ type: "text", text: JSON.stringify(artifact, null, 2) }],
      structuredContent: { artifact },
    };
  },
});
