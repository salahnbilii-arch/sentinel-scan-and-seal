# SentinelOps AI

**Deterministic security scanning, CI-failure healing and signed verification, with Meta Muse Spark Open explanations.**

SentinelOps AI runs a 12-rule deterministic scanner, a 7-signature CI/CD healer and a
HMAC-signed verification engine behind one dashboard. Model explanations come from a single
model — `meta-models/muse-spark-open-1026` via Baseten — and only ever see genuine scanner
output. Built for EU regulatory scrutiny (GDPR, Cyber Resilience Act, NIS2).

---

## 1. Architecture

| Layer | Technology |
| --- | --- |
| UI | React 19 + TanStack Router (file-based routing) + Tailwind CSS v4 design system |
| Server | TanStack Start server functions + server routes |
| Agent engine | `src/lib/agents.server.ts` — scanner rules and healer signatures (deterministic) |
| Verification | `src/lib/verify.server.ts` — 5 heuristic obligations, SHA-256 digest, HMAC-SHA256 signature |
| Model | `src/lib/meta.server.ts` — Muse Spark Open via Baseten (the only model; no fallback) |

```
src/
├── lib/
│   ├── agents.server.ts      # 12 scanner rules, 7 healer signatures + labelled fallback
│   ├── meta.server.ts        # Baseten call, retry-once, invented-finding rejection
│   ├── verify.server.ts      # obligations, trust = 100 - 20 x violated, digest + HMAC
│   ├── benchmark.server.ts   # benchmark computed live from bundled samples
│   └── *.functions.ts        # typed RPC boundary (server functions)
├── routes/
│   ├── index.tsx             # Command Center (live benchmark)
│   ├── sentinel.tsx          # AI Code Sentinel (scan + explain)
│   ├── healer.tsx            # DevOps Auto-Healer
│   ├── compliance.tsx        # EU Compliance Hub (+ deep analysis)
│   ├── verify.tsx            # Verify, re-check, download signed JSON
│   ├── certificate.tsx       # Certificate Studio (operator-entered data only)
│   └── api/public/v1/        # scan-code · devops-heal · explain · deep-analysis ·
│                             # verify · check-signature · benchmark · rules · health
└── components/               # Shell (sidebar/nav), ops primitives
```

## 2. API specification

Base URL: `https://<your-deployment>/api/public/v1`

### `POST /scan-code`
```json
{ "code": "API_KEY = \"sk_live_...\"", "filename": "settings.py" }
```
Returns `scanId`, `verdict` (`blocked|review|clean`), `riskScore` (0–100), severity `counts`,
and a `findings[]` array with `cwe`, `line`, `evidence`, `remediation`, a ready-to-apply
`patch` and mapped `compliance` references.

### `POST /devops-heal`
```json
{ "log": "npm ERR! code ERESOLVE ..." }
```
Returns `detected`, `rootCause`, `targetFile`, the corrected `patch`, recovery `commands[]`
and `preventions[]`. `signatureScore` is a fixed per-signature constant, not a measured accuracy.

### `POST /explain` and `POST /deep-analysis`
```json
{ "code": "..." }
```
Both re-scan server-side first. Clean input returns `200 { "nothingToDo": true }` and never
calls the model. The model prompt contains only scanner facts and findings; answers that cite
a rule or CWE the scanner did not produce are retried once, then rejected
(`model_output_rejected`).

### `POST /verify`
```json
{ "source": "...", "artifactName": "settings.py" }
```
Runs the same scanner, discharges 5 heuristic obligations and returns a signed artifact:
`trustScore = 100 - 20 x violatedCount` (`trustFormula` included), the findings embedded in
the digest, a SHA-256 `digest` and an `HMAC-SHA256` `signature` (`SENTINELOPS_AUDIT_SIGNING_KEY`).
This is a heuristic audit record — there is no formal proof and no solver.

### `POST /check-signature`
```json
{ "artifact": { ...signed artifact... } }
```
Strict shape validation (400 on malformed input), then recomputes digest and signature.

### `GET /benchmark`
Live detection numbers computed from the bundled samples: 12 vulnerable samples (one per rule)
and 8 clean samples. Includes the per-rule CWE.

### `GET /rules`
The 12-rule catalog with titles, severities, categories and the CWE mapping.

All endpoints validate input, cap payloads at 120 KB, require a JSON object body and send
CORS headers only for origins explicitly listed in `ALLOWED_ORIGINS`.

## 3. Running locally

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # production bundle
```

Quick smoke test:

```bash
curl -s localhost:8080/api/public/v1/rules
curl -s -X POST localhost:8080/api/public/v1/scan-code \
  -H 'content-type: application/json' \
  -d '{"code":"API_KEY = \"sk_live_abc123456\""}'
```

Required secrets (server environment, never in code): `BASETEN_API_KEY`,
`SENTINELOPS_AUDIT_SIGNING_KEY`; optional `MUSE_MAX_TOKENS` (default 8192), `ALLOWED_ORIGINS`.

## 4. Security posture

- No submitted code or logs are persisted; analysis is in-memory per request.
- Deterministic engines produce identical output for identical input; the model layer is
  fail-closed and never exposes upstream errors or keys.
- No client-side hashing or signing: SHA-256 and HMAC are server-only.
- Patches are always proposed, never applied automatically.
- The dashboard contains no simulated status indicators; every number shown is computed live.
