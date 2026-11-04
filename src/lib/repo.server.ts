import { HttpError } from "./api-helpers.server";
import { runSecurityScan, type Finding, type ScanReport } from "./agents.server";

/** Public GitHub repository scan. Only github.com URLs are accepted, only public
 *  repositories resolve, and every limit below is enforced with a graceful error —
 *  never a fake or partial result presented as complete. */

const MAX_FILES = 50;
const MAX_FILE_BYTES = 120 * 1024;
const MAX_CANDIDATES = 2_000;

const CODE_EXT = /\.(?:py|js|jsx|ts|tsx|mjs|cjs|go|rb|php|java|kt|swift|c|cc|cpp|h|hpp|cs|rs|sh|bash|sql|yaml|yml|toml|json|ini|cfg|env|tf|hcl)$/i;
const CODE_NAME = /(?:^|\/)(?:Dockerfile(?:\.[^/]+)?|docker-compose[^/]*\.ya?ml|Makefile|requirements\.txt|package\.json|\.env[^/]*|Procfile)$/i;
const SKIP = /(?:^|\/)(?:node_modules|\.git|vendor|dist|build|out|\.venv|__pycache__)(?:\/|$)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(?:js|css)$/i;

export interface RepoFileResult {
  path: string;
  bytes: number;
  findingCount: number;
  riskScore: number;
  verdict: ScanReport["verdict"];
  findings: Finding[];
}

export interface RepoScanResult {
  repo: string;
  branch: string;
  candidates: number;
  scannedFiles: number;
  skippedOversized: number;
  files: RepoFileResult[];
  totals: { findings: number; critical: number; high: number; medium: number; low: number; filesWithFindings: number };
  gateVerdict: "blocked" | "review" | "clean";
  notes: string[];
  scannedAt: string;
}

type TreeEntry = { type: string; path: string; size?: number };

export function parseRepoUrl(input: string): { owner: string; repo: string; branch?: string } {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new HttpError(400, "invalid_input", "Paste a full GitHub repository URL, e.g. https://github.com/owner/repo");
  }
  if (u.protocol !== "https:" || u.hostname !== "github.com") {
    throw new HttpError(400, "invalid_input", "Only public github.com repository URLs can be scanned.");
  }
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new HttpError(400, "invalid_input", "The URL must include an owner and a repository, e.g. https://github.com/owner/repo");
  }
  const branch = parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob") ? decodeURIComponent(parts[3]!) : undefined;
  return branch ? { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/, ""), branch } : { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/, "") };
}

function ghHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "SentinelOpsAI-Scanner",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function scanGithubRepo(input: string): Promise<RepoScanResult> {
  const { owner, repo, branch } = parseRepoUrl(input);
  const gh = async (path: string): Promise<Response> =>
    fetch(`https://api.github.com${path}`, { headers: ghHeaders(), signal: AbortSignal.timeout(30_000) });

  const metaRes = await gh(`/repos/${owner}/${repo}`);
  if (metaRes.status === 404 || metaRes.status === 401) {
    throw new HttpError(
      404,
      "repo_not_found",
      "Repository not found. It may not exist, or it may be private — only public repositories can be scanned.",
    );
  }
  if (metaRes.status === 403) {
    throw new HttpError(429, "github_rate_limited", "GitHub's API rate limit was reached. Try again later.");
  }
  if (!metaRes.ok) throw new HttpError(502, "github_unreachable", "GitHub could not be reached. Try again.");
  const meta = (await metaRes.json()) as { default_branch?: string };
  const ref = branch || meta.default_branch || "main";

  const treeRes = await gh(`/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
  if (treeRes.status === 404) {
    throw new HttpError(404, "repo_not_found", `Branch "${ref}" was not found in ${owner}/${repo}.`);
  }
  if (treeRes.status === 403) {
    throw new HttpError(429, "github_rate_limited", "GitHub's API rate limit was reached. Try again later.");
  }
  if (!treeRes.ok) throw new HttpError(502, "github_unreachable", "GitHub could not be reached. Try again.");
  const tree = (await treeRes.json()) as { truncated?: boolean; tree: TreeEntry[] };
  if (tree.truncated) {
    throw new HttpError(413, "repo_too_large", "This repository is too large for one scan request. Scan it in parts instead.");
  }

  const blobs = tree.tree.filter((t) => t.type === "blob");
  const candidates = blobs.filter((t) => !SKIP.test(t.path) && (CODE_EXT.test(t.path) || CODE_NAME.test(t.path)));
  if (candidates.length > MAX_CANDIDATES) {
    throw new HttpError(
      413,
      "repo_too_large",
      `${owner}/${repo} has ${candidates.length} scannable files; one scan covers at most ${MAX_CANDIDATES}. Scan it in parts instead.`,
    );
  }
  const notes: string[] = [];
  const oversized = candidates.filter((t) => (t.size ?? 0) > MAX_FILE_BYTES).length;
  if (oversized) notes.push(`${oversized} file(s) over 120KB were skipped.`);
  const fetchList = candidates.filter((t) => (t.size ?? 0) <= MAX_FILE_BYTES).slice(0, MAX_FILES);
  if (fetchList.length < candidates.length - oversized) {
    notes.push(`Capped at ${MAX_FILES} files; ${candidates.length - oversized - fetchList.length} scannable files were not fetched.`);
  }
  if (!fetchList.length) notes.push("No code or manifest files matched the scan filter.");

  const files: RepoFileResult[] = [];
  const CHUNK = 10;
  for (let i = 0; i < fetchList.length; i += CHUNK) {
    await Promise.all(
      fetchList.slice(i, i + CHUNK).map(async (t) => {
        const raw = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${t.path}`,
          { signal: AbortSignal.timeout(30_000) },
        );
        if (!raw.ok) {
          notes.push(`${t.path}: could not be fetched (HTTP ${raw.status}).`);
          return;
        }
        const text = await raw.text();
        if (text.length > MAX_FILE_BYTES) {
          notes.push(`${t.path}: skipped, larger than 120KB.`);
          return;
        }
        const report = await runSecurityScan(text, t.path);
        files.push({
          path: t.path,
          bytes: text.length,
          findingCount: report.findings.length,
          riskScore: report.riskScore,
          verdict: report.verdict,
          findings: [...report.findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.line - b.line),
        });
      }),
    );
  }

  files.sort((a, b) => b.riskScore - a.riskScore || a.path.localeCompare(b.path));
  const totals = { findings: 0, critical: 0, high: 0, medium: 0, low: 0, filesWithFindings: 0 };
  for (const f of files) {
    totals.findings += f.findingCount;
    totals.filesWithFindings += f.findingCount > 0 ? 1 : 0;
    for (const x of f.findings) totals[x.severity] = (totals[x.severity] ?? 0) + 1;
  }
  const gateVerdict: RepoScanResult["gateVerdict"] =
    totals.critical > 0 ? "blocked" : totals.findings > 0 ? "review" : "clean";

  return {
    repo: `${owner}/${repo}`,
    branch: ref,
    candidates: candidates.length,
    scannedFiles: files.length,
    skippedOversized: oversized,
    files,
    totals,
    gateVerdict,
    notes,
    scannedAt: new Date().toISOString(),
  };
}
