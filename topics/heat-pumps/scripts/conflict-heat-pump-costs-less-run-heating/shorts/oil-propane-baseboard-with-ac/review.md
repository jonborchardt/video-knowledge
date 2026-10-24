# Review: Oil, propane or electric heat, plus AC? A national model says 95 to 100 percent of homes save.

| | |
|---|---|
| Story | `conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac` (heat-pumps) |
| Revision | 4 (1 of at most 3 in this pass) |
| Validation | **passed** (2026-10-24) |
| Words / runtime | 102 words, about 0.8 min at 150 wpm |
| Sentences | 5 (4 factual or attributed) |
| Assertions | 4, 4 verified |
| Issues | 0 blocking, 0 warnings, 4 dispositioned |
| Unreviewed sentences | 0 |
| Scenes | 5, 0:49 (ok) |
| Evidence package | d4f2543cb2 (9 documents, 1 claims) |
| Model | claude-fable-5-1 |

Automated validation says whether the narration is eligible for human editorial review; it does not establish truth.

## Open issues

- **warning** - release-stale (deterministic): release.json locked script 84774b08fe; it is now 4d7fae0bff: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked package 873c915512; it is now d4f2543cb2: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation 276c2ed8ec; it is now 729a17358a: the approved package has changed, lock it again after review

### Storyboard

- **warning** - release-stale: release.json locked script 84774b08fe; it is now 4d7fae0bff: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked package 873c915512; it is now d4f2543cb2: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked validation 276c2ed8ec; it is now 729a17358a: the approved package has changed, lock it again after review
- **warning** - release-stale: release.json locked storyboard 72a23a544d; it is now 5145df1f10: the approved package has changed, lock it again after review

## Dispositions

Deterministic warnings the reviewer judged false positives or already carried by the narration, at the current sentence fingerprint.

- s01 (s01.a) needs-qualification: The listed limits are other studies' field results that narrow the canonical claim, not Wilson's modelled figure; the sentence attributes the figure to the model ('a national study estimates'), names the passage's own population (oil, propane or electricity) and limits it to homes already running AC; s03 says it is a model and s05 gives the no-AC result. (warning was: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.)
- s03 (s03.a) needs-qualification: This sentence is the qualification itself: it says the figure is modelled, not metered; the listed limits belong to the field studies and do not narrow what the model found. (warning was: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.)
- s04 (s04.a) needs-qualification: The median is read as the passage gives it, tied to the same homes and to heat pump efficiency; s03, the sentence before, says it is modelled. The listed limits (Minnesota, New England, UK, Canada) do not bear on the model's median. (warning was: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.)
- s05 (s05.a) needs-qualification: The sentence limits the 73 to 86 percent to homes on those fuels without AC and places it in the same model; it is the narrower statement the warning asks for. (warning was: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.)

## Resolved review findings

- s01 (s01.a) missing-qualification (raised against revision 1, addressed in revision 2): The passage's population is homes that 'heat primarily with electricity', which includes electric furnaces and existing heat pumps, not only baseboards; the parent's s07 says 'electricity'. The 95 to 100 percent is the share of that wider group, and the Short gives no figure for baseboard homes alone. Not misleading in direction (resistance heat is the clearest case) but the population is stated narrower than the study's.
- s07 unsupported (raised against revision 1, addressed in revision 2): 'where oil breaks the pattern' presupposes that oil breaks the pattern. That fact rests on the New England meters (Cadmus break-even temperatures), a claim outside this Short's package that the Short never spoke; in a Short the viewer has nothing else, so the close asserts a second finding without evidence.
- s07 misdirection (raised against revision 1, addressed in revision 2): 'linked above' points the viewer nowhere: on a YouTube Short the full video is linked in the description and as the related video below the player, not above it.
- s01 (s01.a) omission (raised against revision 3, addressed in revision 4): The study states that its bill results use winter 2021-22 energy prices and are 'very sensitive' to them: at 2019 prices the share of oil-heated homes with positive bill savings falls to 66 to 100 percent (propane 87 to 99 percent). The Short attributes the figure to the model, s06 says a model is exact about what it assumes, and the price year is not among the package's carried qualifications, so the sentence is accurate as spoken; but the 95 to 100 percent is the main case at one winter's prices, not a figure that holds at any price.

## Research gaps

- What explains the split between Wilson 2024 (NREL and LBNL), heat pumps for all?, Edwards 2024, inequities in heat pump bill savings, CEE 2018, ducted and ductless cold-climate heat pumps in the field, Cadmus 2016, ductless mini-split evaluation (MA and RI), RMI 2018, the economics of electrifying buildings, Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff, Canadian Climate Institute 2023, heat pumps pay off?
- CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
- Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
- Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
- Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

## Outstanding editorial decisions

- -: release.json locked script 84774b08fe; it is now 4d7fae0bff: the approved package has changed, lock it again after review
- -: release.json locked package 873c915512; it is now d4f2543cb2: the approved package has changed, lock it again after review
- -: release.json locked validation 276c2ed8ec; it is now 729a17358a: the approved package has changed, lock it again after review

## History

- revision 1, 2026-10-24: blocked, 1 blocking, 2 warnings
- revision 2, 2026-10-24: needs-review, 0 blocking, 1 warnings
- revision 3, 2026-10-24: passed, 0 blocking, 0 warnings
- revision 4, 2026-10-24: passed, 0 blocking, 0 warnings
