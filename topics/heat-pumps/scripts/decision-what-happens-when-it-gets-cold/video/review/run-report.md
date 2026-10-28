# Run report: heat-pumps decision:what-happens-when-it-gets-cold

## 2026-10-27 run (article, re-render in the institution kit)

- Review mp4: `video/review/decision-what-happens-when-it-gets-cold-review-private.mp4`; checklist `video/review/checklist.md`.
- Wall-clock: about 65 min (19:42 to 20:48; approver Jon Borchardt). Branch: main (another person's agent shares the checkout).
- Evidence added: none. Script: unchanged (r3, release.json revision 3).
- Article: r1 (59 sentences, 3 tables, 2 figures from sc14 and sc19). Review held 12 units, 3 blocking: s22 claimed the efficiency and output drop was consistent across studies with no assertion (output measured on one unit); s34 compared sizing with the weather, which no evidence does; s52 repeated s25. Warnings: dek and s46 overstated output loss; s41 missed the zonal-savings limit on the break-even; s43 misread the Toronto model; s48 counted a lifetime-cost model as running cost; s47 repeated s36; s51 left out the fall to COP 1; t2 said 22 sites for the 25% figure (8 and 11 had data); t3 flattened "above 58 F". r2 fixed all of them (new table t4 for the bill rows). Re-review approved every unit: validation `RESULT: PASSED` (0 blocking, 64/64 assertions verified, 56 needs-qualification warnings retired by the reviewer). Locked `article-release.json` revision 1, approved by `automated: /produce run started by Jon Borchardt`.
- Re-render: the build predated the branding merge (board halt `look-stale`). `npm run video -- spike` re-rendered all 34 scenes (33 storyboard + the kit's `end` close card) in the institution kit: 467.5 s, 2052 s render. Two edge-tts clips came back truncated (s03, s28); the cached clip was deleted and the step retried. Music unchanged: Undertow, 4 cues, -20.1 dB under the voice, peak -1.1 dB.
- QA: `RESULT: PASSED` (36 of 36 checks).
- Release blocker: the re-render is narrated with edge (draft), so the 2026-10-22 Azure release build is now a draft again. A person accepts the draft and runs `npm run video -- final heat-pumps decision:what-happens-when-it-gets-cold --approved-by <name>` to re-narrate with Azure. Music: cleared.
- `npm run validate`: typecheck, lint, format and build passed; 16 unit tests timed out at 5 s under load (production, publish, review-action, uploader, tools, video tests), none in files this run changed.

## 2026-10-26 re-run (stale evidence package)

- Release mp4: `video/review/decision-what-happens-when-it-gets-cold.mp4` (release build from 2026-10-22, azure narration); checklist `video/review/checklist.md`.
- Wall-clock: about 10 min (approver jonathan m borchardt). Nothing re-rendered: the script fingerprint (106cb5cd54), storyboard and render.json are unchanged, so the board kept the build.
- Evidence added: none by this run. The package was rebuilt (8cb301861b, 8 claims, 12 documents, 3 gaps) because the Efficiency Maine 2026 whole-home study and the Energy Systems Catapult 2023 UK trial were recorded on cited claims.
- Script r3: no narration changed. Qualifications added to s17.a, s19.a, s40.b (they cite only the US field tests, not the UK trial, which reported no capacity figures) and s26 (22 field-test sites; Maine found backup mostly fossil, resistance rare). The re-review approved 47 of 47 and retired the three new needs-qualification warnings with dispositions; one info note on s41 (Maine backup mix, and its COP of about 2 at -10 F supports s40), optional.
- Re-locked: release.json revision 3, package 8cb301861b, approved by `automated: /produce run started by jonathan m borchardt`.
- Graphics and music: unchanged (Undertow, 4 cues).
- QA: `RESULT: PASSED` (36 of 36, from the 2026-10-22 release build).
- Release blockers: none new; narration (azure) and music are recorded cleared in the build report.

## Earlier run (2026-10-21)


- Review mp4: `video/review/decision-what-happens-when-it-gets-cold-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 57 min (one /produce run, approver jon, 2026-10-21)

## Evidence added

None.

## Script revisions

- r1: 47 sentences. Review: 2 blocking. s36 jumped from the metered gas break-even to a rating curve on paper, skipping that metered cold-climate units broke even only above 58 °F. s40 said "they kept heating below zero" though one NREL site's compressor stopped below 0 °F. Warnings: s27/s28 tied causes to the 25% backup figure; s37 lifetime cost beside running cost; s43 missing the over-10-year retrofit payback.
- r2: all six fixed. Review passed, 47 of 47.

## Notes for the editor (reviewer, not filed)

- s43 drops "typically" from the payback limit ("typically over 10 years").
- s34/s36 leave out that the gas break-even ignores zonal savings (could lower it by 20 °F or more).
- s28 could add that the controls fault is expected to be fixed before the prototypes ship.

## Graphics

None bespoke: 33 generic scenes (19 typography, 9 stat tiles, 4 excerpts, 1 transition). sc26 shows only the gas break-even; the propane break-even (-15 °F) would not pass as a chart value and is in the chart note.

## Music

Undertow (cleared): opening sc01-sc02, setup sc03-sc05, evidence sc06-sc28, ending sc29-sc33. Music -20.2 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok (451.4 s, 33 scenes).

## Code

`tests/production.test.ts` named this story as the one without a script dir; it now picks any unproduced heat-pumps story, so producing one no longer breaks it.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final heat-pumps decision:what-happens-when-it-gets-cold --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
