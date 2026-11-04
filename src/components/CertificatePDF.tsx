import { useMemo } from "react";

import { cn } from "@/lib/utils";

export interface CertificateData {
  /** The only user-typed field. */
  companyName: string;
  /** Read-only: always taken from the Verify run, never typed. */
  trustScore: number;
  /** Full SHA-256 digest of the signed artifact from the Verify run. */
  digest: string;
  signature: string;
  signatureAlgorithm: string;
  issuedAt: Date;
  scanId: string;
}

/** The verification id is the first 16 hex characters of the artifact digest. */
export function verificationIdFromDigest(digest: string): string {
  return digest.slice(0, 16);
}

export const HONEST_METHOD =
  "Heuristic obligation checks derived from scan findings; digest and signature are cryptographic. There is no formal proof and no solver. This document is an automated technical audit record, not a legal or regulatory certification.";

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="SentinelOps AI logo" className={className}>
      <path
        d="M32 4 56 13v20c0 14-10 23-24 27C18 56 8 47 8 33V13L32 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M22 32.5 29.5 40 43 25.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RecordMark() {
  return (
    <div className="relative grid size-[104px] shrink-0 place-items-center print:size-[104px]">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full text-cert-gold">
        <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="3 5"
        />
      </svg>
      <div className="text-center leading-tight">
        <div className="font-serif text-[11px] font-semibold uppercase tracking-[0.16em] text-cert-navy">
          Audit
        </div>
        <div className="font-serif text-[13px] font-bold uppercase tracking-[0.12em] text-cert-navy">
          Record
        </div>
        <div className="font-serif text-[11px] font-semibold uppercase tracking-[0.16em] text-cert-navy">
          Signed
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-[0.2em] text-cert-slate">
          Digest · HMAC
        </div>
      </div>
    </div>
  );
}

export function CertificatePDF({ data, className }: { data: CertificateData; className?: string }) {
  const verificationId = verificationIdFromDigest(data.digest);
  const issued = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(data.issuedAt),
    [data.issuedAt],
  );

  return (
    <div
      id="sentinel-certificate"
      className={cn(
        "mx-auto flex w-full max-w-[1123px] flex-col bg-cert-paper p-[3px] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]",
        "sm:min-h-[210mm]",
        className,
      )}
      style={{ backgroundImage: "linear-gradient(135deg,#1e2a4a 0%,#c9a227 50%,#1e2a4a 100%)" }}
    >
      <div className="flex flex-1 flex-col bg-cert-paper px-5 py-6 sm:px-10 sm:py-7">
        <div className="flex flex-1 flex-col border border-cert-line px-5 py-6 sm:px-10 sm:py-7">
          {/* Branding */}
          <header className="flex flex-col items-center text-center">
            <Logo className="size-10 text-cert-navy sm:size-12" />
            <div className="mt-2 font-serif text-xl font-bold tracking-[0.14em] text-cert-navy sm:text-2xl">
              SENTINELOPS AI
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.34em] text-cert-slate sm:text-[10px]">
              Autonomous Sovereign Security Engine
            </div>
            <div className="mt-4 h-px w-24 bg-cert-gold" />
            <h1 className="mt-4 max-w-[46ch] font-serif text-lg font-semibold leading-snug text-cert-navy sm:text-[26px]">
              Certificate of Security &amp; Compliance Verification
            </h1>
          </header>

          {/* Body */}
          <section className="mt-4 text-center sm:mt-5">
            <p className="mx-auto max-w-[86ch] text-[12px] leading-relaxed text-cert-slate sm:text-[13.5px]">
              This automated technical audit record covers the artifact submitted by{" "}
              <span className="font-semibold text-cert-navy">
                {data.companyName || "(client company name — user-provided)"}
              </span>
              . Heuristic obligation checks derived from scan findings; digest and signature are
              cryptographic. There is no formal proof and no solver.
            </p>
            <p className="mt-3 font-serif text-base font-semibold text-cert-navy sm:text-lg">
              Trust Score: <span className="tabular-nums">{Math.round(data.trustScore)}</span>
              <span className="text-cert-slate">/100</span>
            </p>
            <p className="mt-1 text-[9.5px] uppercase tracking-[0.14em] text-cert-slate">
              read-only · taken from the verify run
            </p>
          </section>

          {/* Signed record — every value comes from the Verify run */}
          <section className="mt-5 sm:mt-6">
            <dl className="grid gap-x-8 gap-y-2 break-all font-mono text-[11px] sm:grid-cols-2">
              <div>
                <dt className="inline uppercase tracking-[0.12em] text-cert-slate">
                  Verification ID (digest prefix):{" "}
                </dt>
                <dd className="inline font-semibold text-cert-navy">{verificationId}</dd>
              </div>
              <div>
                <dt className="inline uppercase tracking-[0.12em] text-cert-slate">Scan ID: </dt>
                <dd className="inline font-semibold text-cert-navy">{data.scanId}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="inline uppercase tracking-[0.12em] text-cert-slate">
                  Artifact digest (SHA-256):{" "}
                </dt>
                <dd className="inline font-semibold text-cert-navy">{data.digest}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="inline uppercase tracking-[0.12em] text-cert-slate">
                  {data.signatureAlgorithm} signature:{" "}
                </dt>
                <dd className="inline font-semibold text-cert-navy">{data.signature}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[10.5px] leading-relaxed text-cert-slate">
              Re-check this record with &ldquo;Re-check signature&rdquo; on the Verify page of this
              application.
            </p>
          </section>

          {/* Sign-off */}
          <section className="mt-auto flex flex-col items-center gap-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="order-2 text-center sm:order-1 sm:text-left">
              <div className="mx-auto h-px w-56 bg-cert-navy/70 sm:mx-0" />
              <div className="mt-1.5 font-serif text-[12.5px] font-semibold text-cert-navy">
                SentinelOps AI — Automated Verification Engine
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-cert-slate">
                Heuristic obligation checks · cryptographic digest and signature
              </div>
            </div>

            <div className="order-1 sm:order-2">
              <RecordMark />
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-4 border-t border-cert-line pt-3">
            <dl className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-[9.5px] uppercase tracking-[0.14em] text-cert-slate sm:justify-between">
              <div>
                <dt className="inline">Verification ID: </dt>
                <dd className="inline font-semibold text-cert-navy">{verificationId}</dd>
              </div>
              <div>
                <dt className="inline">Issue Date: </dt>
                <dd className="inline font-semibold text-cert-navy">{issued} UTC</dd>
              </div>
              <div>
                <dt className="inline">Scan ID: </dt>
                <dd className="inline font-semibold text-cert-navy">{data.scanId}</dd>
              </div>
            </dl>
            <p className="mt-2.5 text-center text-[8.5px] leading-snug text-cert-slate">
              {HONEST_METHOD}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
