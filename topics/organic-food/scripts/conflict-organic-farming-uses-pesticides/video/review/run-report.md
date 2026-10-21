# Run report: organic-food conflict:organic-farming-uses-pesticides

- Review mp4: `video/review/conflict-organic-farming-uses-pesticides-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 20 min to the first stop, then a corrective pass, a scene fix and renders delayed by edge-tts throttling (approver jon, 2026-10-20/21)

## Evidence added

- `eu-2021-1165.txt#L181-L193` (new document, EU Regulation 2021/1165 Annex I; wrong, 0.85) on `organic-farming-bans-all-synthetic-pesticides`: paraffin oils, lime sulphur, copper compounds, deltamethrin and lambda-cyhalothrin in traps only.
- `baker-2002-residues.txt#L20-L26` (new document, Baker et al. 2002 abstract; right, 0.6) on `organic-produce-carries-lower-pesticide-residues`: organic samples had about a third as many residues, at consistently lower concentrations.
- The first evidence pass was refused: the eCFR and Baranski passages sit in documents the script already cites for those claims.

## Script revisions

- r1: chain of two questions. Review: blocking s02 (uncited shopper motive), s07 (US examples outside the cited lines), s32 (close re-answered).
- r2: fixed s02 and s32; needsEvidence for s07 and s24.
- r3: s07 uses Europe's list; s24 drops "only how often, not how much" (Baker contradicts it). Review: blocking s11 ("not regulated more closely" overreaches). Stopped at the revision limit (commit "STOPPED").
- r4 (corrective, authorised by jon): s11 ends on the quote "evaluated in accordance with the same legal framework". Review passed, 31 of 31.

## Notes for the editor

- s10 (approved, warning held): Simnett's quote says organic pesticides are "more closely regulated"; s11 now implies the answer without tying it back. Trim the quote or make s11 say the 26 pass the same approval as the rest.

## Graphics

None bespoke: 26 generic scenes. sc08 (385 EU-approved substances against 26 for organic) failed the frame-fit guard as a `bar` (count points draw one dot per unit, 385 dots ran off the frame); `render.json` now names `columns` for it.

## Music

Undertow (cleared): sc01-sc02, sc03-sc24, sc25-sc26. Music -20.6 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.
