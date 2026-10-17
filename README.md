# video-knowledge

What YouTube videos and blog posts claim, checked against the evidence. For each topic it collects sources, extracts the distinct testable claims, judges every claim (an AI guess, then studies where they exist), and publishes which claims hold up and which sources are worth your time. Stores are built with the `watcher` library.

Site: https://jonborchardt.github.io/video-knowledge/

The library lives in `../retire-sim/watcher`, which must be checked out next to this repo on a branch that has it (or point `WATCHER_DIR` at it).

## Setup

Node 22, `npm install`, and `pdftotext` (poppler) for step 5. The watcher checkout is only needed for the data scripts, not for building the site.

## One folder per topic

```
<topic>/
  videos.txt   YouTube URLs, one per line (blank and # lines ignored)
  blogs.txt    optional: blog/article URLs, same format
  sources/     studies the claims are checked against: <name>.pdf (gitignored) + <name>.txt (committed)
  store/       written by the CLI; commit it (store/transcripts/ is a gitignored cache)
  report.json  written by `npm run report`; commit it (the site is built from it)
  lean.json    written by `npm run record`: claim id → pro | pro-hype | calibrating | skeptic | neutral
  site.json    optional: hero title and lede, recap groups, bottom line ({hypeWrong}/{hypeTotal} are filled in), study display names
  glyph.svg    optional: line-art icon (44x44 viewBox, stroke currentColor) shown on the home card
  changed-minds.json  optional notes from the changed-minds pass (step 6); nothing reads it
  stories.json  written by `npm run stories -- discover`; commit it (the story-ideas page is built from it)
  story-review.json  optional, written by the review agent (scripts/briefs/stories.md); discover merges it
  work/        scratch for agent batches (gitignored)
```

## Adding a topic

The agent does the reading and judging; the scripts do the bookkeeping. Steps 3–5 are written for Claude Code, which runs one agent per group of sources in parallel.

1. **Lists.** Create `<topic>/videos.txt` (and `blogs.txt` if any). Mark later additions with a `# --- Batch N, <how they were found>` line so it's clear which sources came from where.
2. **Fetch.** `npm run watcher -- fetch <topic>/videos.txt --store <topic>/store`, then the same for `blogs.txt`. Videos without captions are reported and skipped. An article that comes out as junk can be attached by hand: `npm run watcher -- fetch --text <file> <id> --title "<t>" --url <u> --store <topic>/store`.
3. **Extract.** Write the claims list (`npm run watcher -- claims list --topic <topic> --store <topic>/store > <topic>/work/claims.txt`), split the `extract` entries from `npm run watcher -- next --json --store <topic>/store` into `<topic>/work/grpN.txt` files (about 400k characters each), and give each group to an agent with `scripts/briefs/extract.md`. Each writes `<topic>/work/hN.json` with its claims, AI guesses and lean tags.
4. **Merge and record.** Agents working in parallel can each create the same new claim. List those in a merges file (`{"<duplicate text>": "<existing-slug>" | "=<canonical new text>"}`), then:
   ```
   npm run merge-claims -- <topic>/work/merges.json <topic>/work/h*.json
   npm run record -- <topic> <topic>/work/h1.json --label "<Topic label>"   # --label only on the very first batch
   npm run record -- <topic> <topic>/work/h2.json                            # …and so on; --from <id> resumes
   ```
5. **Studies.** Put papers in `<topic>/sources/` and convert them (`pdftotext -layout x.pdf x.txt`). Give each agent `scripts/briefs/sources.md`, a few documents and the claims list. Each writes `<topic>/work/sv_G.json`. Then `npm run record-sources -- <topic> <topic>/work/sv_*.json`. When you add claims or documents later, only the new pairs need checking: new claims against all documents, and new documents against all claims.
6. **Changed minds.** If a speaker reverses an earlier position in a later source, run `npm run watcher -- supersede <old-id> <new-id> --store <topic>/store`. The old source stays listed but stops counting.
7. **Publish.** Optionally add `<topic>/site.json` (copy `ai-coding/site.json`: recap groups, bottom line, study display names). Then `npm run report && npm run validate`, check the page with `npm run dev`, and commit and push.

### How verdicts work

- Every claim gets an **AI guess** when it's created. It counts for at most 50% confidence, however sure the agent is.
- A **study verdict** replaces the AI guess when it is at least that confident; a weaker one is shown as context.
- Evidence belongs to the **claim**: a verdict counts for every source that makes the claim, including ones added later. Adding a source never needs re-judging old claims.
- A source's **score** comes from the verdicts on the claims it makes. Its **novelty** adds up the confidence of the claims it gets right, divided by how many other sources say the same.

## Story ideas and the evidence gate

`npm run stories -- discover <topic>` reads the topic's report and store (no watcher checkout needed), drafts
candidate videos, audits each against the recorded evidence, evaluates and ranks them and writes
`<topic>/stories.json` (at most 12 kept; the rest are listed as rejected with a reason). The site shows them at
`/<topic>/stories/`.

```
npm run stories -- discover <topic>              # draft, audit, evaluate, rank; writes <topic>/stories.json
npm run stories -- show <topic> [story-id]       # the ranked list, or one story with its audit and cited passages
npm run stories -- validate <topic> <file.json>  # run the evidence gate on your own assertions (exit 2 if any is blocked)
```

Three layers, kept apart:

- **Deterministic** (`src/lib/stories.ts` drafting, `src/lib/evidence.ts` checks): five kinds of candidate are drafted
  (a popular claim a study contradicts, studies or sources that disagree, a study that overturned the AI guess, a widely
  repeated claim nobody checked, and the recap groups in `site.json` as decision stories), and every reference is
  verified. Ids are `<kind>:<claim slug>`, so a rerun is byte-identical and ids survive corpus changes.
- **Semantic judgment** (`<topic>/story-review.json`, written by an agent following `scripts/briefs/stories.md`): does a
  study verdict decide _this_ sentence (`direct`, `partial`, `contextual`), do a candidate's claims answer one question
  (coherence score, pruned claim list, or rejection), and are the audit's qualifications carried into the narrative.
  Without a review, the validator falls back to conservative wording heuristics (a base rate is only context for a
  "can" claim; a verdict note that hedges its own scope is partial), and a multi-claim story cannot be `ready`.
- **Editorial** (the review's framing, else plain-question templates): the viewer-facing question, title and two
  alternates, why watch, the tension, the evidence needed and available, the gaps, and the arc. Kind names never
  appear in titles.

Each story carries a coherence score, a format (`long-form` for 8 to 12 minutes, `short`, or `needs-research`), and
separate scores: _editorial_ (mean of coherence, relevance, curiosity, stakes, depth, all corpus heuristics, never
audience data) and _evidence_ (strength of the studies behind the central conclusion, discounted when they only partly
apply). Overall is 0.6 editorial + 0.4 evidence, scaled by originality against higher-ranked stories. Readiness is
decided from the central conclusion and the essential findings, never from the scores: `ready` (coherent, verified,
nothing pending), `needs-review` (usable once a person settles the listed points), `needs-research` (essential evidence
missing), or rejected (incoherent, a variation of another story, a single-claim chapter of a reviewed multi-claim
story, or contradicted). A disagreement story is ready when the disagreement itself is verified; a story whose
strongest applicable study is below 0.5 confidence is never ready. Every non-ready story lists what blocks it.

The validator (`src/lib/evidence.ts`) takes an assertion (`fact`, `attribution` or `disagreement`), the canonical
claims it rests on and its evidence references, and returns a status (`supported`, `qualified`, `disputed`,
`unsupported`, `unverified`), a publication decision (`approved`, `qualify`, `blocked`), whether a human must review
it, and the supporting, contradicting and qualifying evidence with passages. It is deterministic and fails closed: a
missing claim, verdict or passage blocks; an AI guess never counts as verification; a figure that is not in the cited
passage blocks; a study verdict is pulled in as a contradiction whether or not it was cited; and any wording that is
not the canonical claim's is flagged for review because only a human (or a semantic check) can confirm a passage
supports an exact sentence. An attribution ("several sources claim X") passes on the sources' own statements without
endorsing X.

```json
[
  {
    "id": "a1",
    "text": "Most retail day traders lose money",
    "kind": "fact",
    "claims": [{ "id": "get-rich-quick/most-retail-day-traders-lose-money", "stance": "asserts" }],
    "evidence": [
      {
        "kind": "study",
        "claim": "get-rich-quick/most-retail-day-traders-lose-money",
        "cite": "get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229"
      }
    ]
  }
]
```

## Website

An [Astro](https://astro.build) site with Tailwind. Each topic with a `report.json` becomes a page (`src/pages/[topic]/index.astro`), linked from a home page. Pages are rendered at build time; the only client script is the tab bar and the claim search.

```
npm run report     # refresh <topic>/report.json from the stores (needs the watcher checkout, so run locally)
npm run stories -- discover <topic>   # refresh <topic>/stories.json from the report and store
npm run dev        # live preview at http://localhost:4321/video-knowledge/
npm run build      # build dist/
npm run validate   # typecheck + lint + format check + build + tests (what CI runs)
npm run format     # prettier --write
```

Pushing to `main` runs `.github/workflows/pages.yml`: `npm ci`, `npm run validate`, deploy `dist/`.

The data scripts (`report`, `record`, `record-sources`, `watcher`) run the watcher CLI from `../retire-sim/watcher` (or `$WATCHER_DIR`). It isn't an npm dependency, so CI, which only builds the site, doesn't need it.

The watcher's agent contract is `.claude/skills/watcher/SKILL.md`, a copy of `../retire-sim/watcher/SKILL.md`. Re-copy it when the library changes.
