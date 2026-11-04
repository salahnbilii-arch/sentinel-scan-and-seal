import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi } = await import("@/lib/api-helpers.server");
  const { apiCounters } = await import("@/lib/metrics.server");
  return handleApi(request, () => apiCounters());
};

/** Real served-work counters: every increment follows a request this API actually served. */
export const Route = createFileRoute("/api/public/v1/counters")({
  server: { handlers: { OPTIONS: run, GET: run } },
});
