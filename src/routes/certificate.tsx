import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Shell } from "@/components/Shell";
import { SectionBoundary } from "@/components/SectionBoundary";
import { CertificatePDF, type CertificateData } from "@/components/CertificatePDF";
import { loadStoredArtifact, type StoredArtifact } from "@/lib/certificate-artifact";

export const Route = createFileRoute("/certificate")({
  head: () => ({
    meta: [
      { title: "Compliance Certificate Generator | SentinelOps AI" },
      {
        name: "description",
        content:
          "Generate a corporate audit-record certificate from a completed Verify run: trust score, digest-prefix verification ID, full SHA-256 digest and HMAC signature. No verification, no certificate.",
      },
      { property: "og:title", content: "Compliance Certificate Generator" },
      {
        property: "og:description",
        content:
          "Export a high-resolution audit-record certificate built only from a real Verify result — nothing invented.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
  // Read storage after hydration: reading it during render would hydration-mismatch.
  const [ready, setReady] = useState(false);
  const [art, setArt] = useState<StoredArtifact | null>(null);
  // Company name is the ONLY typed field; the trust score comes read-only from the Verify run.
  const [company, setCompany] = useState("");

  useEffect(() => {
    setArt(loadStoredArtifact());
    setReady(true);
  }, []);

  let content: ReactNode;
  if (!ready) {
    content = <div className="panel p-5 text-sm text-muted-foreground">Checking for a verification…</div>;
  } else if (!art) {
    // No Verify run → ONLY this gate. No form, no PDF button.
    content = (
      <section className="panel p-5 text-sm text-muted-foreground">
        Run a verification first — the certificate is generated only from a real Verify result.{" "}
        <Link
          to="/verify"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Open the Verify page
        </Link>
      </section>
    );
  } else {
    const data: CertificateData = {
      companyName: company.trim(),
      trustScore: art.trustScore,
      digest: art.digest,
      signature: art.signature,
      signatureAlgorithm: art.signatureAlgorithm,
      issuedAt: new Date(art.issuedAt),
      scanId: art.scanId,
    };
    content = (
      <>
        <section className="panel p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block min-w-[260px] flex-1">
              <span className="label-mono">Client company name (user-provided)</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Northbridge Capital OÜ"
                className="mt-1.5 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </label>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Download className="size-4" /> Download PDF
            </button>
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Trust score, verification ID, digest and signature are read-only from the Verify run.
            Export renders vector-sharp at A4 landscape — choose &ldquo;Save as PDF&rdquo; in the
            print dialog.
          </p>
        </section>

        <div className="mt-6 overflow-x-auto">
          <CertificatePDF data={data} />
        </div>
      </>
    );
  }

  return (
    <Shell
      title="Compliance Certificate"
      subtitle="Audit-record certificate generated from a real Verify run · nothing invented"
    >
      <SectionBoundary label="certificate">
        {content}
      </SectionBoundary>
    </Shell>
  );
}
