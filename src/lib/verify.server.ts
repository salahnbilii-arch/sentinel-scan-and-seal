
import { HttpError } from "./api-helpers.server";
import { runSecurityScan, sha256, type Severity } from "./agents.server";

/**
 * Heuristic obligation checks. An obligation is satisfied when none of its scanner rules fired.
 * This is NOT formal verification: there is no solver and no proof. What is real is the scan,
 * the SHA-256 digest and the HMAC signature. Verify runs the SAME scanner (same rule ids, same
 * CWE mapping) as the Scan page and embeds the findings it derived the obligations from, so the
 * digest covers them and tampering with a finding breaks the digest.
 */
export const OBLIGATIONS = [
  { id: "OB-1", statement: "No hardcoded credentials", rules: ["SEC-001"] },
  { id: "OB-2", statement: "No injection sinks (SQL, dynamic code)", rules: ["SEC-002", "SEC-003"] },
  { id: "OB-3", statement: "Transport and cryptography hygiene", rules: ["SEC-004", "SEC-007"] },
  { id: "OB-4", statement: "Access control and runtime hardening", rules: ["SEC-005", "SEC-006", "SEC-011", "SEC-012"] },
  { id: "OB-5", statement: "Privacy and configuration hygiene", rules: ["SEC-008", "SEC-009", "SEC-010"] },
] as const;

export const SIGNATURE_ALGORITHM = "HMAC-SHA256";
export const TRUST_FORMULA = "trust = 100 - 20 x (violated obligations)";
export const METHOD =
  "heuristic obligation checks derived from scan findings; digest and signature are cryptographic";

export interface Obligation {
  id: string;
  statement: string;
  status: "satisfied" | "violated";
  violatedBy: string[];
}

export interface ArtifactFinding {
  id: string;
  ruleId: string;
  cwe: string;
  severity: Severity;
  line: number;
}

export interface SignedArtifact {
  artifactId: string;
  artifactName: string;
  method: string;
  trustFormula: string;
  scanId: string;
  sourceSha256: string;
  verdict: string;
  riskScore: number;
  findings: ArtifactFinding[];
  obligations: Obligation[];
  violatedCount: number;
  trustScore: number;
  digest: string;
  signatureAlgorithm: string;
  signature: string;
  issuedAt: string;
}

function signingKey(): string {
  const key = process.env["SENTINELOPS_AUDIT_SIGNING_KEY"];
  if (!key) {
    throw new HttpError(
      503,
      "signing_key_missing",
      "Signing is not configured. The operator must set SENTINELOPS_AUDIT_SIGNING_KEY on the server.",
    );
  }
  return key;
}

async function sign(digest: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(digest));
  return Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type Core = Pick<SignedArtifact, "artifactName" | "sourceSha256" | "verdict" | "riskScore" | "findings" | "obligations">;

/** Canonical payload that the digest covers (stable key order). */
function canonical(a: Core): string {
  return JSON.stringify({
    artifactName: a.artifactName,
    sourceSha256: a.sourceSha256,
    verdict: a.verdict,
    riskScore: a.riskScore,
    findings: a.findings.map((f) => [f.id, f.ruleId, f.cwe, f.severity, f.line]),
    obligations: a.obligations.map((o) => [o.id, o.status, o.violatedBy]),
  });
}

/** Constant-time comparison over equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function runVerification(source: string, artifactName = "artifact.txt"): Promise<SignedArtifact> {
  const key = signingKey(); // fail early and gracefully when unset
  const scan = await runSecurityScan(source, artifactName);
  const fired = new Set(scan.findings.map((f) => f.ruleId));
  const obligations: Obligation[] = OBLIGATIONS.map((o) => {
    const violatedBy = o.rules.filter((r) => fired.has(r));
    return {
      id: o.id,
      statement: o.statement,
      status: violatedBy.length ? "violated" : "satisfied",
      violatedBy,
    };
  });
  const violatedCount = obligations.filter((o) => o.status === "violated").length;
  const trustScore = Math.max(0, 100 - 20 * violatedCount);
  const findings: ArtifactFinding[] = scan.findings.map((f) => ({
    id: f.id,
    ruleId: f.ruleId,
    cwe: f.cwe,
    severity: f.severity,
    line: f.line,
  }));
  const base: Core = {
    artifactName,
    sourceSha256: scan.inputSha256,
    verdict: scan.verdict,
    riskScore: scan.riskScore,
    findings,
    obligations,
  };
  const digest = await sha256(canonical(base));
  return {
    artifactId: digest.slice(0, 16),
    ...base,
    method: METHOD,
    trustFormula: TRUST_FORMULA,
    scanId: scan.scanId,
    violatedCount,
    trustScore,
    digest,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    signature: await sign(digest, key),
    issuedAt: new Date().toISOString(),
  };
}

const isStr = (v: unknown): v is string => typeof v === "string";

/** Strict shape check so a malformed artifact is a 400, never a crash. */
export function parseArtifact(v: unknown): SignedArtifact {
  const bad = () => new HttpError(400, "invalid_input", '"artifact" is not a SentinelOps signed artifact.');
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad();
  const a = v as Record<string, unknown>;
  if (![a["artifactName"], a["sourceSha256"], a["verdict"], a["digest"], a["signature"]].every(isStr)) throw bad();
  if (typeof a["riskScore"] !== "number" || !Array.isArray(a["findings"]) || !Array.isArray(a["obligations"])) throw bad();
  const okF = (a["findings"] as unknown[]).every(
    (f) =>
      !!f &&
      typeof f === "object" &&
      [(f as Record<string, unknown>)["id"], (f as Record<string, unknown>)["ruleId"], (f as Record<string, unknown>)["cwe"], (f as Record<string, unknown>)["severity"]].every(isStr) &&
      typeof (f as Record<string, unknown>)["line"] === "number",
  );
  const okO = (a["obligations"] as unknown[]).every(
    (o) =>
      !!o &&
      typeof o === "object" &&
      isStr((o as Record<string, unknown>)["id"]) &&
      isStr((o as Record<string, unknown>)["status"]) &&
      Array.isArray((o as Record<string, unknown>)["violatedBy"]) &&
      ((o as Record<string, unknown>)["violatedBy"] as unknown[]).every(isStr),
  );
  if (!okF || !okO) throw bad();
  return a as unknown as SignedArtifact;
}

/** Recompute digest and HMAC for a previously issued artifact. */
export async function checkSignature(a: SignedArtifact): Promise<{ digestMatches: boolean; signatureValid: boolean }> {
  const key = signingKey();
  const digestMatches = (await sha256(canonical(a))) === a.digest;
  const expected = await sign(a.digest, key);
  const given = typeof a.signature === "string" ? a.signature : "";
  return { digestMatches, signatureValid: timingSafeEqualHex(expected, given) };
}
