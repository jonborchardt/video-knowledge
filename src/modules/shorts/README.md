# shorts

Shorts finds which findings of a produced video can stand on their own as a vertical Short, and builds the Short's evidence package as a filter of the parent's.

- Inputs: the parent's `script.json`, `validation.json`, `storyboard.json`, `evidence-package.json`, `release.json` and the reviewer's `shorts-review.json`.
- Outputs: `shorts.json` (derived, byte-identical on a rerun, never hand-edited). The Short's `evidence-package.json` is written by the script CLI from `buildShortPackage`.
- Brief: `briefs/shorts.md` (keep, slug, format, hook, how each qualification is carried).
- CLI: `npm run shorts -- discover <topic> <story-id>`, `show <topic> <story-id> [key]` (`cli.ts`).
- Inspect: no; the board computes what is owed from `discoverShorts` and the review file through `index.ts`.
- Public API (`index.ts`): `discoverShorts`, `loadShortParent`, `loadShorts`, `loadShortsReview`, `buildShortPackage`, `shortsPath`, `shortsReviewPath` and their types.
- Read API (read-only, listed under `shorts` in `tests/boundaries.json`): `buildShortPackage` is pure over the parsed parent package and candidate (reads, computes and writes nothing); `loadShorts` reads `shorts.json`; `shortsPath` is a path.
- Consumes: shared only (`release-check`, storyboard types, io, sentences).
- Rules: a Short never touches the store, the corpus, a verdict or `record-sources`; its package is a filter of the parent's, never built from the store or the story.
