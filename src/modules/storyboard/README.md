# storyboard

Storyboard fills the planner's scenes with the script's own narration, times them, and checks every chart figure and on-screen citation against the evidence package.

- Inputs: `script.json`, `validation.json`, `evidence-package.json` and the agent's `storyboard.json` plan; datasets' tables through the shared `DataTable`.
- Outputs: `storyboard.json` (the plan filled in), `storyboard.md`; the script CLI writes them.
- Brief: `briefs/storyboard.md` (the planner agent).
- CLI: none; `npm run script -- storyboard <topic> <story-id>` drives it from the script module through the read API.
- Inspect: no; the board derives the storyboard stage from `storyboard.json`'s status and fingerprints.
- Public API (`index.ts`): `buildStoryboard`, `renderStoryboardMd`, `pointProblems`, `chartProblems`, `barGeometry`, `datasetChart`.
- Read API (listed under `storyboard` in `tests/boundaries.json`): `pointProblems`, `chartProblems`, `datasetChart`, `buildStoryboard`, `renderStoryboardMd`; each is pure (values in, problems, a chart spec, a storyboard or markdown out; nothing read or written).
- Consumes: shared only (`src/shared/types`, numbers, sentences).
- Shim: `src/lib/storyboard.ts` re-exports the storyboard vocabulary and types only; `src/video/types.ts` and `kinds.ts` import them from there and are fingerprint-hashed, so it stays until the video section moves them.
- Rules: the storyboard never carries narration of its own; chart data is numeric points with a unit and a cite; required assets are registered by id; timing is per sentence.
