# Run report: heat-pumps conflict:heat-pump-costs-less-run-heating

- Review mp4: `video/review/conflict-heat-pump-costs-less-run-heating-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 14 min to the first stop, then about 25 min of corrective passes and the render (approver jon, 2026-10-20/21)

## Evidence added

None recordable. Deetjen 2021's cost definition (private NPV = energy savings minus amortised installation cost) decides no claim, and the study reports no running cost by fuel.

## Script revisions

- r1: Review: blocking s16 and s29 (Deetjen's oil "private loss" includes installation cost, heard as running cost); warnings s09 (the hot-climate homes' loss came from new cooling) and s20 (RMI's Providence result is a lifetime cost).
- r2: s09 fixed; needsEvidence for Deetjen's definition (nothing recordable).
- r3: dropped Deetjen's oil result but kept RMI's (also lifetime cost). Review: blocking s16, s19, s20 (selective). The run stopped at the revision limit (commit "STOPPED").
- r4 (corrective, authorised by jon): deleted s16-s19, s20 only sets the scene. Review: blocking s21 (the "oil and propane first" recommendation also rests on RMI's lifetime results).
- r5 (corrective, authorised by jon, same blocker): deleted s20 and s21. Review passed, 25 of 25. The oil exception now rests on the Cadmus running-cost evidence only.

## Notes for the editor

- At 2019 prices only 66-100% of oil homes saved (Wilson); the script does not give that figure, s26 says the oil result depends on the oil price.

## Graphics

None bespoke: 22 generic scenes (14 typography, 5 stat tiles, 3 excerpts). The oil switch-off temperatures are a typography list (no temperature unit).

## Music

Undertow (cleared): four cues, sc01-sc02, sc03-sc05, sc06-sc16, sc17-sc22. Music -19.7 dB under the voice, peak -1.4 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Run 2026-10-27: companion article and re-render in the institution kit

- Approver: Jon Borchardt (automated: /produce run started by Jon Borchardt). Wall-clock: about 10 min of work spread over 2026-10-27 01:43 to 17:05 (idle ~5 h on a lost agent notification, then paused by the user and resumed after a merge of main).
- Article: written (r1), reviewed by a different agent: blocking s20 (Deetjen's "economic loss" is a lifetime figure including the purchase, not a running cost) and s22 ("anyone switching from baseboards" turned NRCan's energy figure into a bill promise); warnings s03 ("without conditions" against a quoted "almost everywhere") and table t2 (the 33% row against a propane furnace, the 53% row against resistance heat, unstated). r2 fixed all four; a fresh reviewer passed it; locked as `article-release.json`. After merging main, the lock was re-run to add the figure snapshot (sc16) the new release format carries; text, approval and history unchanged, no public-record revision.
- Evidence added: none. Script revisions: none.
- Re-render: `segment.mp4` dated 2026-10-22 predated the branding merge; `npm run video -- spike` re-rendered it in the institution kit: `RESULT: PASSED`. Repackaged with `npm run video -- package`: mp4 `video/review/conflict-heat-pump-costs-less-run-heating-review-private.mp4`, checklist `video/review/checklist.md`.
- Release blocker: the previous package was the Azure release build; the re-render narrates with edge, so this is a draft again. When the draft is accepted, `npm run video -- final heat-pumps conflict:heat-pump-costs-less-run-heating --approved-by <name>` re-narrates it for release. Music unchanged (Undertow, cleared).
