import { describe, expect, it } from "vitest";

import { classifyFileType, runSecurityScan } from "../agents.server";

/**
 * Regression guard for file-type scoping: every rule fires ONLY on the file
 * types it applies to. Before this suite existed, SEC-005 ("Container runs as
 * root") fired on every Python file whose `from x import y` lines matched a
 * case-insensitive /FROM\s/ — a cross-type false positive.
 */

const PY_CLEAN_IMPORTS = `from os import system
from subprocess import run
import requests

def build():
    return requests.get("https://example.com")`;

const PY_MD5 = `import hashlib
digest = hashlib.md5(password).hexdigest()`;

const DOCKERFILE_NO_USER = `FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY . .
RUN echo "SELECT * FROM users WHERE id = " + user_id
CMD ["node", "index.js"]`;

const DOCKERFILE_USER_ROOT = `FROM node:22.11.0-bookworm-slim
USER root
CMD ["node", "index.js"]`;

const JS_FILE = `const mode = "USER root";
export function run(x) { return eval(x); }`;

const K8S_PRIVILEGED = `apiVersion: apps/v1
kind: Deployment
spec:
  containers:
    - name: agent
      securityContext:
        privileged: true`;

const PACKAGE_JSON = `{
  "scripts": { "start": "node index.js" },
  "dependencies": { "left-pad": "*" }
}`;

describe("classifyFileType", () => {
  it("names infrastructure files by name, not content", () => {
    expect(classifyFileType("Dockerfile", "")).toBe("container");
    expect(classifyFileType("deploy/Dockerfile.prod", "")).toBe("container");
    expect(classifyFileType("docker-compose.yml", "")).toBe("container");
    expect(classifyFileType("package.json", "{}")).toBe("manifest");
  });

  it("names code files by extension", () => {
    expect(classifyFileType("src/auth.py", "")).toBe("python");
    expect(classifyFileType("src/index.tsx", "")).toBe("javascript");
  });

  it("classifies yaml manifests", () => {
    expect(classifyFileType("deploy.yaml", K8S_PRIVILEGED)).toBe("kubernetes");
    expect(classifyFileType("values.yaml", "replicas: 3\nimage: app\n")).toBe("other");
  });

  it("sniffs extensionless pastes without confusing Python imports with Dockerfiles", () => {
    expect(classifyFileType("audit-target", PY_CLEAN_IMPORTS)).toBe("python");
    expect(classifyFileType("snippet.txt", "FROM node:22\nRUN npm ci\nCMD [\"node\"]")).toBe(
      "container",
    );
  });
});

describe("rule scoping (zero cross-type false positives)", () => {
  it("SEC-005 never fires on a Python file, even with many import lines", async () => {
    const r = await runSecurityScan(PY_CLEAN_IMPORTS, "src/requests/auth.py");
    expect(r.findings).toHaveLength(0);
    expect(r.trace.some((t) => t.includes("type=python"))).toBe(true);
  });

  it("SEC-005 fires on a Dockerfile that never drops privileges", async () => {
    const r = await runSecurityScan(DOCKERFILE_NO_USER, "Dockerfile");
    expect(r.findings.some((f) => f.ruleId === "SEC-005")).toBe(true);
    expect(r.trace.some((t) => t.includes("type=container"))).toBe(true);
  });

  it("container rules never fire on code, and code rules never fire on a Dockerfile", async () => {
    const df = await runSecurityScan(DOCKERFILE_NO_USER, "Dockerfile");
    // The RUN line embeds SQL-concatenation text: SEC-002 must stay scoped out.
    expect(df.findings.some((f) => f.ruleId === "SEC-002")).toBe(false);
    expect(df.findings.map((f) => f.ruleId)).toEqual(["SEC-005"]);

    const js = await runSecurityScan(JS_FILE, "src/index.js");
    expect(js.findings.some((f) => f.ruleId === "SEC-005")).toBe(false);
    expect(js.findings.some((f) => f.ruleId === "SEC-003")).toBe(true); // eval stays caught
  });

  it("kubernetes manifests get SEC-012 but not the Dockerfile-only SEC-005", async () => {
    const r = await runSecurityScan(K8S_PRIVILEGED, "deploy.yaml");
    expect(r.findings.some((f) => f.ruleId === "SEC-012")).toBe(true);
    expect(r.findings.some((f) => f.ruleId === "SEC-005")).toBe(false);
  });

  it("dependency manifests get SEC-009 for floating versions", async () => {
    const r = await runSecurityScan(PACKAGE_JSON, "package.json");
    expect(r.findings.some((f) => f.ruleId === "SEC-009")).toBe(true);
  });

  it("mixed repo: every file scanned in isolation shows zero cross-type findings", async () => {
    const repo = [
      ["src/requests/auth.py", PY_CLEAN_IMPORTS],
      ["src/legacy.py", PY_MD5],
      ["Dockerfile", DOCKERFILE_NO_USER],
      ["Dockerfile.root", DOCKERFILE_USER_ROOT],
      ["src/index.js", JS_FILE],
      ["k8s/agent.yaml", K8S_PRIVILEGED],
      ["package.json", PACKAGE_JSON],
    ] as const;

    const containerOnly = ["SEC-005", "SEC-012", "SEC-009"];
    const codeOnly = ["SEC-002", "SEC-003", "SEC-006", "SEC-007", "SEC-010", "SEC-011"];
    let crossType = 0;

    for (const [name, source] of repo) {
      const r = await runSecurityScan(source, name);
      const type = classifyFileType(name, source);
      const isInfra = type === "container" || type === "kubernetes" || type === "manifest";
      for (const f of r.findings) {
        const wronglyScoped = isInfra ? codeOnly.includes(f.ruleId) : containerOnly.includes(f.ruleId);
        if (wronglyScoped) crossType += 1;
      }
    }
    expect(crossType).toBe(0);

    // Real findings still fire in the mixed repo: root container, md5, eval, floating dep.
    const byFile = Object.fromEntries(
      await Promise.all(
        repo.map(async ([name, source]) => [name, (await runSecurityScan(source, name)).findings] as const),
      ),
    );
    expect(byFile["Dockerfile"]!.some((f) => f.ruleId === "SEC-005")).toBe(true);
    expect(byFile["src/legacy.py"]!.some((f) => f.ruleId === "SEC-007" && f.cwe === "CWE-327")).toBe(
      true,
    );
    expect(byFile["src/index.js"]!.some((f) => f.ruleId === "SEC-003")).toBe(true);
    expect(byFile["package.json"]!.some((f) => f.ruleId === "SEC-009")).toBe(true);
  });
});
