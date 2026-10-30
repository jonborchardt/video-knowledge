# Brief: close an evidence gap

Give an agent this file plus the topic id and story id. A writer stopped because a sentence the
story needs rests on a passage the evidence package does not have: the gaps are in
`topics/<topic>/scripts/<slug>/script.json` under `generation.needsEvidence` (`claim`, `why`, and an
optional `hint` naming a document), or the board names a story gap. You are not the writer and you
do not want the sentence to survive: a passage that contradicts the script counts as much as one
that supports it. You never edit `script.json`.

## Method

1. For each gap, read the claim (`topics/<topic>/report.json` or `npm run stories -- show <topic> <story-id>`)
   and what the writer says is missing.
2. Look in the corpus first: grep `topics/<topic>/sources/*.txt` (start with the `hint`) for the passage
   that decides the claim as stated: its population, conditions, period and baseline.
3. If nothing in the corpus decides it, find a document that does (a study, an official dataset,
   a government or lab report; not a blog or a vendor's page). Save it to `topics/<topic>/sources/<file>.txt`
   with a first line `Source: <url>`; convert a PDF with `pdftotext -layout`. One document per file.
4. Judge every passage you use per `src/modules/evidence/briefs/sources.md` (verdict, confidence, one-line
   note, the tightest line range), and record a verdict on the claim the passage actually decides.
   Record its applicability per `sources.md`; a passage that is only `contextual` does not close the gap.
   Write the verdicts to `topics/<topic>/work/sv_<story slug>-<n>.json` (the next unused `n`).
5. Run, in order:
   - `npm run record-sources -- <topic> topics/<topic>/work/sv_<story slug>-<n>.json` (never with
     `--replace-cited`: if it refuses because a script cites that claim and document at another
     range, stop and report the message; record the passage on the claim it decides instead only
     when that is a different claim)
   - `npm run report`
   - `npm run stories -- discover <topic>`
   - `npm run script -- package <topic> <story-id>`

The rebuilt package makes the script stale; the board then asks the writer for a revision against
it, and the writer clears `needsEvidence`. If no document you can find decides a gap, record
nothing for it and say so: the run stops there, and an honest "the evidence cannot say" is the
writer's next sentence, not a weaker citation.

Final reply: per gap, the document and lines recorded (or "nothing decides it" and what you
searched), each verdict with its confidence, and any refusal from `record-sources`.
