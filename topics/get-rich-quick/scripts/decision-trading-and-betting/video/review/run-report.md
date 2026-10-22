# Run report: get-rich-quick decision:trading-and-betting

- Review mp4: `video/review/decision-trading-and-betting-review-private.mp4`
- Checklist: `video/review/checklist.md`
- Wall-clock: about 9 h end to end, mostly queued behind other renders and a PC sleep; script stages ran in parallel with other stories (approver jon, 2026-10-21)

## Evidence added

On `get-rich-quick/most-retail-day-traders-lose-money`, each replacing an uncited verdict on the same document:

- `chague-day-trading-for-a-living.txt#L30-L36` (right, 0.7): Brazilian equity futures, 2013-2015, those who kept at it 300+ days; 97% lost money, 0.4% earned more than a bank teller. Replaced L394-L404 (same figure, no market or period).
- `barber-odean-day-traders-learn.txt#L39-L46` (right, 0.7): Taiwan 1992-2006, "the vast majority of day traders are unprofitable". Replaced L476-L482 (group returns only).

## Script revisions

- r1: the writer set needsEvidence (population and period of both studies); after the evidence pass the same revision cited them. Review passed, 27 of 27.

## Notes for the editor (approved sentences, warnings held)

- s16: the 7 and 23.9 basis points are against holding the Taiwan market index, not raw account losses; suggested "they trailed the market by 7 basis points a day before costs".
- s20: Ross Cameron describes an obstacle he hit himself, not why the studied traders lost; suggested "Ross Cameron describes one obstacle he hit himself:".
- s22 opens "So yes:" after a question about how many end up ahead.

## Graphics

None bespoke: 24 generic scenes (12 typography, 5 excerpts, 7 charts including a waffle). Basis points are drawn as `count` tiles labelled "basis points".

## Music

Undertow (cleared): sc01-sc03, sc04-sc06, sc07-sc21, sc22-sc24. Music -19.4 dB under the voice, peak -1.4 dB.

## QA

`RESULT: PASSED`, 36 checks ok.

## Release blockers

- Narration is draft only (edge-tts: unofficial Microsoft Edge read-aloud API, no terms for published media).
- Music: cleared.

## Release build

- 2026-10-22: `npm run video -- final get-rich-quick decision:trading-and-betting --approved-by Jon` re-narrated the same words with Azure Speech (commercial terms) and packaged the release build; the blockers above are history.
