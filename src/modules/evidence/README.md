# evidence

Evidence gathers and judges claims for a topic it is given; proposing or evaluating new topics is topic discovery (Milestone 2, not present) and never evidence's job.

- Inputs: `topics/<topic>/store/**` through the watcher, `sources/*.txt`, `data/*`, `site.json`, the agent batches `h*.json` (extraction) and `sv_*.json` (study verdicts).
- Outputs: `report.json`, `applicability.json` (only `record-sources` writes it), and `public-record.json` through shared `public-record.ts`.
- Briefs: `briefs/extract.md`, `briefs/sources.md`, `briefs/evidence.md`.
- CLI: `npm run report [-- seed|note]` (`cli-report.ts`), `record`, `record-sources`, `watcher`, `merge-claims` (the `.mjs` files load `batches.ts` and `cited.ts` by `.ts` path under plain node).
- Inspect: no.
- Public API (`index.ts`): the topic views and loaders (`loadTopic`, `topicNames`, `publicTopicNames`, `VAL`), `corpusOf`, datasets (`loadDatasets`, `dataRef`, `datasetCsv`), the finding and verdict labels, and the view types.
- Read API (listed under `evidence` in `tests/boundaries.json`; loaders, a table and pure projections): `loadTopic`, `topicNames`, `publicTopicNames`, `VAL`, `Topic`, `corpusOf`, `loadDatasets`, `dataRef`, `findingLabel`.
- Consumes: publishing's `storyOutputs` (`live-claims.ts`: which claims have a live video, pinned equal to the content graph by `tests/live-claims-equivalence.test.ts`) and storyboard's `pointProblems`.
