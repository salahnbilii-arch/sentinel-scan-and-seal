import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi, requireText, MAX_ARTIFACT_CHARS } = await import("@/lib/api-helpers.server");
  const { explainFindings } = await import("@/lib/meta.server");
  return handleApi(request, async (body) => {
    const code = requireText(body, "code", 1, MAX_ARTIFACT_CHARS);
    // Only the three supported output languages; anything else falls back to English.
    const requested = typeof body?.language === "string" ? body.language : "en";
    const language = (["en", "ar", "fr"] as const).find((l) => l === requested) ?? "en";
    // Always re-scans server-side; clean input returns { nothingToDo: true } and never calls the model.
    const result = await explainFindings(code, language);
    const { recordAnalysis } = await import("@/lib/metrics.server");
    await recordAnalysis();
    return result;
  });
};

export const Route = createFileRoute("/api/public/v1/explain")({
  server: { handlers: { OPTIONS: run, POST: run } },
});
