# Run report: get-rich-quick decision:trading-and-betting

- Review mp4: `video/review/decision-trading-and-betting-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 55 min (2026-10-26, 18:33 to 19:28), approver jonathan m borchardt (`automated: /produce run started by jonathan m borchardt`)
- Earlier run (2026-10-21/22): r1 packaged, then released with Azure narration. This run re-opened the story because new verdicts on cited claims made its evidence package stale.

## Evidence added

None in this run. The rebuilt package (ef97fa3eb7, was c10ea75b99) carries two verdicts recorded elsewhere, and no sentence relies on either:

- FCA CFD consultation 2016 (`fca-cp16-40-cfd.txt#L589-L591`, partly 0.4) qualifies "most retail day traders lose money" (CFDs are leveraged products, not day trading). The reviewer updated the s08.a, s11.a, s27.a and s22.b dispositions to cover it.
- A second Taiwan study (Barber et al. 2011) supports a claim: about 15% of day traders profit after costs, which matches "the vast majority" in s27.

## Script revisions

- r2 (pinned to package ef97fa3eb7), taking the r1 reviewer's two warnings:
  - s16: "they lost 7 basis points a day ... tripled that loss" became "they trailed the market by 7 basis points a day ... tripled that shortfall". The figures are abnormal returns against a Taiwan market index (barber-odean L452-L458), not raw account losses.
  - s20: "Ross Cameron names one reason the rest struggle:" became "Ross Cameron describes one obstacle he hit himself:". The quote is about his own trading.
- The re-review approved 27 of 27 sentences: 22 assertions verified, 17 dispositioned.
- Still open for an editor (info): s22 opens "So yes:", which does not directly answer s02's "how many" question.

## Storyboard

- sc16: the chart title is now "Average daily shortfall against the market, in basis points". Its points and cites are unchanged.
- sc20: only the purpose was reworded. The narration and timing were refilled from the script. 24 scenes, 265 s planned.

## Graphics

None bespoke: 24 generic scenes plus the `end` close card.

## Render

All 25 scenes were re-rendered (none cached): 7548 frames, 251.6 s, in about 19 minutes. The first spike attempt was killed while narrating s02. Its partial mp3 was deleted and the step re-run.

## Music

Undertow: opening sc01-sc03, setup sc04-sc06, evidence sc07-sc21, ending sc22-sc24. Music sits -19.3 dB under the voice, peak -1.4 dB.

## QA

`RESULT: PASSED`, 36 of 36 checks.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media). The earlier Azure release build is superseded. Once the draft is accepted, `npm run video -- final get-rich-quick decision:trading-and-betting --approved-by <name>` re-narrates it for release.
- Music: Undertow, cleared.
