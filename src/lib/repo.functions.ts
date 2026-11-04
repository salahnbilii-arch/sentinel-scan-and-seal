import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RepoInput = z.object({
  url: z.string().min(10).max(500),
});

// POST (not GET): some deployment walls reject unauthenticated same-origin GET
// RPCs with 401, while POST RPCs carry an Origin header and pass.
export const scanGithubRepoFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RepoInput.parse(input))
  .handler(async ({ data }) => {
    const { scanGithubRepo } = await import("./repo.server");
    return scanGithubRepo(data.url);
  });
