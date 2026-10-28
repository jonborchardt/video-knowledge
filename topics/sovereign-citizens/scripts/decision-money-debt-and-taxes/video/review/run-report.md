# Run report: sovereign-citizens decision:money-debt-and-taxes

- Review mp4: `video/review/decision-money-debt-and-taxes-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 5 h, mostly queued behind other renders and edge-tts throttling; script stages ran in parallel with other stories (approver jon, 2026-10-21)

## Evidence added

- `bryant-v-washington-mutual-wdva-2007.txt#L16-L33` (wrong, 0.6) on `birth-certificate-bond-security-traded-fund`: the $244,663.79 bill of exchange, the bank's refusal, the foreclosure, the theory, and the court's "clearly nonsense". Recorded on this claim because the script already cites Bryant L33-L34 on the secret-account claim.

## Script revisions

- r1: chain of two questions. The writer set needsEvidence (Bryant background); after the evidence pass the same revision cited it. Review: blocking s02 (a rhetorical line stating a fact) and s12 ("in a criminal case" not in the passage); warning s34 (who cited Henwood).
- r2: s02 factual with an assertion on L23 ("this loan is paid off"); s12 drops the phrase; s34 "the homeowner also cited". Review passed, 41 of 41.

## Notes for the editor

- s08 leaves the YouTube speaker unnamed ("one YouTube how-to video"): the channel is SovereignProductions369, but the validator reads the digits in a speaker's name as an uncited figure (also "A4V" in the title). Worth a validator fix.
- s26 could add that Buhtz's co-defendants had followed his advice (Bryant L48), which needs that passage recorded first.

## Graphics

None bespoke: 34 generic scenes (1 stat tile, 8 excerpts, 24 typography, 1 transition).

## Music

Undertow (cleared): sc01-sc04, sc05-sc32, sc33-sc34. Music -20.4 dB under the voice, peak -1.3 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final sovereign-citizens decision:money-debt-and-taxes --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.

## Article and re-render in the institution kit (2026-10-28)

- Wall-clock: about 50 min (approver Jon Borchardt, `automated: /produce run started by Jon Borchardt`).
- Article: written (r1, 40 sentences, 48 assertions, figure sc01, table t1, two unresolved callouts and one qualification callout). The first review held `heading:hook` ("A mortgage paid with a bill on a secret account": Bryant says the bill was refused and she did not tender payment); r2 changed it to "A mortgage bill drawn on a secret account"; a fresh reviewer passed it (48 of 48 verified, 0 blocking) and it was locked (`article-release.json`). One stale warning on s01 (the r1 heading overclaim) stays listed; it no longer applies.
- Evidence added: none. Script revisions: none.
- Re-render: `video/segment.mp4` dated 2026-10-22 predated the kit merge (board: look-stale). `npm run video -- spike` re-rendered all 35 scenes (incl. the `end` close card) in the institution kit: 12399 frames, 413.3 s; music -20.3 dB under the voice, peak -1.3 dB. QA `RESULT: PASSED`, 36 of 36 checks. Packaged as a private review build.
- The re-render turned the 2026-10-22 Azure release build back into an edge draft: release is blocked again until a person re-runs `npm run video -- final sovereign-citizens decision:money-debt-and-taxes --approved-by <name>`.
