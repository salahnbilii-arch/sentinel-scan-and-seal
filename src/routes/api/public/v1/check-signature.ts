import { createFileRoute } from "@tanstack/react-router";

const run = async ({ request }: { request: Request }) => {
  const { handleApi, HttpError } = await import("@/lib/api-helpers.server");
  const { checkSignature, parseArtifact } = await import("@/lib/verify.server");
  return handleApi(request, (body) => {
    const artifact = (body as { artifact?: unknown }).artifact;
    // Strict shape check: malformed input is a 400, never a crash.
    return checkSignature(parseArtifact(artifact));
  });
};

export const Route = createFileRoute("/api/public/v1/check-signature")({
  server: { handlers: { OPTIONS: run, POST: run } },
});
