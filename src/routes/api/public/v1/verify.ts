import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi, requireText, optionalText, MAX_ARTIFACT_CHARS } =
    await import("@/lib/api-helpers.server");
  const { runVerification } = await import("@/lib/verify.server");
  return handleApi(request, async (body) => {
    const artifact = await runVerification(
      requireText(body, "source", 1, MAX_ARTIFACT_CHARS),
      optionalText(body, "artifactName", 200) ?? "artifact.txt",
    );
    const { recordVerification } = await import("@/lib/metrics.server");
    await recordVerification();
    return artifact;
  });
};

export const Route = createFileRoute("/api/public/v1/verify")({
  server: { handlers: { OPTIONS: run, POST: run } },
});
