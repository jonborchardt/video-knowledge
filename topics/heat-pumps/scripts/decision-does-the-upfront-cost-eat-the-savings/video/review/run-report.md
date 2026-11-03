# Run report: heat-pumps decision:does-the-upfront-cost-eat-the-savings

Unattended run (npm run run -- story), 2026-11-03T19:22:34.312Z to 2026-11-03T19:40:40.932Z; journal in F:\github\video-knowledge\topics\heat-pumps\scripts\decision-does-the-upfront-cost-eat-the-savings\run.

## Agents

## Commands
- npm run video -- final heat-pumps decision:does-the-upfront-cost-eat-the-savings --approved-by Jon (exit 0, 1919 s)
- npm run publish -- upload heat-pumps decision:does-the-upfront-cost-eat-the-savings --by Jon (exit 0, 32 s)
- npm run publish -- verify heat-pumps decision:does-the-upfront-cost-eat-the-savings --by Jon (exit 1, 1 s, RESULT: FAILED (tags))
- npm run publish -- push heat-pumps decision:does-the-upfront-cost-eat-the-savings --by Jon (exit 0, 6 s)
- npm run publish -- verify heat-pumps decision:does-the-upfront-cost-eat-the-savings --by Jon (exit 1, 1 s, RESULT: FAILED (tags))

## Guard events and halts
- awaiting-person: youtube: the verification still fails after a push: tags: differs from the composed tags; npm run publish -- push resends it
- step-failed: npm run validate failed:        |                         ^ |     120|       const j = readJournal(dir); |     121|       const resume = j.find((e) => e.kind === 'resume'); |  | ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

Total agent cost: 0.00 USD.
