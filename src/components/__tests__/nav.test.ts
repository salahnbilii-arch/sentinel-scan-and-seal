// @vitest-environment node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { NAV } from "../Shell";

const ROUTE_FILES: Record<string, string> = {
  "/": "index.tsx",
  "/sentinel": "sentinel.tsx",
  "/explain": "explain.tsx",
  "/repo": "repo.tsx",
  "/healer": "healer.tsx",
  "/compliance": "compliance.tsx",
  "/verify": "verify.tsx",
  "/certificate": "certificate.tsx",
};

describe("sidebar navigation (one source of truth)", () => {
  it("has 8 entries, each with a real route file", () => {
    expect(NAV).toHaveLength(8);
    const paths = NAV.map((n) => n.to);
    expect(new Set(paths).size).toBe(8);
    for (const item of NAV) {
      const file = ROUTE_FILES[item.to];
      expect(file, `no route mapping for ${item.to}`).toBeTruthy();
      expect(
        existsSync(resolve(import.meta.dirname, "../../routes", file)),
        `route file missing for ${item.to}`,
      ).toBe(true);
    }
  });

  it("includes Explain Findings pointing at /explain", () => {
    const entry = NAV.find((n) => n.to === "/explain");
    expect(entry?.label).toBe("Explain Findings");
  });
});
