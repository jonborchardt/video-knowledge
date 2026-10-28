# Run report: inflation-2026 decision:how-high-is-inflation

- Review mp4: `video/review/decision-how-high-is-inflation-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 6 h 40 min, of which about 4 h 40 min was a render hung after a headless-browser crash (no exit, no output); killed and resumed from cache (one /produce run, approver jon, 2026-10-21)

## Evidence added

- `fomc-statement-2026-09-16.txt#L9-L9` (partly, 0.5) and `fomc-sep-2026-09-16.txt#L25-L39` (partly, 0.5) on `inflation-has-run-above-fed-target`: the Fed's 2 percent goal; its officials' 3.7% PCE projection for 2026 against a 2.0% long run; the definition of PCE.
- `bls-cpi-earnings-series-2019-2026.txt#L476-L483` (right, 0.6) on `gasoline-prices-main-driver-recent-rise`: the gasoline index month by month (+24.9% March, +11.1% April, +8.6% May, -9.7% June). The series has no basket weights, so the script gives gasoline no share of the rise.

## Script revisions

- r1: chain of two questions. The writer set needsEvidence (the Fed target; the gasoline months); after the evidence pass the same revision cited them. Review: blocking s09 (dated a YouTube remark to January; only the reading is January's); warning s08 (read the 2022 peak as what Trump inherited).
- r2: s09 dates the reading, s08 "the 2022 peak was real", s12 ties the January 2025 3.0% to both Trump's "inherited" and the CBS comparison. Review passed, 41 of 41.

## Notes for the editor

- The New York Fed tariff estimate (s35) runs to February 2026, before the March jump; the script never says it explains that rise.
- sc13 shows index levels, not the annualised 4.6% and 0.2% the narration speaks (computed figures cannot be chart points).

## Graphics

None bespoke: 36 generic scenes (6 bar, 7 stat tiles, 20 typography, 3 excerpts).

## Music

Undertow (cleared): opening sc01-sc03, evidence sc04-sc33, ending sc34-sc36. Music -20.6 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok (344.3 s, 36 scenes).

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final inflation-2026 decision:how-high-is-inflation --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## 2026-10-27: article and re-render in the institution kit

One /produce run (approver Jon Borchardt), about 50 min wall-clock (render 25.6 min).

- Evidence added: none. Script unchanged (no script revisions).
- Article: r1 written (chain: hook, question-1, question-2, close; tables t1-t3; figures sc13, sc24). Review held it: blocking s12 (called its verdict "less certain than the others", but others sit at 0.7 and 0.55), s35 (housing "the exception that runs hot"; airline fares and education also beat core), s38 (repeated recap); warnings s09 (dated the YouTube remark to January), s21 (CPI floor read against a PCE target), s28 (gasoline "moved most", unranked), s32 (omitted yearly core rising 2.4 to 2.6). r2 fixed all eight and cut s38; re-review passed 42 of 42 (41/41 assertions verified). 13 needs-qualification warnings left open without dispositions. Locked as `automated: /produce run started by Jon Borchardt` (`article-release.json`). Info left: a note under s31 names s31 where it means s32.
- Re-render: the 2026-10-22 build predated the kit merge (board: look-stale). `npm run video -- spike` re-rendered all 37 scenes (36 storyboard + `end` close card) in the institution kit: 10808 frames, 360.27 s, `RESULT: PASSED` (36 of 36 checks). Music Undertow, -20.6 dB under the voice, peak -1.3 dB. Packaged to `video/review/decision-how-high-is-inflation-review-private.mp4`.
- Release blocker: this re-render is edge-tts draft narration, so the Azure release build from 2026-10-22 is now a private review build again. Once the draft is accepted, `npm run video -- final inflation-2026 decision:how-high-is-inflation --approved-by <name>` re-narrates it for release.
