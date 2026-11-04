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
- Repo scan authenticates GitHub REST calls through the Lovable connector gateway (`connector-gateway.lovable.dev/github`) with `LOVABLE_API_KEY` + `GITHUB_API_KEY` when the project has a GitHub connection; both are server-only env vars, never sent to the browser or the repo, never used against api.github.com directly. Anonymous fallback is allowed, and the result always reports which mode ran (`apiAuth`).
- The evidence pack is one coherent run: `scan-report.json` must come from the same verify run as `signed-verification.json` (matching `scanId`, enforced in `buildEvidencePack`), and `benchmark.json`/`manifest.json` carry the same `scanId`+`artifactId`; a mismatch must fail, never silently bundle.
- Sidebar navigation is defined once (`NAV` in `src/components/Shell.tsx`, 8 entries) and unit-tested so every page renders identical navigation.
