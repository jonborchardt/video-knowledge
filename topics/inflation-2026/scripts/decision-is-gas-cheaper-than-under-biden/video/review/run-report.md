# Run report: inflation-2026 decision:is-gas-cheaper-than-under-biden

- Review mp4: `video/review/decision-is-gas-cheaper-than-under-biden-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 45 min (one /produce run, approver jon, 2026-10-20)

## Evidence added

None (package had 0 gaps).

## Script revisions

- r1: chain of two questions (is gas cheaper; have prices overall risen less). Review: 4 blocking. s25 compared only Biden's first 20 months, which hold the 2022 peak (selective); s27 generalised from it; s11 said "news reports" on one outlet; s21 "a popular comparison" on one channel.
- r2: s25 gives equal stretches at both ends of Biden's term (13.5% and 4.5%); s27 says slower than his term as a whole, faster than his last stretch, and the index cannot attribute cause; s11 adds MS NOW beside NBC; s21 drops "popular". Review passed, 30 of 30.

## Notes for the editor

- s04 quotes Trump's "two twenty-five" as "225"; check how the voice reads it.
- s21's quoted channel line continues with "about 5.4" for this term, while the script uses BLS's 6.1.
- Price tiles show EIA's tenth-of-a-cent figures ($3.461) while the narration says $3.46.

## Graphics

None bespoke: 25 generic scenes (8 stat tiles, 1 bar chart, 16 typography).

## Music

Undertow (cleared): opening sc01-sc03, evidence sc04-sc23, ending sc24-sc25. Music -20.7 dB under the voice, peak -1.4 dB.

## QA

`RESULT: PASSED`, 36 checks ok (276.7 s, 25 scenes). The first spike stopped on an edge-tts "No audio was received" for s26; a re-run synthesised it.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final inflation-2026 decision:is-gas-cheaper-than-under-biden --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
