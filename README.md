# SentinelOps AI — Autonomous Security & DevOps Command Center

> Disclosure (read first): SentinelOps began as a pre-existing Lovable prototype created before the hackathon. This repository is NEW, created during the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026). The code in this repo is the event-week build: rule scoping by file type, multilingual AI explanations, signed verification, benchmark vs. naive baseline, public repo scan, real served-request counters, and the compliance hub were all built, fixed, and live-verified during the event. The demo video opens with the same disclosure. The prototype lineage is disclosed here per the rules.

## What it is

Paste code → deterministic security scan (12 rules) → findings with patches → AI explanation (EN/AR/FR) → one-click patch → re-scan proves CLEAN → signed verification artifact + certificate → benchmark against a naive grep baseline. Plus: scan any public GitHub repo, and a DevOps auto-healer for dependency conflicts.

Live demo: https://sentinel-scan-and-seal.lovable.app (build sentinelops-20261104-2221Z at last verification, Nov 4, 2026). No login, no keys, no phone number — open the URL and paste code.

## Verified live (Nov 4, 2026, on the published build)

- Vulnerable Python (eval + os.system): REVIEW, risk 24/100, SEC-003 ×2 (CWE-95 eval, CWE-78 os.system), real patches. Re-scan of patched code: CLEAN, 0/100, banner "risk 24/100 → 0/100".
- Rule scoping: the scanner applies 9/12 rules to Python files; Dockerfile rules never fire on Python (regression tested on a mixed repo: zero cross-type false positives).
- Explain: "Explained by meta-models/muse-spark-open-1026 · 8822 ms · 3151 output tokens" (EN, AR RTL, FR; patch stays in the input language).
- Healer: npm peer conflict, diagnosis + 0.94 labelled "(fixed constant, not measured accuracy)" + overrides patch (react/react-dom 19.2.0).
- Verify: BLOCKED example, trust 20/100, artifact 131c64051ff7dc49, scan SCN-96B709E6, digest + HMAC-SHA256, re-check "digest matches · signature valid". Evidence pack (scan-report, signed-verification, benchmark, manifest) carries one scanId + artifactId in every file.
- Benchmark (live-computed): scanner 12/12, 0 false positives; naive grep baseline 9/12, 3 false positives.
- Repo scan: authenticates with GitHub when GITHUB_API_KEY is set on the server (verified: psf/requests, 50 of 60 scannable files, 28 findings across 25 files, real evidence lines). Without a key it uses the anonymous GitHub API (60 requests/hour) and may rate-limit — the UI reports this honestly instead of faking a scan.
- Counters: "Counts the public API endpoints only — dashboard scans are separate and not counted." Every increment is a real served request, persisted since server start.
- Sidebar: 8 entries, identical on every page, including Explain Findings. Compliance hub: GDPR (2016/679), Cyber Resilience Act (2024/2847), NIS2 (2022/2555) mapping + technical measures + API surface — no benchmark duplication.

## Meta models used (the only runtime models)

- `meta-models/muse-spark-open-1026` (Meta Muse Spark Open), called via Baseten inference (`https://inference.baseten.co/v1`, OpenAI-compatible). Used ONLY for: (1) Explain findings, (2) Deep analysis. No other runtime model is called. No Llama, no third-party model, no fallback. If the model is unavailable, those two features fail closed with an honest error — the deterministic scanner, healer, verifier, and benchmark keep working (they use no model at all).

## Architecture (per part)

| Part | Model | Input | Output | Inference location | Call |
| Scanner | none (deterministic regex rules) | pasted code / repo files | findings + risk + patches | local | in-process |
| Healer | none (deterministic signatures + fixed confidence constants) | dependency conflict description | diagnosis + patch | local | in-process |
| Explain | Muse Spark Open (Baseten) | findings + code | explanation + patch, EN/AR/FR | Baseten cloud | POST /v1/chat/completions |
| Deep analysis | Muse Spark Open (Baseten) | code + findings | deep analysis + tokens | Baseten cloud | POST /v1/chat/completions |
| Verify | none (HMAC-SHA256, Web Crypto) | scan result | signed artifact + trust score | local | in-process |
| Certificate | none (derived from verification) | verification record | certificate (ID = digest prefix) | local | in-process |
| Benchmark | none (deterministic) | 20 fixed samples (12 vulnerable + 8 clean) | scanner vs naive-grep scores | local | in-process |
| Repo scan | none (GitHub API + scanner) | public repo URL | findings across files | GitHub API + local | GET api.github.com |
| Counters | none (DB-persisted) | served public-API requests | live totals | server DB | in-process |

## Run it yourself (credential-free demo path)

1. Open the live demo URL above. No account, no key, no phone number.
2. Paste the vulnerable Python sample (eval + os.system) → Scan → REVIEW 24.
3. Apply a patch → Re-scan → CLEAN 0.
4. Explain → see the model id, latency, and tokens in the footer.
5. Verify → download the JSON + evidence pack; check the scanId/artifactId match in every file.
6. Benchmark → see scanner 12/12 vs naive grep 9/12.

## Run from source

- `npm install`, `npm run dev` (Vite + React + TanStack). Tests: `npm test` (vitest; 44 tests incl. rule-scoping + pack-coherence regression tests). Lint + typecheck clean.
- Environment (server only, never committed; see `.env.example`): `BASETEN_API_KEY` (for Explain/Deep), `SENTINELOPS_AUDIT_SIGNING_KEY` (HMAC signing), `GITHUB_API_KEY` (optional; raises GitHub quota for repo scan). No keys are in this repo. Judges may use their own keys; the demo needs none.

## Honest limits

- The scanner is regex-based: it finds known patterns, not all vulnerabilities. Confidence numbers on healer patches are fixed constants, labelled as such — not measured accuracy.
- Repo scan caps at 50 files / 120 KB and needs GitHub quota; anonymous access is 60 requests/hour.
- Counters count public-API requests only, not dashboard scans.
- No Meta logos are used. No third-party AI voices or music are used in the demo video (narration is the author's own voice or OS voice).

## License

MIT.
