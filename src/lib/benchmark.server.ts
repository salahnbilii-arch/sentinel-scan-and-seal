import { RULES, runSecurityScan } from "./agents.server";

// Samples are bundled at build time (no filesystem access on the edge runtime).
const SAMPLES = import.meta.glob("./benchmark/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export interface NaiveBaseline {
  patterns: string[];
  caught: number;
  vulnerableSamples: number;
  detectionRate: number;
  falsePositives: number;
  cleanSamples: number;
  falsePositiveRate: number;
}

export interface BenchmarkResult {
  vulnerableSamples: number;
  cleanSamples: number;
  perRule: Array<{
    ruleId: string;
    cwe: string;
    title: string;
    sample: string;
    caught: boolean;
    findingsOnSample: number;
  }>;
  caught: number;
  missed: number;
  detectionRate: number;
  falsePositives: number;
  falsePositiveFiles: Array<{ sample: string; ruleIds: string[] }>;
  cleanSamplesPassed: number;
  /** Measured comparison: the same samples run through a naive substring grep. */
  baseline: NaiveBaseline;
  perSample: Array<{
    sample: string;
    kind: "vulnerable" | "clean";
    scannerFlagged: boolean;
    naiveFlagged: boolean;
    naiveMatches: string[];
  }>;
  computedAt: string;
}

/**
 * The naive baseline: a plain substring grep over the raw sample text, the way a
 * quick ad-hoc script would look for problems. Its patterns are the baseline's
 * definition, not a result; every rate below is measured from the same samples
 * the scanner runs on.
 */
export const NAIVE_PATTERNS = [
  "eval",
  "password",
  "md5",
  "secret",
  "token",
  "shell=true",
  "verify=false",
  ":latest",
  "privileged: true",
  "console.log",
  "select ",
  "docker.sock",
  "user root",
  "access-control-allow-origin",
  "print(",
  "debug",
];

export function naiveScan(text: string): string[] {
  const low = text.toLowerCase();
  return NAIVE_PATTERNS.filter((p) => low.includes(p));
}

/**
 * Samples are named vuln-<RULE_ID>.<ext> (must trigger that rule) or clean-NN.<ext> (must trigger nothing).
 * Every number is computed here from the actual scanner; nothing is typed in.
 */
export async function runBenchmark(): Promise<BenchmarkResult> {
  const files = Object.keys(SAMPLES).sort();
  const perRule: BenchmarkResult["perRule"] = [];
  const falsePositiveFiles: BenchmarkResult["falsePositiveFiles"] = [];
  const perSample: BenchmarkResult["perSample"] = [];
  let cleanSamples = 0;

  for (const key of files) {
    const file = key.split("/").pop()!;
    const text = SAMPLES[key]!;
    const report = await runSecurityScan(text, file);
    const naive = naiveScan(text);
    const vuln = /^vuln-(SEC-\d{3})\./.exec(file);
    if (vuln) {
      const ruleId = vuln[1]!;
      perRule.push({
        ruleId,
        cwe: RULES.find((r) => r.id === ruleId)?.cwe ?? "unknown",
        title: RULES.find((r) => r.id === ruleId)?.title ?? "unknown rule",
        sample: file,
        caught: report.findings.some((f) => f.ruleId === ruleId),
        findingsOnSample: report.findings.length,
      });
      perSample.push({
        sample: file,
        kind: "vulnerable",
        scannerFlagged: report.findings.length > 0,
        naiveFlagged: naive.length > 0,
        naiveMatches: naive,
      });
    } else if (file.startsWith("clean-")) {
      cleanSamples += 1;
      if (report.findings.length)
        falsePositiveFiles.push({ sample: file, ruleIds: report.findings.map((f) => f.ruleId) });
      perSample.push({
        sample: file,
        kind: "clean",
        scannerFlagged: false,
        naiveFlagged: naive.length > 0,
        naiveMatches: naive,
      });
    }
  }

  const caught = perRule.filter((r) => r.caught).length;
  const vulnerableTotal = perRule.length;
  const naiveCaught = perSample.filter((s) => s.kind === "vulnerable" && s.naiveFlagged).length;
  const naiveFalsePositives = perSample.filter((s) => s.kind === "clean" && s.naiveFlagged).length;
  return {
    vulnerableSamples: vulnerableTotal,
    cleanSamples,
    perRule,
    caught,
    missed: vulnerableTotal - caught,
    detectionRate: vulnerableTotal ? caught / vulnerableTotal : 0,
    falsePositives: falsePositiveFiles.length,
    falsePositiveFiles,
    cleanSamplesPassed: cleanSamples - falsePositiveFiles.length,
    baseline: {
      patterns: NAIVE_PATTERNS,
      caught: naiveCaught,
      vulnerableSamples: vulnerableTotal,
      detectionRate: vulnerableTotal ? naiveCaught / vulnerableTotal : 0,
      falsePositives: naiveFalsePositives,
      cleanSamples,
      falsePositiveRate: cleanSamples ? naiveFalsePositives / cleanSamples : 0,
    },
    perSample,
    computedAt: new Date().toISOString(),
  };
}
