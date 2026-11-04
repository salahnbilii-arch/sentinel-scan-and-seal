import { auth, defineMcp } from "@lovable.dev/mcp-js";

import devopsHealTool from "./tools/devops-heal";
import formalVerifyTool from "./tools/formal-verify";
import scanCodeTool from "./tools/scan-code";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "sentinelops-ai-platform",
  title: "SentinelOps AI Platform",
  version: "0.2.0",
  instructions:
    "Autonomous security and DevOps agents for SentinelOps AI. Use `scan_code` to audit source for vulnerabilities, `devops_heal` to diagnose CI/CD failures, and `formal_verify` to produce a signed heuristic verification artifact.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [scanCodeTool, devopsHealTool, formalVerifyTool] as never,
});
