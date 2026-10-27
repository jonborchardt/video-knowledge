# Brief: review story candidates

Give an agent this file plus the topic id. The agent reads `topics/<topic>/stories.json` (run
`npm run stories -- discover <topic>` first), the claims and verdicts behind each candidate,
and the cited passages in `topics/<topic>/sources/`, then writes `topics/<topic>/story-review.json` and
runs discover again. The code drafts candidates and audits references; this pass supplies
the judgment the code cannot make. Nothing here changes a verdict or adds evidence.

## What to judge

1. **Applicability.** For each study verdict the audit lists on a candidate's central
   conclusion or findings, ask: does this passage decide _this sentence_, with its
   population, conditions, timeframe, quantity, causality and modality? Read the passage
   (`npm run stories -- show <topic> <story-id>` prints it). Only record a judgment where
   the heuristic default shown in the audit is wrong or where the story depends on it,
   keyed `"<claim id>|<asserts|denies>|<cite>"`. The stance in the key is the story
   sentence's stance on the claim, not the verdict's direction: `asserts` when the story
   presents the claim as supported or qualified, `denies` when it says the evidence does not
   support it. Record one of:
   - `direct`: the passage establishes the sentence, or something incompatible with it.
   - `partial`: it establishes part of it, or the same thing in a narrower setting.
   - `contextual`: relevant background that does not decide it. A base rate ("most lose")
     never decides a possibility ("an expert can"). A study of one instrument, market or
     population is not direct proof about another. Correlation is not causation.
2. **Coherence.** Do the candidate's claims answer one specific question? Score 0 to 1 with
   a one-line reason. Prune with `claims` to the ones that do; add a claim only when the
   question needs it. Below 0.5 the candidate is rejected; say why with `reject` instead
   when it is not a story at all (a subject, a list, a duplicate).
3. **Framing.** A `question` a viewer would ask, a `title` and two `alternates` in natural
   language, `whyWatch` (the real reason, no audience numbers), `tension`, and
   `evidenceNeeded`. Never promise a conclusion the audit does not support, and never use
   the kind names (contradicted, conflict, surprise, gap, decision) in a title.
4. **Qualifications.** If the audit marks the central conclusion or a finding `qualify`
   or `review`, either rewrite `premise` and `arc` so the narrative carries every
   limitation and set `qualificationsAccepted: true`, or leave it for a later reviewer.
5. **Gaps the code cannot see.** `research: "<reason>"` holds a story at needs-research
   whatever the audit says, for example when the only study answers a neighbouring
   question. Say what evidence would unblock it.
6. **Chain.** One video can answer up to three questions when each answer raises the next
   one: "is it cheaper to run?" leads to "does the upfront cost wipe that out?", which leads
   to "and in a real cold snap?". On the story that asks the first question, set `chain` to
   the follow-up story ids in order and `chainWhy` to one line on why each answer leads to the
   next. Each chained story keeps its own question, claims and audit; do not merge their
   claims into the first. Chain only stories that are already ready (the video is ready only
   when every question is), never a list of loosely related questions, and never a story that
   has its own chain. A chained story is not produced as a separate video: discovery marks it
   `partOf` the first story and the board refuses to start it. `chainCandidates` on a story are
   the code's suggestions (ready stories sharing no claims, nearest in wording); judge each one,
   since a shared word is not a follow-up question.

Keep the candidate's primary claim (the one in its id) in `claims`; the central
conclusion is built from it for every kind except decision groups.

## Output

```json
{
  "applicability": {
    "<topic>/<slug>|denies|<topic>/sources/<file>.txt#L10-L24": {
      "level": "contextual",
      "reason": "a base rate on futures traders cannot rule out one stock trader's outcome"
    }
  },
  "stories": {
    "<story id>": {
      "coherence": { "score": 0.9, "reason": "..." },
      "claims": ["<topic>/<slug>"],
      "question": "...?",
      "title": "...",
      "alternates": ["...", "..."],
      "whyWatch": "...",
      "tension": "...",
      "evidenceNeeded": "...",
      "premise": "...",
      "arc": { "hook": "...", "resolution": "..." },
      "qualificationsAccepted": true,
      "chain": ["<follow-up story id>", "<the one after>"],
      "chainWhy": "..."
    },
    "<other id>": { "reject": "..." }
  }
}
```

- A level recorded with the verdict (`topics/<topic>/applicability.json`, written by `record-sources`) is a
  ceiling: your judgment may narrow it, or widen the wording heuristic up to it, never above it. A wrong
  recorded level is re-recorded, not overridden here.
- Story ids come from `stories.json` and are stable; claim ids must exist in the topic.
- Review the whole list, including the rejected and lower-ranked candidates in the
  `rejected` block: a rejected variation may be the better framing.
- Final reply: how many candidates were kept, pruned, rejected, and the three judgments
  that most changed the list.
