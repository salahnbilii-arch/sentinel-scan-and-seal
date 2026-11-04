import { createServerFn } from "@tanstack/react-start";
import type { ApiCounters } from "./metrics.server";

export type { ApiCounters };

// POST (not GET): some deployment walls reject unauthenticated same-origin GET
// RPCs with 401, while POST RPCs carry an Origin header and pass.
export const fetchApiCounters = createServerFn({ method: "POST" }).handler(async () => {
  const { apiCounters } = await import("./metrics.server");
  return apiCounters();
});
