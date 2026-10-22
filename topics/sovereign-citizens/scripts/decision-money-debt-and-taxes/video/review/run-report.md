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
