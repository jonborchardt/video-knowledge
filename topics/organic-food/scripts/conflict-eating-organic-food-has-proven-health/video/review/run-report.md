# Run report: organic-food conflict:eating-organic-food-has-proven-health

- Review mp4: `video/review/conflict-eating-organic-food-has-proven-health-review-private.mp4` (draft build, edge narration)
- Checklist: `video/review/checklist.md`
- Wall-clock: about 50 min (one /produce run, approver Jon Borchardt, 2026-10-27/28)
- Goal: the article stage and a re-render in the institution kit (the old segment.mp4 dated 2026-10-22, before the branding merge; the board called it look-stale).

## Evidence added

None.

## Article

- r1 (writer): 44 sentences, 49 assertions, 1 table (t1), figures on sc12 and sc20; every gap and claim carries an `unresolved` callout.
- Review 1: blocked on 3 findings: s28 used the whole Million Women cohort (1.3 million) instead of the organic analysis (623,080); t1 mixed a 0.6% absolute risk difference with a 7% share of organic eaters in one column; s19 overgeneralised across seven reviews ("none reports a benefit") against Vigar's wording. Warnings on s15 (meat composition uncited), s16 (Dirty Dozen model "did not indicate"), s18 ("largely" dropped).
- r2 (writer): s28 now "far larger" without the count; t1 now one column, the overall cancer estimate (HR 0.75 NutriNet-Sante, RR 1.03 Million Women); s19 says no review concludes organic food has been shown to cause a benefit (Vigar, Mie, AAP); s15, s16, s18 fixed.
- Review 2: PASSED, 44 of 44 sentences and every unit approved, 49 of 49 assertions verified, 30 needs-qualification warnings open (non-blocking). Info: t1's header could name the measure.
- Locked: article-release.json revision 1, approved by `automated: /produce run started by Jon Borchardt`.

## Script revisions

None (release.json unchanged).

## Graphics

None built or changed.

## Re-render

- `npm run video -- spike` re-narrated with edge (draft), re-timed, re-rendered every scene in the institution kit, mixed the existing music cues.
- QA: `RESULT: PASSED` (36 of 36 checks).
- Packaged as a private review package; board: packaged, no look-stale.

## Release blockers

- The previous Azure release build is now replaced by an edge draft build: a person must accept the draft and run `npm run video -- final organic-food conflict:eating-organic-food-has-proven-health --approved-by "<name>"` to re-narrate for release.
- Music clearance unchanged (recorded in the build report).
