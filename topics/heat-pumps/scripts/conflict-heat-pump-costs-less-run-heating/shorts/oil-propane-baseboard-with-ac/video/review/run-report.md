# Run report: conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac

The first Short the pipeline produced, 2026-10-24, driven by hand through the board's steps (the same loop `/produce`
runs) on branch `feat/shorts`. Format ONE FIGURE FROM THE RECORD; the Commission on Spending's badge.

- Package: `video/review/conflict-heat-pump-costs-less-run-heating-short-oil-propane-baseboard-with-ac-review-private.mp4`
  (1080x1920, 69.0 s), `checklist.md`, `description.txt`, `captions.en.srt`. Private review build, draft voice.
- Wall-clock: about two hours across the whole run, most of it agents and two render passes for frame fixes.

## Evidence

None added. The Short's package is a filter of the parent's: one claim (`heat-pumps/heat-pump-costs-less-run-heating`),
Wilson 2024 `wilson-2024-heat-pumps-for-all.txt#L393-L401`.

## Candidate review (shorts-review.json)

Eleven candidates, two kept, nine rejected with reasons. This candidate (s07) carried two qualifications from the
parent (modelled not metered; the without-AC counterpart). After the first script review the hook was corrected from
"baseboards" to "electric heat" (the study's population is homes heating with electricity), which rebuilt the package
and re-bound the script (revision 3).

## Script revisions

1. Revision 1: validated with 0 blocking. The reviewer blocked s07 (the close presupposed "where oil breaks the
   pattern", an exception this Short never states) and held s01 ("baseboards" narrower than the passage) and the
   "linked above" pointer.
2. Revision 2: s07 and s01 rewritten; every other sentence unchanged.
3. Revision 3: re-bound to the rebuilt package (new hook); no sentence changed. Re-review approved all seven; the
   four deterministic needs-qualification warnings dispositioned (the limits are other studies narrowing the claim,
   not Wilson's modelled figure). One info finding recorded: Wilson's results use winter 2021-22 prices.

## Storyboard and graphics

Six scenes, 80 s estimated: short-stat-tiles (95%-100%), short-title, short-list, short-stat-tiles (the parent's two
tiles reused), short-bar (with AC 95%-100% against without AC 73%-86%), short-list. No bespoke graphics; the portrait
vocabulary covered every scene.

## Music

None (a Short is narration only in this delivery).

## QA

RESULT: PASSED (32 of 32 checks, including the three-minute rule). Frames inspected: badge, eyebrow, content band,
captions and the citation block sit where SHORT_LAYOUT puts them; nothing in YouTube's overlay zones.

## Release blockers

Narration is the edge draft voice; `npm run video -- final heat-pumps "conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac" --approved-by "<name>"`
re-narrates with Azure once a person accepts the draft. The ledger lists the Short as
`short:oil-propane-baseboard-with-ac` in the parent's `publish.json`; it may be uploaded privately now and goes public
only after the parent is live, with the related video set in YouTube Studio.
