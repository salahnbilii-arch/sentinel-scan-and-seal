import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";

import { Shell } from "@/components/Shell";
import { SectionBoundary } from "@/components/SectionBoundary";
import { StatCard } from "@/components/ops";
import { fetchBenchmark } from "@/lib/benchmark.functions";
import { fetchApiCounters, type ApiCounters } from "@/lib/metrics.functions";
import type { BenchmarkResult } from "@/lib/benchmark.server";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SentinelOps AI — Security Scanner & CI Failure Helper" },
      {
        name: "description",
        content:
          "Deterministic rule engine finds security problems; Meta Muse Spark Open explains them. Signed audit artifacts make results checkable.",
      },
      { property: "og:title", content: "SentinelOps AI — Security Scanner & CI Failure Helper" },
      {
        property: "og:description",
        content:
          "12 scan rules, 7 healer signatures, HMAC-signed verification and a live benchmark.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    let benchmark: BenchmarkResult | null = null;
    let counters: ApiCounters | null = null;
    try {
      benchmark = (await fetchBenchmark()) as Awaited<ReturnType<typeof fetchBenchmark>>;
    } catch (error) {
      console.error("benchmark load failed:", error);
    }
    try {
      counters = (await fetchApiCounters()) as Awaited<ReturnType<typeof fetchApiCounters>>;
    } catch (error) {
      console.error("counters load failed:", error);
    }
    return { benchmark, counters };
  },
  component: Overview,
});

function Overview() {
  const { benchmark, counters } = Route.useLoaderData();
  if (!benchmark) {
    return (
      <Shell
        title="Overview"
        subtitle="Benchmark computed by running the scanner over the bundled samples"
      >
        <div className="panel p-5 text-sm text-muted-foreground">
          The live benchmark could not be loaded. Reload the page to try again.
        </div>
        <CountersSection counters={counters} />
      </Shell>
    );
  }
  const b = benchmark;
  return (
    <Shell
      title="Overview"
      subtitle="Benchmark computed just now by running the scanner over the bundled samples"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Detection"
          value={`${b.caught}/${b.vulnerableSamples}`}
          hint={`${(b.detectionRate * 100).toFixed(1)}% of vulnerable samples`}
        />
        <StatCard
          label="False positives"
          value={`${b.falsePositives}/${b.cleanSamples}`}
          hint="on clean samples"
          accent="accent"
        />
        <StatCard label="Scan rules" value="12" hint="deterministic, same input → same result" />
        <StatCard
          label="Healer signatures"
          value="7"
          hint="plus a labelled generic fallback"
          accent="accent"
        />
      </div>

      <SectionBoundary label="counters">
        <CountersSection counters={counters} />
      </SectionBoundary>

      <SectionBoundary label="benchmark">
        <section className="panel mt-4 p-5">
          <h2 className="text-base font-semibold">Per-rule benchmark</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Small, author-written sample set: it checks the rules work as designed, not real-world
            recall.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left label-mono">
                  <th className="pb-2">Rule</th>
                  <th className="pb-2">CWE</th>
                  <th className="pb-2">Title</th>
                  <th className="pb-2">Sample</th>
                  <th className="pb-2 text-right">Result</th>
                </tr>
              </thead>
              <tbody>
                {b.perRule.map((r) => (
                  <tr key={r.ruleId} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 font-mono text-xs">{r.ruleId}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{r.cwe}</td>
                    <td className="py-2.5 text-muted-foreground">{r.title}</td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{r.sample}</td>
                    <td className="py-2.5 text-right">
                      {r.caught ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-accent">
                          <CheckCircle2 className="size-3.5" /> caught
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-critical">
                          <XCircle className="size-3.5" /> missed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.falsePositiveFiles.length ? (
            <ul className="mt-3 font-mono text-xs text-critical">
              {b.falsePositiveFiles.map((f) => (
                <li key={f.sample}>
                  {f.sample}: {f.ruleIds.join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            computed {new Date(b.computedAt).toUTCString()}
          </p>
        </section>
      </SectionBoundary>

      <SectionBoundary label="baseline-comparison">
        <section className="panel mt-4 p-5">
          <h2 className="text-base font-semibold">Scanner vs naive grep baseline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The same {b.perSample.length} bundled samples run through a plain substring grep (
            {b.baseline.patterns.length} patterns, e.g. {b.baseline.patterns.slice(0, 5).join(", ")}
            ). Both columns are measured live; nothing is typed in.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="label-mono">Detection · scanner</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums text-primary">
                {b.caught}/{b.vulnerableSamples}
              </div>
              <div className="text-xs text-muted-foreground">deterministic rules</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="label-mono">Detection · naive grep</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums">
                {b.baseline.caught}/{b.baseline.vulnerableSamples}
              </div>
              <div className="text-xs text-muted-foreground">
                {(b.baseline.detectionRate * 100).toFixed(0)}% of vulnerable samples
              </div>
            </div>
            <div className="rounded-md border border-accent/40 bg-accent/5 p-3">
              <div className="label-mono">False positives · scanner</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums text-accent">
                {b.falsePositives}/{b.cleanSamples}
              </div>
              <div className="text-xs text-muted-foreground">on clean samples</div>
            </div>
            <div className="rounded-md border border-critical/40 bg-critical/5 p-3">
              <div className="label-mono">False positives · naive grep</div>
              <div className="mt-1 font-display text-xl font-semibold tabular-nums text-critical">
                {b.baseline.falsePositives}/{b.baseline.cleanSamples}
              </div>
              <div className="text-xs text-muted-foreground">
                {(b.baseline.falsePositiveRate * 100).toFixed(0)}% of clean samples flagged
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-border text-left label-mono">
                  <th className="pb-2">Sample</th>
                  <th className="pb-2">Kind</th>
                  <th className="pb-2 text-right">Scanner</th>
                  <th className="pb-2 text-right">Naive grep</th>
                </tr>
              </thead>
              <tbody>
                {b.perSample.map((s) => (
                  <tr key={s.sample} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 font-mono text-xs">{s.sample}</td>
                    <td className="py-2.5 text-muted-foreground">{s.kind}</td>
                    <td className="py-2.5 text-right font-mono text-xs">
                      {s.scannerFlagged ? (
                        <span className="text-accent">flagged</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs">
                      {s.naiveFlagged ? (
                        <span className="text-critical">flagged ({s.naiveMatches.length})</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </SectionBoundary>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/sentinel"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Scan code
        </Link>
        <Link to="/healer" className="rounded-md border border-border px-4 py-2 text-sm">
          Heal a CI log
        </Link>
        <Link to="/verify" className="rounded-md border border-border px-4 py-2 text-sm">
          Verify and sign
        </Link>
      </div>
    </Shell>
  );
}

function CountersSection({ counters }: { counters: ApiCounters | null }) {
  if (!counters) {
    return (
      <section className="panel mt-4 p-5 text-sm text-muted-foreground">
        Public API usage could not be loaded. Reload the page to try again.
      </section>
    );
  }
  return (
    <section className="panel mt-4 p-5">
      <h2 className="text-base font-semibold">Public API usage</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Work actually served by the public API{" "}
        {counters.activeSince
          ? `since ${new Date(counters.activeSince).toUTCString()}`
          : "— no request has been counted yet"}
        . {counters.note}. Live totals:{" "}
        <a
          href="/api/public/v1/counters"
          className="underline underline-offset-4 hover:text-foreground"
        >
          /api/public/v1/counters
        </a>
        .
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Scans"
          value={String(counters.scans)}
          hint="POST /api/public/v1/scan-code"
        />
        <StatCard
          label="Heals"
          value={String(counters.heals)}
          hint="POST /api/public/v1/devops-heal"
          accent="accent"
        />
        <StatCard
          label="Analyses"
          value={String(counters.analyses)}
          hint="explain + deep-analysis"
        />
        <StatCard
          label="Verifications"
          value={String(counters.verifications)}
          hint="POST /api/public/v1/verify"
          accent="accent"
        />
      </div>
    </section>
  );
}
