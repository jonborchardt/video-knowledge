# Run report: heat-pumps decision:does-the-upfront-cost-eat-the-savings

- Review mp4: `video/review/decision-does-the-upfront-cost-eat-the-savings-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 5 h, mostly queued behind other renders and edge-tts throttling; script stages ran in parallel with other stories (approver jon, 2026-10-21)

## Evidence added

None.

## Script revisions

- r1: chain of two questions (what a heat pump costs against a furnace and AC; what credits and rebates are left in 2026). Review: no blocking; warnings s16 (two installed-cost figures disagree, presented as a correction), s17 (one database's spread stated for every median), s22 (rhetorical line claiming every price is before incentives), s33 (the median rebate is from pre-2021 projects).
- r2: s16 "disagrees"; s17 limited to the first database; s22 a plain question; s30 time order; s33 "predates today's rules". Review passed, 37 of 37.

## Notes for the editor

- s16 "The study from earlier" may be heard as Wilson rather than Edwards; the on-screen citation should make it clear.
- The cold-climate cost increments in Wilson (L451-L457) are left out: which homes they cover is stated outside the cited lines.

## Graphics

None bespoke: 30 generic scenes (13 typography, 9 stat tiles, 7 excerpts, 1 transition). The $370 and 32% gaps are spoken; the tiles show the source figures they come from.

## Music

Undertow (cleared): sc01-sc03, sc04-sc29, sc30. Music -20.8 dB under the voice, peak -1.4 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Run 2026-10-27: article and re-render in the institution kit

Approver: Jon Borchardt. Wall-clock about 1 h 25 min (18:46 to about 20:10), mostly the render (1960 s).

### Article

- r1 (writer): hook, question-1, question-2, close; 49 sentences, 59 assertions, tables t1-t4, figures sc10 and sc13.
- Review 1: held s17 and s18 (blocking: both treated the 32 percent premium from the NREL efficiency-measures database medians as "installed prices" set against the same database's $5,550 vs $5,180, a contrast the evidence does not draw), s25 (warning: the $2,000-$30,000 range and panel shares were attributed to the LBNL 2021 report, not Wilson 2024) and s47 (warning: "since then" / "still" made the February 2026 tracker read as later than June).
- r2: s17 and s18 restated as two analyses of the same database; s25 names the NREL and LBNL analysis; s47 calls the tracker an earlier snapshot.
- Review 2: all units approved, `RESULT: PASSED` (59/59 assertions verified). Info notes left for the editor: s19 repeats the 32 percent figure a third time; s41 could mention full-cost low-income programs, but that line (Canadian study L2040) is uncited, so only a person can add it.
- Locked: `article-release.json` revision 1, approved by `automated: /produce run started by Jon Borchardt`.

### Evidence added

None.

### Re-render

- `segment.mp4` dated 2026-10-22, before the branding merge; the board said `look-stale`. Re-rendered with `npm run video -- spike` (31 scenes, 406.2 s, all in the institution kit, new `end` close card), then `package`.
- QA: `RESULT: PASSED`, 36 of 36 checks. Music: Undertow, 3 cues, -20.8 dB under the voice, peak -1.4 dB.
- **The 2026-10-22 Azure release build is replaced by a draft (edge-tts) build**: `review.json` is now `private review build`. To release, a person accepts the draft and runs `npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings --approved-by "<name>"`.
