# Brief: write the narration script

Give an agent this file plus the topic id and story id. The agent reads
`topics/<topic>/scripts/<slug>/evidence-package.json` (run `npm run script -- package <topic> <story-id>`
first) and the passages it cites in `topics/<topic>/sources/`, writes `topics/<topic>/scripts/<slug>/script.json`,
and runs `npm run script -- validate <topic> <story-id>` until the deterministic checks pass. An
independent reviewer (`scripts/briefs/script-review.md`) then judges the wording; the writer revises
against both. Nothing here adds evidence: if the package cannot support a sentence, the sentence
changes, not the evidence.

## Before writing

For every study you will use, find in the package what it compares against and whom it measured:
the comparison baseline (replacing like for like at end of life, against keeping the old system,
against doing nothing), the population (all homes, one fuel, one region), the period and the
measure (gross or net, median or mean). A sentence that compares two findings must compare them on
the same baseline; if the package does not say a finding's baseline, that is an evidence gap, not
something to infer.

## When the evidence is missing

If a finding the story needs rests on a passage the package does not have (a baseline, a
population, a figure the reviewer asked for), do not work around it with a vaguer sentence. Add an
entry to `generation.needsEvidence` and stop:

```json
"needsEvidence": [
  { "claim": "<topic>/<slug>", "why": "the national figures' baseline is not in the package", "hint": "topics/<topic>/sources/<file>.txt" }
]
```

A separate evidence agent (`scripts/briefs/evidence.md`) records what decides it and rebuilds the
package. When you revise against the rebuilt package, clear `needsEvidence` (remove the field).
If the gap could not be closed, say in the sentence that the evidence cannot answer.

## What to write

A faceless, research-based YouTube narration as long as the story needs and no longer. There is
no word target: never pad to reach a length, add no fluff, and never restate something the viewer
has already heard. Storytelling first, in five sections:

- `hook`: opens on the tension. It may tease the answer but never lays out the figures the
  investigation will give.
- `setup`: the popular belief in the sources' own words. It does not end by listing again what it
  just quoted.
- `investigation`: evidence one piece at a time, each as the answer to a question the viewer now
  has. Each limitation goes beside the figure it limits (self-report, before expenses, one
  analyst's assumptions), so the viewer hears both together; there is no separate section of
  caveats to repeat them in.
- `answer`: answers the opening question once, as precisely as the evidence allows, in a few
  sentences. It points back to figures in words rather than reading them again, and adds only the
  limits that apply to the whole answer (what the evidence cannot say).
- `takeaway`: what an ordinary viewer can do with it: a question to ask, a moment to act, a check
  to make. No new figures and no second answer. Its last line closes the video.

When the package has `questions`, the video answers a chain of them instead: one `hook` that opens
on the first question, then a `question-1`, `question-2`, ... section per question in the
package's order, then a short `close`. Each question section asks its question in the viewer's
words, brings in its evidence, carries its qualifications in place, answers it once, and ends on
what that answer leaves open, which is the next question. Each entry in `questions` carries that question's own
`premise`, `tension`, `whyWatch` and `arc`: frame each section from its own entry, not the first story's. The
package's `chainWhy` is why each answer raises the next question; the end of each section should make that turn. Give each question section a `title`
(the question as a chapter title). The `close` ties the answers together in a few sentences and
does not answer any question again. Each question section must assert at least one claim from
that question's `claims`; the validator blocks one that does not. Vary sentence
length. Use concrete examples, analogies and rhetorical questions. Do not open every study the
same way, do not read numbers in a list, and do not write the phrases an AI writes ("delve",
"it's important to note", "in conclusion", "a testament to").

Say each thing once. A figure is read where it is first needed and not read again: a later section
that needs it points back in words ("that 47 percent", "the half that closed") and never re-reads
a list of figures the viewer has heard. The `answer` and `takeaway` add what the evidence means
and what to do; they do not summarise what was just said.

Pace it for someone who can click away. The evidence starts within the first minute: a short hook,
the one or two quotes that state the belief best, then the first study. Keep the figures the
argument needs and let the chart carry the rest; ten figures inside eight sentences is a table read
aloud. The validator warns on each of these (`slow-start`, `number-dense`, `repetition`, a sentence
that re-reads two or more earlier figures); fix the script rather than asking the reviewer to
excuse it.

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

- Sections, in order: `hook`, `setup`, `investigation`, `answer`, `takeaway`; for a package with
  `questions`, `hook`, `question-1` ... `question-N`, `close`.
  Sentence ids `s01`, `s02`, ... stay stable across revisions; a deleted sentence's id
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
and is reviewed again. A pass has three revisions to clear its blocking findings: after that, with blockers still open, the output stays as it is with its
blockers listed, and a person decides. A revision that only answers warnings the reviewer holds a sentence on is not limited.

## Send-back and corrective passes

The run or a person sets `passStartRevision` and `generation.corrective`; never set them yourself to
get past the revision limit.

- **Notes pass** (the prompt says so): an editor watched the video and sent notes. The run has set
  `passStartRevision` to the revision you start from, so this pass has its own three revisions.
  Apply the notes and only the notes; keep every sentence the notes do not touch word for word.
- **Corrective pass** (the prompt says so): the revision limit was reached, and a person
  authorised fixing named sentences against the existing evidence. `generation.corrective` has an
  entry for this revision (`revision`, `reason`, `sentences`, `authorizedBy`); change only the
  sentences it lists.

Final reply: word count and runtime, the deterministic result, and the three sentences you are
least sure the evidence supports as worded.

## Short format

When the package has a `short` block, you are writing a vertical Short, not a video: one finding out of a
produced video, under a minute and a half (aim for 45 to 75 seconds), with its own opening and a close that
points at the full video (brand/design.md 2.6). The rule that outranks the rest: a conditional result never
becomes an absolute one. The viewer sees nothing but this Short.

- Sections, in order: `hook` (one or two sentences, may be rhetorical, opened from `short.hook`), `finding`
  (two to six sentences: the figure, whom it was measured on, under what conditions), `close` (one or two
  sentences pointing at the full inquiry; no figure, no second finding).
- `short.carries` lists how each qualification the parent carried elsewhere must be said here. Say every one
  inside `finding`, beside the figure it limits, and name the sentence that carries it in the assertion's
  `qualifications` ("s03 says the sample is one survey"). The validator blocks a qualified assertion that
  names no sentence of this Short.
- `short.sentences` are the parent sentences the finding comes from. Copy their assertions (claims, cites,
  calc, quote) wherever you keep the wording; the Short's package holds only those claims, and an assertion
  on any other claim blocks (`scope`).
- `short.format` is the eyebrow the video draws over the opening; write to it (`ONE FIGURE FROM THE RECORD`
  opens on the number; `CLAIM UNDER EXAMINATION` opens on the belief, then the evidence; `PUBLIC ADVISORY`
  ends on what to do).
- `title`: under 100 characters, the hook in the viewer's words, promising no more than the finding.
- Never point back to a figure the Short has not spoken ("that 47 percent" with no 47 percent before it).
- The storyboard will block past `short.maxSeconds` of estimated narration: say each thing once.
