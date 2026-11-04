import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Terminal as TerminalIcon, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { CodeTextarea } from "@/components/CodeTextarea";
import { SectionBoundary } from "@/components/SectionBoundary";
import { Terminal } from "@/components/ops";
import { healPipeline } from "@/lib/agents.functions";
import type { HealResult } from "@/lib/agents.server";

export const Route = createFileRoute("/healer")({
  head: () => ({
    meta: [
      { title: "DevOps Auto-Healer — Self-Healing CI/CD | SentinelOps AI" },
      {
        name: "description",
        content:
          "Paste a failing build log and the Healer agent returns the corrected Dockerfile, Kubernetes manifest or dependency lockfile instantly.",
      },
      { property: "og:title", content: "DevOps Auto-Healer — Self-Healing CI/CD" },
      {
        property: "og:description",
        content: "Root-cause analysis and instant configuration patches for failing pipelines.",
      },
    ],
  }),
  component: HealerPage,
});

const SAMPLES: { label: string; log: string }[] = [
  {
    label: "Kubernetes crash loop",
    log: `Events:
  Warning  BackOff  kubelet  Back-off restarting failed container api in pod api-7d9f
  Warning  Unhealthy  kubelet  Readiness probe failed: Get "http://10.42.1.9:8080/health": dial tcp: connect: connection refused
  State: Terminated  Reason: OOMKilled  Exit Code: 137
  pod/api-7d9f  CrashLoopBackOff  8 restarts`,
  },
  {
    label: "npm peer conflict",
    log: `npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: @acme/ui@3.4.1
npm ERR! Found: react@18.2.0
npm ERR! Conflicting peer dependency: react@19.2.0
npm ERR! Fix the upstream dependency conflict, or retry with --force`,
  },
  {
    label: "Dockerfile failure",
    log: `#5 [internal] load build definition from Dockerfile
Dockerfile:12
--------------------
  12 | >>> RUNN npm ci --omit=dev
--------------------
ERROR: failed to solve: dockerfile parse error on line 12: unknown instruction: RUNN`,
  },
  {
    label: "Python import error",
    log: `Traceback (most recent call last):
  File "/app/main.py", line 4, in <module>
    from pydantic import BaseSettings
ModuleNotFoundError: No module named 'pydantic.BaseSettings'
ERROR: pip's dependency resolver: ResolutionImpossible`,
  },
];

function HealerPage() {
  const heal = useServerFn(healPipeline);
  const [log, setLog] = useState(SAMPLES[0]!.log);
  const [result, setResult] = useState<HealResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  async function run() {
    if (!log.trim()) {
      toast.error("Paste a failing build log first.");
      return;
    }
    setBusy(true);
    setResult(null);
    setLines([]);
    try {
      const res = await heal({ data: { log } });
      setLines(res.trace);
      setResult(res);
      setBusy(false);
    } catch {
      setBusy(false);
      toast.error("The Healer agent could not analyse this log. Try again.");
    }
  }

  return (
    <Shell
      title="DevOps Auto-Healer"
      subtitle="Root-cause triage and patch synthesis for failing pipelines"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Failing build log</h2>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setLog(s.log)}
                  className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/50 hover:text-primary"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <CodeTextarea
            value={log}
            onValueChange={setLog}
            spellCheck={false}
            rows={16}
            className="mt-3 w-full resize-y rounded-md border border-input bg-background/70 p-3 font-mono text-xs leading-relaxed outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            placeholder="Paste the failing CI/CD output…"
          />
          <button
            onClick={run}
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Wand2 className="size-4" />
            {busy ? "Healing…" : "Trigger Autonomous Heal"}
          </button>
        </section>

        <section className="space-y-4">
          <SectionBoundary label="healer-result">
            <Terminal lines={lines} done={!busy} />
            {result ? (
              <div className="panel panel-glow p-5">
                <div className="label-mono">Root cause</div>
                <h3 className="mt-1 font-display text-lg font-semibold text-primary">
                  {result.detected}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{result.rootCause}</p>
                <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="rounded border border-border px-2 py-0.5">
                    {result.category}
                  </span>
                  <span className="rounded border border-border px-2 py-0.5">
                    signature score {result.signatureScore} (fixed constant)
                  </span>
                  <span className="rounded border border-border px-2 py-0.5">
                    {result.incidentId}
                  </span>
                  {!result.matchedSignature ? (
                    <span className="rounded border border-medium/50 px-2 py-0.5 text-medium">
                      generic fallback
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </SectionBoundary>
        </section>
      </div>

      {result ? (
        <div className="mt-4 space-y-4 xl:grid xl:grid-cols-3 xl:gap-4">
          <section className="panel p-5 xl:col-span-2">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-accent" />
              <h2 className="text-base font-semibold">
                Generated patch · <span className="font-mono text-sm">{result.targetFile}</span>
              </h2>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md border border-accent/30 bg-background/70 p-4 font-mono text-xs leading-relaxed text-accent">
              {result.patch}
            </pre>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(result.patch);
                toast.success("Patch copied. Nothing is applied automatically.");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Copy className="size-4" /> Copy patch
            </button>
          </section>

          <section className="space-y-4">
            <div className="panel p-5">
              <div className="label-mono">Recovery commands</div>
              <ul className="mt-2 space-y-1.5 font-mono text-xs text-foreground/85">
                {result.commands.map((c) => (
                  <li key={c} className="rounded border border-border bg-background/60 px-2 py-1.5">
                    <span className="text-muted-foreground">$ </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <div className="label-mono">Prevention policy</div>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {result.preventions.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
