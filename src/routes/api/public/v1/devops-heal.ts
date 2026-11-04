import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi, requireText, MAX_ARTIFACT_CHARS } = await import("@/lib/api-helpers.server");
  const { runDevOpsHeal } = await import("@/lib/agents.server");
  return handleApi(request, async (body) => {
    const result = await runDevOpsHeal(requireText(body, "log", 1, MAX_ARTIFACT_CHARS));
    const { recordHeal } = await import("@/lib/metrics.server");
    await recordHeal();
    return result;
  });
};

export const Route = createFileRoute("/api/public/v1/devops-heal")({
  server: { handlers: { OPTIONS: run, POST: run } },
});
