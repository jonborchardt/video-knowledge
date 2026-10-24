# Oil, propane or electric heat, plus AC? A national model says 95 to 100 percent of homes save.

Story `conflict:heat-pump-costs-less-run-heating/shorts/oil-propane-baseboard-with-ac` (heat-pumps), revision 4. About 0.8 minutes (102 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 4/4 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

95 to 100 percent of homes heating with oil, propane or electricity, and already running air conditioning, would pay less with a heat pump, a national study estimates. [s01 ok]

## Finding

Estimates, because it is a model: the study simulated those homes' bills, so the figure is not a reading from anyone's meter. [s03 ok] Its median saving, $300 to $650 a year, is for those same homes and moves with the heat pump's efficiency. [s04 ok] Drop the air conditioning and the same model is weaker: only 73 to 86 percent come out ahead. [s05 ok]

## Close

Whether metered homes agree with the model is the subject of the full inquiry.

## Open issues

- **warning** - release-stale (deterministic): release.json locked script 84774b08fe; it is now 4d7fae0bff: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked package 873c915512; it is now d4f2543cb2: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation 276c2ed8ec; it is now 729a17358a: the approved package has changed, lock it again after review
- **info** s01 (s01.a) omission (review): Still true of the cut script: the 95 to 100 percent is the study's main case at winter 2021-22 energy prices, which the study calls 'very sensitive' to price; at 2019 prices the median saving for oil and propane homes falls by $400 to $600 a year. The sentence attributes the figure to the model and s03 says it is a model, and the price year is not among the package's carried qualifications, so the Short is accurate as spoken; the price sensitivity belongs in the full video. Suggestion: No change needed for the Short.

## Evidence by sentence

### s01 (factual, verified)

> 95 to 100 percent of homes heating with oil, propane or electricity, and already running air conditioning, would pay less with a heat pump, a national study estimates.

- info omission (review): Still true of the cut script: the 95 to 100 percent is the study's main case at winter 2021-22 energy prices, which the study calls 'very sensitive' to price; at 2019 prices the median saving for oil and propane homes falls by $400 to $600 a year. The sentence attributes the figure to the model and s03 says it is a model, and the price year is not among the package's carried qualifications, so the Short is accurate as spoken; the price sensitivity belongs in the full video.
- **s01.a** [verified] For homes heating primarily with electricity, fuel oil or propane and with central or room AC, the study found 95% to 100% nationally would have positive bill savings, depending on heat pump efficiency.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 4 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.65, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L401`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s03 (factual, verified)

> Estimates, because it is a model: the study simulated those homes' bills, so the figure is not a reading from anyone's meter.

- **s03.a** [verified] The study modelled the national stock of homes that heat primarily with electricity, fuel oil or propane and have central or window/room AC, estimating their bill savings rather than measuring them.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 4 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.65, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L401`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s04 (factual, verified)

> Its median saving, $300 to $650 a year, is for those same homes and moves with the heat pump's efficiency.

- **s04.a** [verified] For those homes the median bill saving was $300 to $650 per year, depending on efficiency.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 4 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.65, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L401`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s05 (factual, verified)

> Drop the air conditioning and the same model is weaker: only 73 to 86 percent come out ahead.

- **s05.a** [verified] Only 73% to 86% of the homes heating with those fuels but without central or room AC would have positive bill savings.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 4 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.65, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L401`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.
