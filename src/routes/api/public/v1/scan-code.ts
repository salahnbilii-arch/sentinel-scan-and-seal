import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi, requireText, optionalText, MAX_ARTIFACT_CHARS } =
    await import("@/lib/api-helpers.server");
  const { runSecurityScan } = await import("@/lib/agents.server");
  return handleApi(request, async (body) => {
    const report = await runSecurityScan(
      requireText(body, "code", 1, MAX_ARTIFACT_CHARS),
      optionalText(body, "filename", 200) ?? "snippet.txt",
    );
    // Counted only after the scan actually served a result.
    const { recordScan } = await import("@/lib/metrics.server");
    await recordScan();
    return report;
  });
};

export const Route = createFileRoute("/api/public/v1/scan-code")({
  server: { handlers: { OPTIONS: run, POST: run } },
});
