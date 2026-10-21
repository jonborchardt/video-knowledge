# Run report: sovereign-citizens / decision:courts-and-jurisdiction

"The Courtroom Escape Hatches Sovereign Citizens Swear By": a chain of two questions, 42 scenes, 9:27.

- **Video:** `video/review/decision-courts-and-jurisdiction-review-private.mp4`
- **Checklist:** `video/review/checklist.md`
- **Wall-clock:** about 1 h 40 min (the first full render took 33 min).
- **Approver:** automated: /produce run started by jon

## Evidence added

None. The package has 10 claims, 15 documents and 1 gap. The writer never set `needsEvidence`. Counts that appear only in verdict notes (1,089 Canadian decisions, 51 refused leave applications, and others) were said in words from the cited passages, not as figures.

## Script revisions

- **Revision 1:** 56 sentences, 10 needs-qualification warnings. The review blocked three sentences:
  - **s20:** said the McCann court "had heard this argument before". The passage says other courts had.
  - **s36:** "nobody has published a US count" is a claim about the world. It is now limited to "the evidence here".
  - **s48:** "the charter this version leans on hardest" has no support. The clause was cut.

  It also held four sentences on warnings:
  - **s05:** "points at a real document" became "leans on something real".
  - **s29:** the paraphrase now matches the speaker's context (state nationals).
  - **s43:** "tax prosecutions" became "tax cases" (Upton v. IRS is civil).
  - **s53:** a clause that repeated s51 was replaced.
- **Revision 2:** the re-review approved every sentence. Validation passed: 50/50 assertions verified, 0 warnings, 10 dispositioned.

## Graphics

| Scene | Kind | Component |
|---|---|---|
| sc04 | `sc-courts-kit` (diagram) | new `CourtsKit.tsx` (icons reused from the d692140 Toolkit) |
| sc09 | `sc-courts-shop` (animation) | new `ShopProtest.tsx` |
| sc19 | `sc-courts-timeline` (diagram) | new `DistrictTimeline.tsx` |
| sc30 | `sc-courts-nationals` (diagram) | new `NationalCircles.tsx` |

The visual review approved all four on the first pass. No scene was drawn as labelled text. Some labels in the descriptions are not in `onScreenText`, so they are drawn as icons, not words:
- **sc04:** "UCC 1-308" by the signature.
- **sc09:** "UNDER PROTEST" on the stamp.
- **sc19:** "District of Columbia", the three icon captions and "sovereign power".

To show them as words, add them to the storyboard's `onScreenText` and send the scenes back.

## Music

`undertow`: three cues.
- `opening`: pulse, sc01–sc04
- `evidence`: texture, sc05–sc39
- `ending`: pulse, sc40–sc42

The music sits -20.5 dB under the voice, with a peak of -1.4 dB.

## QA

`passed: 36 of 36 checks`, `RESULT: PASSED`

## Release blockers

- **Narration:** draft only, from the unofficial Microsoft Edge read-aloud API, with no terms for published media. It needs a licensed voice before public release.
- **Music:** `undertow` is marked `licence.cleared: true` in its composition.json.
