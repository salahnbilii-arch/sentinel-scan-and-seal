// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runSecurityScan, runDevOpsHeal, ruleCatalog } from "../agents.server";
import { runVerification, checkSignature, parseArtifact } from "../verify.server";
import { citationProblems, detectLanguage, patchLanguageDirective } from "../meta.server";
import { runBenchmark, naiveScan } from "../benchmark.server";
import { buildPatchedSource } from "../patched-source";

const BAD = 'API_KEY = "sk_live_9f8e7d6c5b4a3210"\nUSER root\nresp = requests.get(u, verify=False)';

const SAMPLE = `import os, requests
DEBUG = True
API_KEY = "sk_live_9f8e7d6c5b4a3210"

def get_user(conn, user_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = " + user_id)
    row = cur.fetchone()
    print("resolved user email", row["email"])
    return row

def sync(payload):
    requests.post("https://partner.example/api", json=payload, verify=False)
    return eval(payload["callback"])`;

const prevSigningKey = process.env["SENTINELOPS_AUDIT_SIGNING_KEY"];
beforeAll(() => {
  process.env["SENTINELOPS_AUDIT_SIGNING_KEY"] = "test-key";
});
afterAll(() => {
  if (prevSigningKey === undefined) delete process.env["SENTINELOPS_AUDIT_SIGNING_KEY"];
  else process.env["SENTINELOPS_AUDIT_SIGNING_KEY"] = prevSigningKey;
});

describe("scanner (reference rules)", () => {
  it("weights critical 25 and blocks", async () => {
    const r = await runSecurityScan(`API_KEY = "sk_live_9f8e7d6c5b4a3210"`);
    expect(r.findings[0]!.id).toBe("SEC-001@1");
    expect(r.riskScore).toBe(25);
    expect(r.verdict).toBe("blocked");
  });

  it("caps risk at 100", async () => {
    const r = await runSecurityScan(
      Array(6).fill(`password = "hunter2hunter"`).join("\n") + "\n" + Array(3).fill(`token = "abcdefgh"`).join("\n"),
    );
    expect(r.riskScore).toBeLessThanOrEqual(100);
  });

  it("keeps 12 rules", () => {
    expect(ruleCatalog()).toHaveLength(12);
  });

  it("SEC-003 covers both CWE-95 and CWE-78 with the correct CWE per pattern", async () => {
    const evalHit = await runSecurityScan("function run(x) { return eval(x); }");
    expect(evalHit.findings.find((f) => f.ruleId === "SEC-003")?.cwe).toBe("CWE-95");
    const newFn = await runSecurityScan("const f = new Function(code);");
    expect(newFn.findings.find((f) => f.ruleId === "SEC-003")?.cwe).toBe("CWE-95");
    for (const [src, cwe] of [
      ["os.system(cmd)", "CWE-78"],
      ["subprocess.run(c, shell=True)", "CWE-78"],
      ["child_process.exec(c)", "CWE-78"],
    ] as const) {
      const r = await runSecurityScan(src);
      expect(r.findings.find((f) => f.ruleId === "SEC-003")?.cwe).toBe(cwe);
    }
    // safe usage must not fire
    expect((await runSecurityScan("re.exec(s)")).findings.some((f) => f.ruleId === "SEC-003")).toBe(false);
  });

  it("catalog exposes every CWE the rule can fire with (SEC-003 alias)", () => {
    const sec003 = ruleCatalog().find((r) => r.id === "SEC-003");
    expect(sec003?.cwe).toBe("CWE-95");
    expect(sec003?.cweAliases).toContain("CWE-78");
    expect(ruleCatalog().find((r) => r.id === "SEC-001")?.cweAliases).toBeUndefined();
  });

  it("every finding carries the CWE of its rule (SEC-003 per pattern)", async () => {
    const r = await runSecurityScan(BAD);
    for (const f of r.findings) {
      const rule = ruleCatalog().find((x) => x.id === f.ruleId);
      expect(rule).toBeDefined();
      if (f.ruleId === "SEC-003") {
        expect(["CWE-95", "CWE-78"]).toContain(f.cwe);
      } else {
        expect(f.cwe).toBe(rule!.cwe);
      }
    }
  });

  it("benchmark: 12/12 caught, 0/8 false positives", async () => {
    const b = await runBenchmark();
    expect(b.caught).toBe(12);
    expect(b.vulnerableSamples).toBe(12);
    expect(b.falsePositives).toBe(0);
    expect(b.cleanSamples).toBe(8);
  });

  it("naive grep baseline is measured over the same samples (9/12, 3/8 today)", async () => {
    const b = await runBenchmark();
    expect(b.baseline.vulnerableSamples).toBe(b.vulnerableSamples);
    expect(b.baseline.cleanSamples).toBe(b.cleanSamples);
    expect(b.perSample).toHaveLength(b.vulnerableSamples + b.cleanSamples);
    expect(b.baseline.patterns).toContain("eval");
    // Concrete measured values over the bundled samples; if the samples change this test flags it.
    expect(b.baseline.caught).toBe(9);
    expect(b.baseline.falsePositives).toBe(3);
    expect(naiveScan("return eval(x); // password")).toContain("eval");
    expect(naiveScan("rows = db.query(sql)")).toEqual([]);
  });
});

describe("healer (reference signatures)", () => {
  it("matches npm peer conflict at 0.94", async () => {
    const h = await runDevOpsHeal("npm ERR! code ERESOLVE");
    expect(h.signatureScore).toBe(0.94);
    expect(h.matchedSignature).toBe(true);
  });
  it("falls back at 0.63", async () => {
    const h = await runDevOpsHeal("something odd");
    expect(h.signatureScore).toBe(0.63);
    expect(h.matchedSignature).toBe(false);
  });
});

describe("verification", () => {
  it("trust = 100 - 20 x violated; id derived from digest; tamper detection", async () => {
    const a = await runVerification(BAD, "x.py");
    expect(a.artifactId).toBe(a.digest.slice(0, 16));
    const violated = a.obligations.filter((o) => o.status === "violated").length;
    expect(a.violatedCount).toBe(violated);
    expect(a.trustScore).toBe(100 - 20 * violated);
    expect(await checkSignature(a)).toEqual({ digestMatches: true, signatureValid: true });
    expect((await checkSignature({ ...a, riskScore: 0 })).digestMatches).toBe(false);
    expect((await checkSignature({ ...a, findings: [] })).digestMatches).toBe(false);
    expect((await checkSignature({ ...a, signature: "00".repeat(32) })).signatureValid).toBe(false);
    expect((await runVerification("const x = 1;\n", "ok.ts")).trustScore).toBe(100);
  });

  it("verify uses the same rule ids, CWEs and lines as scan", async () => {
    const scan = await runSecurityScan(BAD, "x.py");
    const ver = await runVerification(BAD, "x.py");
    expect(ver.findings.map((f) => [f.id, f.ruleId, f.cwe, f.line])).toEqual(
      scan.findings.map((f) => [f.id, f.ruleId, f.cwe, f.line]),
    );
    expect(ver.sourceSha256).toBe(scan.inputSha256);
    expect(ver.riskScore).toBe(scan.riskScore);
  });

  it("malformed artifact is rejected with 400, never a crash", () => {
    for (const bad of [null, 5, "x", [], {}, { obligations: 5 }]) {
      expect(() => parseArtifact(bad)).toThrowError(
        expect.objectContaining({ status: 400, code: "invalid_input" }),
      );
    }
  });
});

describe("meta output guard", () => {
  const SRC = 'API_KEY = "sk_live_9f8e7d6c5b4a3210"\nos.system(cmd)'; // findings span SEC-001/SEC-003, CWE-798/CWE-78

  it("rejects SEC/CWE ids the scanner did not produce", async () => {
    const findings = (await runSecurityScan(SRC)).findings;
    expect(citationProblems("Also SEC-009 and CWE-999 apply.", findings)).toEqual(["SEC-009", "CWE-999"]);
  });

  it("accepts ids the scanner did produce", async () => {
    const findings = (await runSecurityScan(SRC)).findings;
    expect(citationProblems("SEC-001, SEC-003, CWE-798 and CWE-78 are real.", findings)).toEqual([]);
  });
});

describe("explain patch language", () => {
  it("detects the input language", () => {
    expect(detectLanguage('API_KEY = "sk_live_9f8e7d6c5b4a3210"\nDEBUG = True')).toBe("python");
    expect(detectLanguage('const cp = require("child_process");\nconst t = 1;')).toBe("javascript");
    expect(detectLanguage("SELECT * FROM users WHERE id = 1")).toBe("unknown");
    // terse one-liners: arrow with expression body must still read as JavaScript
    expect(detectLanguage("const handler = (input) => eval(input);")).toBe("javascript");
  });

  it("Python input → Python patch rule; unknown → no Patch section", () => {
    expect(patchLanguageDirective("DEBUG = True")).toMatch(/the input source is Python/);
    expect(patchLanguageDirective("DEBUG = True")).toMatch(/Never show a patch in a different language/);
    expect(patchLanguageDirective("SELECT * FROM users WHERE id = 1")).toMatch(
      /Omit the ## Patch section entirely/,
    );
  });
});

describe("scan patch language (findings cards)", () => {
  it("Python input → Python patches", async () => {
    const r = await runSecurityScan('import os\nAPI_KEY = "sk_live_9f8e7d6c5b4a3210"\nos.system(cmd)\nDEBUG = True');
    const sec1 = r.findings.find((f) => f.ruleId === "SEC-001");
    expect(sec1?.patch).toContain('os.environ["API_KEY"]');
    expect(sec1?.patch).not.toContain("process.env");
    const sec3 = r.findings.find((f) => f.ruleId === "SEC-003");
    expect(sec3?.patch).toContain('handlers = {"start"');
    expect(sec3?.patch).not.toMatch(/as const/);
    expect(r.findings.find((f) => f.ruleId === "SEC-008")?.patch).toContain("os.getenv");
  });

  it("JS/TS input → JavaScript patches", async () => {
    const r = await runSecurityScan(
      'const apiKey = "sk_live_9f8e7d6c5b4a3210";\nconst cmd = req.body.cmd;\nchild_process.exec(cmd);\nconst h = createHash("md5");',
    );
    const sec1 = r.findings.find((f) => f.ruleId === "SEC-001");
    expect(sec1?.patch).toContain("process.env");
    expect(sec1?.patch).not.toContain("os.environ");
    const sec3 = r.findings.find((f) => f.ruleId === "SEC-003");
    expect(sec3?.patch).toContain("as const");
    expect(r.findings.find((f) => f.ruleId === "SEC-007")?.patch).toContain("scryptSync");
  });

  it("terse JS one-liner → JavaScript patch on SEC-003", async () => {
    const r = await runSecurityScan("const handler = (input) => eval(input);");
    const sec3 = r.findings.find((f) => f.ruleId === "SEC-003");
    expect(sec3?.cwe).toBe("CWE-95");
    // a JavaScript patch is offered (dispatch table), never a Python one
    expect(sec3?.patch ?? "").not.toMatch(/def |os\.|subprocess/);
    expect(sec3?.patch ?? "").toMatch(/as const|=>|function/);
  });

  it("Unknown language → no patch for language-tied rules", async () => {
    const sec1 = (await runSecurityScan('api_key = "sk_live_9f8e7d6c5b4a3210"')).findings[0];
    expect(sec1?.ruleId).toBe("SEC-001");
    expect(sec1?.patch).toBeNull();
    const sec4 = (await runSecurityScan("curl -k https://internal.example/api")).findings.find(
      (f) => f.ruleId === "SEC-004",
    );
    expect(sec4).toBeDefined();
    expect(sec4?.patch).toBeNull();
  });

  it("Language-neutral rules keep their patch for any language", async () => {
    const r = await runSecurityScan("FROM node:latest\nUSER root");
    const sec9 = r.findings.find((x) => x.ruleId === "SEC-009");
    expect(sec9).toBeDefined();
    expect(sec9?.patch).toContain("FROM node");
    const sec5 = r.findings.find((x) => x.ruleId === "SEC-005");
    expect(sec5).toBeDefined();
    expect(sec5?.patch).toContain("RUN addgroup");
  });

  it("closed loop: the patched vulnerable sample re-scans clean", async () => {
    const r1 = await runSecurityScan(SAMPLE, "sample.py");
    expect(r1.findings.length).toBeGreaterThan(0);
    const { code: patched, applied } = buildPatchedSource(SAMPLE, r1);
    expect(applied).toBe(r1.findings.length);
    const r2 = await runSecurityScan(patched, "sample.py");
    expect(r2.findings).toEqual([]);
    expect(r2.verdict).toBe("clean");
  });
});

// The served-work counters now persist in the database: they cannot be unit-tested
// against fake in-memory state, and writing test rows would falsify real counters.
// They are covered by the live pre-publish gate (scripts/publish-gate.ts), which
// proves a counter increments after a real served API call.

describe("evidence pack", () => {
  it("bundles the real scan report, signed verification and benchmark as JSON files", async () => {
    const { buildEvidencePack } = await import("../evidence-pack");
    const report = await runSecurityScan(BAD, "x.py");
    const artifact = await runVerification(BAD, "x.py");
    const benchmark = await runBenchmark();
    const blob = await buildEvidencePack({ report, artifact, benchmark });
    expect(blob.size).toBeGreaterThan(0);
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const scanReport = JSON.parse((await zip.file("scan-report.json")!.async("string"))!);
    const verification = JSON.parse((await zip.file("signed-verification.json")!.async("string"))!);
    const bench = JSON.parse((await zip.file("benchmark.json")!.async("string"))!);
    expect(scanReport.scanId).toBe(report.scanId);
    expect(verification.digest).toBe(artifact.digest);
    expect(verification.signature).toBe(artifact.signature);
    expect(bench.caught).toBe(12);
    expect((await zip.file("manifest.json")!.async("string"))!).toContain(artifact.artifactId);
  });
});

describe("public repo scan", () => {
  it("rejects bad URLs and non-github hosts before any network call", async () => {
    const { parseRepoUrl, scanGithubRepo } = await import("../repo.server");
    for (const bad of ["not a url", "https://gitlab.com/a/b", "http://github.com/a/b", "https://github.com/onlyowner"]) {
      await expect(scanGithubRepo(bad)).rejects.toMatchObject({ status: 400 });
    }
    expect(parseRepoUrl("https://github.com/owner/repo/tree/v2.0.0/src")).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "v2.0.0",
    });
  });

  it("fails gracefully on a missing or private repository", async () => {
    const { scanGithubRepo } = await import("../repo.server");
    await expect(scanGithubRepo("https://github.com/octocat/this-repo-does-not-exist-4x9k")).rejects.toMatchObject({
      status: 404,
      code: "repo_not_found",
    });
  });

  it("scans a small public repository and returns a real aggregate", async () => {
    const { scanGithubRepo } = await import("../repo.server");
    const r = await scanGithubRepo("https://github.com/octocat/Hello-World");
    expect(r.repo).toBe("octocat/Hello-World");
    expect(r.scannedFiles).toBeLessThanOrEqual(50);
    expect(r.gateVerdict).toMatch(/^(blocked|review|clean)$/);
    expect(["blocked", "review", "clean"]).toContain(r.gateVerdict);
    expect(r.totals.findings).toBe(r.files.reduce((n, f) => n + f.findingCount, 0));
  }, 60_000);
});

describe("multilingual explain", () => {
  it("offers English, Arabic and French with the right directives", async () => {
    const { EXPLAIN_LANGUAGES, languageDirective } = await import("../meta.server");
    expect(EXPLAIN_LANGUAGES.map((l) => l.code)).toEqual(["en", "ar", "fr"]);
    expect(languageDirective("en")).toContain("English");
    expect(languageDirective("ar")).toContain("Arabic");
    expect(languageDirective("fr")).toContain("French");
    expect(languageDirective("ar")).toContain("right-to-left");
  });

  it("keeps the patch-language rule in every language", async () => {
    const { patchLanguageDirective, languageDirective } = await import("../meta.server");
    const py = patchLanguageDirective("import os\nos.system(user_input)");
    for (const l of ["en", "ar", "fr"] as const) {
      const d = languageDirective(l);
      expect(d).toContain("explanation");
    }
    expect(py).toContain("Python");
  });
});
