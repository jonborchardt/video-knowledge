# video-knowledge

Topic knowledge stores (claims from YouTube videos and blog posts, judged against studies) published as an Astro site. The workflow for adding a topic is in README.md; the agent contract for the watcher CLI is `.claude/skills/watcher/SKILL.md`; the briefs handed to parallel agents are `scripts/briefs/`.

## Commands

- `npm run validate` before committing: typecheck, lint, format check, build, tests. CI runs the same and deploys `dist/`.
- `npm run format` fixes formatting (prettier with astro + tailwind plugins).
- `npm run report` regenerates `<topic>/report.json`. It needs the watcher checkout (`../retire-sim/watcher` or `$WATCHER_DIR`), so it only runs locally; commit the result, the site is built from it.
- `npm run watcher -- <cmd> --store <topic>/store` runs the watcher CLI.
- `npm run stories -- discover <topic>` regenerates `<topic>/stories.json` (story candidates with their evidence audit), merging `<topic>/story-review.json` if present; it reads the report and store, so it runs anywhere. Commit the result. `validate <topic> <assertions.json>` is the evidence gate. The review file is the agent's semantic pass (`scripts/briefs/stories.md`): applicability of each verdict to a sentence, coherence and pruning of each candidate, viewer-facing framing.

## Rules

- Never hand-edit `<topic>/store/` (`topics.json`, `videos/*.json`). Go through `npm run record`, `record-sources`, or the CLI.
- Evidence belongs to the claim, not the source. A verdict on a claim counts for every source that makes it. Adding a source never needs re-judging old claims.
- An AI guess counts for at most 0.5 confidence; a study verdict overrides it only when at least as confident.
- Canonical claim text: one line, mechanism-level, no numbers that belong to one source. No personal data in notes or claims; the store is public.
- `.claude/skills/watcher/SKILL.md` is a verbatim copy of `../retire-sim/watcher/SKILL.md`. Change it upstream and re-copy; don't edit it here.
- `stories.json` is derived: never hand-edit it, and never store passage text in it (references only; `show` re-reads passages). The validator in `src/lib/evidence.ts` must stay deterministic and fail closed; an AI guess never counts as verification; contextual evidence never decides. Semantic judgment lives only in `story-review.json`, keyed by stable ids, so runs stay reproducible. A story with more than one claim is never `ready` without a review.
- Site pages are rendered at build time. Keep client JS to the tab bar and claim search.
- Site name, nav, author and blog links live in `src/config/site.ts`. Build internal links with `href()` from `src/lib/url.ts` so they respect Astro's `base`.
