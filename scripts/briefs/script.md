# Brief: write the narration script

Give an agent this file plus the topic id and story id. The agent reads
`<topic>/scripts/<slug>/evidence-package.json` (run `npm run script -- package <topic> <story-id>`
first) and the passages it cites in `<topic>/sources/`, writes `<topic>/scripts/<slug>/script.json`,
and runs `npm run script -- validate <topic> <story-id>` until the deterministic checks pass. An
independent reviewer (`scripts/briefs/script-review.md`) then judges the wording; the writer revises
against both. Nothing here adds evidence: if the package cannot support a sentence, the sentence
changes, not the evidence.

## What to write

A faceless, research-based YouTube narration of 8 to 12 minutes (1,200 to 1,800 words at the
default 150 words per minute). Storytelling first: a hook that opens on the tension, a setup that
states the popular belief in the sources' own words, an investigation that introduces evidence
one piece at a time as the answer to a question the viewer now has, findings, qualifications that
belong to the story rather than interrupting it, implications for an ordinary viewer, and a
conclusion that answers the opening question as precisely as the evidence allows. Vary sentence
length. Use concrete examples, analogies and rhetorical questions. Do not open every study the
same way, do not read numbers in a list, and do not write the phrases an AI writes ("delve",
"it's important to note", "in conclusion", "a testament to").

The evidence package distinguishes five things and so must the script:

1. a source made the claim (`statements`): attribute it, never present it as true;
2. a study supports it (`evidence` with role `supports`): state it, with its population and conditions;
3. a study qualifies it (`qualifies`): state the narrower thing the study shows;
4. a study contradicts it (`contradicts`): say so, in the same breath as the claim;
5. background (`context`, and every AI guess): never offered as proof.

Two documents with `sameStudyAs` are one study: never count them as two sources agreeing.

Editorial rules: keep each finding's population, period and conditions; distinguish gross revenue,
commissions, costs, profit and net income; distinguish averages, medians, distributions and
shares; never widen a company's disclosure to the industry without a passage that does; never turn
a correlation or a self-report into a cause; where the evidence cannot answer, say it cannot. A
hypothetical ("say you join under a friend") is fine when it is plainly hypothetical and carries
no figure the evidence does not; an invented typical income is not.

## The file

```json
{
  "topic": "<topic>",
  "story": "<story id>",
  "title": "<from the package, or a better one that promises no more>",
  "revision": 1,
  "generation": {
    "model": "<model id>",
    "brief": "scripts/briefs/script.md",
    "date": "<ISO date>",
    "wordsPerMinute": 150,
    "evidencePackage": "<package fingerprint>"
  },
  "sections": [
    {
      "name": "hook",
      "sentences": [
        { "id": "s01", "text": "...", "type": "rhetorical" },
        {
          "id": "s02",
          "text": "In a survey of 601 people who had tried it, 47 percent said they lost money.",
          "type": "factual",
          "assertions": [
            {
              "id": "s02.a",
              "text": "In AARP's 2018 survey of 601 current and former MLM participants, 47% reported losing money.",
              "kind": "fact",
              "claims": [{ "id": "<topic>/<slug>", "stance": "asserts" }],
              "evidence": [
                { "kind": "study", "claim": "<topic>/<slug>", "cite": "<topic>/sources/<file>.txt#L135-L139" }
              ],
              "qualifications": ["s31 says the figures are self-reported."]
            }
          ]
        }
      ]
    }
  ]
}
```

- Sections, in order: `hook`, `setup`, `investigation`, `findings`, `qualifications`, `implications`,
  `conclusion`. Sentence ids `s01`, `s02`, ... stay stable across revisions; a deleted sentence's id
  is not reused.
- `type`: `factual` (offered as true), `attributed` (reports what a source said), `hypothetical`,
  `rhetorical`, `transitional`. A factual or attributed sentence needs at least one assertion; the
  other three carry no figure and no fact that is not in an assertion.
- One assertion per independent factual claim in the sentence. Half a sentence with evidence does
  not carry the other half. Every figure in the sentence must appear in an assertion, written as
  digits, and must appear in the cited passage or verdict note (`"$1,000"` matches `1000`).
- `kind`: `fact` with `study` evidence; `attribution` with `statement` evidence (a source that takes
  that stance on that claim). `claims` are canonical claim ids from the package; `evidence` entries
  are the package's `cite`s and `source`s. Contextual evidence and AI guesses never support a fact.
- A derived figure needs `calc`: `{"expression": "100 - 47 - 27", "inputs": [{"value": "47", "cite": "..."}, ...], "result": "26"}`.
  Inputs must be in the cited passages; the expression must evaluate to the result as written.
- A quotation needs `quote`: `{"text": "<the exact words>", "cite": "<passage>"}` or
  `{"text": "...", "source": "<source id>"}`. The words must be in the passage (or the recorded source
  quote) and in the sentence. `speaker`: required whenever the narration says who spoke (a name, a
  role, a show); it must appear in the package's `statements[].context` for that source, or in the
  source title or channel. A quotation from a source with no `speaker` is a warning for the reviewer.
- `qualifications`: where the narration carries the limitation the package lists for that claim
  (self-reported, before expenses, one analyst's assumptions, one company). An assertion the audit
  marks `qualify` needs this or a narrower sentence.
- `note` on a sentence: anything the reviewer should know (why a hypothetical is safe, what a figure
  counts).

## Validate

`npm run script -- validate <topic> <story-id>` prints every issue. Blocking issues (missing
provenance, a figure not in the evidence, a misquote, a calculation that does not reproduce, a
reference that does not resolve) must be fixed before review. Warnings (`needs-qualification`,
`figure-in-non-factual`, runtime) are for the reviewer unless they are plainly wrong.

## Revising

After review, read `validation.json` (open issues, by sentence) and `review.md`. For each blocking
finding: remove the assertion, narrow or qualify it, rewrite it as an attributed claim, say the
evidence is insufficient, or record that it needs research (in `generation.notes`). Change only
the sentences the findings touch; bump `revision`; keep ids. A changed sentence loses its approval
and is reviewed again. At most three revisions: after that the output stays as it is with its
blockers listed, and a person decides.

Final reply: word count and runtime, the deterministic result, and the three sentences you are
least sure the evidence supports as worded.
