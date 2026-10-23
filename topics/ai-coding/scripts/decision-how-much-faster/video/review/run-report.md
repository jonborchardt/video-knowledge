# Run report: ai-coding decision:how-much-faster

- Review mp4: `video/review/decision-how-much-faster-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 45 min (one /produce run, approver jon, 2026-10-21)

## Evidence added

None.

## Script revisions

- r1: chain of two questions (how much faster; can developers tell). Facts whose limits sit only in verdict notes were left out (company names and counts for the Google and Microsoft/Accenture studies, Shan's 18%). Review: blocking s18 (the reason developers decline METR's study sat outside its cite); warnings s22 ("real" gains, unscoped to the tools tested) and s33 (repeated s31).
- r2: s18 also cites `metr-2026-experiment-design.txt#L58-L62`; s22 scoped to the tools tested and "modest"; s33 trimmed. Review passed, 35 of 35.

## Graphics

None bespoke: 27 generic scenes (11 typography, 8 stat tiles, 2 bar charts, 3 excerpts, 2 quote cards, 1 transition). sc14 shows METR 2026's estimates as 18% and 4% cuts in task time (tiles cannot take negatives); the note says both ranges reach a slowdown.

## Music

Undertow (cleared): opening sc01-sc02, evidence sc03-sc26, ending sc27. Music -20.8 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok (345.3 s, 27 scenes). The spike failed twice on transient errors (edge-tts "No audio was received"; a Remotion temp stitch directory vanishing) and passed on the third run, reusing 12 cached chunks.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final ai-coding decision:how-much-faster --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
