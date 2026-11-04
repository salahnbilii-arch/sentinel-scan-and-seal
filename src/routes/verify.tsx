import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, PackageOpen, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { CodeTextarea } from "@/components/CodeTextarea";
import { SectionBoundary } from "@/components/SectionBoundary";
import { recheckSignature, verifyWithReport } from "@/lib/verify.functions";
import { fetchBenchmark } from "@/lib/benchmark.functions";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { deliverFile } from "@/lib/download";
import { storeArtifact } from "@/lib/certificate-artifact";
import type { SignedArtifact } from "@/lib/verify.server";
import type { ScanReport } from "@/lib/agents.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify & Sign Artifacts | SentinelOps AI" },
      {
        name: "description",
        content:
          "Scan an artifact, run 5 heuristic obligation checks and receive a SHA-256 digest with an HMAC-SHA256 signature.",
      },
      { property: "og:title", content: "Verify & Sign Artifacts" },
      {
        property: "og:description",
        content: "Heuristic obligation checks with a cryptographic digest and signature.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPage,
});

const VULNERABLE = `API_KEY = "sk_live_9f8e7d6c5b4a3210"\nquery = "SELECT * FROM users WHERE id = " + user_id\nresp = requests.get(url, verify=False)\nDEBUG = True`;
const CLEAN = `import os\nAPI_KEY = os.environ["API_KEY"]\nrows = db.execute("SELECT * FROM users WHERE id = %(id)s", {"id": user_id})`;

function VerifyPage() {
  const run = useServerFn(verifyWithReport);
  const recheck = useServerFn(recheckSignature);
  const navigate = useNavigate();
  const [source, setSource] = useState(VULNERABLE);
  const [name, setName] = useState("artifact.txt");
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState<SignedArtifact | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [check, setCheck] = useState<{ digestMatches: boolean; signatureValid: boolean } | null>(
    null,
  );
  const [pack, setPack] = useState<Blob | null>(null);
  const [packBusy, setPackBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setArt(null);
    setReport(null);
    setCheck(null);
    try {
      const result = await run({ data: { source, artifactName: name || "artifact.txt" } });
      setArt(result.artifact);
      setReport(result.scanReport);
      // The certificate page is generated only from this stored Verify result.
      storeArtifact(result.artifact);
    } catch (error) {
      toast.error("Verification failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function doCheck() {
    if (!art) return;
    try {
      setCheck(await recheck({ data: { artifact: art as unknown as Record<string, unknown> } }));
    } catch (error) {
      toast.error("Signature check failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  /** Builds the zip first; the download itself then runs synchronously from its own
   *  click, so user activation is preserved (iOS drops it after an await). The
   *  scan report comes from the same verify run (matching scanId), never a
   *  second scan. */
  async function buildPack() {
    if (!art || !report) return;
    setPackBusy(true);
    setPack(null);
    try {
      const benchmark = await fetchBenchmark();
      setPack(await buildEvidencePack({ report, artifact: art, benchmark }));
    } catch (error) {
      toast.error("The evidence pack could not be built. Try again.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPackBusy(false);
    }
  }

  function toCertificate() {
    if (!art) return;
    storeArtifact(art);
    void navigate({ to: "/certificate" });
  }

  function download() {
    if (!art) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(art, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${art.artifactId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell
      title="Verify and sign"
      subtitle="Heuristic obligation checks derived from scan findings · digest and signature are cryptographic"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSource(VULNERABLE)}
              className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground hover:text-primary"
            >
              Vulnerable sample
            </button>
            <button
              onClick={() => setSource(CLEAN)}
              className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground hover:text-primary"
            >
              Clean sample
            </button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Artifact name"
              className="ml-auto rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs"
            />
          </div>
          <CodeTextarea
            value={source}
            onValueChange={setSource}
            spellCheck={false}
            rows={16}
            className="mt-3 w-full resize-y rounded-md border border-input bg-background/70 p-3 font-mono text-xs outline-none focus:border-ring"
          />
          <button
            onClick={verify}
            disabled={busy || !source.trim()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Play className="size-4" /> {busy ? "Verifying…" : "Verify and sign"}
          </button>
        </section>

        <section className="space-y-4">
          <SectionBoundary label="verify-artifact">
            {art ? (
              <div className="panel panel-glow p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="label-mono">Verdict</div>
                    <div className="mt-1 font-display text-2xl font-semibold uppercase text-primary">
                      {art.verdict}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="label-mono">Trust score</div>
                    <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-primary">
                      {art.trustScore}/100
                    </div>
                  </div>
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {art.trustFormula} · {art.violatedCount} violated · {art.findings.length}{" "}
                  finding(s) covered by the digest
                </p>
                <table className="mt-4 w-full text-sm">
                  <tbody>
                    {art.obligations.map((o) => (
                      <tr key={o.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 font-mono text-xs">{o.id}</td>
                        <td className="py-2 text-muted-foreground">{o.statement}</td>
                        <td className="py-2 text-right">
                          <span
                            className={cn(
                              "rounded border px-2 py-0.5 font-mono text-[10px] uppercase",
                              o.status === "satisfied"
                                ? "border-accent/40 text-accent"
                                : "border-critical/40 text-critical",
                            )}
                          >
                            {o.status}
                          </span>
                          {o.violatedBy.length ? (
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              {o.violatedBy.join(", ")}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="mt-4 space-y-1 break-all font-mono text-[11px] text-muted-foreground">
                  <div>
                    artifact id: <span className="text-foreground/80">{art.artifactId}</span>
                  </div>
                  <div>
                    source sha-256: <span className="text-foreground/80">{art.sourceSha256}</span>
                  </div>
                  <div>
                    digest: <span className="text-foreground/80">{art.digest}</span>
                  </div>
                  <div>
                    {art.signatureAlgorithm}:{" "}
                    <span className="text-foreground/80">{art.signature}</span>
                  </div>
                  <div>
                    issued: {new Date(art.issuedAt).toUTCString()} · scan {art.scanId}
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={download}
                    className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    <Download className="size-3.5" /> Download JSON
                  </button>
                  <button
                    onClick={doCheck}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    <ShieldCheck className="size-3.5" /> Re-check signature
                  </button>
                  <button
                    onClick={toCertificate}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    <FileText className="size-3.5" /> Create certificate
                  </button>
                  {check ? (
                    <span
                      className={cn(
                        "font-mono text-[11px]",
                        check.digestMatches && check.signatureValid
                          ? "text-accent"
                          : "text-critical",
                      )}
                    >
                      digest {check.digestMatches ? "matches" : "MISMATCH"} · signature{" "}
                      {check.signatureValid ? "valid" : "INVALID"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {pack ? (
                    <button
                      onClick={() =>
                        void deliverFile(pack, `sentinelops-evidence-${art.artifactId}.zip`)
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <PackageOpen className="size-3.5" /> Download evidence pack (.zip)
                    </button>
                  ) : (
                    <button
                      onClick={buildPack}
                      disabled={packBusy}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      <PackageOpen className="size-3.5" />{" "}
                      {packBusy ? "Building pack…" : "Build evidence pack"}
                    </button>
                  )}
                  {pack ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      scan-report.json · signed-verification.json · benchmark.json · manifest.json —
                      one run, scanId {art.scanId} · artifactId {art.artifactId} in every file
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {art.method}. There is no formal proof and no solver.
                </p>
              </div>
            ) : (
              <div className="panel p-5 text-sm text-muted-foreground">
                Run a verification to see obligations, digest and signature.
              </div>
            )}
          </SectionBoundary>
        </section>
      </div>
    </Shell>
  );
}
