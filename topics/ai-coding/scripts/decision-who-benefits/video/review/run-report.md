# Run report: ai-coding decision:who-benefits

- Review mp4: `video/review/decision-who-benefits-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 9 h end to end, mostly queued behind other renders and a PC sleep; script stages ran in parallel with other stories (approver jon, 2026-10-21)

## Evidence added

None. (The premise's "Google's trial used code no participant knew" is at 2410.12944 L210-L213, uncited; the script gives the Google authors' own explanation instead.)

## Script revisions

- r1: chain of two questions. Review: blocking s06 (merged Willison's comparison with non-coders into the trials' comparison), s36 (repeated the acceptance share and made checking the cause of the slowdown), s38 (advice contradicted s35); warnings s04, s15, s22, s24.
- r2: all seven fixed; s15 states METR's slowdown without a figure (no study passage carries the 19%). Review passed, 38 of 38.

## Notes for the editor

- METR's slowdown has no figure on screen or in narration: the 19% is only in YouTube statements in the corpus.

## Graphics

None bespoke: 27 generic scenes (19 typography, 5 charts, 3 excerpts). Two-column passages are shown as typography, not excerpts.

## Music

Undertow (cleared): sc01-sc03, sc04-sc26, sc27. Music -20.8 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final ai-coding decision:who-benefits --approved-by automated: final run started by Jon (release package preview)` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
