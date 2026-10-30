# script

Script turns a reviewed story into the evidence package the writer may cite, validates the writer's script against it, and locks the approved fingerprints.

- Inputs: `stories.json`, `story-review.json`, the corpus (through evidence), `script.json`, `script-review.json`, `storyboard.json` and, for lock, `video/render-check.json` (re-run through `npm run video -- check`).
- Outputs: `evidence-package.json`, `validation.json`, `script.md`, `review.md`, `release.json`; the `storyboard` verb also writes `storyboard.json` and `storyboard.md`.
- Briefs: `briefs/script.md` (the writer), `briefs/script-review.md` (a different agent, the reviewer).
- CLI: `npm run script -- package|validate|show|lock|storyboard|run <topic> <story-id>` (`cli.ts`).
- Inspect: no; the board derives the script stage from the artifacts' fingerprints and validation status through shared types.
- Public API (`index.ts`): `buildPackage`. Read API: none.
- Consumes: shorts' read API (`buildShortPackage`, `loadShorts`, `shortsPath`); evidence's and stories' (`corpusOf`, `loadTopic`, `loadReview`, `loadStories`) until they are modules, and storyboard's read API (`buildStoryboard`, `renderStoryboardMd`); video's `render-check` reader; the lock spawns `npm run video -- check`.
- Rules: the writer and the reviewer are different agents; approvals are by fingerprint, so a changed sentence is re-reviewed; the lock needs a passed validation, an ok storyboard and a render check with every bespoke graphic approved.
