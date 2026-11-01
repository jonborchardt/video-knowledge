# Modules

Each capability is a folder here (`index.ts` public API, `cli.ts` the npm entry, `briefs/`, `tests/`, `README.md`).
Boundaries are enforced by
`tests/boundaries.test.ts` (config `tests/boundaries.json`); this table is the only place future ownership is recorded
in code.

| capability      | today                                                                                                                                                                                    | CLI                                                                                                         | briefs                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| shared          | `src/shared/` (contracts, io, sentence validation, evidence gate, public record, look, build report, inspect), `src/config/`                                                             |                                                                                                             |                                                                                                       |
| evidence        | `src/modules/evidence/` (`topics.ts`, `corpus.ts`, `batches.ts`, `finding-label.ts`, `verdict-label.ts`, `cited.ts`, `datasets.ts`, `live-claims.ts`)                                    | `src/modules/evidence/cli-report.ts`, `record.mjs`, `record-sources.mjs`, `watcher.mjs`, `merge-claims.mjs` | `extract.md`, `sources.md`, `evidence.md`, `collect.md`, `studies.md`, `merge.md`, `revision-note.md` |
| stories         | `src/modules/stories/`                                                                                                                                                                   | `src/modules/stories/cli.ts`                                                                                | `stories.md`                                                                                          |
| script          | `src/modules/script/` (`evidence-package.ts`, `script-md.ts`; validators in `src/shared/`)                                                                                               | `src/modules/script/cli.ts`                                                                                 | `script.md`, `script-review.md`                                                                       |
| storyboard      | `src/modules/storyboard/` (`storyboard.ts`, `chart-geometry.ts`; types in `src/shared/types.ts`)                                                                                         | (driven by `src/modules/script/cli.ts`)                                                                     | `storyboard.md`                                                                                       |
| video           | `src/modules/video/` (`remotion/`, `bespoke/`, `tts/`, `render-check.ts`, `final.ts`), `music/`                                                                                          | `src/modules/video/cli.ts`, `cli-music.ts`                                                                  | `graphics.md`, `visual-review.md`, `video-fix.md`, `strudel-bench.md`                                 |
| packaging       | `src/modules/packaging/`                                                                                                                                                                 | `src/modules/packaging/cli.ts`                                                                              |                                                                                                       |
| article         | `src/modules/article/`                                                                                                                                                                   | `src/modules/article/cli.ts`                                                                                | `article.md`, `article-review.md`                                                                     |
| shorts          | `src/modules/shorts/`                                                                                                                                                                    | `src/modules/shorts/cli.ts`                                                                                 | `shorts.md`                                                                                           |
| publishing      | `src/modules/publishing/`                                                                                                                                                                | `src/modules/publishing/cli.ts`                                                                             |                                                                                                       |
| brand           | `src/modules/brand/`, `brand/`                                                                                                                                                           | `src/modules/brand/cli.ts`                                                                                  |                                                                                                       |
| website         | `src/modules/website/` (graph, SEO, CTA, review page model and job, rehearsal), `src/pages`, `src/components`, `src/layouts`, `src/styles`, `src/admin`, `src/tools`, `astro.config.mjs` | `src/modules/website/cli-links.ts`, `cli-quality.ts`, `cli-rehearse.ts`                                     | `cta.md`                                                                                              |
| orchestration   | `src/orchestration/`                                                                                                                                                                     | `src/orchestration/board.ts`                                                                                | `.claude/skills/produce/SKILL.md`                                                                     |
| topic-discovery | `src/modules/topic-discovery/` (`proposals.ts`: validation, ranking, inspection of `proposals/<slug>.json` and its review)                                                               | `src/modules/topic-discovery/cli.ts`                                                                        | `discover.md`, `proposal-review.md`                                                                   |
| social          | `src/modules/social/` (`social.ts` the posts and their record, `x.ts` the X client)                                                                                                      | `src/modules/social/cli.ts`                                                                                 |                                                                                                       |

Orchestration lives outside this folder: `src/orchestration/` (the board, `npm run board`) reads the modules through their
`index.ts` and decides stage, next step, halt kind and column (publishing answers a structured next step; the board renders it); see `src/orchestration/README.md`.

## Responsibility boundaries

1. **Topic discovery vs. evidence.** Topic discovery (future) identifies, evaluates, scores and deduplicates
   candidate topics; its output is a proposal (institution fit, rationale, potential claims, preliminary sources,
   research feasibility). Evidence owns substantive research: gathering sources, extracting claims, assessing
   studies, maintaining verdicts, generating reports, and is the only writer of the store. Topic discovery must
   never become a second evidence-research implementation.
2. **Publishing vs. social.** Publishing owns YouTube-specific operations: uploads, release approval records,
   scheduling, go-live, verification. Social (future) owns X-specific content and publication. No generalized
   publishing framework, no coupling between the two; orchestration coordinates them.
3. **Article vs. website.** Article owns editorial content through its lifecycle: drafting, review, validation,
   corrections and reaffirmations when evidence changes (`article -- correct`, `reaffirm`). Website owns
   rendering, content relationships, building and deploying the site; it never decides whether a finding needs a
   correction.
4. **Orchestration vs. modules.** A module knows its own artifacts: it validates them, inspects them
   (`missing | invalid | stale | ready`) and changes them through its CLI. Orchestration knows the workflow: which
   stage a story or topic is in, what runs next, who acts, and (from Milestone 2) when it runs, how it is retried,
   what it may cost and whom to tell. A module never answers what runs next or whether something may go live;
   orchestration never judges content and never writes a module's artifact except through that module's CLI.
5. **Agents vs. machinery.** An agent writes artifacts a validator checks (a script, a review, a batch, a proposal,
   a component where the graphics brief allows). It never edits the code, configuration or settings that run it,
   never publishes, posts, pushes or holds a secret. A writer and its reviewer are different agents.

## Milestones

- **Milestone 1 (done): module separation.** One module per capability behind a compiler-backed boundary test;
  derived board state; child-process CLIs as the write boundary.
- **Milestone 2: autonomous operations.** Discover, research, produce, approve, publish, distribute and maintain
  with minimal manual coordination. The question it answers: can a person approve a batch of topics, stop
  thinking about the system for a week, and return to a set of well-researched, professionally produced releases
  that need only their final decisions, with failures already identified and routine problems handled? Adds the
  modules `topic-discovery` and `social` and an executor in orchestration; changes no boundary above.
- **A later milestone: business optimization.** Measure audience response, compare stories and institutions,
  optimize topic selection, test monetization, allocate production by results. Milestone 2 only keeps the
  identity every publication needs for that (institution, topic, story, format, date, channel, call to action)
  in its ledgers.
