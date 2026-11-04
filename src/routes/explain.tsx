import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, Sparkle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { SectionBoundary } from "@/components/SectionBoundary";
import { SeverityBadge } from "@/components/ops";
import { explainScan } from "@/lib/ai.functions";
import { scanCode } from "@/lib/agents.functions";
import type { ScanReport } from "@/lib/agents.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explain")({
  head: () => ({
    meta: [
      { title: "Explain Findings — AI Security Explanation | SentinelOps AI" },
      {
        name: "description",
        content:
          "Paste code, run the deterministic scanner, and have Meta Muse Spark Open explain each finding in English, Arabic or French. Patches always match the input language.",
      },
      { property: "og:title", content: "Explain Findings — AI Security Explanation" },
      {
        property: "og:description",
        content: "Scanner findings explained in English, Arabic or French by Meta Muse Spark Open.",
      },
    ],
  }),
  component: ExplainPage,
});

const SAMPLE = `import os, requests

def get_user(conn, user_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = " + user_id)
    return cur.fetchone()

def sync(payload):
    requests.post("https://partner.example/api", json=payload, verify=False)
    return eval(payload["callback"])`;

type ExplainOut = Awaited<ReturnType<typeof explainScan>>;

function ExplainPage() {
  const runScan = useServerFn(scanCode);
  const runExplain = useServerFn(explainScan);
  const [code, setCode] = useState(SAMPLE);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [lang, setLang] = useState<"en" | "ar" | "fr">("en");
  const [out, setOut] = useState<ExplainOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannedCode, setScannedCode] = useState("");

  async function run() {
    if (!code.trim()) {
      toast.error("Paste some code first.");
      return;
    }
    setBusy(true);
    setReport(null);
    setOut(null);
    try {
      const result = await runScan({ data: { code, filename: "explain-target" } });
      setReport(result);
      setScannedCode(code);
      if (result.findings.length > 0) {
        setOut(await runExplain({ data: { code, language: lang } }));
      }
    } catch {
      toast.error("The scan or explanation could not complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function switchLanguage(next: "en" | "ar" | "fr") {
    setLang(next);
    if (!report || report.findings.length === 0) return;
    setBusy(true);
    setOut(null);
    try {
      setOut(await runExplain({ data: { code: scannedCode, language: next } }));
    } catch {
      toast.error("Explanation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Explain Findings" subtitle="Deterministic scan first, then a model explanation in your language">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Code to explain</h2>
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
            rows={14}
            className="mt-3 w-full resize-y rounded-md border border-input bg-background/70 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            placeholder="Paste source code, Dockerfile, Kubernetes manifest or Terraform…"
          />
          <button
            onClick={run}
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Sparkle className="size-4" />
            {busy ? "Working…" : "Scan, then explain"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            The scan is deterministic. The model is called only when a finding exists; clean code never reaches it.
          </p>
        </section>

        <section className="space-y-4">
          <SectionBoundary label="explain-results">
          {report ? (
            <div className="panel panel-glow p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="label-mono">Verdict</div>
                  <div className="mt-1 font-display text-2xl font-semibold uppercase text-primary">{report.verdict}</div>
                </div>
                <div className="text-right">
                  <div className="label-mono">Risk score</div>
                  <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-critical">
                    {report.riskScore}/100
                  </div>
                </div>
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                scan {report.scanId} · {report.linesAnalyzed} lines · {report.findings.length} finding(s)
              </p>
            </div>
          ) : null}

          {report && report.findings.length > 0 ? (
            <div className="panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Explanation language">
                  {([["en", "English"], ["ar", "العربية"], ["fr", "Français"]] as const).map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => void switchLanguage(code)}
                      disabled={busy}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-medium disabled:opacity-50",
                        lang === code ? "bg-accent text-accent-foreground" : "hover:bg-surface-raised",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">Meta Muse Spark Open</span>
              </div>
              {busy && !out ? (
                <p className="mt-3 text-sm text-muted-foreground">Reasoning…</p>
              ) : out ? (
                out.nothingToDo ? (
                  <p className="mt-3 text-sm text-muted-foreground">{out.message}</p>
                ) : (
                  <>
                    <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                      Explained by {out.model} · {out.latencyMs} ms
                    </p>
                    <pre
                      dir={lang === "ar" ? "rtl" : "ltr"}
                      className={cn(
                        "mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm text-foreground/90",
                        lang === "ar" && "text-right",
                      )}
                    >
                      {out.explanation}
                    </pre>
                  </>
                )
              ) : null}
            </div>
          ) : report ? (
            <div className="panel p-5 text-sm text-muted-foreground">
              {report.findings.length === 0
                ? "No rule matched, so there is nothing to explain. The model was not called. This means none of the 12 rules fired, not that the code is proven safe."
                : null}
            </div>
          ) : null}

          {report && report.findings.length > 0 ? (
            <div className="space-y-3">
              {report.findings.map((f) => (
                <article key={f.id} className="panel p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <ShieldAlert className="size-4 text-critical" />
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <SeverityBadge severity={f.severity} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {f.cwe} · line {f.line}
                    </span>
                  </div>
                  {f.patch ? (
                    <pre className="mt-3 overflow-x-auto rounded-md border border-accent/30 bg-accent/5 p-3 font-mono text-xs text-accent">
                      {f.patch}
                    </pre>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No patch suggestion: the input language could not be determined, so no language-matched patch is
                      offered.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : null}
          </SectionBoundary>
        </section>
      </div>
    </Shell>
  );
}
