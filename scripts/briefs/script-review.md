# Brief: review the narration script

Give an agent that did not write the script this file plus the topic id and story id. The agent
reads `npm run script -- show <topic> <story-id>` (every sentence with its assertions, their
fingerprints, the deterministic result and the cited passages), the evidence package, and the
source documents themselves in `<topic>/sources/` where a passage needs its surroundings, then
writes `<topic>/scripts/<slug>/script-review.json` and runs `npm run script -- validate <topic> <story-id>`.
The code has already checked references, figures, quotations and arithmetic; this pass supplies
the judgment the code cannot make. It never adds evidence and never approves on plausibility: a
sentence the passages do not establish is a finding, however likely it sounds.

## For every sentence

1. **Coverage.** List the factual claims the sentence makes to a viewer, including the ones carried
   by a clause, a comparison or a number. Is each one an assertion with evidence? An uncovered claim
   is a blocking `unsupported` finding. A `hypothetical`, `rhetorical` or `transitional` sentence
   that smuggles a fact is the same finding.
2. **Entailment.** For each assertion, do the cited passages establish the wording, with its
   population (whose income, which companies, which year), its measure (gross, commissions, net
   of expenses, self-reported), its denominator (all participants, active ones, those with income),
   its modality (most, some, can, always) and its causal force? Read the passage, not the verdict
   note. A passage that establishes a narrower or different thing is `overgeneralization`,
   `incompatible-comparison`, `causation` or `missing-qualification`, as fits. For an attributed
   sentence, confirm the speaker from the package's `context` (the transcript window around the
   quote), never from a file outside the repository; a `speaker-missing` warning is yours to clear
   only when the narration truly names nobody.
3. **Qualification.** Does the narration carry the limitation the package lists for that claim
   (self-report, before expenses, one analyst's assumptions, one company's table) close enough to
   the figure that a viewer hears both? A missing one is `missing-qualification`; blocking when the
   figure would mislead without it, a warning when it is stated elsewhere but far away.
4. **Omission and selection.** Does the corpus hold something that changes the sentence's meaning
   (a contradicting verdict, a source that denies the claim, a limit the study states about
   itself) that the script leaves out? `selective` or `omission`.
5. **Strength.** Is the conclusion stronger than the evidence presented? Contextual-only evidence
   (`contextual-only`), a single study presented as general (`overclaim`), a summary and its
   original counted as two (`double-counting`).
6. **Numbers.** The code checked that each figure appears in a passage. Check that it means what
   the sentence says it means (percent of whom, dollars of what, over what period) and that a
   calculation's inputs are the right inputs.

Approve a sentence only when every check passes. Approval is by fingerprint: copy the `fp=` value
the sheet prints; a later edit changes it and the approval lapses.

## Output

```json
{
  "reviewer": "scripts/briefs/script-review.md",
  "model": "<model id>",
  "date": "<ISO date>",
  "revision": 1,
  "packageFingerprint": "<evidence-package.json fingerprint>",
  "approved": { "s01": "<fingerprint>", "s02": "<fingerprint>" },
  "findings": [
    {
      "sentence": "s12",
      "assertion": "s12.a",
      "fingerprint": "<fingerprint of s12>",
      "revision": 1,
      "category": "overgeneralization",
      "severity": "blocking",
      "explanation": "The passage reports one company's rank table; the sentence says 'in every MLM'.",
      "refs": ["<topic>/sources/<file>.txt#L838-L866"],
      "suggestion": "Say 'in one disclosure the FTC excerpted'."
    }
  ]
}
```

- Copy the package fingerprint from `evidence-package.json` into `packageFingerprint`; a review of
  another package counts for nothing (its findings still apply, its approvals do not).
- For each deterministic warning (`needs-qualification`, `speaker-missing`, `figure-in-non-factual`)
  you judge a false positive or already carried by the narration, add a `dispositions` entry keyed
  by the assertion id (or the sentence id for a sentence-level warning) with the sentence fingerprint,
  the warning's category and a one-sentence reason:
  `"dispositions": { "s23.a": { "fingerprint": "<fp>", "category": "needs-qualification", "reason": "s51 says the figures are self-reported" } }`.
  A disposition retires only that category at that fingerprint, and only while the review is bound
  to the current package. A warning you judge real becomes a finding instead. Blocking issues cannot
  be dispositioned. Only the reviewer writes dispositions.
- Severity: `blocking` (a viewer would come away believing something the evidence does not
  establish), `warning` (true but imprecise, or a limitation stated too far away), `info`.
  Use category `needs-human` with severity `warning` when only an editor can decide.
- On a later revision, keep earlier findings in the file (the validator marks the ones whose
  sentence changed as resolved) and append new ones with the new `revision`; re-read every
  changed sentence before approving it, and do not re-approve an unchanged sentence you had a
  blocking finding on unless the finding was wrong.
- Final reply: sentences approved, findings by severity, and the three findings that most change
  what the video can claim.
