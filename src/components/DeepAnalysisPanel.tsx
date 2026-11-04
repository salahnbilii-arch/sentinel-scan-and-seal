import { useMutation } from "@tanstack/react-query";
import { BrainCircuit, Loader2, Sparkle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deepAnalyze } from "@/lib/ai.functions";

const PLACEHOLDER = `Paste the artefact to analyse — source file, Terraform/K8s manifest or configuration. Clean input is re-scanned first and the model is not called.`;

export function DeepAnalysisPanel() {
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: async () => deepAnalyze({ data: { content: content.trim() } }),
    onError: (error: Error) =>
      toast.error("Deep analysis failed", {
        description: error.message.replace(/^Error:\s*/, ""),
      }),
  });

  const result = mutation.data;

  return (
    <section className="panel mt-8 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md border border-accent/40 bg-accent/10 text-accent">
          <BrainCircuit className="size-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Deep Analysis Engine</h2>
          <p className="text-sm text-muted-foreground">
            Meta Muse Spark Open deep audit: the artefact is re-scanned server-side and the model
            reasons only over genuine scanner findings.
          </p>
        </div>
        <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
          muse spark open
        </span>
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={PLACEHOLDER}
        className="mt-5 w-full resize-y rounded-md border border-border bg-background/70 p-3 font-mono text-xs text-foreground outline-none focus:border-primary/60"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={mutation.isPending || content.trim().length < 12}
          onClick={() => mutation.mutate()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkle className="size-4" />
          )}
          {mutation.isPending ? "Reasoning…" : "Run deep analysis"}
        </button>
        {result && !result.nothingToDo ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {result.model} · {result.latencyMs} ms ·{" "}
            {result.usage.completionTokens ?? "?"} out tokens
          </span>
        ) : null}
      </div>

      {result ? (
        result.nothingToDo ? (
          <p className="mt-4 rounded-md border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            {result.message}
          </p>
        ) : (
          <article className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background/60 p-4 text-sm leading-relaxed text-foreground/90">
            {result.report}
          </article>
        )
      ) : null}
    </section>
  );
}
