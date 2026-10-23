# Run report: inflation-2026 decision:do-tariffs-raise-prices

- Review mp4: `video/review/decision-do-tariffs-raise-prices-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 9 h, of which about 5 h the PC was asleep mid-render and the rest queued behind other renders; script stages ran in parallel with other stories (approver jon, 2026-10-21)

## Evidence added

None (package had 0 gaps).

## Script revisions

- r1: Review: blocking s18 (the 2.9 points went to the yearly rise in consumer goods prices, not overall inflation); warnings s17 (the fall and rise come from a Supreme Court ruling and new Canadian tariffs, and are a forecast), s10 (26% pass-through read as a share of the importer's cost).
- r2: s18 "contribution to the yearly rise in consumer goods prices"; s17 gives both causes as the Fed's forecast; s10 "roughly a quarter of the tariff rate, measured against goods less exposed". Review passed, 24 of 24.

## Notes for the editor

- s10 does not explain the gap between importers bearing most of the cost and the quarter that reaches consumer prices (retail margins, import share; nyfed-lse L13-L16 is uncited).

## Graphics

None bespoke: 21 generic scenes (10 typography, 6 charts, 4 excerpts, 1 transition).

## Music

Undertow (cleared): sc01-sc02, sc03-sc05, sc06-sc17, sc18-sc21. Music -19.7 dB under the voice, peak -1.4 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final inflation-2026 decision:do-tariffs-raise-prices --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
