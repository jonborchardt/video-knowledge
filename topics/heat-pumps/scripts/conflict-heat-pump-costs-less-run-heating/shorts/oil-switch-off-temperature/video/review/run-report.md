# Run report: conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature

The second Short of the first video, 2026-10-24, driven by hand through the board's steps on branch `feat/shorts`.
Format PUBLIC ADVISORY; the Commission on Spending's badge.

- Package: `video/review/conflict-heat-pump-costs-less-run-heating-short-oil-switch-off-temperature-review-private.mp4`
  (1080x1920, 71.0 s), `checklist.md`, `description.txt`, `captions.en.srt`. Private review build, draft voice.

## Evidence

None added. One claim (`heat-pumps/heat-pumps-save-most-money-homes`), Cadmus 2016
`cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205` (the evaluators' recommendation for oil-heated homes).

## Candidate review

Candidate s15, kept with two `carries` lines: the thresholds (8 F in 2015, 25 F in 2016) are one evaluation's
price-dependent outputs, not a rule; the advice is for oil-heated homes only, against propane and resistance the same
evaluation found the heat pump cheaper throughout.

## Script revisions

1. Revision 1 validated with 0 blocking (one wording change during validation: "which of the two" counted as a figure
   in the close). The reviewer approved all seven sentences first time; five needs-qualification warnings dispositioned;
   two info findings: "Massachusetts and Rhode Island homes" rests on the document's provenance rather than the cited
   lines, and the propane/resistance "always" is the evaluation's own wording, attributed.

## Storyboard and graphics

Six scenes, 81 s estimated: short-question ("Heat with oil?"), short-stat-tiles (8°F 2015, 25°F 2016), short-list,
short-list, short-quote ("may not appeal to all"), short-list. No bespoke graphics.

## Music

None.

## QA

RESULT: PASSED (32 of 32 checks). The first spike run hit edge-tts throttling twice on the sixth sentence; the
narration loop now retries a throttled sentence after a pause, and the third run completed. Frames inspected after the
caption and citation fixes.

## Release blockers

Draft voice: `npm run video -- final heat-pumps "conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature" --approved-by "<name>"`
once accepted. Ledger output `short:oil-switch-off-temperature` in the parent's `publish.json`; public only after the
parent is live, related video set in YouTube Studio.
