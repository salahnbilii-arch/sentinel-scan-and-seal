import type { SignedArtifact } from "@/lib/verify.server";

/**
 * The certificate is generated only from a real Verify run. The Verify page stores the signed
 * artifact here after every successful run; the certificate page reads it back.
 */
export const ARTIFACT_STORAGE_KEY = "sentinelops-verify-artifact";

export interface StoredArtifact {
  trustScore: number;
  digest: string;
  signature: string;
  signatureAlgorithm: string;
  issuedAt: string;
  scanId: string;
}

type ArtifactFields = Pick<
  SignedArtifact,
  "trustScore" | "digest" | "signature" | "signatureAlgorithm" | "issuedAt" | "scanId"
>;

export function storeArtifact(art: ArtifactFields): void {
  try {
    sessionStorage.setItem(
      ARTIFACT_STORAGE_KEY,
      JSON.stringify({
        trustScore: art.trustScore,
        digest: art.digest,
        signature: art.signature,
        signatureAlgorithm: art.signatureAlgorithm,
        issuedAt: art.issuedAt,
        scanId: art.scanId,
      }),
    );
  } catch {
    // Storage unavailable: the Verify page still shows the full result.
  }
}

/** Strict shape check so stale or corrupted storage yields "no verification", never a crash. */
export function loadStoredArtifact(): StoredArtifact | null {
  try {
    const raw = sessionStorage.getItem(ARTIFACT_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof v["trustScore"] !== "number" ||
      typeof v["digest"] !== "string" ||
      v["digest"].length < 16 ||
      typeof v["signature"] !== "string" ||
      v["signature"].length === 0 ||
      typeof v["signatureAlgorithm"] !== "string" ||
      typeof v["scanId"] !== "string" ||
      typeof v["issuedAt"] !== "string" ||
      Number.isNaN(Date.parse(v["issuedAt"]))
    ) {
      return null;
    }
    return v as unknown as StoredArtifact;
  } catch {
    return null;
  }
}
