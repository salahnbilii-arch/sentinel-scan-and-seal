import { createFileRoute } from "@tanstack/react-router";

/** The rule-id to CWE mapping, straight from the scanner's own rule table. */
export const Route = createFileRoute("/api/public/v1/rules")({
  server: {
    handlers: {
      GET: async () => {
        const { ruleCatalog } = await import("@/lib/agents.server");
        return Response.json({ rules: ruleCatalog() });
      },
    },
  },
});
