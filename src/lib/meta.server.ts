import { HttpError } from "./api-helpers.server";
import { detectLanguage, runSecurityScan, type Finding, type ScanReport, type Severity, type SourceLanguage } from "./agents.server";

// Re-exported so the model layer and its tests share the scanner's single language heuristic.
export { detectLanguage };
export type { SourceLanguage };


/** The only model this app calls. There is no fallback to any other model. */
export const META_MODEL = "meta-models/muse-spark-open-1026";
const baseUrl = () => process.env["BASETEN_BASE_URL"] || "https://inference.baseten.co/v1"; // empty string counts as unset
/** Budget must cover hidden reasoning AND the visible answer. Overridable, never silently shrunk. */
const maxTokens = () => Math.max(1024, Number(process.env["MUSE_MAX_TOKENS"] ?? 8192) || 8192);
const ATTEMPT_TIMEOUT_MS = 80_000;
const ATTEMPTS = 2; // one retry, same model, same prompt

export interface MetaOutput {
  model: string;
  text: string;
  latencyMs: number;
  attempts: number;
  usage: { promptTokens: number | null; completionTokens: number | null };
}

type Choice = { message?: { content?: unknown }; finish_reason?: string };
type Completion = { choices?: Choice[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };

/** Ids and CWEs a model answer may cite. Anything else is an invented finding. */
export function citationProblems(answer: string, findings: Finding[]): string[] {
  const okRules = new Set(findings.map((f) => f.ruleId));
  const okCwe = new Set(findings.map((f) => f.cwe));
  const bad = new Set<string>();
  for (const m of answer.matchAll(/\bSEC-\d{3}\b/g)) if (!okRules.has(m[0])) bad.add(m[0]);
  for (const m of answer.matchAll(/\bCWE-\d+\b/g)) if (!okCwe.has(m[0])) bad.add(m[0]);
  return [...bad];
}

/**
 * Appended to the Explain prompt. The referencePatch fields may be templates in another
 * language; the model must rewrite patches in the input's language, or omit the Patch
 * section entirely when the language cannot be determined.
 */
export function patchLanguageDirective(code: string): string {
  const lang = detectLanguage(code);
  if (lang === "unknown") {
    return "\n\nPatch language: the source language could not be determined. Omit the ## Patch section entirely and provide the explanation only.";
  }
  const name = lang === "python" ? "Python" : "JavaScript or TypeScript";
  return `\n\nPatch language: the input source is ${name}. The referencePatch fields show intent only and may be written in another language — rewrite every fenced code block in the Patch section as ${name} adapted to the user's code. Never show a patch in a different language than the input.`;
}

/** Explain output languages. The findings, ids and patch-language rules never change — only the prose. */
export const EXPLAIN_LANGUAGES = [
  { code: "en", label: "English", directive: "Write the entire explanation in English." },
  { code: "ar", label: "العربية", directive: "Write the entire explanation in Arabic (Modern Standard Arabic), right-to-left. Keep rule ids, CWE ids and code identifiers exactly as they are." },
  { code: "fr", label: "Français", directive: "Write the entire explanation in French." },
] as const;

export type ExplainLanguage = (typeof EXPLAIN_LANGUAGES)[number]["code"];

export function languageDirective(lang: ExplainLanguage): string {
  return EXPLAIN_LANGUAGES.find((l) => l.code === lang)?.directive ?? EXPLAIN_LANGUAGES[0].directive;
}

/** Fail-closed chat call. Empty output (typically hidden-reasoning exhaustion, finish_reason "length"),
 * answers that cite findings the scanner never produced and answers that fail an optional output
 * validator (e.g. wrong language) are retried once with the same model and prompt.
 * Every failure becomes a generic error: upstream bodies and keys are never exposed. */
export async function callMuse(
  system: string,
  user: string,
  findings: Finding[],
  validate?: (text: string) => string | null,
): Promise<MetaOutput> {
  const key = process.env["BASETEN_API_KEY"];
  if (!key) throw new HttpError(503, "model_unavailable", "The Meta model is not configured. Set BASETEN_API_KEY on the server.");
  const t0 = Date.now();
  let lastReason = "empty_answer";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: META_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          max_tokens: maxTokens(),
        }),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch {
      console.error(`[meta] attempt ${attempt}: request failed or timed out`);
      throw new HttpError(502, "model_unavailable", "The Meta model could not be reached in time. Nothing was generated.");
    }
    if (!res.ok) {
      console.error(`[meta] attempt ${attempt}: upstream status ${res.status}`);
      throw new HttpError(502, "model_unavailable", `The Meta model returned an error (${res.status}). Nothing was generated.`);
    }
    let json: Completion;
    try {
      json = (await res.json()) as Completion;
    } catch {
      throw new HttpError(502, "model_unavailable", "The Meta model returned an unreadable response.");
    }
    const choice = json.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (text.length < 40) {
      lastReason = choice?.finish_reason === "length" ? "reasoning_budget_exhausted" : "empty_answer";
      console.error(`[meta] attempt ${attempt}: ${lastReason}`);
      continue;
    }
    const invented = citationProblems(text, findings);
    if (invented.length) {
      lastReason = "invented_findings";
      console.error(`[meta] attempt ${attempt}: answer cited ${invented.join(",")}`);
      continue;
    }
    const invalid = validate?.(text) ?? null;
    if (invalid) {
      lastReason = invalid;
      console.error(`[meta] attempt ${attempt}: ${invalid}`);
      continue;
    }
    return {
      model: META_MODEL,
      text,
      latencyMs: Date.now() - t0,
      attempts: attempt,
      usage: { promptTokens: json.usage?.prompt_tokens ?? null, completionTokens: json.usage?.completion_tokens ?? null },
    };
  }
  const msg =
    lastReason === "invented_findings"
      ? "The Meta model's answer cited findings the scanner did not produce, so it was rejected. Nothing was generated."
      : lastReason === "wrong_language"
        ? "The Meta model's answer was not in the requested language, so it was rejected. Nothing was generated."
        : "The Meta model returned no usable answer after one retry. Nothing was generated.";
  throw new HttpError(
    502,
    lastReason === "invented_findings" || lastReason === "wrong_language" ? "model_output_rejected" : "model_unavailable",
    msg,
  );
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const ordered = (f: Finding[]) => [...f].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.line - b.line);

const brief = (f: Finding) => ({
  id: f.id,
  ruleId: f.ruleId,
  title: f.title,
  severity: f.severity,
  cwe: f.cwe,
  line: f.line,
  evidence: f.evidence,
  referencePatch: f.patch,
});

const facts = (r: ScanReport) => ({ verdict: r.verdict, riskScore: r.riskScore, counts: r.counts, findingCount: r.findings.length });

const FORMAT = `Use EXACTLY this markdown structure and nothing else:

## Verdict
One or two sentences. State the scanner verdict and risk score exactly as given, then the single most important risk.

## Findings
One "### " block per finding, in the order given. Each block has: a heading "### <id> - <title> (<cwe>, line <line>)", then "Evidence:" with the evidence in backticks, then the explanation.

## Patch
One fenced code block per finding, labelled with the finding id, adapting the reference patch to the user's code.

Rules: cover every finding exactly once and no others. Cite only the finding ids, CWE ids, lines and numbers present in the JSON. Never invent findings, CVEs, statistics or percentages. No introduction, no closing remarks.`;

function frame(system: string, r: ScanReport, extra: string) {
  return {
    system: `${system}\n\n${FORMAT}`,
    user: `Scanner facts (authoritative, do not contradict): ${JSON.stringify(facts(r))}\n\nFindings (JSON, already ordered):\n${JSON.stringify(ordered(r.findings).map(brief), null, 2)}${extra}`,
  };
}

const numbered = (src: string) => src.split("\n").map((l, i) => `${String(i + 1).padStart(4)} | ${l}`).join("\n");

export async function explainFindings(code: string, language: ExplainLanguage = "en") {
  const report = await runSecurityScan(code); // the model only ever sees genuine scanner output
  if (!report.findings.length)
    return {
      nothingToDo: true as const,
      scanId: report.scanId,
      inputSha256: report.inputSha256,
      message: "The scan found no findings, so there is nothing to explain. The model was not called.",
    };
  const { system, user } = frame(
    `You explain static-analysis findings to a developer who is not a security specialist. Plain language: what is wrong, what an attacker could do. At most 60 words per finding. ${languageDirective(language)}`,
    report,
    patchLanguageDirective(code),
  );
  const out = await callMuse(system, user, report.findings);
  return {
    nothingToDo: false as const,
    scanId: report.scanId,
    inputSha256: report.inputSha256,
    explanation: out.text,
    generatedAt: new Date().toISOString(),
    ...out,
  };
}

export async function runDeepAnalysis(code: string) {
  const report = await runSecurityScan(code);
  if (!report.findings.length)
    return {
      nothingToDo: true as const,
      scanId: report.scanId,
      inputSha256: report.inputSha256,
      message: "The scan found no findings, so there is nothing to analyse in depth. The model was not called.",
    };
  const { system, user } = frame(
    "You are a senior application-security reviewer writing a deep audit. For each finding explain exploitability and impact in 80 words or fewer, then give a hardened replacement for the vulnerable line(s).",
    report,
    `\n\nSource (line-numbered):\n\`\`\`\n${numbered(code)}\n\`\`\``,
  );
  const out = await callMuse(system, user, report.findings);
  return {
    nothingToDo: false as const,
    scanId: report.scanId,
    inputSha256: report.inputSha256,
    report: out.text,
    generatedAt: new Date().toISOString(),
    ...out,
  };
}
