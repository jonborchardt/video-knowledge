# Run report: Do Most New Businesses Really Fail in a Few Years?

`/produce get-rich-quick surprise:most-new-businesses-including-online-stores`, approver jon (lock recorded as
`automated: /produce run started by jon`). Branch `produce/get-rich-quick-surprise-most-new-businesses-including-online-stores`.
Started 2026-10-19 07:26 UTC, packaged about 08:35 UTC (about 70 minutes wall-clock, including two board fixes
made mid-run).

**Ready to watch:** `video/review/surprise-most-new-businesses-including-online-stores-review-private.mp4`
(9 min 55 s, 36 scenes, 7 chapters), checklist `video/review/checklist.md`, upload text `video/review/description.txt`.

## Evidence added

The writer stopped at revision 2 (`needs-evidence`): the script could not say what the BLS survival table counts.
An evidence agent fetched three BLS pages and recorded four verdicts on
`get-rich-quick/most-new-businesses-including-online-stores`, each `partly`, confidence 0.4:

- `sources/bls-qcew-concepts.txt#L48-L48`: an establishment is a single location (a store, a factory); a firm may
  have several.
- `sources/bls-bed-age-survival-faq.txt#L67-L73`: age and survival are measured per establishment; a chain's new
  branch is a new opening.
- `sources/bls-bed-faq.txt#L118-L120`: a closing is an establishment whose employment goes to zero (it says that
  the jobs stopped, not why).
- `sources/bls-bed-faq.txt#L96-L98`: records are linked across a change of ownership, so a sale is meant to continue,
  not to close.

No passage says whether a move to a new address counts as a closing; the script says so. `record-sources` did not
refuse anything (no cited verdict was replaced).

## Script revisions

- **Revision 1:** the reviewer approved 41 of 58 sentences and raised 7 blocking findings. The script cited a "BLS
  note" that does not exist (s30), wrongly implied Shopify had the wrong cohort (s33), read establishments as
  businesses (s35), and called the SBA curve "the same" when it shows lower survival (s39). It also said exits
  include sales with no source (s41, s42), and its verdict left out the SBA figure that supports the slogan (s56).
- **Revision 2:** fixed all seven. Asked for the two BLS definitions instead of keeping the unsupported exit wording.
- **Revision 3:** written against the rebuilt package. Added the establishment, closing and ownership-change
  definitions (s35, s41, s58, s59). Re-review: 57 of 58 approved, s20 held on a warning.
- **Revision 4:** s20 cut to "That is a real loss. But it is not most." Re-review approved it, and validation
  `passed`: 59 of 59 assertions verified, 0 blocking.

## Graphics

- sc25: built as `nb-branch-closing` (new component `BranchClosing.tsx`). A company outline holds three stores; the
  middle one goes dark with a "closing" tag on "stopped", and the outline pulses on "carries". A separate visual
  reviewer approved it at key `c3f14ef107`. No scene was drawn as labelled text instead of its diagram.
- The storyboard planned no other diagrams. The definitions are shown as document excerpts (sc20, sc24, sc26).

## Video fixes

- QA run 1 failed on two checks. The first, "sc25 assets", was a code bug: QA did not know a bespoke kind draws its
  own assets. I fixed it in code. The second was a 5 s blank at the start of sc07: the list waited for words spoken
  late. A video-fix agent added `line:1` and `line:2` cues in `render.json`.

## Music

`undertow` (cleared), drafted by `npm run music -- cues`:

- `pulse`, -11 dB, from sc01 to sc05
- `active`, -13 dB, from sc06 to sc09
- `texture`, -13 dB, from sc10 to sc29
- `pulse`, -11 dB, from sc30 to sc36

The voice ducks the music by -2.5 dB. The mix sits 19.3 dB under the voice, with a peak of -1.3 dB.

## QA

`RESULT: PASSED` (36 of 36 checks, with the soundtrack).

## Worth a look when you watch (QA cannot judge these)

- **sc01, sc02, sc06, sc08:** the quote cards are empty at mid-scene in the contact sheet. Check that each quote
  appears with its words, not late.
- **sc05:** the table excerpt shows only the date header row, not the survival figures.
- **sc13, sc15, sc22:** the lowest bars run into the citation block at the bottom of the frame.
- **sc20, sc24, sc25, sc26:** the citation's second line repeats the file name (the new BLS documents have no
  display name).
- **s37:** the book is cited as "The Case against MLM"; its full title is "The Case (for and) against Multi-level
  Marketing".

## Release blockers

- The narration is a draft voice (edge-tts). It is not licensed for publication.
- Music: `undertow` is cleared.
