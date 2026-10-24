# Brief: review Short candidates

Give an agent this file plus the topic id and the story id of a produced video. The agent reads
`topics/<topic>/scripts/<slug>/shorts.json` (run `npm run shorts -- discover <topic> <story-id>` first),
the parent's `script.md` and `validation.json`, and the cited passages (`npm run shorts -- show <topic>
<story-id> <key>` prints a candidate with its sentences, qualifications and passages), then writes
`topics/<topic>/scripts/<slug>/shorts-review.json` and runs discover again. The code drafts candidates
(one per storyboard scene in a finding section whose sentences are all verified and approved and that
asserts a fact); this pass supplies the judgment the code cannot make. Nothing here changes a verdict, adds
evidence or edits the parent.

A Short is one finding out of the video, with its own hook and a close that points at the full video
(brand/design.md 2.6): the smallest institutional badge, one question, one useful insight, no ceremonial
intro. The rule that outranks the rest: **every Short carries the qualifications of the extracted claim;
a conditional result never becomes an absolute one.** A viewer who sees only the Short must not be misled.

## What to judge

1. **Does it stand alone?** Read the candidate's sentences as if nothing came before or after. Keep it only
   when the finding is complete in itself: the figure, whom it was measured on, under what conditions.
   A sentence that points back ("that 47 percent", "the half that closed") is not self-contained unless
   the Short will restate the figure. Reject a candidate that is a list, a transition dressed as a fact,
   or a finding whose meaning depends on an earlier comparison the Short cannot carry.
2. **Carry every qualification.** `qualifications` lists what the parent's assertions were qualified by
   and, in `carriedBy`, the parent sentences that carried each one (self-reported figures, one company's
   disclosure, experienced developers on their own repositories). For a kept candidate, write one
   `carries` line per qualification: how the Short will say it, in plain words, inside the finding.
   Fewer `carries` than qualifications holds the candidate at `needs-review`.
3. **Pick the format** from the brand's closed list, as the eyebrow line on screen:
   `ONE FIGURE FROM THE RECORD` (a single number and its conditions), `THE COMMISSION FINDS` (a verdict
   the evidence package's central conclusion supports; never for a qualified or disputed finding),
   `EXHIBIT IN BRIEF` (a document or passage shown), `CLAIM UNDER EXAMINATION` (a popular claim beside
   what the evidence says), `PUBLIC ADVISORY` (what a viewer can do). No in-world mark may claim more
   than the verdicts do.
4. **Write the hook**: one line in the viewer's words, under 100 characters, that promises no more than the
   finding delivers. It becomes the package title the writer opens from. No "scam", "proven" or "saves
   $X" when the evidence is conditional.
5. **Slug**: lowercase words joined by `-`, unique within the video; it names the folder
   `shorts/<slug>/` and the id `<story-id>/shorts/<slug>`, so choose it once.
6. **Claims**: `claims` prunes or widens the candidate's claim list within the parent's package. Add a
   claim only when the finding cannot be stated without it.
7. **Pick at most three.** Discovery marks any further ready candidate `needs-review` (over the cap).
   Prefer findings that differ from each other; three Shorts on one chart are one Short.

## Output

```json
{
  "candidates": {
    "s14": {
      "keep": true,
      "slug": "slower-not-faster",
      "format": "ONE FIGURE FROM THE RECORD",
      "hook": "They were sure the AI made them faster. The stopwatch said 19 percent slower.",
      "carries": [
        "sixteen experienced developers, each working on a repository they already knew well",
        "the developers' own guess was that they had been faster"
      ]
    },
    "s21": { "reject": "depends on the comparison in s14; not self-contained" }
  }
}
```

- Keys are candidate keys from `shorts.json` (the scene's first sentence id); a key discovery does not
  draft fails discover (exit 2).
- A candidate with no entry stays `needs-review`; `keep: false` is the same as no entry with a note.
- Final reply: how many candidates were kept and rejected, each kept Short's id, and the qualification
  you found hardest to carry.
