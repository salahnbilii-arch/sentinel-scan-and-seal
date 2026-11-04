import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi, requireText, MAX_ARTIFACT_CHARS } = await import("@/lib/api-helpers.server");
  const { runDeepAnalysis } = await import("@/lib/meta.server");
  return handleApi(request, async (body) => {
    const content = requireText(body, "content", 12, MAX_ARTIFACT_CHARS);
    // Always re-scans server-side; clean input returns { nothingToDo: true } and never calls the model.
    const result = await runDeepAnalysis(content);
    const { recordAnalysis } = await import("@/lib/metrics.server");
    await recordAnalysis();
    return result;
  });
};

export const Route = createFileRoute("/api/public/v1/deep-analysis")({
  server: { handlers: { OPTIONS: run, POST: run } },
});
