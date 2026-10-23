# Run report: organic-food conflict:organic-farming-yields-less-food-per

- Review mp4: `video/review/conflict-organic-farming-yields-less-food-per-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 2 h 50 min, run in parallel with other stories' script stages and queued behind their renders (approver jon, 2026-10-21)

## Evidence added

- `ponisio-2015-yield-gap.txt#L95-L99` (right, 0.6) on `organic-farming-needs-more-land-produce`: the authors warn the 19.2% gap may be overstated (15.5-22.9% "potentially overestimated"); the gap shrinks to 9% with multi-cropping and 8% with rotations. Recorded on this claim because the script already cites Ponisio for the yield claim.
- Not recordable: Ponisio's scope (115 studies, 38 countries, L26) and Clark and Tilman's scope (mostly high-input farms in Europe and North America, L468-L476); both documents are already cited for those claims.

## Script revisions

- r1: chain of two questions (yield; the planet). Review: blocking s26 (implied a per-field comparison no passage makes); warnings s13 (the rotation/multi-cropping gap) and s17 (Clark and Tilman's scope).
- r2: s26 "better per what?"; s13 adds the 8-9% gap; s17 carries a note that its scope is not citable. Review passed, 26 of 26.

## Notes for the editor (need a decision: re-recording a cited verdict, `--replace-cited`)

- s13: the 8-9% compares diversified organic against undiversified conventional fields (Ponisio L87); when both diversified the gap was 20-21%. Citing L87 would let the narration say so.
- s17: the narration never says Clark and Tilman's figures come mostly from high-input farms in Europe and North America.
- sc15's "More land" tile is drawn at 25 but labelled "25% to 110%" (a percent point cannot exceed 100).

## Graphics

None bespoke: 20 generic scenes (11 typography, 3 charts, 4 excerpts, 1 transition, 1 quote).

## Music

Undertow (cleared): opening sc01-sc03, evidence sc04-sc18, ending sc19-sc20. Music -20.6 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final organic-food conflict:organic-farming-yields-less-food-per --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
