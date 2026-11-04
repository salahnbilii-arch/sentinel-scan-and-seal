import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runDevOpsHeal, runSecurityScan } from "./agents.server";

const ScanInput = z.object({
  code: z.string().min(1, "Provide code to analyse").max(120_000),
  filename: z.string().max(200).optional(),
});

const HealInput = z.object({
  log: z.string().min(1, "Provide a build log").max(120_000),
});

export const scanCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => runSecurityScan(data.code, data.filename ?? "snippet.txt"));

export const healPipeline = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HealInput.parse(input))
  .handler(async ({ data }) => runDevOpsHeal(data.log));
