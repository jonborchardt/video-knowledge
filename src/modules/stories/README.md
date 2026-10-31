# stories

Stories turns a topic's judged claims into ranked candidate videos, each with its evidence audit, and merges the reviewer's semantic pass.

- Inputs: `report.json` and the store through evidence's `loadTopic`, `story-review.json`, the cited passages through shared `passageReader`.
- Outputs: `topics/<topic>/stories.json`; derived, never hand-edited, byte-identical on a rerun.
- Brief: `briefs/stories.md` (the review agent writes `story-review.json`).
- CLI: `npm run stories -- discover|show|validate <topic> ...` (`cli.ts`).
- Inspect: no; the board reads the readiness field of `stories.json`.
- Public API (`index.ts`): `discover`, `loadStories`, `storiesPath`, `chainOf`, `storyUrlSlug`, `groupSlug`, `staleReviewIds`, `storyTopicNames`, `loadReview`, `reviewPath`, types `StoryInput`, `StoriesFile`.
- Read API (listed under `stories` in `tests/boundaries.json`): `loadStories`, `storiesPath`, `chainOf`, `storyUrlSlug`, `loadReview`, `reviewPath`, `storyTopicNames` (the topics with a `stories.json`), `groupSlug` (a recap group's slug from its title, pure), the type `StoriesFile`; each only reads `stories.json` or `story-review.json`, builds a path, or selects over a loaded file. `discover` is not in it: only the orchestrator runs it.
- Consumes: evidence's `loadTopic`, `topicNames` and `VAL` (`src/modules/evidence/`, listed under `evidence` in `tests/boundaries.json`); the topic view types are in `src/shared/types.ts`.
- Rules: `stories.json` is derived and holds references only (never passage text); semantic judgment lives only in `story-review.json`, keyed by stable ids; a story with more than one claim is never `ready` without a review; a video may chain up to three questions (`MAX_CHAIN_CLAIMS` 14), chains do not nest and a chained story is `partOf` the first.
