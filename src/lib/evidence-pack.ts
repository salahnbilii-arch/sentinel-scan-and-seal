import JSZip from "jszip";
import type { ScanReport } from "./agents.server";
import type { SignedArtifact } from "./verify.server";
import type { BenchmarkResult } from "./benchmark.server";

export interface EvidencePackInputs {
  report: ScanReport;
  artifact: SignedArtifact;
  benchmark: BenchmarkResult;
}

/** Bundles the real runs — scan report, signed verification, live benchmark —
 *  as JSON files in one zip. Coherence is enforced: the scan report must be the
 *  same run that produced the signed artifact (matching scanId), and the
 *  benchmark is stamped with that run's ids. Every byte comes from an actual
 *  run; nothing is typed in. */
export async function buildEvidencePack({
  report,
  artifact,
  benchmark,
}: EvidencePackInputs): Promise<Blob> {
  if (report.scanId !== artifact.scanId) {
    throw new Error(
      `evidence pack coherence failed: scan-report scanId ${report.scanId} does not match signed-verification scanId ${artifact.scanId}`,
    );
  }
  const stampedBenchmark = {
    ...benchmark,
    packagedWith: { scanId: artifact.scanId, artifactId: artifact.artifactId },
  };
  const zip = new JSZip();
  zip.file("scan-report.json", JSON.stringify(report, null, 2));
  zip.file("signed-verification.json", JSON.stringify(artifact, null, 2));
  zip.file("benchmark.json", JSON.stringify(stampedBenchmark, null, 2));
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        files: ["scan-report.json", "signed-verification.json", "benchmark.json"],
        scanId: artifact.scanId,
        artifactId: artifact.artifactId,
        digest: artifact.digest,
        signatureAlgorithm: artifact.signatureAlgorithm,
        benchmarkComputedAt: benchmark.computedAt,
      },
      null,
      2,
    ),
  );
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
