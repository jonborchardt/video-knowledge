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
  scripts/<story slug>/  one generated script per story: evidence-package.json, script.json, script-review.json,
               validation.json, storyboard.json and the readable script.md, storyboard.md, review.md; commit them
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

## Scripts and storyboards

A `ready` story becomes a narration script and a storyboard in `<topic>/scripts/<story slug>/`. The code builds
the evidence package, checks the script and fills in the storyboard; three agent briefs do the writing and the
judging (`scripts/briefs/script.md`, `script-review.md`, `storyboard.md`). Every stage persists its output, so a
rejected script is revised and rechecked without touching research or story discovery.

```
npm run script -- package <topic> <story-id>      # evidence-package.json: the story, its final claims, every passage, statement and gap
# an agent writes script.json from scripts/briefs/script.md
npm run script -- validate <topic> <story-id>     # validation.json, script.md, review.md (exit 2 when blocked)
npm run script -- show <topic> <story-id> [s12]   # the reviewer's sheet: sentences, assertions, fingerprints, passages
# an independent agent writes script-review.json from scripts/briefs/script-review.md, then validate again
# an agent writes storyboard.json from scripts/briefs/storyboard.md
npm run script -- storyboard <topic> <story-id>   # fills narration and timing, checks charts and citations; storyboard.md
npm run script -- run <topic> <story-id>          # every stage whose inputs exist, then the next agent step
npm run script -- lock <topic> <story-id> --approved-by "<name>"   # release.json: the approved fingerprints (passed + ok only)
```

The script is sentences with stable ids, each typed `factual`, `attributed`, `hypothetical`, `rhetorical` or
`transitional`. A factual or attributed sentence carries one assertion per independent claim it makes, with the
canonical claims and evidence references it rests on, and optionally a quotation or a calculation. The deterministic
layer runs the evidence gate on each assertion and adds its own checks: a factual sentence without an assertion, a
figure no assertion owns, a figure absent from the cited passage, a quotation not in the passage, a calculation whose
inputs are not cited or whose arithmetic does not reproduce, or a reference that does not resolve all block. The
semantic layer is the reviewer's file: approvals and findings keyed by sentence id and a fingerprint of the sentence
and its assertions, so an edit lapses the approval and a revision never inherits one. Status is `blocked` (an open
blocking issue), `needs-review` (sentences without a current approval) or `passed`; at most three revisions, after
which the output stays with its blockers listed. The storyboard references sentence ids and never carries words of
its own; it is machine-readable: per-sentence timing (absolute seconds from a numeral-aware spoken-word estimate at
`generation.wordsPerMinute`, default 150, plus declared pauses), a closed set of chart types with numeric points
(`value`, `unit`, `display`, `cite`), and an asset registry scenes reference by id, while `visual.description` stays
guidance for a designer. Every chart point and on-screen figure must be in a cited passage. The site shows each script at
`/<topic>/scripts/<slug>/`.

Everything needed to inspect and re-validate a script is committed: the package records the sha of every cited
document and a transcript window around every recorded source quote (`statements[].context`, the only place a
speaker attribution can be confirmed from), so `<topic>/sources/*.txt` plus `<topic>/scripts/<slug>/` is enough.

## Video

A validated storyboard becomes an MP4 in `<topic>/scripts/<slug>/video/`. `render.json` (committed, written by
hand) names the contiguous scenes to render, the voice, the cues (which narration word each animation waits for), a
bespoke `kinds` entry for scenes the storyboard category alone does not identify (one scene's own diagram or
animation), and per-scene `options` (layout choices, never figures). Narration is one file per sentence, cached by
voice, rate and text, with the measured duration and word boundaries in `narration.json`. Providers: `edge`
(Microsoft neural voices through `pip install edge-tts`, free, draft only: no licence for published media) and
`openai` (commercial terms; `OPENAI_API_KEY`, word timestamps from its transcription of the output, cost estimated
in the manifest). The timeline tiles the scenes by the measured audio, never by the word-count estimate, resolves
every cue to the frame its word is spoken on, and reads each cited excerpt from the corpus. The composition is
Remotion (React, one component per scene kind in `src/video/remotion/scenes/`, the closed kind list in
`src/video/kinds.ts`). Scenes render one at a time into cached chunks (`video/scenes/`, keyed by the scene and the
code that draws it), the chunks are concatenated without re-encoding, and the narration is laid down as one
loudness-normalised track; ffmpeg comes with Remotion, nothing else is installed. Rendering needs Chrome (downloaded
on first run). A scene without a renderer is reported, never substituted.

```
npm run video -- spike <topic> <story-id>      # narrate, timeline, render video/segment.mp4, qa, report, contact sheet
npm run video -- narrate <topic> <story-id>    # only the audio (add --regenerate to ignore the cache)
npm run video -- timeline <topic> <story-id>   # only video/timeline.json
npm run video -- render <topic> <story-id> [--scene sc17 | --from sc10 --to sc20] [--force]
                                               # the whole render.json into video/segment.mp4, or a range into video/scenes/<range>.mp4
npm run video -- qa <topic> <story-id>         # checks, frames in video/frames/, video/contact-sheet.png, the report (exit 2 on failure)
npm run video -- preview <topic> <story-id>    # Remotion studio on the same composition and timeline
```

Commit `render.json`, `narration.json`, `timeline.json`, `music.json`, `mix.json` and the build report; the audio,
chunks, frames, contact sheet and mp4 are ignored. The production board (`/production/`) reads the build report: a
render of every storyboard scene that passes QA against the locked fingerprints is `rendered`, with a soundtrack
mixed in it is `scored`, with a current review package `packaged`; anything less is `video`. QA is integrity and
consistency only; a person reviews the contact sheet and the video before any publication decision.
Validation blocks when a cited document no longer matches its recorded sha (`stale-source`), and a review counts
only for the package fingerprint it names; two documents marked `sameStudy` in `site.json` count as one. The
gitignored transcripts are needed only to build a package for a new story; rebuilding an existing package without
them keeps the persisted contexts and the same fingerprint. The reviewer may retire a deterministic warning with a
`dispositions` entry (reason plus sentence fingerprint); it lapses when the sentence changes. `lock` records the
approved script, package, validation and storyboard fingerprints in `release.json` (refused unless validation is
`passed` and the storyboard `ok`); a later `validate` or `storyboard` run that drifts from them warns `release-stale`.

Baseline: `mlm-script-v1` is the first locked package (`get-rich-quick/scripts/decision-mlm-and-seminars/release.json`);
rendering work starts from it.

### Soundtrack

Music is a bed under the narration, placed by `video/music.json` (the cue sheet) over compositions in `music/`
(`music/README.md` has the contract). A composition is one strudel-bench song; each of its sections is rendered on
its own as a variation (`music/<composition>/<variation>.wav`, gitignored, with its sha, length, bar count and
provenance in `composition.json`). A cue names a variation and two scene anchors, never seconds:

```json
{
  "duck": { "db": -2.5, "attack": 0.4, "release": 1.2 },
  "cues": [
    {
      "id": "opening",
      "asset": "undertow/pulse",
      "from": "sc02",
      "to": "sc06",
      "gain": -11,
      "fadeIn": 3,
      "fadeOut": 3
    },
    { "id": "conclusion", "asset": "undertow/rest", "from": "sc42", "to": "sc43", "gain": -10, "loop": false }
  ]
}
```

`from` is the measured start of its scene, `to` the measured end (`sc12:end-2`, `sc07+1.5` offset from an edge);
scenes between cues are silent on purpose. `render` resolves the cues against the timeline, decodes the assets,
loops them on the bar boundary with the variation's crossfade, fades, ducks under speech, sums them under the
loudness-normalised narration, turns the music down (never the voice) if the sum would pass -1 dBFS, and writes
`video/mix.json`. Nothing in the chunk cache knows about music, so a cue change re-mixes the audio in a couple of
minutes and re-renders no scene. Only a full render mixes: `--scene` and `--from/--to` renders are narration only and
leave `mix.json` alone. Levels in `mix.json` are as mixed, after any turning down. QA fails when the mix on disk is
not the mix of the committed cue sheet, a cue did not sound, or the music is closer than 10 dB to the voice or
further than 40 dB from it. The build report records
each composition's generator commit, source sha, tempo, key, sample packs with their licences, attribution lines
and whether it is cleared, separately from the narration voice's licence: `clearance.publishable` is true only when
both hold, and a passing build never sets it. A re-import keeps a composition's clearance only while its sample
packs and soundfonts are the same; a new sound source lapses it until a person imports with `--cleared` again.

```
npm run music -- import <id> --source <strudel-bench>/songs/<name>.strudel --repo <strudel-bench> <strudel-bench>/renders/<name>.*.wav
npm run music -- render <id>        # STRUDEL_BENCH=<dir>, npm run headless running there: re-render every variation and import
npm run music -- show <id>
```

### Private review package

```
npm run video -- package <topic> <story-id>
```

writes `video/review/`: the mp4 copied as `<slug>-review-private.mp4` (gitignored), `README.md`, `description.txt`
(the paste-ready description: a review-build notice, chapters at measured timestamps from `render.json`'s
`chapters` or the script's sections, the studies and sources, the voice and music provenance, the clearance line),
`checklist.md` (opening, intelligibility, music balance and continuity, citations, charts, pacing, transitions,
glitches, conclusion, local vs YouTube playback), the build report, a `thumbnail.png` from the title card, and
`review.json` (which build report it was made from; the board calls it stale when that changes). It refuses an mp4
other than the one QA checked (the build report records its sha), and chapters YouTube would ignore: fewer than
three, one under 10 s, or a scene not in the timeline. Upload the mp4
to YouTube as a **private** video by hand; there is no API call. Record the outcome in `production.json` with
`decision: "reviewing"` and the URL. The package says in every file that it is a review build and whether public
release is blocked; the Edge voice keeps it blocked until the video is re-narrated under commercial terms.

## Production board

`/production/` on the site shows what stage every topic, story and script is in. Everything on it is derived at
build time by `src/lib/production.ts` from the committed files: the research pipeline per topic (sources listed vs
fetched, fetched vs extracted, documents vs recorded verdicts, report vs store, stories.json vs a fresh `discover`,
candidates reviewed), each story's readiness, and for each `<topic>/scripts/<slug>/` the health of every artifact.
"Current" means re-running the library on today's inputs reproduces the file, the same test `lock` applies
(`buildPackage`, `validateScript`, `buildStoryboard`, `releaseCheck`); "stale" means it would not; "pending" means an
agent step is owed; "blocked" means the gate says so. Each row names the next command or brief. There is no state
machine: the stage is the first artifact that is missing or not current.

The one hand-written input is `production.json` at the repo root, for decisions no artifact records:

```json
{
  "get-rich-quick/decision:selling-online": {
    "decision": "parked",
    "note": "no study bears on it",
    "date": "2026-10-18"
  }
}
```

`decision` is `queued` (produce this next), `parked` (with the reason), `reviewing` (uploaded privately for human
review, with `url`) or `published` (with `url`). Keys must name a story in that topic's `stories.json`; the build
fails otherwise. The board keeps three things apart: technical readiness (the stage, from the artifacts), editorial
approval (`reviewing` and `published`, from this file) and licensing clearance (from the build report: the voice's
licence and each composition's `cleared`), so a card can be `packaged` and still say "public release blocked".

## Reproducing the MLM video

A fresh checkout plus these makes `get-rich-quick/scripts/decision-mlm-and-seminars/video/segment.mp4` again:

- **Node 22+** (`npm ci`); Remotion downloads Chrome on the first render. The ffmpeg and ffprobe used everywhere
  are the ones in Remotion's compositor package; `FFMPEG_DIR` overrides the directory.
- **Python 3 with `pip install edge-tts`** for the draft voice (`VK_PYTHON` names the interpreter, default
  `python`). `VK_TTS_PROVIDER=openai` with `OPENAI_API_KEY` switches to the commercial voice; nothing needs it.
- **The music assets**: `music/undertow/*.wav` are not committed. Either copy `music/undertow/source.strudel` into a
  strudel-bench checkout as `songs/undertow.strudel`, run `npm run headless -- songs/undertow.strudel` there, and
  `STRUDEL_BENCH=<dir> npm run music -- render undertow` here; or delete `video/music.json` to build without music.
  The watcher checkout (`../retire-sim/watcher`) is not needed for any video step.

```
npm run video -- narrate get-rich-quick decision:mlm-and-seminars     # cached per sentence; --regenerate to redo
npm run video -- timeline get-rich-quick decision:mlm-and-seminars
npm run video -- render get-rich-quick decision:mlm-and-seminars [--scene sc17 | --from sc10 --to sc20] [--force]
npm run video -- qa get-rich-quick decision:mlm-and-seminars
npm run video -- spike get-rich-quick decision:mlm-and-seminars       # the four above
npm run video -- package get-rich-quick decision:mlm-and-seminars     # video/review/
npm run validate                                                      # typecheck, lint, format, build, tests
```

What invalidates what: a sentence's text, the voice or the rate regenerates that sentence's audio; a storyboard scene
or the component that draws it re-renders that scene's chunk; anything in `music.json`, a variation's bytes or a
scene's timing re-mixes the audio; nothing else touches the chunks. No step reads a file outside the repo except
the strudel-bench checkout when regenerating music.

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
