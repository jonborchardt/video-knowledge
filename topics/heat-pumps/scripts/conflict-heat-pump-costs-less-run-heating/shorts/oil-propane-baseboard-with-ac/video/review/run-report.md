# Run report: conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac

The first Short the pipeline produced, 2026-10-24, driven by hand through the board's steps (the same loop `/produce`
runs) on branch `feat/shorts`. Format ONE FIGURE FROM THE RECORD; the Commission on Spending's seal and badge.

- Package: `video/review/conflict-heat-pump-costs-less-run-heating-short-oil-propane-baseboard-with-ac-review-private.mp4`
  (1080x1920, 44.4 s), `checklist.md`, `description.txt`, `captions.en.srt`. Private review build, draft voice.

## Evidence

None added. The Short's package is a filter of the parent's: one claim (`heat-pumps/heat-pump-costs-less-run-heating`),
Wilson 2024 `wilson-2024-heat-pumps-for-all.txt#L393-L401`.

## Candidate review (shorts-review.json)

Eleven candidates, two kept, nine rejected with reasons. This candidate (s07) carried two qualifications from the
parent (modelled not metered; the without-AC counterpart). After the first script review the hook was corrected from
"baseboards" to "electric heat" (the study's population is homes heating with electricity).

## Script revisions

1. Revision 1 (178 words): 0 blocking deterministically. The reviewer blocked s07 (the close presupposed "where oil
   breaks the pattern", an exception this Short never states) and held s01 ("baseboards") and the "linked above" pointer.
2. Revision 2: s07 and s01 rewritten.
3. Revision 3: re-bound to the rebuilt package (new hook); approved by re-review.
4. Revision 4 (102 words, about 45 s; a send-back pass with the editor's note "too long"): two asides cut, every figure
   and both qualifications kept inside the finding, the close reduced to one sentence for the end card. Approved by
   re-review: 4 assertions verified, 4 needs-qualification warnings dispositioned (other field studies narrow the
   canonical claim, not Wilson's modelled figure), one info finding (Wilson's results use winter 2021-22 prices).

## Storyboard and graphics

Five scenes, 49 s estimated: short-stat-tiles (95%-100%), short-list (a model, simulated bills, not a meter reading),
short-stat-tiles (the parent's two tiles), short-bar (with AC 95%-100% against without AC 73%-86%), and the close as
the end card (`short-endcard`, named by `init`: the seal, "The full inquiry" with the parent's question, "Tap the video
linked below"). No bespoke graphics.

## Music

None (a Short is narration only in this delivery).

## QA

RESULT: PASSED (32 of 32 checks, including the three-minute rule; measured 44.4 s). Frames inspected: badge with the
real seal, eyebrow, content band, captions, citation and end card where SHORT_LAYOUT puts them.

## Release blockers

Narration is the edge draft voice; `npm run video -- final heat-pumps "conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac" --approved-by "<name>"`
re-narrates with Azure once a person accepts the draft. The ledger lists the Short as
`short:oil-propane-baseboard-with-ac` in the parent's `publish.json`; it may be uploaded privately now and goes public
only after the parent is live, with the related video set in YouTube Studio.
