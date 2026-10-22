# Run report: heat-pumps decision:what-happens-when-it-gets-cold

- Review mp4: `video/review/decision-what-happens-when-it-gets-cold-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 57 min (one /produce run, approver jon, 2026-10-21)

## Evidence added

None.

## Script revisions

- r1: 47 sentences. Review: 2 blocking. s36 jumped from the metered gas break-even to a rating curve on paper, skipping that metered cold-climate units broke even only above 58 °F. s40 said "they kept heating below zero" though one NREL site's compressor stopped below 0 °F. Warnings: s27/s28 tied causes to the 25% backup figure; s37 lifetime cost beside running cost; s43 missing the over-10-year retrofit payback.
- r2: all six fixed. Review passed, 47 of 47.

## Notes for the editor (reviewer, not filed)

- s43 drops "typically" from the payback limit ("typically over 10 years").
- s34/s36 leave out that the gas break-even ignores zonal savings (could lower it by 20 °F or more).
- s28 could add that the controls fault is expected to be fixed before the prototypes ship.

## Graphics

None bespoke: 33 generic scenes (19 typography, 9 stat tiles, 4 excerpts, 1 transition). sc26 shows only the gas break-even; the propane break-even (-15 °F) would not pass as a chart value and is in the chart note.

## Music

Undertow (cleared): opening sc01-sc02, setup sc03-sc05, evidence sc06-sc28, ending sc29-sc33. Music -20.2 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok (451.4 s, 33 scenes).

## Code

`tests/production.test.ts` named this story as the one without a script dir; it now picks any unproduced heat-pumps story, so producing one no longer breaks it.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final heat-pumps decision:what-happens-when-it-gets-cold --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
