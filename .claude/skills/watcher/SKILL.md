---
name: watcher
description: Drive the watcher library — turn a list of YouTube videos into a knowledge store about their topics (canonical claims, verdicts, video and channel scores) using this agent as the brain. Use when the user gives YouTube URLs or a queue file and wants to know what the videos claim, what is right or wrong, which are worth watching, or what they have not learned yet. Consumer skills (e.g. retire-sim's theory-test) wrap this loop and add their own empirical verdicts.
---

# Watcher

You are the model. The CLI is the plumbing: it fetches transcripts, keeps the
store valid, finds near-duplicate claims, and computes the report. Every
command takes `--store <dir>` (default `./knowledge`). Run from the repo root
as `npm run watcher -- <command>` (or `npx tsx watcher/src/cli.ts`).

Inputs the user may give: a URL list or file, known topic ids (pass to
`newTopics` only if the store is empty — otherwise they're already in
`topics.json`), a `--sources <dir>` folder of reference material.

## Loop

1. **Fetch.** `fetch <url|file> [--origin feed|suggested|manual]`. Exit 2 lists
   videos with no captions: tell the user, who can paste text →
   `fetch --text <file> <id>`. List files ignore blank and `#` lines and note
   (on stderr) any line without a video id. A non-YouTube URL (blog post,
   essay, article) is fetched as an `article` source: its readable text
   becomes the transcript and its id is a slug of host + path
   (`htmx.org/essays/code-is-cheap` → `htmx-code-is-cheap`); extract and judge
   it like a video. Other text (a pasted conversation, a paywalled page) is
   added with
   `fetch --text <file> <kebab-slug> --title "<t>" [--channel <c>] [--url <u>]`.
2. **Extract.** `next --json`. Entries in `needFetch` have a record but no
   cached transcript file (fresh clone: the cache is gitignored) — run
   `fetch <id>` for each first. For each entry in `extract`, in order
   (`skipSuggested: true` means the channel has ≥2 harmful videos — ask
   before spending time on it):
   - Read the transcript file (`transcript` path).
   - Pick the primary topic from `topics.json` ids, or name a new kebab-case
     one in `newTopics`.
   - List the distinct, testable claims the video makes (not every sentence —
     the 3–10 assertions a viewer would walk away believing). First run
     `claims list --topic <topic>` once per video and read it; for each
     assertion reuse an existing id whenever the meaning matches, even if
     worded differently, else `newClaim`. `claims find "<text>"` is a
     shortcut for a big catalog, not the judge. Say `denies` when the video
     argues against a claim.
   - Write the batch (schema below) to a scratch file, `record <file>`. On a
     near-duplicate rejection, reuse the suggested id or set `force: true`
     only when the meaning really differs. `record` warns if re-extraction
     discarded verdicts — stop and tell the user if you did not intend that.
3. **Judge from prior.** `next --method prior --json`. One batch per video:
   for each `judge` entry a verdict `right|wrong|partly|untestable|unknown`,
   a `confidence` 0–1 (required for right/wrong/partly), a one-line `note`
   with the reason. `partly` = right mechanism, wrong dose/timing.
   `untestable` = framing, motivation, taste.
4. **Judge from sources** (only if a sources folder was given).
   `next --method source --sources <dir> --json`. Grep the listed files for
   each claim's key terms before reading whole files. Record a `source`
   verdict only where a passage actually bears on the claim, with
   `source: "<file>#L<start>-L<end>"` and the passage's gist in `note`.
5. **Report.** `report` for the human; `report --json` for a consumer.
   Lead with Surprises and Commonly wrong; then worth-watching per video.
6. **Changed minds.** When a later source shows its speaker reversing a
   position from an earlier source in the store (they say so, or now assert
   the opposite; not mere refinement), run `supersede <old-id> <new-id>`.
   The old source stays listed but stops counting; evidence on it still counts.

Evidence belongs to the claim: a verdict recorded on any video's assertion
judges every video that makes that claim, so `next --method …` lists each
claim once. Among a claim's verdicts the one with the highest confidence wins
(a prior counts at most 0.5); ties go to the stronger method, and an
unknown/untestable never beats a real judgment.

## Batch schema

```json
{
  "video": "<id>",
  "topics": { "primary": "<topic>", "secondary": [], "newTopics": [{ "id": "<kebab>", "label": "..." }] },
  "assertions": [
    { "claim": "<topic>/<slug>", "stance": "asserts", "quote": "..." },
    { "newClaim": { "topic": "<topic>", "text": "one-line canonical wording" }, "stance": "asserts" }
  ],
  "verdicts": [
    { "claim": "<topic>/<slug>", "method": "prior", "verdict": "wrong", "confidence": 0.7, "note": "..." }
  ]
}
```

Any section may be omitted. `assertions` REPLACES the video's list; `verdicts`
append and must reference a claim asserted on that video. A verdict can only
name a claim id that already exists, so when assertions create new claims,
record them first and send the verdicts in a second batch using the printed
`created <id>` ids. A batch may also set
`"rating": -1|0|1|2` (a TESTED overall verdict on the video, e.g. a consumer's
simulator result; the report uses it as the video's score when present, so
never set it from opinion, or it hides the evidence) and
`"summary": "one line"`.

## Rules

- Never edit `topics.json` or `videos/*.json` by hand; go through `record`.
- Canonical claim text is one line, mechanism-level, no numbers that belong
  to one video ("Weight returns after stopping the drug", not
  "Two-thirds regained within a year of stopping").
- Keep personal data out of notes and claim text. The store is meant to be
  shared.
- Consumer skills add `method: "empirical"` verdicts the same way; the lib
  never knows what the test was.
