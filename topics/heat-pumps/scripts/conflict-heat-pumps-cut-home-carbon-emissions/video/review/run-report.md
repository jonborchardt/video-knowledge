# Run report: heat-pumps conflict:heat-pumps-cut-home-carbon-emissions

- Review mp4: `video/review/conflict-heat-pumps-cut-home-carbon-emissions-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: 42 min (one /produce run, approver jon, 2026-10-20)

## Evidence added

On `heat-pumps/heat-pumps-cut-home-carbon-emissions`, re-recorded at ranges that carry each result's limit beside its figure:

- `deetjen-2021-us-residential-heat-pumps.txt#L635-L642`: right, 0.5. 2.1% of the US housing stock would emit more CO2 after switching, with the assumption that grid CO2 falls 45% over the 15-year life.
- `wilson-2024-heat-pumps-for-all.txt#L248-L258`: right, 0.6. Average savings positive in every state and future grid scenario, levelized over the 16-year life, under full immediate adoption.

The earlier verdicts on the same pairs (L677-L681, L249-L251, uncited) stay in the store beside them.

## Script revisions

- r1: writer set needsEvidence for the two limits.
- r2: cites both. Review: blocking s25 (every-state average pools all prior fuels, heard as gas homes); warnings s24 (2.1% is of all houses), s19 (repeats s11), s22 (overclaim).
- r3: s25 says every home switching, not only gas; s24 says a share of all houses; s19 a short callback; s22 reworded. Review held s22 (ranked the grid as the biggest factor).
- r4: s22 makes no ranking. (The writer left `revision` at 3; a separate writer bump to 4, no text change.) Review passed, 26 of 26.

## Graphics

None bespoke: 16 generic scenes (10 typography, a bar chart, stat tiles, 3 excerpts, a transition).

## Music

Undertow (cleared): opening sc01-sc02, setup sc03-sc05, evidence sc06-sc14, ending sc15-sc16. Music -20.1 dB under the voice, peak -1.3 dB.

## QA

`passed: 36 of 36 checks` / `RESULT: PASSED` (261.9 s, 16 scenes).

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final heat-pumps conflict:heat-pumps-cut-home-carbon-emissions --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Re-lock run, 2026-10-26

- Mp4: `video/review/conflict-heat-pumps-cut-home-carbon-emissions.mp4` (release build of 2026-10-22, unchanged); checklist `video/review/checklist.md`. Wall-clock: 6 min (approver jonathan m borchardt).
- Why: a new verdict on the claim made the evidence package stale: `fraunhofer-2025-heat-pumps-existing-buildings.txt#L77-L83`, right, 0.4 (German grid 2024, measured heat pumps emitted 64% less CO2 than gas; press release). Independent sources 4 -> 5. No evidence added by this run.
- Script: r5, no sentence changed (the script cites only US and UK evidence; nothing it says is contradicted or counted). Re-review approved 26 of 26, carried the 17 dispositions forward, logged an info omission on s20 (Fraunhofer uses the average German mix, not marginal grid power; 0.4 confidence).
- Re-locked `release.json` (package 5108ce9ff2). Graphics, music and render untouched: nothing re-rendered; QA stays `passed (36 of 36)` / `RESULT: PASSED`.
- Release blockers: none new (narration and music cleared per the build report).

## Article and re-render run, 2026-10-27

- Mp4: `video/review/conflict-heat-pumps-cut-home-carbon-emissions-review-private.mp4` (draft build, private review package); checklist `video/review/checklist.md`. Approver: Jon Borchardt (`automated: /produce run started by Jon Borchardt`).
- Article: written (r1), reviewed: one blocking finding (table t1 put NBER whole-home footprint cuts, 36% and 68%, in one column with Fraunhofer's and the Canadian Climate Institute's cuts against gas heating only) and one warning (s18 claimed every study's result lines up with its grid assumption; only RMI and NBER show it). Revision r2 split the table by baseline, narrowed s18, and fixed "behind the meter" in s04. A fresh reviewer passed it (22 sentences, 25 of 25 assertions, 0 blocking; 23 needs-qualification warnings left open). Locked `article-release.json` revision 1.
- Evidence added: none. Script: unchanged (r5, release.json untouched).
- Re-render: the 2026-10-22 build predated the institution kit (board: look-stale). `video spike` re-rendered all 17 scenes (277.9 s, 8338 frames; the kit's close card is the new 17th scene) and mixed Undertow (4 cues, music -19.9 dB under the voice, peak -1.3 dB). QA: `passed: 36 of 36 checks` / `RESULT: PASSED`. Packaged.
- Release blockers: the re-render narrated with edge (draft), so the Azure release build of 2026-10-22 is now a private review build again. A person re-runs `npm run video -- final heat-pumps conflict:heat-pumps-cut-home-carbon-emissions --approved-by <name>` after watching it. Music: cleared.
