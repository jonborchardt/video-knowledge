# article

Article owns editorial content through its lifecycle: drafting, review, validation, corrections and reaffirmations when evidence changes (`article -- correct`, `reaffirm`). Website renders `article-release.json` and never decides whether a finding needs a correction.

- Inputs: `evidence-package.json`, `validation.json`, `release.json` and `storyboard.json` of the story, the topic's `public-record.json`, `article.json` and `article-review.json` (written by different agents).
- Briefs: `briefs/article.md` (writer), `briefs/article-review.md` (reviewer).
- Outputs: `article-validation.json`, `article.md`, `article-release.json` (the snapshot the site renders), article revisions in `public-record.json`.
- Validator: `validateArticle` / `validateArticleIn` in `validation.ts` (pure over parsed artifacts, the script checks over its sentences plus coverage, metadata, tables, figures).
- Inspect: yes, `inspectArticle` returns an `Inspection` whose `code` is one of `missing`, `needs-evidence`, `no-package`, `revision-limit`, `blocking`, `unapproved`, `passed`, `changed`, `stale`, `ready`; only the board maps a code to a halt and a next command.
- CLI: `npm run article -- validate|show|lock|correct|reaffirm <topic> <story-id>` (`cli.ts`).
- Public API (`index.ts`): release and view readers for the site, inspect and validate for the board.
- Read API (listed under `article` in `tests/boundaries.json`; read-only, nothing written): `loadArticleRelease(topic, storyId)` reads `article-release.json`, or null; `articleModified(release)` is the date the released text last changed, from a release already read; `releaseFigureDraws(release, docNames)` is what each figure draws, computed from the release's own snapshot (it throws on a release without one, never reads); `articleView(release, topic, record, repo, figures)` is the page model, a pure projection; `ArticleView` is its type.
