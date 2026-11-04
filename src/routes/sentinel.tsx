import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Play, RefreshCcw, ShieldAlert, Sparkle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { SectionBoundary } from "@/components/SectionBoundary";
import { SeverityBadge, Terminal } from "@/components/ops";
import { scanCode } from "@/lib/agents.functions";
import { explainScan } from "@/lib/ai.functions";
import { buildPatchedSource } from "@/lib/patched-source";
import type { ScanReport } from "@/lib/agents.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sentinel")({
  head: () => ({
    meta: [
      { title: "AI Code Sentinel — Autonomous Security Audit | SentinelOps AI" },
      {
        name: "description",
        content:
          "Paste any code or infrastructure config and let the Sentinel agent detect hardcoded secrets, injection vectors and misconfigurations with one-click patches.",
      },
      { property: "og:title", content: "AI Code Sentinel — Autonomous Security Audit" },
      {
        property: "og:description",
        content: "Detect secrets, injection vectors and misconfigurations with instant AI patches.",
      },
    ],
  }),
  component: SentinelPage,
});

const SAMPLE = `import os, requests
DEBUG = True
API_KEY = "sk_live_9f2b8c41d77a4e0eb3a5"

def get_user(conn, user_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = " + user_id)
    row = cur.fetchone()
    print("resolved user email", row["email"])
    return row

def sync(payload):
    requests.post("https://partner.example/api", json=payload, verify=False)
    return eval(payload["callback"])`;

function SentinelPage() {
  const run = useServerFn(scanCode);
  const [code, setCode] = useState(SAMPLE);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [patchedCode, setPatchedCode] = useState<string | null>(null);
  const [patchedReport, setPatchedReport] = useState<ScanReport | null>(null);
  const [rescanBusy, setRescanBusy] = useState(false);

  async function audit() {
    if (!code.trim()) {
      toast.error("Paste some code before running the audit.");
      return;
    }
    setBusy(true);
    setReport(null);
    setPatchedCode(null);
    setPatchedReport(null);
    setLines([]);
    try {
      const result = await run({ data: { code, filename: "audit-target" } });
      setLines(result.trace);
      setReport(result);
      setBusy(false);
    } catch {
      setBusy(false);
      toast.error("The Sentinel agent could not complete the audit. Try again.");
    }
  }

  async function rescanPatched() {
    if (!report) return;
    const { code: patched, applied } = buildPatchedSource(code, report);
    if (!applied) {
      toast.error("No patch suggestions are available for this report, so there is nothing to re-scan.");
      return;
    }
    setRescanBusy(true);
    setPatchedCode(patched);
    setPatchedReport(null);
    try {
      setPatchedReport(await run({ data: { code: patched, filename: "patched-audit-target" } }));
    } catch {
      toast.error("The re-scan could not complete. Try again.");
    } finally {
      setRescanBusy(false);
    }
  }

  return (
    <Shell
      title="AI Code Sentinel"
      subtitle="Autonomous static analysis with synthesised remediation patches"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Audit target</h2>
            <button
              onClick={() => setCode(SAMPLE)}
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary"
            >
              load sample
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            rows={18}
            className="mt-3 w-full resize-y rounded-md border border-input bg-background/70 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            placeholder="Paste source code, Dockerfile, Kubernetes manifest or Terraform…"
          />
          <button
            onClick={audit}
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Play className="size-4" />
            {busy ? "Auditing…" : "Run Autonomous Security Audit"}
          </button>
        </section>

        <section className="space-y-4">
          <SectionBoundary label="sentinel-results">
            <Terminal lines={lines} done={!busy} />
            {report ? <Verdict report={report} /> : null}
            {report && report.findings.length > 0 ? <Explain code={code} /> : null}
          </SectionBoundary>
        </section>
      </div>

      {report ? (
        <div className="mt-4 space-y-3">
          <h2 className="text-base font-semibold">
            Findings <span className="text-muted-foreground">({report.findings.length})</span>
          </h2>
          <SectionBoundary label="sentinel-findings">
            {report.findings.length === 0 ? (
              <div className="panel p-5 text-sm text-muted-foreground">
                No rule matched. This means none of the 12 rules fired, not that the code is proven safe.
              </div>
            ) : (
              report.findings.map((f) => <FindingCard key={f.id} finding={f} />)
            )}
          </SectionBoundary>
        </div>
      ) : null}

      {report && report.findings.length > 0 ? (
        <section className="panel mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Re-scan patched code</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Applies each patch suggestion above to its own line — the replacement text is exactly what the cards
                offer — then runs the scanner over the result.
              </p>
            </div>
            <button
              onClick={rescanPatched}
              disabled={rescanBusy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCcw className="size-4" />
              {rescanBusy ? "Re-scanning…" : "Re-scan patched code"}
            </button>
          </div>
          <SectionBoundary label="sentinel-rescan">
            {patchedCode ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-background/70 p-3 font-mono text-xs leading-relaxed">
                {patchedCode}
              </pre>
            ) : null}
            {patchedReport ? (
              <div className="mt-3 space-y-3">
                <Verdict report={patchedReport} />
                <p className="text-sm text-muted-foreground">
                  Patched result: risk {report.riskScore}/100 → {patchedReport.riskScore}/100 ·{" "}
                  {patchedReport.findings.length} finding(s) remain.
                </p>
                {patchedReport.findings.length > 0 ? (
                  patchedReport.findings.map((f) => <FindingCard key={`patched-${f.id}`} finding={f} />)
                ) : (
                  <p className="text-sm font-medium text-accent">
                    The patched code is clean: no rule fires any more.
                  </p>
                )}
              </div>
            ) : null}
          </SectionBoundary>
        </section>
      ) : null}
    </Shell>
  );
}

function Verdict({ report }: { report: ScanReport }) {
  return (
    <div className="panel panel-glow p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-mono">Verdict</div>
          <div className="mt-1 font-display text-2xl font-semibold uppercase text-primary">
            {report.verdict}
          </div>
        </div>
        <div className="text-right">
          <div className="label-mono">Risk score</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-critical">
            {report.riskScore}/100
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 font-mono text-xs">
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <div key={s} className="rounded-md border border-border bg-surface-raised p-2 text-center">
            <div className="text-lg tabular-nums text-foreground">{report.counts[s]}</div>
            <div className="uppercase tracking-widest text-muted-foreground">{s}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        scan {report.scanId} · {report.linesAnalyzed} lines · {report.durationMs}ms
      </p>
    </div>
  );
}

function FindingCard({ finding }: { finding: ScanReport["findings"][number] }) {
  const patch = finding.patch;
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldAlert className="size-4 text-critical" />
        <h3 className="text-sm font-semibold">{finding.title}</h3>
        <SeverityBadge severity={finding.severity} />
        <span className="font-mono text-[11px] text-muted-foreground">
          {finding.cwe} · line {finding.line} · {finding.category}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{finding.description}</p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/70 p-3 font-mono text-xs text-high">
        {finding.evidence}
      </pre>
      <p className="mt-3 text-sm">
        <span className="label-mono">Remediation</span>
        <br />
        {finding.remediation}
      </p>
      {patch ? (
        <pre className="mt-3 overflow-x-auto rounded-md border border-accent/30 bg-accent/5 p-3 font-mono text-xs text-accent">
          {finding.patch}
        </pre>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No patch suggestion: the input language could not be determined, so no language-matched patch is offered.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {patch ? (
          <button
            onClick={() => {
              void navigator.clipboard.writeText(patch);
              toast.success("Patch copied. Nothing is applied automatically.");
            }}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
          >
            <Copy className="size-3.5" /> Copy patch
          </button>
        ) : null}
        {finding.compliance.map((c) => (
          <span
            key={c}
            className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {c}
          </span>
        ))}
      </div>
    </article>
  );
}

function Explain({ code }: { code: string }) {
  const run = useServerFn(explainScan);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<"en" | "ar" | "fr">("en");
  const [out, setOut] = useState<Awaited<ReturnType<typeof explainScan>> | null>(null);
  async function go(next: "en" | "ar" | "fr") {
    setLang(next);
    setBusy(true);
    setOut(null);
    try {
      setOut(await run({ data: { code, language: next } }));
    } catch (error) {
      toast.error("Explanation failed", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void go(lang)} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          <Sparkle className="size-3.5" /> {busy ? "Reasoning…" : "Explain findings"}
        </button>
        <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Explanation language">
          {([["en", "English"], ["ar", "العربية"], ["fr", "Français"]] as const).map(([code, label]) => (
            <button
              key={code}
              onClick={() => void go(code)}
              disabled={busy}
              className={cn("px-2.5 py-1.5 text-xs font-medium disabled:opacity-50", lang === code ? "bg-accent text-accent-foreground" : "hover:bg-surface-raised")}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">Meta Muse Spark Open</span>
      </div>
      {out ? (
        out.nothingToDo ? (
          <p className="mt-3 text-sm text-muted-foreground">{out.message}</p>
        ) : (
          <>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">Explained by {out.model} · {out.latencyMs} ms</p>
            <pre dir={lang === "ar" ? "rtl" : "ltr"} className={cn("mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm text-foreground/90", lang === "ar" && "text-right")}>{out.explanation}</pre>
          </>
        )
      ) : null}
    </div>
  );
}
