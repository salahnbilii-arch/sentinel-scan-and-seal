import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCheck2, Globe2, Lock, Scale, ShieldCheck } from "lucide-react";

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

/** Framework mapping. Every entry states what the product actually does — the
 *  claims are limited to mechanisms that exist in this application. */
const FRAMEWORKS = [
  {
    name: "GDPR",
    official: "Regulation (EU) 2016/679",
    items: [
      "Art. 5(1)(c) data minimisation — source code is analysed in memory and discarded; nothing user-submitted is stored.",
      "Art. 5(1)(b) purpose limitation — the service processes code for security analysis only; no profiling and no marketing use.",
      "Art. 25 data protection by design — the machine interface returns findings and counters, never raw submitted content.",
      "Art. 32 security of processing — audit artifacts are hashed (SHA-256) and signed (HMAC-SHA256) so records can be checked for tampering.",
    ],
  },
  {
    name: "EU Cyber Resilience Act",
    official: "Regulation (EU) 2024/2847",
    items: [
      "Secure-by-default guidance — every finding ships with a concrete remediation patch in the language of the scanned code.",
      "Vulnerability handling — the 12-rule scanner detects hardcoded credentials, injection sinks, weak transport and weak hashing.",
      "Transparent documentation — each finding carries a rule ID and CWE reference so reports map to a public weakness taxonomy.",
      "Support for SBOM workflows — the public /api/public/v1/rules endpoint exposes the exact rule and CWE catalog in machine-readable form.",
    ],
  },
  {
    name: "NIS2",
    official: "Directive (EU) 2022/2555",
    items: [
      "Art. 21 risk-management measures — deterministic scanning, automated CI-log healing and signed verification form a measurable control set.",
      "Incident and audit evidence — verification artifacts are signed and re-checkable, so an auditor can verify a record was not altered.",
      "Supply-chain security — public repository scans give an aggregate gate verdict (blocked / review / clean) over dependencies' source.",
      "Business continuity — the stateless edge deployment recovers automatically; no operator action is needed after an instance restart.",
    ],
  },
];

const EVIDENCE_LINKS = [
  {
    to: "/verify",
    label: "Formal Verification",
    detail: "Run a signed, re-checkable audit artifact.",
  },
  {
    to: "/certificate",
    label: "Certificate Studio",
    detail: "Render an audit certificate from a real verify run.",
  },
  {
    to: "/repo",
    label: "Public Repo Scan",
    detail: "Aggregate gate verdict over a GitHub repository.",
  },
] as const;

function CompliancePage() {
  return (
    <Shell
      title="EU Compliance Hub"
      subtitle="Continuous regulatory evidence for enterprise procurement and audit"
    >
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        This hub maps what SentinelOps AI actually does to the EU frameworks procurement teams ask
        about. Every claim below is limited to a mechanism that exists in this application — the
        dashboard modules, the signed artifacts and the public API are the proof.
      </p>

      <h2 className="mt-6 text-base font-semibold">Technical &amp; organisational measures</h2>
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

      <SectionBoundary label="framework-mapping">
        <section className="panel mt-8 p-6">
          <h2 className="text-base font-semibold">Compliance framework mapping</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Article-level mapping for GDPR, the Cyber Resilience Act and NIS2, with the mechanism
            behind each line.
          </p>
          <div className="mt-4 space-y-6">
            {FRAMEWORKS.map((f) => (
              <div key={f.name}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-display text-lg font-semibold">{f.name}</h3>
                  <span className="font-mono text-[11px] text-muted-foreground">{f.official}</span>
                </div>
                <ul className="mt-2 space-y-2">
                  {f.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 rounded-md border border-border bg-surface-raised/40 p-3 text-sm"
                    >
                      <Scale className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This mapping describes implemented product mechanisms. It is not a certification and
            does not replace an audit by an accredited body.
          </p>
        </section>
      </SectionBoundary>

      <section className="panel mt-8 p-6">
        <h2 className="text-base font-semibold">Evidence you can check yourself</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {EVIDENCE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md border border-border bg-background/60 p-4 transition-colors hover:border-primary/40"
            >
              <div className="text-sm font-semibold">{l.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{l.detail}</div>
            </Link>
          ))}
        </div>
      </section>

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
            [
              "POST",
              "/api/public/v1/explain",
              "{ code } → Muse Spark Open explanation; clean input → { nothingToDo: true }",
            ],
            [
              "POST",
              "/api/public/v1/deep-analysis",
              "{ content } → deep audit report; clean input → { nothingToDo: true }",
            ],
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
