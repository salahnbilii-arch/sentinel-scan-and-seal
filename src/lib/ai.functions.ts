import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DeepAnalysisInput = z.object({
  content: z.string().min(12, "Provide the artefact to analyse").max(120_000),
});

const ExplainInput = z.object({
  code: z.string().min(1).max(120_000),
  language: z.enum(["en", "ar", "fr"]).default("en"),
});

export const deepAnalyze = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeepAnalysisInput.parse(input))
  .handler(async ({ data }) => {
    const { runDeepAnalysis } = await import("./meta.server");
    return runDeepAnalysis(data.content);
  });

export const explainScan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExplainInput.parse(input))
  .handler(async ({ data }) => {
    const { explainFindings } = await import("./meta.server");
    // Re-scan server-side so the model only ever sees genuine scanner output.
    return explainFindings(data.code, data.language);
  });
