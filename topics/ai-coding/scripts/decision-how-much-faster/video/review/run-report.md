# Run report: ai-coding decision:how-much-faster

- Review mp4: `video/review/decision-how-much-faster-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 45 min (one /produce run, approver jon, 2026-10-21)

## Evidence added

None.

## Script revisions

- r1: chain of two questions (how much faster; can developers tell). Facts whose limits sit only in verdict notes were left out (company names and counts for the Google and Microsoft/Accenture studies, Shan's 18%). Review: blocking s18 (the reason developers decline METR's study sat outside its cite); warnings s22 ("real" gains, unscoped to the tools tested) and s33 (repeated s31).
- r2: s18 also cites `metr-2026-experiment-design.txt#L58-L62`; s22 scoped to the tools tested and "modest"; s33 trimmed. Review passed, 35 of 35.

## Graphics

None bespoke: 27 generic scenes (11 typography, 8 stat tiles, 2 bar charts, 3 excerpts, 2 quote cards, 1 transition). sc14 shows METR 2026's estimates as 18% and 4% cuts in task time (tiles cannot take negatives); the note says both ranges reach a slowdown.

## Music

Undertow (cleared): opening sc01-sc02, evidence sc03-sc26, ending sc27. Music -20.8 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok (345.3 s, 27 scenes). The spike failed twice on transient errors (edge-tts "No audio was received"; a Remotion temp stitch directory vanishing) and passed on the third run, reusing 12 cached chunks.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final ai-coding decision:how-much-faster --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Re-render in the institution kit (2026-10-27)

- Why: the release build above (uploaded private as YouTube `Ry9Va8V0vA8`, build 9b2dfb11fb) was rendered on 2026-10-22, before the institution-branding merge, so it shows the old look. The board was already `packaged`; nothing in the script, storyboard or render.json changed.
- `npm run video -- spike ai-coding decision:how-much-faster`: 28 scenes rendered fresh in the institution kit (27 storyboard scenes plus the kit's `end` close card), 361.6 s; music -20.7 dB under the voice, peak -1.3 dB. `RESULT: PASSED`, 36 of 36 checks.
- `npm run video -- package`: new draft build ad653caeae, packaged as `video/review/decision-how-much-faster-review-private.mp4` with `video/review/checklist.md`. Wall-clock about 30 min.
- Evidence added: none. Script revisions: none. Graphics: none bespoke.
- Article: the board on main has no article stage (the stage is on the unmerged branch feat/article-stage), so no article was written.
- Release blockers: narration is draft again (edge-tts). After a person accepts the new draft, `npm run video -- final ai-coding decision:how-much-faster --approved-by <name>` re-narrates it with Azure; the private upload Ry9Va8V0vA8 is the old-look build and needs replacing by a new upload. Music: cleared.

## Companion article (2026-10-27)

- Board stage on start: `article` (missing). Nothing re-rendered; the build is still the draft ad653caeae in the institution kit.
- Revision 1 (writer): 34 sentences, one table (t1, measured change by study), figures from scenes sc11, sc14, sc21, sc23; gap and qualification callouts for every gap and the Qualified/Unresolved claims.
- Review 1 (a different agent): blocking on s14 (METR 2026 compares periods, not model generations), s09 (the Shan field study's self-selection limit was missing), s30 (repeated s28); warnings on s03/t1 (one column mixed five measures, METR's 19% is a slowdown) and s19 (over-broad "code suggestion tool").
- Revision 2: Shan row and s08 removed (the limit is only in a verdict note, not a cited passage); s14 reworded; s30 deleted; t1 caption and column relabelled, METR row marked a slowdown; s19 narrowed.
- Review 2: `RESULT: PASSED` (32 sentences, 39 of 39 assertions verified, 0 blocking, 28 needs-qualification warnings, 0 unreviewed). Info note: s19's "largest workplace estimate" sits beside s17's "largest figures"; an editor may add "measured".
- Locked: `article-release.json` revision 1, approved by `automated: /produce run started by Jon Borchardt`.
- Evidence added: none. Board now `packaged`; next is a person's: accept the draft, `video final`, then a new upload (the private upload Ry9Va8V0vA8 is the old-look build).
