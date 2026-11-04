/**
 * Pre/post-publish gate — API and server-rendered HTML checks.
 * Run against any deployment: `BASE_URL=https://... bun run gate:api`
 * Every check below is derived from a real run against the target URL.
 * Exit code 1 = the deployment must not be considered published/healthy.
 */
import { buildPatchedSource } from "@/lib/patched-source";

const BASE = process.env["BASE_URL"] ?? "http://localhost:8080";
const META_MODEL = "meta-models/muse-spark-open-1026";

const VULN_PY = `import os
os.system("ls " + user_input)
result = eval(user_input)`;

const CLEAN_PY = `import os
API_KEY = os.environ["API_KEY"]
rows = db.execute("SELECT * FROM users WHERE id = %(id)s", {"id": user_id})`;

const VERIFY_SOURCE = `API_KEY = "sk_live_9f8e7d6c5b4a3210"\nquery = "SELECT * FROM users WHERE id = " + user_id\nresp = requests.get(url, verify=False)\nDEBUG = True`;

const NPM_LOG = `npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: @acme/ui@3.4.1
npm ERR! Found: react@18.2.0
npm ERR! Conflicting peer dependency: react@19.2.0
npm ERR! Fix the upstream dependency conflict, or retry with --force`;

const NAV_LABELS = [
  "Command Center",
  "AI Code Sentinel",
  "Public Repo Scan",
  "DevOps Auto-Healer",
  "EU Compliance Hub",
  "Formal Verification",
  "Certificate Studio",
];

const results: Array<{ name: string; pass: boolean; detail?: string }> = [];
function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail && !pass ? ` — ${detail}` : ""}`);
}

async function api(path: string, init?: RequestInit): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* html pages */ }
  return { status: res.status, json, text };
}

const post = (path: string, body: unknown) => api(path, { method: "POST", body: JSON.stringify(body) });

async function main() {
  // ---- build marker ---------------------------------------------------------
  const health = await api("/api/public/v1/health");
  const buildId: string | undefined = health.json?.buildId;
  record("health: ok + keys configured", health.json?.ok === true && health.json?.metaConfigured === true && health.json?.signingConfigured === true, health.text.slice(0, 200));
  const markerOk = typeof buildId === "string" && /^sentinelops-\d{8}-\d{4}Z$/.test(buildId);
  record("build marker present and well-formed", markerOk, String(buildId));
  if (markerOk) {
    const m = /^sentinelops-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})Z$/.exec(buildId)!;
    const builtAt = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    record("build marker is fresh (built within 48h)", Date.now() - builtAt < 48 * 3600_000, buildId);
  }

  // ---- rules catalog --------------------------------------------------------
  const rules = await api("/api/public/v1/rules");
  const ruleList: any[] = rules.json?.rules ?? [];
  const ids = ruleList.map((r) => r.id);
  const expectedIds = Array.from({ length: 12 }, (_, i) => `SEC-${String(i + 1).padStart(3, "0")}`);
  record("rules: exactly 12 rules SEC-001..SEC-012", rules.status === 200 && ids.length === 12 && expectedIds.every((id) => ids.includes(id)), JSON.stringify(ids));
  record("rules: every rule carries a CWE id", ruleList.every((r) => /^CWE-\d+$/.test(String(r.cwe))));
  const rulesText = JSON.stringify(ruleList);
  record("rules: CWE-798/89/95/78 mapping present", ["CWE-798", "CWE-89", "CWE-95", "CWE-78"].every((c) => rulesText.includes(c)));

  // ---- scan: vulnerable -----------------------------------------------------
  const scan1 = await post("/api/public/v1/scan-code", { code: VULN_PY, filename: "gate.py" });
  const findings = scan1.json?.findings ?? [];
  const sec003 = findings.filter((f: any) => f.ruleId === "SEC-003");
  record("scan vulnerable: REVIEW, risk 24", scan1.json?.verdict === "review" && scan1.json?.riskScore === 24, JSON.stringify({ verdict: scan1.json?.verdict, risk: scan1.json?.riskScore }));
  record("scan vulnerable: SEC-003 fires twice (CWE-95 + CWE-78)", sec003.length === 2 && sec003.map((f: any) => f.cwe).sort().join(",") === "CWE-78,CWE-95", JSON.stringify(sec003.map((f: any) => f.cwe)));
  record("scan vulnerable: python patches on every finding", findings.length > 0 && findings.every((f: any) => typeof f.patch === "string" && f.patch.length > 0));

  // ---- closed-loop re-scan --------------------------------------------------
  const patched = buildPatchedSource(VULN_PY, scan1.json);
  record("rescan: patch applied to every finding line", patched.applied === findings.length, String(patched.applied));
  const scan2 = await post("/api/public/v1/scan-code", { code: patched.code, filename: "gate-patched.py" });
  record("rescan: patched code comes back CLEAN, 0", scan2.json?.verdict === "clean" && scan2.json?.riskScore === 0, JSON.stringify({ verdict: scan2.json?.verdict, risk: scan2.json?.riskScore }));

  // ---- scan: clean ----------------------------------------------------------
  const scanClean = await post("/api/public/v1/scan-code", { code: CLEAN_PY, filename: "clean.py" });
  record("scan clean: CLEAN, 0 findings", scanClean.json?.verdict === "clean" && (scanClean.json?.findings ?? []).length === 0);

  // ---- scan: js input gets a js patch ---------------------------------------
  const scanJs = await post("/api/public/v1/scan-code", { code: "const handler = (input) => eval(input);", filename: "gate.js" });
  record("scan js: patch offered for js input", (scanJs.json?.findings ?? []).some((f: any) => typeof f.patch === "string" && f.patch.includes("JSON.parse") || (scanJs.json?.findings ?? []).some((f: any) => typeof f.patch === "string")));

  // ---- explain: three languages ---------------------------------------------
  const languages = ["en", "ar", "fr"] as const;
  const explanations: Record<string, string> = {};
  for (const lang of languages) {
    const ex = await post("/api/public/v1/explain", { code: VULN_PY, language: lang });
    const ok = ex.status === 200 && ex.json?.model === META_MODEL && typeof ex.json?.explanation === "string" && ex.json.explanation.length > 100;
    explanations[lang] = ex.json?.explanation ?? "";
    record(`explain ${lang}: model id visible, non-empty explanation`, ok, ex.text.slice(0, 160));
  }
  record("explain ar: arabic script present", /[\u0600-\u06FF]/.test(explanations.ar));
  record("explain fr: differs from en", explanations.fr !== explanations.en && explanations.fr.length > 100);

  // ---- healer ----------------------------------------------------------------
  const heal = await post("/api/public/v1/devops-heal", { log: NPM_LOG });
  record("healer: diagnosis + 0.94 fixed constant + overrides patch", heal.json?.signatureScore === 0.94 && typeof heal.json?.rootCause === "string" && typeof heal.json?.patch === "string" && heal.json.patch.includes("overrides"), JSON.stringify({ score: heal.json?.signatureScore }));

  // ---- deep analysis ---------------------------------------------------------
  const deep = await post("/api/public/v1/deep-analysis", { content: VULN_PY + "\n# deep analysis gate" });
  record("deep analysis: model id, latency, output tokens", deep.json?.model === META_MODEL && deep.json?.latencyMs > 0 && typeof deep.json?.usage?.completionTokens === "number" && deep.json.usage.completionTokens > 0, JSON.stringify(deep.json?.usage));

  // ---- verify + re-check -----------------------------------------------------
  const ver = await post("/api/public/v1/verify", { source: VERIFY_SOURCE, artifactName: "gate-artifact.txt" });
  const art = ver.json ?? {};
  record("verify: trust 80/100, 1 violated", art.trustScore === 80 && art.violatedCount === 1, JSON.stringify({ trust: art.trustScore, violated: art.violatedCount }));
  record("verify: digest + HMAC-SHA256 signature (64 hex each)", /^[0-9a-f]{64}$/.test(art.digest ?? "") && art.signatureAlgorithm === "HMAC-SHA256" && /^[0-9a-f]{64}$/.test(art.signature ?? ""));
  record("verify: artifactId = first 16 hex of digest", art.artifactId === String(art.digest ?? "").slice(0, 16));
  const recheck = await post("/api/public/v1/check-signature", { artifact: art });
  record("re-check: digest matches + signature valid", recheck.json?.digestMatches === true && recheck.json?.signatureValid === true, recheck.text.slice(0, 120));
  const ver2 = await post("/api/public/v1/verify", { source: VERIFY_SOURCE, artifactName: "gate-artifact.txt" });
  record("verify: deterministic digest across runs", ver2.json?.digest === art.digest);

  // ---- counters: prove a served call increments ------------------------------
  const before = await api("/api/public/v1/counters");
  const beforeScans = before.json?.scans;
  record("counters: readable with a sane activation timestamp", before.status === 200 && typeof beforeScans === "number" && typeof before.json?.activeSince === "string" && !Number.isNaN(Date.parse(before.json.activeSince)) && Date.now() - Date.parse(before.json.activeSince) < 48 * 3600_000, before.text.slice(0, 200));
  await post("/api/public/v1/scan-code", { code: CLEAN_PY, filename: "counter-probe.py" });
  const after = await api("/api/public/v1/counters");
  record("counters: increments by exactly 1 after one served scan", after.json?.scans === beforeScans + 1, `${beforeScans} -> ${after.json?.scans}`);

  // ---- benchmark -------------------------------------------------------------
  const bench = await api("/api/public/v1/benchmark");
  const b = bench.json ?? {};
  record("benchmark: scanner 12/12, 0 false positives", b.caught === 12 && b.vulnerableSamples === 12 && b.falsePositives === 0, JSON.stringify({ caught: b.caught, fp: b.falsePositives }));
  record("benchmark: naive baseline 9/12, 3 false positives", b.baseline?.caught === 9 && b.baseline?.falsePositives === 3, JSON.stringify(b.baseline));
  record("benchmark: computed live", typeof b.computedAt === "string" && Date.now() - Date.parse(b.computedAt) < 5 * 60_000, b.computedAt);

  // ---- pages, sidebar, 404 ---------------------------------------------------
  const pages = ["/", "/sentinel", "/repo", "/healer", "/compliance", "/verify", "/certificate", "/explain"];
  for (const page of pages) {
    const res = await fetch(`${BASE}${page}`);
    const html = await res.text();
    const navOk = NAV_LABELS.every((label) => html.includes(label));
    record(`page ${page}: 200, 7-entry sidebar, no AGENTS ONLINE`, res.status === 200 && navOk && !html.includes("AGENTS ONLINE"), `status ${res.status}`);
    const footerBuild = /build (sentinelops-\d{8}-\d{4}Z)/.exec(html)?.[1];
    if (markerOk) record(`page ${page}: footer build marker matches /health`, footerBuild === buildId, `${footerBuild} vs ${buildId}`);
  }
  const gtm = await fetch(`${BASE}/gtm`);
  record("/gtm is gone (404)", gtm.status === 404, String(gtm.status));

  // ---- summary ---------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — ${failed.length} FAILED` : " — deployment is gate-clean"}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error("gate crashed:", e);
  process.exit(1);
});
