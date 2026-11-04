import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { checkSignature, parseArtifact, runVerification, type SignedArtifact } from "./verify.server";

const VerifyInput = z.object({
  source: z.string().min(1, "Provide the artefact to verify").max(120_000),
  artifactName: z.string().max(200).optional(),
});

export const formalVerify = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data }) => runVerification(data.source, data.artifactName ?? "artifact.txt"));

export const recheckSignature = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ artifact: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ data }) => checkSignature(parseArtifact(data.artifact)));
