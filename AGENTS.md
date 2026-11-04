<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- Scanner rules, healer signatures, verification obligations and the Meta (Baseten `meta-models/muse-spark-open-1026`) call mirror the uploaded reference build exactly; do not add rules or other model providers, because results must stay identical to the reference.
- Finding patches follow the input language, everywhere patches surface (findings cards, Copy patch, model referencePatch): Python input → Python patch, JS/TS → JS patch; language-neutral rules (Dockerfile/Kubernetes) keep one patch for any language; unknown language → language-tied rules emit no patch (`null`) and the UI hides the patch block. Language detection lives only in `src/lib/agents.server.ts` and is re-exported by `meta.server.ts` — one heuristic, two consumers.
