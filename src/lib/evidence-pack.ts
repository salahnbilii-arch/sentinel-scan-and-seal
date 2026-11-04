import JSZip from "jszip";
import type { ScanReport } from "./agents.server";
import type { SignedArtifact } from "./verify.server";
import type { BenchmarkResult } from "./benchmark.server";

export interface EvidencePackInputs {
  report: ScanReport;
  artifact: SignedArtifact;
  benchmark: BenchmarkResult;
}

/** Bundles the three real runs — scan report, signed verification, live benchmark —
 *  as JSON files in one zip. Every byte comes from an actual run; nothing is typed in. */
export async function buildEvidencePack({ report, artifact, benchmark }: EvidencePackInputs): Promise<Blob> {
  const zip = new JSZip();
  zip.file("scan-report.json", JSON.stringify(report, null, 2));
  zip.file("signed-verification.json", JSON.stringify(artifact, null, 2));
  zip.file("benchmark.json", JSON.stringify(benchmark, null, 2));
  zip.file("manifest.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    files: ["scan-report.json", "signed-verification.json", "benchmark.json"],
    scanId: report.scanId,
    artifactId: artifact.artifactId,
    digest: artifact.digest,
    signatureAlgorithm: artifact.signatureAlgorithm,
  }, null, 2));
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
