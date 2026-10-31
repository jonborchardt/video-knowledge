# video-knowledge

What YouTube videos and blog posts claim, checked against the evidence. For each topic it collects sources, extracts the distinct testable claims, judges every claim (an AI guess, then studies where they exist), and publishes which claims hold up and which sources are worth your time. Stores are built with the `watcher` library.

Site: https://commonwealthofreason.com/ (Cloudflare, `wrangler.jsonc`), mirrored for now at https://jonborchardt.github.io/video-knowledge/ (GitHub Pages, built with `DEPLOY_TARGET=pages`). The public site is **Commonwealth of Reason**; its YouTube channels are commissions (`commissions` in `src/config/site.ts`), each owning the topics whose videos it publishes. The first is [Commonwealth of Reason: Commission on Spending](https://www.youtube.com/@CORSpending). `video-knowledge` is the name of this repo and of the production tooling, not of anything a viewer sees.

The library lives in `../retire-sim/watcher`, which must be checked out next to this repo on a branch that has it (or point `WATCHER_DIR` at it).

## Setup

Node 22, `npm install`, and `pdftotext` (poppler) for step 5. The watcher checkout is only needed for the data scripts, not for building the site.

## One folder per topic, under topics/

```
topics/<topic>/
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
  story-review.json  optional, written by the review agent (src/modules/stories/briefs/stories.md); discover merges it
  scripts/<story slug>/  one generated script per story: evidence-package.json, script.json, script-review.json,
               validation.json, storyboard.json and the readable script.md, storyboard.md, review.md; commit them
  work/        scratch for agent batches (gitignored)
```

## Adding a topic

The agent does the reading and judging; the scripts do the bookkeeping. Steps 3–5 are written for Claude Code, which runs one agent per group of sources in parallel.

1. **Lists.** Create `topics/<topic>/videos.txt` (and `blogs.txt` if any). Mark later additions with a `# --- Batch N, <how they were found>` line so it's clear which sources came from where.
2. **Fetch.** `npm run watcher -- fetch topics/<topic>/videos.txt --store topics/<topic>/store`, then the same for `blogs.txt`. Videos without captions are reported and skipped. An article that comes out as junk can be attached by hand: `npm run watcher -- fetch --text <file> <id> --title "<t>" --url <u> --store topics/<topic>/store`.
3. **Extract.** Write the claims list (`npm run watcher -- claims list --topic <topic> --store topics/<topic>/store > topics/<topic>/work/claims.txt`), split the `extract` entries from `npm run watcher -- next --json --store topics/<topic>/store` into `topics/<topic>/work/grpN.txt` files (about 400k characters each), and give each group to an agent with `src/modules/evidence/briefs/extract.md`. Each writes `topics/<topic>/work/hN.json` with its claims, AI guesses and lean tags (the format is typed and checked in `src/modules/evidence/batches.ts`; `record` refuses a malformed file before writing anything).
4. **Merge and record.** Agents working in parallel can each create the same new claim. List those in a merges file (`{"<duplicate text>": "<existing-slug>" | "=<canonical new text>"}`), then:
   ```
   npm run merge-claims -- topics/<topic>/work/merges.json topics/<topic>/work/h*.json
   npm run record -- <topic> topics/<topic>/work/h1.json --label "<Topic label>"   # --label only on the very first batch
   npm run record -- <topic> topics/<topic>/work/h2.json                            # …and so on; --from <id> resumes
   ```
5. **Studies.** Put papers in `topics/<topic>/sources/` and convert them (`pdftotext -layout x.pdf x.txt`). Give each agent `src/modules/evidence/briefs/sources.md`, a few documents and the claims list. Each writes `topics/<topic>/work/sv_G.json`. Then `npm run record-sources -- <topic> topics/<topic>/work/sv_*.json`. When you add claims or documents later, only the new pairs need checking: new claims against all documents, and new documents against all claims.
6. **Changed minds.** If a speaker reverses an earlier position in a later source, run `npm run watcher -- supersede <old-id> <new-id> --store topics/<topic>/store`. The old source stays listed but stops counting.
7. **Institution.** Claim the topic in `commissions` (`src/config/site.ts`): an existing institution, or a new one whose channel a person has created (never an invented handle); a similar subject can be a second topic under another institution. Then `npm run brand`.
8. **Publish.** Optionally add `topics/<topic>/site.json` (copy `topics/ai-coding/site.json`: recap groups, bottom line, study display names). Then `npm run report && npm run validate`, check the page with `npm run dev`, and commit and push.

### How verdicts work

- Every claim gets an **AI guess** when it's created. It counts for at most 50% confidence, however sure the agent is.
- A **study verdict** replaces the AI guess when it is at least that confident; a weaker one is shown as context.
- Evidence belongs to the **claim**: a verdict counts for every source that makes the claim, including ones added later. Adding a source never needs re-judging old claims.
- A source's **score** comes from the verdicts on the claims it makes. Its **novelty** adds up the confidence of the claims it gets right, divided by how many other sources say the same.

## Story ideas and the evidence gate

`npm run stories -- discover <topic>` reads the topic's report and store (no watcher checkout needed), drafts
candidate videos, audits each against the recorded evidence, evaluates and ranks them and writes
`topics/<topic>/stories.json` (at most 12 videos listed, a chain's follow-up questions riding with their first question;
rejected candidates are listed with a reason). The dev server shows them at
`/<topic>/stories/` (the working pages in `src/admin/` are routed by `npm run dev` only, never built or deployed).

```
npm run stories -- discover <topic>              # draft, audit, evaluate, rank; writes topics/<topic>/stories.json
npm run stories -- show <topic> [story-id]       # the ranked list, or one story with its audit and cited passages
npm run stories -- validate <topic> <file.json>  # run the evidence gate on your own assertions (exit 2 if any is blocked)
```

Three layers, kept apart:

- **Deterministic** (`src/modules/stories/stories.ts` drafting, `src/shared/evidence-gate.ts` checks): five kinds of candidate are drafted
  (a popular claim a study contradicts, studies or sources that disagree, a study that overturned the AI guess, a widely
  repeated claim nobody checked, and the recap groups in `site.json` as decision stories), and every reference is
  verified. Ids are `<kind>:<claim slug>`, so a rerun is byte-identical and ids survive corpus changes.
- **Semantic judgment** (`topics/<topic>/story-review.json`, written by an agent following `src/modules/stories/briefs/stories.md`): does a
  study verdict decide _this_ sentence (`direct`, `partial`, `contextual`), do a candidate's claims answer one question
  (coherence score, pruned claim list, or rejection), and are the audit's qualifications carried into the narrative.
  Without a review, the validator falls back to conservative wording heuristics (a base rate is only context for a
  "can" claim; a verdict note that hedges its own scope is partial), and a multi-claim story cannot be `ready`.
- **Editorial** (the review's framing, else plain-question templates): the viewer-facing question, title and two
  alternates, why watch, the tension, the evidence needed and available, the gaps, and the arc. Kind names never
  appear in titles.

Each story carries a coherence score and separate scores (a script runs as long as its story needs, never padded): _editorial_ (mean of coherence, relevance, curiosity, stakes, depth, all corpus heuristics, never
audience data) and _evidence_ (strength of the studies behind the central conclusion, discounted when they only partly
apply). Overall is 0.6 editorial + 0.4 evidence, scaled by originality against higher-ranked stories. Readiness is
decided from the central conclusion and the essential findings, never from the scores: `ready` (coherent, verified,
nothing pending), `needs-review` (usable once a person settles the listed points), `needs-research` (essential evidence
missing), or rejected (incoherent, a variation of another story, a single-claim chapter of a reviewed multi-claim
story, or contradicted). A disagreement story is ready when the disagreement itself is verified; a story whose
strongest applicable study is below 0.5 confidence is never ready. Every non-ready story lists what blocks it.

One video can answer a chain of up to three questions. The reviewer sets `chain` (the follow-up story ids, in order)
and `chainWhy` on the first story; each chained story keeps its own claims and audit, the video is ready only when
every one is, chains do not nest, and a chained story is marked `partOf` the first and never produced on its own (the
board refuses it). A chained video carries at most 14 claims across its questions; a longer chain holds the first story
at `needs-review`. Its evidence package carries every question's own premise, tension, why-watch and arc, and the
`chainWhy`, so the writer frames each question from its own story. Discovery suggests `chainCandidates` for each ready
story outside a chain (ready stories sharing no claims, nearest in wording); the reviewer decides. A review entry for an
id discovery no longer drafts fails a test (`staleReviewIds`).

The validator (`src/shared/evidence-gate.ts`) takes an assertion (`fact`, `attribution` or `disagreement`), the canonical
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

A `ready` story becomes a narration script and a storyboard in `topics/<topic>/scripts/<story slug>/`. The code builds
the evidence package, checks the script and fills in the storyboard; three agent briefs do the writing and the
judging (`src/modules/script/briefs/script.md`, `script-review.md`; `src/modules/storyboard/briefs/storyboard.md`). Every stage persists its output, so a
rejected script is revised and rechecked without touching research or story discovery.

```
npm run script -- package <topic> <story-id>      # evidence-package.json: the story, its final claims, every passage, statement and gap
# an agent writes script.json from src/modules/script/briefs/script.md
npm run script -- validate <topic> <story-id>     # validation.json, script.md, review.md (exit 2 when blocked)
npm run script -- show <topic> <story-id> [s12]   # the reviewer's sheet: sentences, assertions, fingerprints, passages
# an independent agent writes script-review.json from src/modules/script/briefs/script-review.md, then validate again
# an agent writes storyboard.json from src/modules/storyboard/briefs/storyboard.md
npm run script -- storyboard <topic> <story-id>   # fills narration and timing, checks charts and citations; storyboard.md
npm run script -- run <topic> <story-id>          # every stage whose inputs exist, then the next agent step
npm run script -- lock <topic> <story-id> --approved-by "<name>"   # release.json: the approved fingerprints (passed + ok only)
```

A script is as long as its story needs, with no word target, and says each thing once. It has five sections: `hook`,
`setup`, `investigation` (each limitation beside the figure it limits), `answer` (once) and `takeaway` (what the viewer
can do). A chained story's package lists its `questions`, and its script is `hook`, `question-1` ... `question-N` and
`close`, each question section answering its own question once. The validator warns on pacing: `slow-start` (the
evidence starts after the first minute), `number-dense` (ten or more figures inside eight sentences) and
`repetition` (a sentence re-reading two or more figures the viewer already heard).

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
speaker attribution can be confirmed from), so `topics/<topic>/sources/*.txt` plus `topics/<topic>/scripts/<slug>/` is enough.

## Video

A validated storyboard becomes an MP4 in `topics/<topic>/scripts/<slug>/video/`. `render.json` (committed, written by
hand) names the contiguous scenes to render, the voice, the cues (which narration word each animation waits for), a
bespoke `kinds` entry for scenes the storyboard category alone does not identify (one scene's own diagram or
animation), and per-scene `options` (layout choices, never figures). Narration is one file per sentence, cached by
voice, rate and text, with the measured duration and word boundaries in `narration.json`. Providers: `edge`
(Microsoft neural voices through `pip install edge-tts`, free, draft only: no licence for published media) and
`azure` (the same neural voices through Azure AI Speech, commercial terms; `AZURE_SPEECH_KEY` and
`AZURE_SPEECH_REGION` in the gitignored `.env`; this is the release voice: `npm run video -- final` re-narrates an
accepted draft with it) and `openai` (commercial terms; `OPENAI_API_KEY`, word timestamps from its transcription of
the output, cost estimated in the manifest). The timeline tiles the scenes by the measured audio, never by the word-count estimate, resolves
every cue to the frame its word is spoken on, and reads each cited excerpt from the corpus. The composition is
Remotion (React components in `src/modules/video/remotion/scenes/`; the closed kind records in `src/modules/video/kinds.ts`, with
each video's bespoke kinds registered in `src/modules/video/bespoke/`). Scenes render one at a time into cached chunks
(`video/scenes/`, keyed by the scene and the code that draws it: the component and every helper it imports by value, however
deep, each normalised with its type-only imports removed; that normalisation moved every chunk key once, a cache
re-render, never an approval), the chunks are concatenated without re-encoding (`src/modules/video/assemble.ts`), and the narration is laid down as one
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
chunks, frames, contact sheet and mp4 are ignored. The production board (`/admin#board` on the dev server) reads the build report: a
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
glitches, conclusion, local vs YouTube playback), the build report, a `thumbnail.png` from the title card, `captions.en.srt`
(one cue per sentence from the measured timeline), and `review.json` (which build report it was made from; the board calls it stale when that changes). It refuses an mp4
other than the one QA checked (the build report records its sha), and chapters YouTube would ignore: fewer than
three, one under 10 s, or a scene not in the timeline. The description fits YouTube's 5000 bytes: the sources
discussed are one link to the topic page. Upload it privately with `npm run publish -- upload <topic> <story-id>`
(or by hand, then `npm run publish -- uploaded <topic> <story-id> --id <youtube id>`). The package says in every file that it is a review build and why public
release is blocked; the Edge voice keeps it blocked. When you accept the draft, run

```
npm run video -- final <topic> <story-id> --approved-by "<name>"
```

which re-narrates the same words with Azure Speech (the same neural voice under commercial terms), re-renders, re-runs
QA and writes the **release build** to the same `video/review/`: the mp4 as `<slug>.mp4`, the real title, a
description without the review notice, the voice or the clearance line, no draft-voice item on the checklist, and a
`## Release build` line appended to `run-report.md`, and records the acceptance in `publish.json`. The board then
walks the release upload, approval and publication (see Publishing below). Any later edit renders a draft again, so
`final` runs once more before a re-upload; a live video is never rebuilt or replaced.

## Shorts

A produced video can spawn vertical Shorts: one finding each, with its own hook and a close that points at the full
inquiry, rendered 1080x1920 in the Commonwealth look with the institution's badge, the format eyebrow and burned-in
captions (`brand/design.md` 2.6). A Short is a nested production, `<story-id>/shorts/<slug>` in
`topics/<topic>/scripts/<story slug>/shorts/<slug>/`, and goes through the same stages, briefs and CLIs as a video.

```
npm run shorts -- discover <topic> <story-id>     # shorts.json: one candidate per finding scene of the produced video
# an agent writes shorts-review.json from src/modules/shorts/briefs/shorts.md (keep, slug, format, hook, carries), then discover again
npm run shorts -- show <topic> <story-id> [key]   # a candidate with its sentences, qualifications and passages
/produce <topic> <story-id>/shorts/<slug>         # package, writer, reviewer, storyboard, lock, render, qa, package: the same loop
```

The Short's evidence package is a filter of the parent's: the claims its finding uses and a `short` block (the hook,
the format, how each qualification the parent carried elsewhere is said inside the Short, the cap, the parent's
fingerprints), so a parent revised, re-locked or re-reviewed stales the Short. The script has three sections (`hook`,
`finding`, `close`); the validator blocks an assertion on a claim outside the package, a qualified assertion that no
sentence of the Short carries, and a figure in the close; the storyboard blocks past 170 s and QA fails a measured
Short over 180 s (YouTube's rule). Shorts draw with a closed portrait vocabulary (`short-title`, `short-question`,
`short-list`, `short-quote`, `short-stat-tiles`, `short-bar`, `short-excerpt`); anything else fails the render
check. The review package has no chapters, a `#Shorts` description with the full inquiry's link, and its own captions.

Packaging records the Short as the output `short:<slug>` in the parent's `publish.json`, derived from the main video,
so `npm run publish -- <verb> <topic> <story-id>/shorts/<slug>` works on it; it may be uploaded privately any time but
goes public only after the parent is live. YouTube classifies any square or vertical upload up to three minutes as a
Short; the related-video link has no API and is set in YouTube Studio, then recorded with
`npm run publish -- updated ... --fields relatedVideo`.

## Production board

The Board, Stages, Pipeline and Artifacts tabs of `/admin` on the dev server (never on the public site) show what stage every topic, story and script is in. Everything on them is derived at
build time by `src/orchestration/production.ts` from the committed files: the research pipeline per topic (sources listed vs
fetched, fetched vs extracted, documents vs recorded verdicts, report vs store, stories.json vs a fresh `discover`,
candidates reviewed), each story's readiness, and for each `topics/<topic>/scripts/<slug>/` the health of every artifact.
"Current" means re-running the library on today's inputs reproduces the file, the same test `lock` applies
(`buildPackage`, `validateScript`, `buildStoryboard`, `releaseCheck`); "stale" means it would not; "pending" means an
agent step is owed; "blocked" means the gate says so. Each row names the next command or brief. There is no state
machine: the stage is the first artifact that is missing or not current.

The board has one card per video (a chain is one card listing its follow-up questions and total claims; follow-ups get
no card), in a column for whoever acts next: needs research, needs review, ready to produce, in production (`/produce`
is on it; the strip on the card shows the stage, red means it stopped and a person must act), your review (a private
package is made), changes requested, uploaded, approved, scheduled, published and parked.

The one hand-written input is `production.json` at the repo root, for planning decisions no artifact records:

```json
{
  "get-rich-quick/decision:selling-online": {
    "decision": "parked",
    "note": "no study bears on it",
    "date": "2026-10-18"
  }
}
```

`decision` is `queued` (produce this next) or `parked` (with the reason). Keys must name a story in that topic's
`stories.json`; the build fails otherwise. The board keeps three things apart: technical readiness (the stage, from the
artifacts), publishing state (from `publish.json`, below) and licensing clearance (from the build report: the voice's
licence and each composition's `cleared`), so a card can be `packaged` and still say "public release blocked".

## Publishing

Publishing adds things no production artifact records: who approved which build, what was uploaded where, what is
scheduled, what is live, what failed. They live in `topics/<topic>/scripts/<slug>/publish.json`, one per video: per
output (the YouTube video, later a short, a blog post, a page) an append-only event log and a person's metadata choices
(tags, a better title, a hand-made thumbnail). `npm run publish -- <verb> <topic> <story-id>` writes the events; the
`metadata` block may be hand-edited. Builds are named by the mp4 sha the QA checked, metadata by the sha of the
composed title, description, tags and thumbnail sha, so a thumbnail swap is an `updated` event, never a re-render.

**The review page.** On the dev server, `/<topic>/review/<slug>` (or `/<topic>/review/<slug>/shorts/<short>` for a
Short; the board's "Watch and review" link) plays the packaged build streamed from disk (it is never copied into the
site or git), lists every failed QA check, validation issue, review finding and pacing warning with a link to its moment,
and does every step below from buttons: approve (every checklist item ticked, a person's name), request changes (one
note per line, `[m:ss sc20 s31]` places it; "Note at current time" stamps the player's position), accept a draft
(`video final`), upload privately, push, sync, verify, go live now or at a time (a confirmation box). Each form carries the
build it judged and is refused if a newer build was packaged since. Long verbs run the CLI in the background; the page
shows the job and its log. A change request (`request-changes`) moves the card to "changes requested" and its
send-back prompt carries the notes; an approval binds the build **and** the title, so a new render or a changed title
asks again. No automated run approves or goes live.

The flow, as the board's next step walks it (every step is one `npm run publish -- <verb> <topic> <story-id>`):

1. Draft packaged: `upload` sends `video/review/<slug>-review-private.mp4` to YouTube **privately** with the title-card
   thumbnail and the captions, and records `uploaded`.
2. Watch it with `checklist.md`; `npm run video -- final --approved-by "<name>"` accepts the draft (recorded as
   `approved` for the draft build) and packages the release build.
3. `upload` again (the release build is a new private video; the draft's id is kept as superseded), watch it, then
   `approve --by "<name>" --checked <n>` (n: the checklist items ticked; every one is needed). Only an approved
   build may go public.
4. `go-live` makes it public now and reads the video back: it records `published` only when YouTube says public,
   else a `failed` event naming the Studio route (below) and exit 1. `go-live --at <ISO>` schedules it (YouTube
   keeps it private until then; at least five minutes ahead). After the time, `sync` reads YouTube and records
   `published`; a schedule more than 15 minutes past with the video still private is a `failed` event.
5. Later changes to the title, tags, thumbnail (`thumbnail <file>`) or the `metadata` block: `push` sends them and
   records `updated`. A live video is never replaced: a re-release is a new output, `add <id> --kind youtube-video`.
6. After any upload, push or go-live, `verify` checks what YouTube holds against the package (below).

A Short is another output of the same ledger: `add short-1 --kind youtube-short --from youtube --source <file>`,
then the same `upload`, `approve`, `go-live`. Shorts are made and approved before the full video launches, and
they launch together: the video goes live first, its Shorts right after (`go-live` refuses a Short before its video). Its description links the full
video once that is live (so its metadata is pushed once more); the related
video is set in YouTube Studio (the API has no field for it).

`show` prints the state, the composed upload metadata (with the `description:` to paste into Studio) and the event
log. Every verb is idempotent (an event already
recorded prints and exits 0) and refuses, without writing, what the files do not support (exit 2). The hand verbs
(`uploaded --id`, `scheduled --at`, `published`, `updated --fields`) record what was done in the browser instead.

### YouTube

Once, by a person (Google's console; nothing here can do it):

1. Create or pick a Google Cloud project and enable the YouTube Data API v3.
2. OAuth consent screen: external, publishing status **In production** (a screen left in Testing issues refresh
   tokens that expire after 7 days), scope `https://www.googleapis.com/auth/youtube.force-ssl`. In production
   without OAuth verification, Google shows the unverified-app warning at consent and caps the project at 100 users
   over its lifetime, which one owner never reaches; accept the warning once. Run `auth` again after switching from
   Testing, so the stored token is one without the 7-day expiry. Branding: homepage
   `https://commonwealthofreason.com/publishing/`, privacy policy `https://commonwealthofreason.com/privacy/`
   (with the trailing slash: the slashless URL redirects, and Google refuses a homepage that redirects), authorized
   domain `commonwealthofreason.com`.
3. Create an OAuth client of type **Desktop app** and download its JSON. Save it as `.secrets/youtube-oauth.json`
   (`.secrets/` is gitignored) and point `.env` at it: `YOUTUBE_OAUTH_CREDENTIALS_PATH=./.secrets/youtube-oauth.json`.
   (`YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in `.env` work too.)
4. Verify the channel by phone (youtube.com/verify) so custom thumbnails are allowed.
5. `npm run publish -- auth <topic> <story-id>` opens the consent page and stores the refresh token in that same
   JSON file (mode 0600; without the path variable, in `.youtube-token.json`). A refresh token in `.env` as
   `YOUTUBE_REFRESH_TOKEN` is used instead when set.

What the API does and costs (https://developers.google.com/youtube/v3/determine_quota_cost, checked 2026-10-27 for
list and set): `videos.insert` is 1 of 100 calls per project per day in its own quota bucket (since 2026-06-01);
`thumbnails.set` 50, `captions.insert` 400, `videos.update` 50 and `videos.list` 1 unit of the 10,000 a day for
everything else, so one video is about 500 units and all 18 fit in a day. Google's `videos.insert` reference
(2026-10-15) says uploads from unverified API projects are **not** restricted to private viewing, while its 2020
revision note says they are until the project passes an audit; nothing here assumes either. `go-live` believes only
what YouTube reads back, and a video YouTube keeps private goes out through Studio (below). `publishAt` only works on a never-published private video; a past
time publishes immediately, which is why `go-live --at` refuses anything under five minutes ahead. There is no Shorts
flag: a vertical or square video up to three minutes is a Short.

Recovery: every API success is recorded before the next call, and `upload` writes `video/upload-session.json` (the
resumable session) before the first byte and deletes it after the ledger has the id, so a crash, a quota refusal or
a network drop is a `failed` event with `retryable` and the same `upload` resumes the same YouTube video. A session
YouTube no longer knows is a final failure: look for the title in Studio and record it with `uploaded --id`, or delete
the session file to upload again. `sync` reconciles what happened on YouTube (rejected, deleted, gone public).

`verify` reads the video back and checks it against the approved package and the ledger, for an API upload, a Studio
upload recorded by hand and a Short alike: it exists, the upload and processing finished, the privacy (and schedule) is
what the ledger says, an anonymous request reaches it only when it should (YouTube's oEmbed: 200 is reachable without
signing in), the title, description, tags, category and language are the composed ones, the description's chapter
lines are the measured chapters, nobody marked it made for kids or changed the altered-content answer, no age, region,
embedding or licence restriction is set, a custom thumbnail is set (the API cannot return the image), an English
standard captions track is serving, and the uploaded file's size is the packaged mp4's (the build binding for a Studio
upload; the API offers no hash). It costs one `videos.list` unit plus 50 for `captions.list` when the package has
captions; oEmbed is free. Each check is `pass`, `fail`, `pending` or `skip`, and the run is recorded once per distinct
outcome as a `verified` event holding the check names, results and our own reasons, never YouTube's values (API data may
not be kept; the CLI prints them live). `RESULT: PENDING` means YouTube is still processing or syncing, or the
anonymous request had no network: run `verify` again later. `RESULT: FAILED` (exit 1) names the checks: a failed
metadata or captions check makes the next `push` resend them (a captions track that is not serving is deleted and
replaced, never added to: 100 more units); fix anything else in Studio (then `updated --fields`).
A verification never changes the output's status or hides a failure.

#### Publishing through YouTube Studio

The route when the API keeps a video private, or by choice. In this order:

1. `npm run video -- final <topic> <story-id> --approved-by "<name>"` makes the release build.
2. `npm run publish -- show <topic> <story-id>` prints the title, the tags and the `description:` block to paste.
3. In YouTube Studio, on the institution's channel, upload exactly `video/review/<slug>.mp4` as **Private**. Paste the
   title, description and tags. Set the thumbnail to `video/review/thumbnail.png`. Under Subtitles, upload
   `video/review/captions.en.srt` as English. Set "No, it's not made for kids", the altered-content answer to the
   ledger's `containsSyntheticMedia` (default No), and the category to Education.
4. `npm run publish -- uploaded <topic> <story-id> --id <id> --captions` records it against the build on disk
   (`--captions`: the package's captions went up with it, so a later `push` does not add a second track).
5. Watch it, then approve on the review page, or `npm run publish -- approve <topic> <story-id> --by "<name>"
--checked <n>`. The approval names the latest upload of the build.
6. Either `go-live` (the API makes it public and the read-back confirms it), or set Public or a schedule in Studio
   and record it with `published` or `scheduled --at <ISO>`, or let `sync` observe it.
7. `npm run publish -- verify <topic> <story-id>`; on `PENDING` run it again once Studio shows processing finished.
8. A Short: the same steps with `<story-id>/shorts/<slug>`, after its video is live.

A metadata change made in Studio afterwards is recorded with `updated --fields <list>`. An earlier API upload of the
same build stays in the log; leave it private, or delete it in Studio.

#### API compliance

An audit (https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) comes before any quota beyond
the default and may be what lifts a private lock; it runs alongside Studio publication, which needs none. The form is
https://support.google.com/youtube/contact/yt_api_form (appeals: https://support.google.com/youtube/contact/yt_api_appeals).
It asks for:

- **Organisation:** name ("self" for an individual), an https website, legal address, category, size, contacts.
- **Business model:** the work as it relates to YouTube (100 characters or more), audience, monetisation (a free
  service), Google representative and Content Owner or Ads ids (none).
- **API client:** a name without "YouTube", the access URL, the **privacy policy URL** (`/privacy/` on the site, which
  also holds the terms), whether it is public, and demo credentials or an end-to-end screencast.
- **Per Cloud project:** the project number, the use case ("Video Uploading & Account Management"), OAuth (yes),
  volume (under 1,000 requests a day), the endpoints (`videos.insert`, `videos.update`, `videos.list`,
  `thumbnails.set`, `captions.insert`, `captions.list`) and the quota (the default is enough).
- **Evidence (720p or larger, address bar visible, one file under 10 MB each):** the privacy page showing its YouTube
  sections, the Google Privacy Policy link and what is kept; the home page showing the footer's Privacy link beside the
  channel links; the terms; the consent screen, scopes and revocation; for uploading, the upload script
  (`src/modules/publishing/uploader.ts` with `src/modules/publishing/cli.ts`, public in this repository) or a screencast.
- **Attestations:** the YouTube API Services Terms of Service, the Google Privacy Policy, the Developer Policies,
  termination and accuracy.

The privacy policy must (Developer Policies III.A, https://developers.google.com/youtube/terms/developer-policies) be
always reachable, say the client uses YouTube API Services, link the Google Privacy Policy
(http://www.google.com/policies/privacy), say what user data is accessed, stored, used and shared, disclose third-party
content and device storage, link the revocation page (https://security.google.com/settings/security/permissions),
give a contact, and link the YouTube Terms of Service (https://www.youtube.com/t/terms) with the statement that users
agree to be bound by them. `/privacy/` does all of it; change it with the code it describes. Stored API data is
refreshed or deleted within 30 days and deleted when access is revoked (III.E.4): the ledger keeps only ids and our own
events.

## Producing a story

On the board, a story that is not yet `packaged` offers one prompt first in its "What next?" popover:

```
/produce <topic> <story-id>
Approver: <your name>
```

Paste it into a Claude Code session in this repo (fill in your name) and leave. The `/produce` skill
(`.claude/skills/produce/SKILL.md`) works on its own branch, `produce/<topic>-<story slug>`, and loops on
`npm run board -- next <topic> <story-id> --json`: it runs each command the board names and hands each brief to a
fresh agent (the writer and reviewer, the graphics builder and visual reviewer, are never the same agent). Between
`storyboard` and `lock` the board's `graphics` stage drafts `video/render.json` (`npm run video -- init`), has a
bespoke component built for each diagram or animation (`src/modules/video/briefs/graphics.md`), judged from its frames by
another agent (`src/modules/video/briefs/visual-review.md`), and requires a current `npm run video -- check`. After the lock it
renders, drafts the cue sheet (`npm run music -- cues`), mixes, runs QA and makes the review package.

It ends one of two ways: **packaged** (committed after `npm run validate`, never pushed, with
`video/review/run-report.md` listing every judgment call: evidence added, revisions, graphics, music, the QA result),
or **stopped** (nothing committed; the stage, the open problem and what would unblock it). A missing passage goes to
an evidence agent (`src/modules/evidence/briefs/evidence.md`) rather than a weaker sentence; a writer pass that spends its three
revisions with blocking findings open stops the run.

On a `packaged` story the popover offers the send-back prompt instead, ending in `Notes:`; each note goes to the
artifact that owns it (wording to the script, a graphic to its component, pacing and music to `render.json` and
`music.json`) and everything downstream is redone. The board binds a build to the script, storyboard and
`render.json`, so a pacing note re-renders by itself; a revised graphic is re-rendered by the run after its visual
review (only the changed scene chunk renders again).

## Reproducing a video

A fresh checkout plus these makes a story's `topics/<topic>/scripts/<slug>/video/segment.mp4` again:

- **Node 22+** (`npm ci`); Remotion downloads Chrome on the first render. The ffmpeg and ffprobe used everywhere
  are the ones in Remotion's compositor package; `FFMPEG_DIR` overrides the directory.
- **Python 3 with `pip install edge-tts`** for the draft voice (`VK_PYTHON` names the interpreter, default
  `python`). The release voice needs `AZURE_SPEECH_KEY=...` and `AZURE_SPEECH_REGION=...` in `.env` at the repo root
  (gitignored; `src/modules/video/cli.ts` loads it); only `npm run video -- final` uses it.
- **The music assets**: `music/undertow/*.wav` are not committed. Either copy `music/undertow/source.strudel` into a
  strudel-bench checkout as `songs/undertow.strudel`, run `npm run headless -- songs/undertow.strudel` there, and
  `STRUDEL_BENCH=<dir> npm run music -- render undertow` here; or delete `video/music.json` to build without music.
  The watcher checkout (`../retire-sim/watcher`) is not needed for any video step.

```
npm run video -- narrate <topic> <story-id>                           # cached per sentence; --regenerate to redo
npm run video -- timeline <topic> <story-id>
npm run video -- render <topic> <story-id>                       [--scene sc17 | --from sc10 --to sc20] [--force]
npm run video -- qa <topic> <story-id>
npm run video -- spike <topic> <story-id>                             # the four above
npm run video -- package <topic> <story-id>                           # video/review/
npm run validate                                                      # typecheck, lint, format, build, tests
```

What invalidates what: a sentence's text, the voice or the rate regenerates that sentence's audio; a storyboard scene
or the component that draws it re-renders that scene's chunk; anything in `music.json`, a variation's bytes or a
scene's timing re-mixes the audio; nothing else touches the chunks. No step reads a file outside the repo except
the strudel-bench checkout when regenerating music.

## Website

An [Astro](https://astro.build) site with Tailwind. Each topic with a `report.json` becomes a page (`src/pages/[topic]/index.astro`), linked from a home page. Pages are rendered at build time; the only client script is the tab bar and the claim search.

```
npm run report     # refresh topics/<topic>/report.json from the stores (needs the watcher checkout, so run locally)
npm run stories -- discover <topic>   # refresh topics/<topic>/stories.json from the report and store
npm run dev        # live preview at http://localhost:4321/ (DEPLOY_TARGET=pages for the /video-knowledge/ mirror)
npm run build      # build dist/
npm run validate   # typecheck + lint + format check + build + tests (what CI runs)
npm run format     # prettier --write
npm run quality    # web-quality gate for site changes (build, static checks, browser suite); -- --audit for the full audit
```

Pushing to `main` runs `.github/workflows/pages.yml`: `npm ci`, `npm run validate`, `npm audit` of shipped dependencies, the browser suite in Chromium, Firefox and WebKit, then deploy `dist/`. What each check enforces and what still needs a person: `.claude/skills/web-quality/reference/enforcement-matrix.md`.

Rehearsing a go-live: the public build shows only stories with a live video, so the live-only templates and tests meet real content only at the first go-live. `npm run rehearse -- <topic> <story-id> [--keep]` copies the working tree (tracked and untracked files, not gitignored ones) into a temp folder outside the repo, junctions `node_modules`, writes a fixture `published` event (video id `REHEARSAL00`) into the copy's `publish.json`, and runs the go-live sequence there (`report -- seed`, `brand`, `build`, `links -- freeze`, `quality -- --no-build` with every page checked). The real checkout is never written. It prints `RESULT: PASSED` or `RESULT: FAILED (<step>)` and refuses (exit 2) a follow-up, a story already live or one not packaged. `DEPLOY_TARGET=pages` rehearses the mirror; `--keep` leaves the copy to preview (`npm run preview` in it).

### Refreshing a dataset

A dataset (`topics/<topic>/data/<id>.json`) needs a refresh when `src/modules/evidence/tests/datasets.test.ts` fails with "refresh it", which it does once the dataset's `retrieved` date is older than `DATASET_MAX_AGE_DAYS` (`src/modules/evidence/datasets.ts`), or when EIA publishes a newer full year of prices (the Electric Power Annual and the Natural Gas Annual).

The new figures come in as a new source document. A source agent (`src/modules/evidence/briefs/sources.md`) writes `topics/<topic>/sources/eia-<year>-state-residential-energy-prices.txt` in the same layout as the current one: line 1 names the tables and ends `(retrieved YYYY-MM-DD)`, Parts 1 and 2 hold the raw prices, and the derived section shows its method. It never edits the old file, whose cites stay valid for everything that already cites it.

The document enters the corpus through `npm run record-sources -- <topic> topics/<topic>/work/sv_*.json`, with a verdict on `heat-pumps/whether-heat-pump-cheaper-run-gas` that cites the method lines, as `topics/heat-pumps/work/sv_A.json` does for the current file. The store is never hand-edited. Then run `npm run report`; if the claim's finding changes, it prints the revision that needs a `note`.

Then rewrite the dataset: its cites point into the new file, and `asOf` and `retrieved` say what the new file says. Point the tool's own cites (`src/tools/heating-cost/spec.ts`: `justification`, `afue`, `cops`, `latest`) at the new file as well, and update `latest.value` to the new file's figure. Rewrite the period in `priceNote`'s wording there ("January to July 2026 electricity and 2025 gas prices") to the new file's, and in `tests/tools.test.ts` update the expected note and the `3.60` in the `latest` passage check to the new file's values. A `retrieved` date after today fails `datasetProblems`.

Check with `npx vitest run tests/datasets.test.ts tests/tools.test.ts`. The recompute test in `tests/tools.test.ts` reads the raw columns by line range: update the ranges and the file name for the new file, never the expected arithmetic. Then run `npm run validate` and `npm run quality`.

A new verdict can change the story's evidence package on its next `npm run script -- package`, and the board then says what to re-bind. A changed finding makes released articles stale, and `npm run board -- next` names the article step.

The data scripts (`report`, `record`, `record-sources`, `watcher`) run the watcher CLI from `../retire-sim/watcher` (or `$WATCHER_DIR`). It isn't an npm dependency, so CI, which only builds the site, doesn't need it.

The watcher's agent contract is `.claude/skills/watcher/SKILL.md`, a copy of `../retire-sim/watcher/SKILL.md`. Re-copy it when the library changes.
