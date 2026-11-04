// @vitest-environment node
import JSZip from "jszip";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { runSecurityScan } from "../agents.server";
import { runVerificationWithReport } from "../verify.server";
import { runBenchmark } from "../benchmark.server";
import { buildEvidencePack } from "../evidence-pack";

const prevSigningKey = process.env["SENTINELOPS_AUDIT_SIGNING_KEY"];
beforeAll(() => {
  process.env["SENTINELOPS_AUDIT_SIGNING_KEY"] = "test-key";
});
afterAll(() => {
  if (prevSigningKey === undefined) delete process.env["SENTINELOPS_AUDIT_SIGNING_KEY"];
  else process.env["SENTINELOPS_AUDIT_SIGNING_KEY"] = prevSigningKey;
});

const SOURCE = 'API_KEY = "sk_live_9f8e7d6c5b4a3210"\nDEBUG = True';

describe("evidence pack coherence", () => {
  it("bundles one coherent run: matching scanId and artifactId in every file", async () => {
    const { artifact, scanReport } = await runVerificationWithReport(SOURCE, "pack.py");
    const benchmark = await runBenchmark();
    const pack = await buildEvidencePack({ report: scanReport, artifact, benchmark });

    const zip = await JSZip.loadAsync(await pack.arrayBuffer());
    const report = JSON.parse(await zip.file("scan-report.json")!.async("string"));
    const signed = JSON.parse(await zip.file("signed-verification.json")!.async("string"));
    const bench = JSON.parse(await zip.file("benchmark.json")!.async("string"));
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));

    // scan-report.json is the same run that produced the signed artifact.
    expect(report.scanId).toBe(artifact.scanId);
    expect(signed.scanId).toBe(artifact.scanId);
    // Every file carries the same artifactId and digest.
    expect(signed.artifactId).toBe(artifact.artifactId);
    expect(signed.digest).toBe(artifact.digest);
    expect(manifest.scanId).toBe(artifact.scanId);
    expect(manifest.artifactId).toBe(artifact.artifactId);
    expect(manifest.digest).toBe(artifact.digest);
    // The benchmark is stamped with the run's ids.
    expect(bench.packagedWith.scanId).toBe(artifact.scanId);
    expect(bench.packagedWith.artifactId).toBe(artifact.artifactId);
    // Real run content, nothing typed in.
    expect(report.riskScore).toBeGreaterThan(0);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.length).toBe(signed.findings.length);
    expect(manifest.files).toEqual([
      "scan-report.json",
      "signed-verification.json",
      "benchmark.json",
    ]);
    expect(bench.computedAt).toBe(manifest.benchmarkComputedAt);
  });

  it("refuses to bundle a scan report from a different run", async () => {
    const { artifact } = await runVerificationWithReport(SOURCE, "pack.py");
    const otherReport = await runSecurityScan(SOURCE, "other-run.py");
    const benchmark = await runBenchmark();
    await expect(
      buildEvidencePack({ report: otherReport, artifact, benchmark }),
    ).rejects.toThrow(/coherence failed/);
  });
});
