# /produce run: inflation-2026 decision:is-the-economy-booming

Approved by: automated: /produce run started by Jon (release.json, revision 4).

- Video: `video/review/decision-is-the-economy-booming-review-private.mp4` (183.7 s, 18 scenes)
- Checklist: `video/review/checklist.md`
- Wall-clock: about 2 h 30 min (includes one stop for a person's decision)

## Evidence added

- `labor-market-full-employment-2026`: the BLS September 2026 jobs verdict (partly, 0.6, note unchanged) re-cited from
  `bls-employment-situation-2026-09.txt#L25-L27` to `#L14-L27`, so the cited passage holds the +29,000 payroll figure as
  well as the 4.2% unemployment rate. Recorded with `--replace-cited` on Jon's explicit approval after the run stopped
  on it.
- New document `sources/fomc-sep-2026-09-16.txt` (FOMC Summary of Economic Projections, 16 Sep 2026):
  - `economy-booming-2026`: partly, 0.55, `#L13-L17`: longer-run real GDP growth median 2.0% (central tendency
    2.0-2.2%), so the 2.5% and 2.2% quarters are a little above trend, not a boom.
  - `labor-market-full-employment-2026`: partly, 0.55, `#L13-L21`: longer-run unemployment median 4.2%, so September's
    4.2% sits at the Fed's estimate of the sustainable rate.

Code fix found on the way: `loadTopic` (`src/lib/topics.ts`) dropped a re-recorded verdict whose document and note
matched an older one, so the replaced cite never reached stories.json or the package. A newer copy now replaces the
older one.

## Script revisions

1. First draft. Blocked: s12's "29,000 jobs" was not in the cited passage (L25-L27); `needsEvidence` set.
2. Re-cited to L14-L27. Review held s03 (both camps quote numbers: Trump's quote has none), s08 and s20 ("usual pace",
   "low unemployment" only in the verdict note), s18 (Trump's wage boast tested against the wrong period, speaker not
   named), s24 (repeats s22), with warnings on s21 (repeats s15-s16) and s12 ("slowed" vs "changed little").
3. s03 reworded, s18 names Trump and checks both periods, s21 and s24 cut, s12 "barely moved"; s08 and s20 kept and
   `needsEvidence` set for a trend-growth and a natural-rate benchmark.
4. s08 and s20 cite the FOMC projections. Re-review approved all 22 sentences; 12 qualification warnings dispositioned.

## Graphics

- sc12, kind `eb-real-pay` (diagram), component `RealPayColumns.tsx`: real hourly pay vs a year earlier, March to
  September 2026, as columns around a zero line. Approved by the visual review on the first pass. Drawn as described,
  no labelled-text fallback.
- Shared change for it: a `passage` flag on `KindSpec` (`src/video/kinds.ts`); for such kinds `src/video/timeline.ts`
  reads the scene's first cited passage into `excerpt`, and the component takes the figures from those rows. No other
  kind sets it.
- `tests/packages.test.ts` no longer requires an 8-12.5 minute script (stories have no length format).

## Music

Composition `undertow` (cleared): opening sc01-sc02 `pulse`, setup sc03-sc04 `active`, evidence sc05-sc15 `texture`,
ending sc16-sc18 `pulse`. Music sits 19.5 dB under the voice; peak -1.4 dB.

## QA

`passed: 36 of 36 checks` - RESULT: PASSED

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: `undertow` is cleared.

## Release build

- 2026-10-22: `npm run video -- final inflation-2026 decision:is-the-economy-booming --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Article and re-render (2026-10-27)

Second /produce run, from `article` to `packaged`, about 45 minutes wall-clock. No evidence added; no script revisions.

- Article: written (revision 1), reviewed: 2 blocking findings (s23 dated Trump's quote to "the year to January"
  without a source for the date; s24 said payroll growth "slowed", the cited release only says September payrolls
  changed little) and a warning on `meta.description` ("held at 4.2 percent", long-run pace stated as a measurement
  rather than a Fed projection). Revision 2 fixed all three; a fresh reviewer approved them (29/29 assertions
  verified, 0 blocking, 16 needs-qualification warnings left open). Locked: `article-release.json`, approved by
  `automated: /produce run started by Jon Borchardt`.
- Re-render: the 2026-10-22 build predated the branding merge (board: `look-stale`).
  `npm run video -- spike` re-rendered all 19 scenes in the institution kit (5990 frames, 199.7 s), QA
  `passed: 36 of 36 checks` - RESULT: PASSED; `npm run video -- package` rewrote `video/review/`.
- Release blocker again: the re-render narrates with edge (draft), so the 2026-10-22 Azure release build is now a
  private draft package. Once the draft is accepted, `npm run video -- final inflation-2026
  decision:is-the-economy-booming --approved-by <name>` re-narrates it with Azure for release. Music `undertow`
  remains cleared.
