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

## Release build

- 2026-10-22: `npm run video -- final organic-food conflict:organic-farming-uses-pesticides --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Re-lock after new verdicts (2026-10-26)

- Approver: automated: /produce run started by jonathan m borchardt. Wall-clock about 10 min. The story was already packaged (release build); nothing was re-rendered.
- Evidence package regenerated (db3fc8d736 -> 0a1129e37a): new supporting cites on cited claims (USDA AMS 2010-2011 residue pilot, Fagan 2020 urinary glyphosate, CVUA Stuttgart 2021 monitoring). Purely additive; nothing the script cites changed. No evidence recorded by this run.
- Script r5: metadata only (package fingerprint, date); every sentence unchanged. Re-review approved 32 of 32 at unchanged fingerprints, 16 dispositions carried; one warning held (s10 "more closely regulated", as above); info: the USDA AMS pilot could also back s23.
- Re-locked release.json (revision 5, script 1754c299c9, package 0a1129e37a). Storyboard, render.json and the build are unchanged, so the packaged release build (`video/review/conflict-organic-farming-uses-pesticides.mp4`, QA `RESULT: PASSED`) stands.

## Article and re-render in the institution kit (2026-10-28)

- Approver: automated: /produce run started by Jon Borchardt. Wall-clock about 1 h 5 min (article about 20 min, render 24 min). No evidence recorded; script and storyboard unchanged.
- Article: r1 written (hook, two questions, close; tables t1 EU hazard classes, t2 residue frequency, t3 urinary pesticide falls). Review r1 blocked: s31 counted Hyland 2019 and Fagan 2020 (the same 16 people) as two studies; s27 callout typed unresolved for a qualified claim, missing that the meta-analysis counts frequency not amounts; s13/t1 dropped the two hazard rows where organic substances appear (acutely toxic 99 vs 3, PBT 54 vs 1). r2 fixed all three (new s37). Re-review held t2/s22 on a warning: row labels did not name their baseline (all samples vs conventional crops), row 4 lacked percent signs. r3 fixed it; a fresh reviewer approved, 49 of 49 assertions verified, `RESULT: PASSED`. Locked `article-release.json` revision 1.
- Re-render: the build (2026-10-22, Azure release build) predated the kit merge and the board called its look stale. `npm run video -- spike` re-rendered all 27 scenes (0 cached) in the institution kit with edge draft narration: 10312 frames, 343.73 s. QA `RESULT: PASSED`, 36 of 36 checks. Packaged as the private review package (`video/review/conflict-organic-farming-uses-pesticides-review-private.mp4`).
- Release blocker: this turns the Azure release build back into a draft. A person accepts the draft and runs `npm run video -- final organic-food conflict:organic-farming-uses-pesticides --approved-by <name>` before upload. Music: Undertow, cleared.
