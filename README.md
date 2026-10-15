# video-knowledge

Knowledge stores about topics, built from YouTube videos and blog posts with the `watcher` library, and published as a website: what the sources claim, and how those claims hold up against studies.

Site: https://jonborchardt.github.io/video-knowledge/

The library is linked from `../retire-sim/watcher`, which must be checked out on a branch that has it.

## Setup

```
npm install
```

## One folder per topic

```
<topic>/
  videos.txt   YouTube URLs, one per line (blank and # lines ignored)
  blogs.txt    optional: blog/article URLs, same format
  sources/     studies the claims are checked against: <name>.pdf (gitignored) + <name>.txt (committed)
  store/       written by the CLI; commit it (store/transcripts/ is a gitignored cache)
  report.json  written by `npm run report`; commit it (the site is built from it)
  lean.json    written by `npm run record`: claim id → pro | pro-hype | calibrating | skeptic | neutral
  site.json    optional: recap claims and bottom line, study display names
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
7. **Publish.** Optionally add `<topic>/site.json` (copy `ai-coding/site.json`: recap groups, bottom line, study display names). Then `npm run report && npm run site`, check `_site/<topic>/index.html`, and commit and push.

### How verdicts work

- Every claim gets an **AI guess** when it's created. It counts for at most 50% confidence, however sure the agent is.
- A **study verdict** replaces the AI guess when it is at least that confident; a weaker one is shown as context.
- Evidence belongs to the **claim**: a verdict counts for every source that makes the claim, including ones added later. Adding a source never needs re-judging old claims.
- A source's **score** comes from the verdicts on the claims it makes. Its **novelty** adds up the confidence of the claims it gets right, divided by how many other sources say the same.

## Website

Each topic with a `report.json` becomes a page, linked from a home page.

```
npm run report   # refresh <topic>/report.json from the stores (needs the watcher library, so run locally)
npm run site     # build _site/ (no dependencies); open _site/index.html to preview
```

Pushing to `main` runs `.github/workflows/pages.yml`, which builds `_site/` from the committed files and deploys it.

The watcher's agent contract is `.claude/skills/watcher/SKILL.md`, a copy of `../retire-sim/watcher/SKILL.md`. Re-copy it when the library changes.
