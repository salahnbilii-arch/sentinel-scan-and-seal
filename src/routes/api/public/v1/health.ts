import { createFileRoute } from "@tanstack/react-router";

/** Reports only whether keys are configured, never their values, plus the build marker. */
export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          buildId: __BUILD_ID__,
          metaConfigured: Boolean(process.env["BASETEN_API_KEY"]),
          signingConfigured: Boolean(process.env["SENTINELOPS_AUDIT_SIGNING_KEY"]),
        }),
    },
  },
});
