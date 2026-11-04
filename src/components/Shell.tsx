import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Award,
  Github,
  Menu,
  MessageSquareText,
  ScanLine,
  ShieldCheck,
  Stamp,
  Wrench,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SectionBoundary } from "@/components/SectionBoundary";

/** One navigation source of truth. Exported so tests assert every page shows the
 *  same 8 entries and every path has a real route file. */
export const NAV = [
  { to: "/", label: "Command Center", icon: Activity, code: "OPS-00" },
  { to: "/sentinel", label: "AI Code Sentinel", icon: ScanLine, code: "SEC-01" },
  { to: "/explain", label: "Explain Findings", icon: MessageSquareText, code: "EXP-07" },
  { to: "/repo", label: "Public Repo Scan", icon: Github, code: "RPO-05" },
  { to: "/healer", label: "DevOps Auto-Healer", icon: Wrench, code: "OPS-02" },
  { to: "/compliance", label: "EU Compliance Hub", icon: ShieldCheck, code: "GRC-03" },
  { to: "/verify", label: "Formal Verification", icon: Stamp, code: "AUD-04" },
  { to: "/certificate", label: "Certificate Studio", icon: Award, code: "CRT-06" },
] as const;

export function Shell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "group flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "text-muted-foreground hover:border-border hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="flex-1 font-medium">{item.label}</span>
            <span className="font-mono text-[10px] tracking-widest opacity-60">{item.code}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="hidden border-r border-border bg-surface/60 p-5 backdrop-blur lg:flex lg:flex-col">
        <Brand />
        <div className="mt-8 label-mono">Modules</div>
        <div className="mt-3">{nav}</div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <button
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-border p-2 text-muted-foreground lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold lg:text-xl">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </header>

        {open ? (
          <div className="border-b border-border bg-surface/80 p-4 backdrop-blur lg:hidden">
            <Brand />
            <div className="mt-4">{nav}</div>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <SectionBoundary label="page-content">{children}</SectionBoundary>
        </main>

        <footer className="border-t border-border px-4 py-5 text-xs text-muted-foreground lg:px-8">
          SentinelOps AI · Autonomous Security &amp; DevOps Agents · Built for EU enterprise
          compliance (GDPR · CRA · NIS2)
          <span className="mt-1 block font-mono text-[10px] tracking-wider opacity-70">
            build {__BUILD_ID__}
          </span>
        </footer>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
        <ShieldCheck className="size-5" />
      </span>
      <span>
        <span className="block font-display text-base font-semibold leading-tight">
          SentinelOps <span className="text-primary">AI</span>
        </span>
        <span className="block font-mono text-[10px] tracking-widest text-muted-foreground">
          AUTONOMOUS SECOPS v4.2
        </span>
      </span>
    </Link>
  );
}
