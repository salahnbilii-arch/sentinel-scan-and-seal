# Roadmap

- [x] Port reference engines (scanner, healer, verify, Meta/Baseten) and remove Gemini/Groq
- [x] Apply sentinelops-0.2.0 reference pass: trust = 100 - 20 x violated, findings embedded in the signed digest, 8192 token budget with one retry, invented SEC/CWE rejection, clean input never calls the model, `GET /api/public/v1/rules`, CWE per benchmark rule
- [x] SEC-003 correction: covers eval/new Function (CWE-95) AND command injection os.system / shell=True / child_process.exec (CWE-78), correct CWE per pattern, still 12 rules
- [x] Demo removal: AGENTS ONLINE badge, Agent Mesh sidebar, Enterprise GTM page, Certificate Studio prefilled demo company/score
- [x] Security package update
- [x] Secrets: BASETEN_API_KEY set in Lovable Secrets (GEMINI/GROQ keys are no longer used)
- [x] SENTINELOPS_AUDIT_SIGNING_KEY updated by the user after the remix

# Uploaded spec (in strict order, 9 phone tests re-run after each)

- [x] Precondition: certificate + Explain fix done and verified (15/15 tests, live checks); patch-language findings-card fix done and verified (19/19 tests)
- [x] 1. Closed-loop re-scan: "Re-scan patched code" button; patched vulnerable sample comes back CLEAN (unit + live); shown code is the actual patch text. Also fixed a pre-existing healer phone overflow (grid → block below xl)
- [x] 2. Benchmark vs naive grep baseline: measured side-by-side on the Overview (scanner 12/12 & 0/8 vs naive grep 9/12 & 3/8), per-sample table, unit-tested with concrete values
- [x] 3. Real counters: in-memory scans/heals/analyses/verifications served by the public API on the Overview, labeled "since server start", reset note shown; live check 0 → 2 scans after two real calls
- [x] 4. Evidence pack: verified real download from /verify — zip with scan-report.json, signed-verification.json (digest + HMAC), benchmark.json, manifest.json; all from live runs; unit-tested
- [x] 5. ONLY if 1-4 pass: public GitHub repo scan (50 files, 120KB each, code/manifest only), aggregate report + gate verdict, graceful failures
- [x] 6. Multilingual Explain: English, Arabic, French minimum; same findings, same Meta model, chosen language

Phone test suite (run after each feature, 384x652 viewport):
P1 Overview loads with live benchmark stats, no horizontal overflow; P2 Sentinel default-sample scan completes with verdict; P3 findings show language-matched patches; P4 unknown-language input hides the patch block and Copy button; P5 Healer npm-log run returns the 0.94 signature; P6 Verify returns trust = 100 − 20 × violated with digest; P7 Verify Re-check passes; P8 Certificate gate without a run, renders with one; P9 Compliance loads and /gtm is gone.

- [x] Secrets after remix: update BASETEN_API_KEY and SENTINELOPS_AUDIT_SIGNING_KEY (Gemini/Groq unused — not needed)

# Root fix (2026-11-04): published site was a stale broken build

- [x] Diagnosed: published sentielops.lovable.app ran an old bundle — `cn is not defined` crashed /sentinel (scan button), counters showed the 1970 epoch, and the SPA died after the crash; current preview source has none of these
- [x] Added the dedicated /explain page (paste code → deterministic scan → EN/AR/FR Explain, patch matches input language, clean code never calls the model); sidebar stays at 7 entries
- [x] Lock suite re-run on preview: 25/25 (scan REVIEW/24/SEC-003 x2, clean CLEAN/0, Explain model id + EN/AR/FR RTL, Healer npm 0.94, Deep analysis model+latency+tokens, Verify trust 80/digest/HMAC/Re-check/download match, Certificate empty→80/100 digest-prefix ID/no QR/honest footer, benchmark 12/12+0/8, sidebar 7, /gtm 404); 28/28 unit tests; typecheck clean
- [x] Republished so the live URL serves the fixed build
