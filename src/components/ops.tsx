import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  accent = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "accent" | "critical";
}) {
  return (
    <div className="panel p-4">
      <div className="label-mono">{label}</div>
      <div
        className={cn(
          "mt-2 font-display text-2xl font-semibold tabular-nums lg:text-3xl",
          accent === "primary" && "text-primary",
          accent === "accent" && "text-accent",
          accent === "critical" && "text-critical",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "border-critical/50 bg-critical/15 text-critical",
    high: "border-high/50 bg-high/15 text-high",
    medium: "border-medium/50 bg-medium/15 text-medium",
    low: "border-low/50 bg-low/15 text-low",
  };
  return (
    <span
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        map[severity] ?? map["low"],
      )}
    >
      {severity}
    </span>
  );
}

export function Terminal({ lines, done }: { lines: string[]; done: boolean }) {
  return (
    <div className="panel scanline max-h-72 overflow-auto bg-background/70 p-4 font-mono text-xs leading-relaxed">
      {lines.length === 0 ? (
        <p className="text-muted-foreground">$ awaiting input…</p>
      ) : (
        lines.map((line, i) => (
          <p key={i} className="text-accent/90">
            <span className="text-muted-foreground">$</span> {line}
          </p>
        ))
      )}
      {!done && lines.length > 0 ? (
        <p className="text-primary">
          <span className="animate-pulse">▋</span>
        </p>
      ) : null}
    </div>
  );
}
