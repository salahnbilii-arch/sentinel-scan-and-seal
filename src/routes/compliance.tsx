import { createFileRoute } from "@tanstack/react-router";
import { FileCheck2, Globe2, Lock, ShieldCheck } from "lucide-react";

import { DeepAnalysisPanel } from "@/components/DeepAnalysisPanel";
import { SectionBoundary } from "@/components/SectionBoundary";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "EU Compliance Hub — GDPR, CRA & NIS2 Posture | SentinelOps AI" },
      {
        name: "description",
        content:
          "Continuous evidence of adherence to GDPR, the EU Cyber Resilience Act, NIS2 and ISO/IEC 27001 for every scan and automated remediation.",
      },
      { property: "og:title", content: "EU Compliance Hub — GDPR, CRA & NIS2 Posture" },
      {
        property: "og:description",
        content: "Continuous compliance evidence for EU enterprise security frameworks.",
      },
    ],
  }),
  component: CompliancePage,
});

const CONTROLS = [
  {
    icon: Lock,
    title: "Data minimisation by design",
    body: "Submitted snippets are analysed in memory and never persisted. Only aggregate counters leave the request boundary.",
  },
  {
    icon: Globe2,
    title: "EU data residency",
    body: "All processing executes in EU-hosted edge regions with no transfer of personal data to third countries.",
  },
  {
    icon: FileCheck2,
    title: "Immutable audit trail",
    body: "Every agent decision carries a scan ID, rule ID, CWE reference and evidence line, and verification results carry an HMAC signature.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop remediation",
    body: "Patches are always proposed, never silently merged, satisfying EU AI Act transparency expectations for automated decisions.",
  },
];

function CompliancePage() {
  return (
    <Shell
      title="EU Compliance Hub"
      subtitle="Continuous regulatory evidence for enterprise procurement and audit"
    >
      <h2 className="mt-2 text-base font-semibold">Technical &amp; organisational measures</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {CONTROLS.map((c) => (
          <article key={c.title} className="panel flex gap-4 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <c.icon className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
            </div>
          </article>
        ))}
      </div>

      <SectionBoundary label="deep-analysis">
        <DeepAnalysisPanel />
      </SectionBoundary>

      <section className="panel mt-8 p-6">
        <h2 className="text-base font-semibold">Public API surface</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The same agents power the dashboard and the machine interface, so audit evidence is
          identical whether produced by a human or a pipeline.
        </p>
        <div className="mt-4 space-y-2 font-mono text-xs">
          {[
            ["POST", "/api/public/v1/scan-code", "{ code, filename? } → severity report + patches"],
            ["POST", "/api/public/v1/devops-heal", "{ log } → root cause + configuration patch"],
            ["POST", "/api/public/v1/explain", "{ code } → Muse Spark Open explanation; clean input → { nothingToDo: true }"],
            ["POST", "/api/public/v1/deep-analysis", "{ content } → deep audit report; clean input → { nothingToDo: true }"],
            ["POST", "/api/public/v1/verify", "{ source, artifactName? } → signed artifact"],
            ["POST", "/api/public/v1/check-signature", "{ artifact } → digest + signature check"],
            ["GET", "/api/public/v1/benchmark", "→ detection and false-positive numbers"],
            ["GET", "/api/public/v1/rules", "→ the 12-rule catalog with the CWE mapping"],
          ].map(([method, path, desc]) => (
            <div
              key={path}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2"
            >
              <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">{method}</span>
              <span className="text-foreground">{path}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
