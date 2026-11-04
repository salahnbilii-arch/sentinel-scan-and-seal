import { createServerFn } from "@tanstack/react-start";

// POST (not GET): some deployment walls reject unauthenticated same-origin GET
// RPCs with 401, while POST RPCs carry an Origin header and pass. The handler
// is pure server-side compute either way.
export const fetchBenchmark = createServerFn({ method: "POST" }).handler(async () => {
  const { runBenchmark } = await import("./benchmark.server");
  return runBenchmark();
});
