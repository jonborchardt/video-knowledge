# video-knowledge

Knowledge stores about topics, built from YouTube videos with the `watcher` library. The library is linked from `../retire-sim/watcher`, which must be checked out on a branch that has it.

## Setup

```
npm install
```

## One folder per topic

```
<topic>/
  videos.txt   one URL per line (blank and # lines ignored)
  blogs.txt    optional: blog/article URLs, same format
  sources/     reference material the agent checks claims against
  store/       created by the CLI; commit it (store/transcripts/ is a gitignored cache)
  report.json  written by `npm run report`; commit it (the site is built from it)
  lean.json    optional: claim id → pro | pro-hype | calibrating | skeptic | neutral (counts sweeping claims for the recap)
  site.json    optional: recap claims and bottom line, study display names
```

## Website

Each topic with a `report.json` becomes a page on the GitHub Pages site, linked from a home page.

```
npm run report   # refresh <topic>/report.json from the stores (needs the watcher library, so run locally)
npm run site     # build _site/ (no dependencies); open _site/index.html to preview
```

Pushing to `main` runs `.github/workflows/pages.yml`, which builds `_site/` from the committed files and deploys it. One-time setup: in the repo's Settings → Pages, set Source to "GitHub Actions".

## Use

In Claude Code:

> Use the watcher skill on glp1/videos.txt. Store is glp1/store, known topic `glp1`, sources folder glp1/sources. Fetch, extract, judge from prior and from sources, then give me the report.

By hand:

```
npm run watcher -- fetch glp1/videos.txt --store glp1/store
npm run watcher -- report --store glp1/store
```

The agent contract is `.claude/skills/watcher/SKILL.md`, a copy of `../retire-sim/watcher/SKILL.md`. Re-copy it when the library changes.
