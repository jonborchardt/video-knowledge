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

## Article and re-render (2026-10-27)

/produce run started by Jon Borchardt, about 55 min wall-clock (22:13 to 23:08).

- Article: a fresh agent wrote `article.json` (chained: hook, question-1, question-2, close; 29 sentences, 38 assertions, tables t1-t3 of EIA gas, WTI vs gas and CPI levels, figures sc14 and sc22). A different fresh agent reviewed it: all sentences, headline, SEO title, headings, tables and figures approved, 38 of 38 assertions verified, 0 blocking; the 14 needs-qualification warnings retired with dispositions (each limit is stated in the adjacent callout). Locked as revision 1 by `automated: /produce run started by Jon Borchardt` (`article-release.json`). The State of the Union quote ("below $2.30 a gallon in most states") was left out: one source only.
- Reviewer info notes for the editor: the dek compares nominal prices but says so only from s07; Trump's "probably 225" is not answered head-on (lowest monthly average in the record is $2.81); s12 does not date the war's start (no dated passage in the package); s22 "bears out the totals" fits the channel's 21% but not its 5.4% (BLS: 6.1%).
- Evidence added: none. Script revisions: none.
- Re-render: the build predated the institution kit (board `look-stale`). `npm run video -- spike` re-rendered all 26 scenes in the kit (the `end` close card now appended), 8782 frames, 292.7 s; music -20.6 dB under the voice, peak -1.4 dB. QA: `RESULT: PASSED` (36 of 36 checks). `npm run video -- package` wrote the private review package.
- The re-render narrates with edge (draft), so the 2026-10-22 Azure release build is now a draft again: public release is blocked until a person runs `npm run video -- final inflation-2026 decision:is-gas-cheaper-than-under-biden --approved-by <name>`.
- `npm run validate`: 2 tests in tests/production.test.ts timed out at 5 s under load (not touched by this run).
