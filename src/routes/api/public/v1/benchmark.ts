import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi } = await import("@/lib/api-helpers.server");
  const { runBenchmark } = await import("@/lib/benchmark.server");
  return handleApi(request, () => runBenchmark());
};

export const Route = createFileRoute("/api/public/v1/benchmark")({
  server: { handlers: { OPTIONS: run, GET: run } },
});
