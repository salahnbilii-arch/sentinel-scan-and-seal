import type { ScanReport } from "./agents.server";

/**
 * Builds the patched source by substituting each finding's ACTUAL patch text at its line.
 * Nothing is invented here: the replacement text is exactly what the findings cards offer.
 * When several findings hit the same line, the first patch wins (deterministic report order).
 */
export function buildPatchedSource(
  source: string,
  report: Pick<ScanReport, "findings">,
): { code: string; applied: number } {
  const byLine = new Map<number, string>();
  for (const f of report.findings) {
    if (f.patch && !byLine.has(f.line)) byLine.set(f.line, f.patch);
  }
  const out: string[] = [];
  let applied = 0;
  source.split("\n").forEach((line, i) => {
    const patch = byLine.get(i + 1);
    if (patch === undefined) out.push(line);
    else {
      out.push(patch);
      applied += 1;
    }
  });
  return { code: out.join("\n"), applied };
}
