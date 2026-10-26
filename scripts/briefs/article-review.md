# Brief: review the companion article

Give an agent that did not write the article this file plus the topic id and story id. The `<slug>` is the story
id with `:` replaced by `-`. The agent runs `npm run article -- validate <topic> <story-id>`, then reads
`npm run article -- show <topic> <story-id>` (the article as a reader sees it, each sentence's state and `fp=`
fingerprint, the open issues), `topics/<topic>/scripts/<slug>/article.json` (every sentence with its assertions
and cites, every callout, table and figure), the `evidence-package.json` (claims, verdict notes, passages, gaps),
and the source documents in `topics/<topic>/sources/` where a passage needs its surroundings. It writes
`topics/<topic>/scripts/<slug>/article-review.json` and validates again. It never edits `article.json`: a
sentence that needs changing is a finding, and the writer changes it. The code has already checked references,
figures, quotations, arithmetic, table cells, figure refs, URLs, metadata length and coverage; this pass supplies
the judgment it cannot make. It never adds evidence and never approves on plausibility.

`show` prints no passage text. A cite `<topic>/sources/<file>.txt#L10-L24` is relative to `topics/`: read lines
10 to 24 of `topics/<topic>/sources/<file>.txt` (and the lines around them when the context matters). The
package's `evidence[].passage` holds the same text for each verdict, when it is not null. A recorded statement has no line
cite: its words are the package's `statements[].quote`, with `context` around it, and a finding's `refs` may name
its source id.

## For every sentence

Including `meta.dek` and `meta.description`, which are sentences like any other.

1. **Coverage.** List the claims the sentence makes to a reader, including those carried by a clause, a
   comparison or a number. Is each one an assertion with evidence? An uncovered claim is a blocking
   `unsupported` finding. A `hypothetical`, `rhetorical` or `transitional` sentence that smuggles a fact is the
   same finding.
2. **Entailment.** Do the cited passages establish each assertion's wording, with its population, measure,
   denominator, modality and causal force? Read the passage, not the verdict note. A narrower or different
   thing is `overgeneralization`, `incompatible-comparison`, `causation` or `missing-qualification`, as fits.
   A Reported claim (no study decided it) stated as `factual` rather than `attributed` is blocking.
3. **Qualification.** Is the limitation the package lists for the claim stated beside the figure it limits?
   Missing is `missing-qualification`: blocking when the figure would mislead without it.
4. **Omission and selection.** Does the package hold something that changes the sentence's meaning (a
   contradicting verdict, a source that denies the claim, a limit the study states about itself) that the
   article leaves out? `selective` or `omission`.
5. **Strength.** Contextual-only evidence (`contextual-only`), one study presented as general (`overclaim`), a
   summary and its original counted as two (`double-counting`). Check each cite's `role` in the package: a
   passage whose role is `context` cited as `study` evidence is yours to catch, since the gate does not. The
   exception is a gap callout about that context-only passage: it may report what the passage says, citing it,
   provided it states that the passage cannot decide the claim.
6. **Numbers.** Each figure means what the sentence says it means (percent of whom, money of what, over what
   period), and a calculation's inputs are the right inputs.

Approve a sentence only when every check passes. Approval is by fingerprint: copy the `fp=` value the sheet
prints after the sentence's id; a later edit changes it and the approval lapses. A sentence may be approved
while it carries an `info` finding: info records something worth knowing (a note for the editor, a point about
a neighbour) that does not make this sentence wrong.

When the fix needs a passage the package does not have, say so in the finding. Only a person adds a passage
(`record-sources`); never suggest that the writer cite lines no verdict cites.

## What only an article has

- **Callouts.** Each `qualification` or `unresolved` callout names a claim (`claim`) or a gap (`gap`, its index in
  the package's `gaps`). Read that claim's verdict note and passages: does the callout state the condition the
  note states (under what conditions it holds, what is not known and why), no wider and no narrower? A callout
  that names the claim but drops the condition is a blocking `missing-qualification` on its first sentence.
- **Headline, SEO title, dek and description.** None may claim more than the claims' labels: a Qualified claim
  summarised as a flat yes or no, an Unresolved claim summarised as settled, or a Reported claim summarised
  as true is `overclaim`, blocking. The headline and SEO title are not sentences: approve each by its unit id
  (`meta.headline`, `meta.seoTitle`) at the `fp=` the sheet prints beside it, and put a finding about either on
  `meta.dek` (category `overclaim`, the explanation naming the field) so the writer sees it.
- **Headings, tables and figures are approved too.** Each section heading (`heading:<section>`), table (its `id`)
  and figure (its `ref`) carries a `[<id> fp=<fingerprint>]` on the sheet; approve it at that fingerprint in
  `approved` once it says no more than its section, cells or chart. An unapproved or edited unit holds the
  article at `needs-review` (an `unreviewed` info issue names it).
- **Tables.** The code checked that each cell's figures are in its passage. Check that the row label's
  population and year are the passage's, that the cells in one column measure the same thing on the same
  baseline, and that the caption claims no more than the cells. A finding goes on the first sentence of the
  section that holds the table, or on the nearest sentence when that section has no prose, naming the table id.
- **Figures.** The caption describes the storyboard chart it names and adds no figure.
- **Chains.** When the package has `questions`: each question section answers its own question with its own
  claims, and the `close` answers nothing again.
- **Repetition and the narration.** Read the article end to end once before judging sentences. A restatement
  that adds nothing is a blocking `repetition` finding. A `transcript-overlap` warning (keyed on the section's
  first sentence) says the section reads the narration back: make it a finding unless the shared wording is
  unavoidable (a quotation, a claim's fixed phrasing), and retire it only with a disposition saying which.

## Output

```json
{
  "reviewer": "scripts/briefs/article-review.md",
  "model": "<model id>",
  "date": "<ISO date>",
  "revision": 1,
  "packageFingerprint": "<evidence-package.json fingerprint>",
  "approved": {
    "meta.headline": "<fingerprint>",
    "meta.seoTitle": "<fingerprint>",
    "heading:hook": "<fingerprint>",
    "t1": "<fingerprint>",
    "meta.dek": "<fingerprint>",
    "meta.description": "<fingerprint>",
    "s01": "<fingerprint>"
  },
  "findings": [
    {
      "sentence": "s12",
      "assertion": "s12.a",
      "fingerprint": "<fingerprint of s12>",
      "revision": 1,
      "category": "overgeneralization",
      "severity": "blocking",
      "explanation": "The passage reports homes on one tariff; the sentence says 'most households'.",
      "refs": ["<topic>/sources/<file>.txt#L40-L44"],
      "suggestion": "Say 'households on that tariff'."
    }
  ],
  "dispositions": {
    "s20": { "fingerprint": "<fp>", "category": "transcript-overlap", "reason": "the shared run is the quoted claim" }
  }
}
```

- `revision` is the article's `revision` you reviewed. Copy `packageFingerprint` from `evidence-package.json`; a
  review of another package keeps its findings but its approvals and dispositions count for nothing.
- A disposition retires one deterministic warning (`transcript-overlap`, `needs-qualification`,
  `speaker-missing`, `figure-in-non-factual`) at that sentence's fingerprint, keyed by the assertion id or the
  sentence id; give a list under one id to retire two categories. A warning you judge real becomes a finding
  instead. Blocking issues cannot be dispositioned. Open warnings do not stop an article passing, so retiring
  one on an approved sentence is optional; when you do, give the reason. A `gap-coverage` warning has no sentence and cannot be
  retired: it is the writer's to close with an `unresolved` callout naming the gap.
- Severity: `blocking` (a reader would come away believing something the evidence does not establish),
  `warning` (true but imprecise, or a limitation stated too far away), `info`. `needs-human` with `warning` when
  only an editor can decide.
- On a later revision, keep earlier findings (the validator marks those whose sentence changed as resolved),
  append new ones with the new `revision`, re-read every changed sentence before approving it, and do not
  re-approve an unchanged sentence you had a blocking finding on unless the finding was wrong. A new or changed
  sentence can change what an approved neighbour means: re-read the sentences around it. Editing a
  callout's `claim` or `gap`, or an assertion's `qualifications`, does not change a sentence's fingerprint:
  re-read every callout on a new revision.
- The article passes when nothing blocks and every sentence and unit (headline, SEO title, heading, table,
  figure) is approved; `validate` then prints
  `RESULT: PASSED`.

Final reply: sentences approved, findings by severity, and the three findings that most change what the article
can claim.
