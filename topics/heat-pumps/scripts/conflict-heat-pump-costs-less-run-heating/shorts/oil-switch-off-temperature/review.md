# Review: Heat with oil? The evaluators said turn the heat pump off below 8 degrees. A year later, 25.

| | |
|---|---|
| Story | `conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature` (heat-pumps) |
| Revision | 2 (1 of at most 3 in this pass) |
| Validation | **passed** (2026-10-24) |
| Words / runtime | 110 words, about 0.8 min at 150 wpm |
| Sentences | 4 (3 factual or attributed) |
| Assertions | 3, 3 verified |
| Issues | 0 blocking, 0 warnings, 3 dispositioned |
| Unreviewed sentences | 0 |
| Scenes | 4, 0:49 (ok) |
| Evidence package | 1c3ed97505 (9 documents, 1 claims) |
| Model | claude-fable-5-1 |

Automated validation says whether the narration is eligible for human editorial review; it does not establish truth.

## Open issues

- **warning** - release-stale (deterministic): release.json locked script 9fe3615994; it is now f72c0d2ac3: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked package cf04f8a5d5; it is now 1c3ed97505: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation 048f176fd5; it is now 80a8637996: the approved package has changed, lock it again after review

### Storyboard

- **warning** - release-stale: release.json locked script 9fe3615994; it is now f72c0d2ac3: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked package cf04f8a5d5; it is now 1c3ed97505: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked validation 048f176fd5; it is now 80a8637996: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked storyboard 84cb0d0961; it is now 3274b21f80: the approved package has changed, lock it again after review

## Dispositions

Deterministic warnings the reviewer judged false positives or already carried by the narration, at the current sentence fingerprint.

- s01 (s01.a) needs-qualification: The sentence reports one evaluation's switch-off advice, attributed as such, not that oil homes save money; the Deetjen limit (oil homes usually a private loss) points the same way and Bernard does not analyse oil; s04 says one evaluation, oil-heated homes only, inside the Short. (warning was: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.)
- s02 (s02.a) needs-qualification: The thresholds are dated to 2015 and 2016 and tied in the same sentence to that year's oil and electricity prices and the heat pump's cold performance, with the direction of movement from L1201-L1202; s04 scopes them to one evaluation of oil-heated homes. Deetjen and Bernard do not bear on an oil switchover temperature. (warning was: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.)
- s04 (s04.a) needs-qualification: 'always' is the evaluation's own word for propane (L1194-L1195) and appears only in the assertion; the narration says 'it found the heat pump cheaper', attributed to and scoped by 'one evaluation of ductless mini-splits' in the same sentence. Deetjen (capital cost included) and Bernard (UK, no oil or propane) concern whether homes save overall, not this evaluation's operating-cost comparison. (warning was: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. "always" is stronger than the evidence (strongest support 0.45). Add the qualification: the evidence supports a narrower or weaker statement.)

## Resolved review findings

- s04 (s04.a) needs-human (raised against revision 1, addressed in revision 2): 'Massachusetts and Rhode Island homes' is not in the cited passage (L1184-L1205, the recommendations); it comes from the document's provenance (source header L1 and L10: prepared for the Electric and Gas Program Administrators of Massachusetts and Rhode Island) and the package's document name, which is also how short.carries phrases the qualification. Treated as source attribution, not a claim needing its own passage; the ductless mini-split and oil-heated-home scope are in the passage.

## Research gaps

- What explains the split between Wilson 2024 (NREL and LBNL), heat pumps for all?, Edwards 2024, inequities in heat pump bill savings, CEE 2018, ducted and ductless cold-climate heat pumps in the field, Cadmus 2016, ductless mini-split evaluation (MA and RI), RMI 2018, the economics of electrifying buildings, Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff, Canadian Climate Institute 2023, heat pumps pay off?
- CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
- Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
- Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
- Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

## Outstanding editorial decisions

- -: release.json locked script 9fe3615994; it is now f72c0d2ac3: the approved package has changed, lock it again after review
- -: release.json locked package cf04f8a5d5; it is now 1c3ed97505: the approved package has changed, lock it again after review
- -: release.json locked validation 048f176fd5; it is now 80a8637996: the approved package has changed, lock it again after review

## History

- revision 1, 2026-10-24: passed, 0 blocking, 0 warnings
- revision 2, 2026-10-24: passed, 0 blocking, 0 warnings
