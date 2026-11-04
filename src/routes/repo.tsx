import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Github, ScanSearch, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { SectionBoundary } from "@/components/SectionBoundary";
import { SeverityBadge } from "@/components/ops";
import { scanGithubRepoFn } from "@/lib/repo.functions";
import type { RepoScanResult } from "@/lib/repo.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repo")({
  head: () => ({
    meta: [
      { title: "Public Repo Scan — Scan a GitHub Repository | SentinelOps AI" },
      {
        name: "description",
        content:
          "Paste a public github.com URL and scan up to 50 code and manifest files (120KB each) with an aggregate gate verdict.",
      },
      { property: "og:title", content: "Public Repo Scan" },
      {
        property: "og:description",
        content:
          "Scan a public GitHub repository with the 12 SentinelOps rules and get a gate verdict.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepoScanPage,
});

function RepoScanPage() {
  const run = useServerFn(scanGithubRepoFn);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RepoScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!url.trim()) {
      toast.error("Paste a public GitHub repository URL first.");
      return;
    }
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      setResult(await run({ data: { url } }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The repository scan could not complete. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Public repo scan"
      subtitle="Scan a public github.com repository: up to 50 code/manifest files, 120KB each, aggregate gate verdict"
    >
      <section className="panel p-5">
        <label htmlFor="repo-url" className="label-mono">
          Public repository URL
        </label>
        <input
          id="repo-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          spellCheck={false}
          className="mt-2 w-full rounded-md border border-input bg-background/70 px-3 py-2.5 font-mono text-sm outline-none focus:border-ring"
        />
        <button
          onClick={go}
          disabled={busy}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <ScanSearch className="size-4" />
          {busy ? "Scanning repository…" : "Scan repository"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Public repositories only. Private or missing repositories, oversized repositories and bad
          URLs fail with a clear message — nothing is guessed or faked.
        </p>
        {error ? (
          <p className="mt-3 rounded-md border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
            {error}
          </p>
        ) : null}
      </section>

      <SectionBoundary label="repo-report">
        {result ? <RepoReport result={result} /> : null}
      </SectionBoundary>
    </Shell>
  );
}

function RepoReport({ result }: { result: RepoScanResult }) {
  return (
    <div className="mt-4 space-y-4">
      <section className="panel panel-glow p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="label-mono">Gate verdict</div>
            <div
              className={cn(
                "mt-1 font-display text-2xl font-semibold uppercase",
                result.gateVerdict === "blocked"
                  ? "text-critical"
                  : result.gateVerdict === "review"
                    ? "text-high"
                    : "text-accent",
              )}
            >
              {result.gateVerdict}
            </div>
          </div>
          <div className="text-right font-mono text-[11px] text-muted-foreground">
            {result.repo} · {result.branch}
            <br />
            {result.scannedFiles} of {result.candidates} scannable file(s) scanned
            <br />
            <span className={result.apiAuth === "token" ? "text-accent" : undefined}>
              GitHub API: {result.apiAuth === "token" ? "authenticated" : "anonymous"}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 font-mono text-xs">
          {(["critical", "high", "medium", "low"] as const).map((s) => (
            <div
              key={s}
              className="rounded-md border border-border bg-surface-raised p-2 text-center"
            >
              <div className="text-lg tabular-nums text-foreground">{result.totals[s]}</div>
              <div className="uppercase tracking-widest text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {result.totals.findings} finding(s) across {result.totals.filesWithFindings} file(s).
          BLOCKED means at least one critical finding.
        </p>
        {result.notes.length ? (
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
            {result.notes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {result.files.length ? (
        result.files.map((f) => <RepoFileCard key={f.path} file={f} />)
      ) : (
        <section className="panel p-5 text-sm text-muted-foreground">
          No code or manifest files were scanned, so there is nothing to report.
        </section>
      )}
    </div>
  );
}

function RepoFileCard({ file }: { file: RepoScanResult["files"][number] }) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Github className="size-4 text-muted-foreground" />
        <h3 className="font-mono text-sm font-semibold">{file.path}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {file.bytes} bytes · risk {file.riskScore}/100 · {file.verdict}
        </span>
      </div>
      {file.findings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No rule fired in this file.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {file.findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-md border border-border bg-surface-raised/50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert
                  className={cn(
                    "size-4",
                    finding.severity === "critical" ? "text-critical" : "text-high",
                  )}
                />
                <span className="text-sm font-medium">{finding.title}</span>
                <SeverityBadge severity={finding.severity} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {finding.cwe} · line {finding.line}
                </span>
              </div>
              <pre className="mt-2 overflow-x-auto rounded border border-border bg-background/70 p-2 font-mono text-xs text-high">
                {finding.evidence}
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">{finding.remediation}</p>
              {finding.patch ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(finding.patch as string);
                      toast.success("Patch copied. Nothing is applied automatically.");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground hover:opacity-90"
                  >
                    <Copy className="size-3" /> Copy patch
                  </button>
                  <pre className="min-w-0 flex-1 overflow-x-auto rounded border border-accent/30 bg-accent/5 p-2 font-mono text-[11px] text-accent">
                    {finding.patch}
                  </pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
