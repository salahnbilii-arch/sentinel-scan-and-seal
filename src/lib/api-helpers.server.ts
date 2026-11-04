/**
 * SentinelOps AI — API input/cors helpers, mirroring the reference server's
 * http.ts contract: safe error codes, hard input limits, and CORS headers
 * only for origins explicitly listed in ALLOWED_ORIGINS.
 */

export const MAX_ARTIFACT_CHARS = 120_000;

/** Error whose message is safe to show to API callers. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Read a required string field and enforce its length bounds. */
export function requireText(body: unknown, field: string, min: number, max: number): string {
  const value = (body as Record<string, unknown> | null)?.[field];
  if (typeof value !== "string") throw new HttpError(400, "invalid_input", `"${field}" must be a string.`);
  if (value.trim().length < min) {
    throw new HttpError(400, "invalid_input", `"${field}" must contain at least ${min} character(s).`);
  }
  if (value.length > max) {
    throw new HttpError(413, "input_too_large", `"${field}" exceeds the ${max}-character limit.`);
  }
  return value;
}

export function optionalText(body: unknown, field: string, max: number): string | undefined {
  const value = (body as Record<string, unknown> | null)?.[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new HttpError(400, "invalid_input", `"${field}" must be a string.`);
  if (value.length > max) throw new HttpError(413, "input_too_large", `"${field}" exceeds ${max} characters.`);
  return value;
}

// Cross-origin callers must be listed explicitly in ALLOWED_ORIGINS
// (comma-separated). Unlisted origins get no CORS headers; same-origin use is
// unaffected.
function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allow = new Set(
    (process.env["ALLOWED_ORIGINS"] ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
  return allow.has(origin) ? origin : null;
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function parseJson(request: Request): Promise<unknown> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }
  // Request bodies must be JSON objects; arrays, null and scalars are rejected before any handler runs.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "invalid_input", "Request body must be a JSON object.");
  }
  return parsed;
}

/**
 * Shared route plumbing: OPTIONS preflight, JSON envelope, and the error
 * mapping every reference route uses (`{ error, message }`).
 */
export async function handleApi(
  request: Request,
  fn: (body: unknown) => Promise<unknown> | unknown,
): Promise<Response> {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const body = request.method === "POST" ? await parseJson(request) : {};
    const data = await fn(body);
    return Response.json(data, { headers: { ...cors, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status, headers: cors });
    }
    console.error("[api] unhandled error:", error instanceof Error ? error.message : "unknown");
    return Response.json(
      { error: "internal_error", message: "Unexpected server error." },
      { status: 500, headers: cors },
    );
  }
}
