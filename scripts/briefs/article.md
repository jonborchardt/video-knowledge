# Brief: write the companion article

Give an agent this file plus the topic id and story id. The agent reads
`topics/<topic>/scripts/<slug>/evidence-package.json`, the passages it cites in `topics/<topic>/sources/`, the
approved `script.json` and the `storyboard.json` beside it, writes `topics/<topic>/scripts/<slug>/article.json`,
and runs `npm run article -- validate <topic> <story-id>` until the deterministic checks pass. An independent
reviewer (`scripts/briefs/article-review.md`) then judges the wording and writes `article-review.json`; the writer
never writes or edits that file. Nothing here adds evidence: if the package cannot support a sentence, the
sentence changes, not the evidence. The `<slug>` is the story id with `:` replaced by `-`
(`decision:is-it-cheaper-to-run-than-gas` lives in `decision-is-it-cheaper-to-run-than-gas/`).

## Inputs

- **`evidence-package.json` is the only factual source.** Claims, their verdicts and notes, the statements (who
  said what), the study passages and their roles, the gaps. A fact not in it does not go in the article.
- **`script.json` is framing only:** which questions the video asks, in what order, what it already explained.
  Do not copy its sentences: the article is a new text for a reader. The validator warns
  (`transcript-overlap`) when a section shares more than 30% of its 8-word runs with the narration. Its
  verified assertions (text, claims, evidence, calc, quote) may be reused as they are; its sentence wording may
  not.
- **`storyboard.json` is the list of figures:** each scene with a `visual.chart` can be shown by reference. Never
  copy its points into a figure; a table carries its own cited cells.

Before writing, do what the script brief asks: for every study you use, find in the package its baseline, its
population, its period and its measure. A sentence that compares two findings compares them on the same baseline;
a baseline the package does not give is a gap, not something to infer.

## When the evidence is missing

If a finding the article needs rests on a passage the package does not have, do not write around it with a
vaguer sentence. Add an entry to `generation.needsEvidence` and stop:

```json
"needsEvidence": [
  { "claim": "<topic>/<slug>", "why": "the bill figures' baseline is not in the package", "hint": "topics/<topic>/sources/<file>.txt" }
]
```

A separate evidence agent records what decides it and rebuilds the package. When you revise against the rebuilt
package, remove the field. If the gap could not be closed, say in the sentence that the evidence cannot answer.

A limit that only a verdict note carries (no cited passage states it) cannot be stated as fact: narrow the
sentence so it does not need the limit, or set `needsEvidence` when the article cannot stand without it. A
conflict of interest or an affiliation goes in the article only when a cited passage carries it; otherwise leave
it out, and do not stop for it.

## What an article adds

The video is heard once, in order; the article is scanned, searched and quoted. Write for that:

- **Headings a reader can scan.** Each section has a `heading` that says what the section answers, in the
  reader's words ("What a typical household saves", not "Investigation"). A question section's heading is its
  question.
- **Every figure in a table**, with its unit and its cite. The prose says what the numbers mean and names the
  one or two that carry the argument; the table holds the rest. Show a storyboard chart as a `figure` where
  it says it better than a table.
- **Every qualification and every unresolved question in full**, as a callout (below). The video carried them in
  a clause; the article states the condition the verdict note gives.
- **No narration read back.** Say each thing once, as in the script: a figure is given where it is first needed
  and pointed back to in words after that.
- **No URL anywhere** (prose, headings, captions, headline): sources are linked from cites when the page renders.

## Sections

The section names are the script's, from the package: `hook`, `setup`, `investigation`, `answer`, `takeaway`;
for a package with `questions`, `hook`, `question-1` ... `question-N` (one per question, in the package's order),
`close`. Use exactly those names, in that order. In a chained article each question section answers its own
question with that question's `claims` (the validator blocks a question section that asserts none of them), and
frames itself from that question's own `premise`, `tension` and `arc`; the `close` ties the answers together and
answers nothing again.

- `hook`: the question and why it matters to the reader. It may say where the answer lands; it does not lay out
  the figures.
- `setup` (or the opening of each question section): the belief, attributed to the sources that hold it.
- `investigation`: the evidence, a piece at a time, each limitation beside the figure it limits.
- `answer`: the answer once, as precisely as the evidence allows, and what the evidence cannot say.
- `takeaway` / `close`: what a reader can do with it. No new figures.

## Metadata

`meta` holds four fields; the validator blocks any over its limit (`LIMITS` in `src/lib/article-validation.ts`):

- `headline`: the on-page h1, at most 90 characters. It may differ from the video's title.
- `seoTitle`: the title tag, at most 60 characters (the site adds its suffix).
- `dek`: one or two sentences under the headline, a `Sentence` with id **`meta.dek`**. Not empty.
- `description`: the search snippet, at most 155 characters, a `Sentence` with id **`meta.description`**.

The dek and the description are sentences like any other: typed, with an assertion per claim they state, and
reviewed. None of the four may state a figure that is not in a cited passage, and none may claim more than the
labels allow: a claim that is a Qualified claim is never summarised as a flat yes or no, an Unresolved one is
never summarised as settled, and a Reported one is what sources say, not what is true.

## Sentences

Prose sentences are typed and asserted exactly as in the script brief (`scripts/briefs/script.md`, "The file"):

- `type`: `factual` (offered as true), `attributed` (reports what a source said), `hypothetical`, `rhetorical`,
  `transitional`. A factual or attributed sentence needs at least one assertion; the other three carry no figure
  and no fact.
- One assertion per independent claim; every figure in the sentence is in an assertion as digits and in the
  cited passage. `kind: "fact"` takes `study` evidence; `kind: "attribution"` takes `statement` evidence.
  `calc` for a derived figure, `quote` (with `speaker` when the text names one) for a quotation, as in a script.
- **A claim no study has decided (the label Reported) is stated `attributed`, never `factual`** ("installers
  say ...", "several videos claim ..."). What the validator enforces is the assertion: a `kind: "fact"` on such
  a claim has no study verdict to cite and blocks (`bad-reference` or `unsupported`); only `kind: "attribution"`
  with `statement` evidence passes. The sentence `type` itself is the reviewer's to check.
- **An assertion's `stance` agrees with the claim's verdict.** Asserting a claim the evidence judged wrong (or
  denying one judged right) blocks as `contradicted`; state it with `"stance": "denies"`, or attribute it.
- **Number words are figures** (`src/lib/numbers.ts`): "two", "one in", "fourteen percent" are checked like
  digits. Keep them out of `hypothetical`, `rhetorical` and `transitional` sentences, which carry no figure.
- **A quotation is one unbroken run:** `quote.text` must appear in the sentence word for word, not split around
  an inserted clause.
- `qualifications` on an assertion names where the article carries the limitation ("s14 says the savings are
  modelled, not metered"). Such an assertion still raises a `needs-qualification` warning: that is expected, the
  reviewer retires it with a disposition, and you do not reword to clear it.
- Sentence ids `s01`, `s02`, ... are unique across the article (the dek and description are `meta.dek` and
  `meta.description`), stay stable across revisions, and a deleted id is not reused.
- Contextual evidence and AI guesses never support a fact. Two documents with `sameStudyAs` are one study.

## Blocks

A section is `{ "name", "heading", "blocks": [...] }`. Three kinds of block:

```json
{ "kind": "prose", "sentences": [ { "id": "s05", "text": "...", "type": "factual", "assertions": [ ... ] } ] }

{ "kind": "prose", "callout": "qualification", "claim": "<topic>/<claim-slug>", "sentences": [ ... ] }

{ "kind": "prose", "callout": "unresolved", "gap": 2, "sentences": [ ... ] }

{
  "kind": "table", "id": "t1", "caption": "Households whose bills fell after switching, by study",
  "columns": ["Share with lower bills"],
  "rows": [
    { "label": "US homes heated by gas, 2024 study", "cells": [
      { "label": "Share with lower bills", "value": 60, "unit": "percent", "display": "60 percent", "cite": "<topic>/sources/<file>.txt#L40-L44" }
    ] }
  ]
}

{ "kind": "figure", "ref": "<story-slug>/sc09", "caption": "..." }
```

- **Callouts.** A `qualification` callout names the claim it qualifies by its package id in `claim`. An
  `unresolved` callout names either a claim (`claim`) or a gap by its zero-based index in the package's
  `gaps` list (`gap`). The callout's sentences state the condition from the verdict note: under what conditions
  the claim holds, or what is not known and why. The callout type follows the claim's label (`findingLabel` in
  `src/lib/finding-label.ts`): `qualification` for a Qualified claim (verdict `partly`), `unresolved` for an
  Unresolved claim (decided by a study, but not `right` or `wrong` at verified confidence). The coverage check
  accepts either type, so getting it right is yours. A factual sentence in a gap callout cites a study passage
  that bears on the gap, never a context-only one, unless the gap is about that passage (the package marks it
  context only): then the callout may report what it says, citing it, and states that it cannot decide the claim.
- **Qualification coverage (blocking).** Every package claim whose label is Qualified claim or Unresolved claim must be
  named by a callout, or carried by an assertion on that claim with `qualifications`. Every gap needs an
  `unresolved` callout naming it by `gap` (a `gap-coverage` warning otherwise, which only you can close).
- **Tables.** Cells are `ChartPoint`s, checked by the storyboard's own point check: `value` a number, `unit`
  one of `percent`, `usd`, `gbp`, `count`, `ratio`, `display` the figure as the passage states it (it must state the
  value; for a ratio, "1 in 238" with value 238), `cite` a cite in the package whose passage holds every figure
  in `display` and in the cell's own `label`. Optional `qualifier`: `lt`, `lte`, `gt`, `gte`, `about`. A table
  never holds a figure the passage does not. The row's `label` names the population and year but is not checked
  for figures, so put every figure in a cell's own `label` or `display`. Dollars are `usd` and pounds `gbp`; the
  display keeps the passage's sign ("$120", "£120"), and a sign that contradicts the unit is wrong. Years and a
  COP go under `count`.
- **Figures.** `ref` is `<story-slug>/<scene-id>` of a storyboard scene that has a chart
  (`figuresOf` in `src/lib/article-validation.ts`); anything else blocks. The caption describes the chart and
  carries no figure of its own.
- A quotation is a sentence whose assertion carries a `quote`, as in a script.

## The file

```json
{
  "topic": "<topic>",
  "story": "<story id>",
  "revision": 1,
  "generation": {
    "model": "<model id>",
    "brief": "scripts/briefs/article.md",
    "date": "<ISO date>",
    "wordsPerMinute": 150,
    "evidencePackage": "<package fingerprint>"
  },
  "meta": {
    "headline": "...",
    "seoTitle": "...",
    "dek": { "id": "meta.dek", "text": "...", "type": "factual", "assertions": [ ... ] },
    "description": { "id": "meta.description", "text": "...", "type": "factual", "assertions": [ ... ] }
  },
  "sections": [ { "name": "hook", "heading": "...", "blocks": [ ... ] } ]
}
```

`wordsPerMinute` is required by the shared type and unused for an article.

## Validate

`npm run article -- validate <topic> <story-id>` writes `article-validation.json` and `article.md` and prints
one summary line (`<status>: N sentences, N assertions, N verified, N blocking, N warnings, N unreviewed`), then
every open blocking issue and warning as `SEVERITY <sentence> <category> [deterministic|review]: <explanation>`,
then `RESULT: PASSED` or `RESULT: FAILED (<status>)`. Before a review exists the status is at best
`needs-review`: your job is zero blocking issues. Blocking issues (missing provenance, a figure not in the
evidence, a misquote, a calculation that does not reproduce, `qualification-coverage`, `metadata`, `no-url`,
`table-data`, `figure`, `structure`) are yours to fix. A `gap-coverage` warning is yours too: close it with an
`unresolved` callout whose `gap` is that index; nobody can disposition it. Other warnings
(`transcript-overlap`, `needs-qualification`) are for the reviewer unless plainly yours.

`npm run article -- show <topic> <story-id>` prints `article.md`: the article as a reader sees it, each sentence
followed by `[<id> ok|review|BLOCKED fp=<fingerprint>]` (the state is left out for a verified sentence with no
assertions), each callout led by `**qualification (<claim>):**` or `**unresolved (gap <n>):**`, each table
rendered with its `display` values, then `## Open issues` with every issue not dispositioned, review findings
included, and the reviewer's suggestions. The headline, SEO title, each heading, table and figure carry
`[<id> fp=<fingerprint>]` too: the reviewer approves them like sentences, so an edit to one is reviewed again.

## Revising

After review, read `npm run article -- show` and `article-validation.json` (open issues, by sentence). For each
blocking finding: remove the assertion, narrow or qualify it, rewrite it as attributed, say the evidence is
insufficient, or record that it needs research. Change only what the findings touch; bump `revision`; keep ids.
A changed sentence loses its approval and is reviewed again. A pass has three revisions (`MAX_REVISIONS`) to
clear its blocking findings, counted as `revision` minus `passStartRevision` (0 when absent). The first draft is
revision 1, so in a first pass revision 3 is the last: if it still blocks, the limit is reached, the article
stays as it is with its blockers listed, and a person decides. A revision that only answers warnings is not limited. Never set
`passStartRevision` or `generation.corrective` yourself; a person or the run does, and a corrective pass
changes only the sentences its entry lists.

## Stale article

The board says `stale` when a finding the released article relies on (a claim its sentences assert or a callout
names) was revised after the release. Read the revision's note in `public-record.json` and the claim's new
verdict, then either:

- **Revise:** the text no longer holds. Change what the revised finding touches as in Revising (bump `revision`,
  keep ids); after review a person releases it with
  `npm run article -- correct <topic> <story-id> --approved-by "<name>" --note "<what changed>"`, which records
  the correction.
- **Reaffirm:** the text still holds as written (the revision does not change what the article says). Change
  nothing; a person runs
  `npm run article -- reaffirm <topic> <story-id> --approved-by "<name>" --note "<why unchanged>"`. It refuses an article that is not stale, one that changed since the release (use `correct`), a
  validation that has not passed and a placeholder approver. It adds a history entry with the note and moves the
  release date to today, which clears the stale banner; it records no public-record revision.

Final reply: the deterministic result, the tables and figures you used, and the three sentences you are least
sure the evidence supports as worded.
