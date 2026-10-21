# Heat Pump vs Oil, Propane and Baseboard Heat

Story `conflict:heat-pump-costs-less-run-heating` (heat-pumps), revision 5. About 4.2 minutes (603 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 17/17 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

If your house runs on propane, heating oil or electric baseboards, someone has probably told you a heat pump is the easy win. But does a heat pump always beat each of them on running cost, or does one of them break the rule?

## Setup

The home-energy marketplace EnergySage puts it flatly: "Heat pumps consistently save against propane, oil, and electric resistance heating almost everywhere." [s03 ok] Abode Energy Management, in a video on heat pump economics in Massachusetts, says home heating oil is "always also going to be more expensive than a heat pump". [s04 ok] Yet The Boston Globe reported that in a winter of cheaper oil, even Massachusetts homeowners switching from oil "could see their energy costs increase by a few hundred dollars over the cold season". [s05 ok]

## Investigation

So who is right? Start with the widest view. A national study estimated that among homes heating mainly with electricity, fuel oil or propane that already have air conditioning, 95 to 100 percent would see lower bills with a heat pump, depending on its efficiency. [s07 ok] The median saving it estimated was $300 to $650 a year. [s08 ok] Homes on those fuels without air conditioning did worse: only 73 to 86 percent would come out ahead, and most of the homes whose bills went up were in hotter climates, where the new cooling cost more than the heating saved. [s09 ok] For comparison, among gas-heated homes with air conditioning, the same study put the median anywhere from a $70 loss to a $380 saving, depending on the heat pump. [s10 ok] That was an estimate. What about heat pumps running in real homes? A study of cold-climate heat pumps found the all-electric systems cut heating costs by 53 percent on average, measured against what electric resistance heaters would have used for the same heat. [s12 ok] An evaluation of ductless mini-split heat pumps found them more cost-effective than electric resistance and propane heat at every energy price and every outdoor temperature it examined. [s13 ok] Oil was different: there, the relative price of oil decided the outdoor temperature above which the heat pump won. [s14 ok] So the evaluators advised oil-heated homes to switch the heat pump off when it got very cold, when the oil system would run cheaper: below 8 degrees Fahrenheit in one year, and below 25 degrees the next, depending on that year's energy prices. [s15 ok] And another study found that in regions where homes heat with electricity or fuels other than gas, heating is generally more expensive and the net benefits of a heat pump are higher, though climate and energy prices also play an important role. [s22 ok] Real projects show the same split: across 273 home electrification projects with cost data, some raised annual energy costs, in some cases by as much as $1,000 a year, while the big reductions were most likely in homes with high bills beforehand, such as those heating with propane or fuel oil. [s23 ok]

## Answer

So does a heat pump always win? Against propane and electric resistance heat, this evidence says it nearly always does on running cost. [s25 ok] Against oil, not always: whether it wins depends on the price of oil and how cold it gets. [s26 ok] What none of this can do is price your own house: the results moved with air conditioning, climate and energy prices. [s27 ok]

## Takeaway

If you heat with propane or baseboards, get installed quotes and set them against what you spend on fuel each winter. If you heat with oil, ask a different question: at this winter's oil and electricity prices, below what outdoor temperature does your old system run cheaper, and will you keep it for those days? Check your fuel and your rates before you check the brochure.

## Open issues

- **info** s03 (s03.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s03 (attributed, verified)

> The home-energy marketplace EnergySage puts it flatly: "Heat pumps consistently save against propane, oil, and electric resistance heating almost everywhere."

- **s03.a** [verified] EnergySage wrote that heat pumps consistently save against propane, oil and electric resistance heating almost everywhere.
  - supported (approved): no direct support, 4 qualifying, 1 source statement. modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.
  - statement: Does a Heat Pump Actually Save Money?  `energysage-heat-pump-save-money`
    > Heat pumps consistently save against propane, oil, and electric resistance heating almost everywhere.
  - quotation: "Heat pumps consistently save against propane, oil, and electric resistance heating almost everywhere." from `energysage-heat-pump-save-money`

### s04 (attributed, verified)

> Abode Energy Management, in a video on heat pump economics in Massachusetts, says home heating oil is "always also going to be more expensive than a heat pump".

- **s04.a** [verified] Abode Energy Management said home heating oil is always going to be more expensive than a heat pump.
  - supported (approved): no direct support, 4 qualifying, 1 source statement. modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.
  - statement: Heat Pump Economics in Massachusetts  `QPMXV5ogWyc`
    > home heating oil we would see that it's always also going to be more expensive than a heat pump
  - quotation: "always also going to be more expensive than a heat pump" from `QPMXV5ogWyc`

### s05 (attributed, verified)

> Yet The Boston Globe reported that in a winter of cheaper oil, even Massachusetts homeowners switching from oil "could see their energy costs increase by a few hundred dollars over the cold season".

- **s05.a** [verified] The Boston Globe reported that with oil cheaper that year, even Massachusetts homeowners switching from oil could see energy costs rise by a few hundred dollars over the cold season.
  - supported (approved): no direct support, 3 contradicting, 4 qualifying, 1 source statement. modality: possibility.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.
  - contradicts (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.65, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L401`
    > Homes heating with electricity, oil or propane that have AC see lower bills in 95-100% of cases (median $300-$650/yr); 73-86% without AC; still 87-99% (propane) and 66-100% (oil) at 2019 prices.
  - contradicts (uncited): Edwards 2024, inequities in heat pump bill savings right 0.55, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L296-L299`
    > In Edwards' county model, where homes heat with electricity (resistance) or non-gas fuels, heating is generally more expensive and heat pump bill savings are higher.
  - contradicts (uncited): RMI 2018, the economics of electrifying buildings right 0.45, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L817-L820`
    > In Providence, RMI's heat pumps have a lower 15-year net present cost than both oil and propane systems, and save at least $10,000 against propane.
  - statement: Heat pumps are efficient and better for the climate. But with sky-high electric rates, will Mass. consumers buy in? - The Boston Globe  `bostonglobe-heat-pumps-electricity-rates-in-winter`
    > even homeowners switching from that source could see their energy costs increase by a few hundred dollars over the cold season
  - quotation: "could see their energy costs increase by a few hundred dollars over the cold season" from `bostonglobe-heat-pumps-electricity-rates-in-winter`

### s07 (factual, verified)

> A national study estimated that among homes heating mainly with electricity, fuel oil or propane that already have air conditioning, 95 to 100 percent would see lower bills with a heat pump, depending on its efficiency.

- **s07.a** [verified] For homes heating primarily with electricity, fuel oil or propane and with central or room AC, the study found 95% to 100% nationally would have positive bill savings, depending on heat pump efficiency.
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

### s08 (factual, verified)

> The median saving it estimated was $300 to $650 a year.

- **s08.a** [verified] For those homes the median bill saving was $300 to $650 per year, depending on efficiency.
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

### s09 (factual, verified)

> Homes on those fuels without air conditioning did worse: only 73 to 86 percent would come out ahead, and most of the homes whose bills went up were in hotter climates, where the new cooling cost more than the heating saved.

- **s09.a** [verified] Only 73% to 86% of the homes heating with those fuels but without central or room AC would have positive bill savings.
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
- **s09.b** [verified] Most of the homes with increased energy bills are those in hotter climates but without existing central or window AC, where increased cooling costs outweigh heating cost savings.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying. modality: typical.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.6, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L414`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s10 (factual, verified)

> For comparison, among gas-heated homes with air conditioning, the same study put the median anywhere from a $70 loss to a $380 saving, depending on the heat pump.

- **s10.a** [verified] For homes heating with natural gas and with AC, median bill savings ranged from -$70 to $380 per year depending on heat pump performance level.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.6, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L414`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s12 (factual, verified)

> A study of cold-climate heat pumps found the all-electric systems cut heating costs by 53 percent on average, measured against what electric resistance heaters would have used for the same heat.

- **s12.a** [verified] For all-electric cold-climate heat pump systems, with an electric resistance heater assumed to meet the same load in the baseline, average cost savings were 53%.
  - qualified (qualify): no direct support, 4 qualifying. modality: universal.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > For the ductless systems and all electric ducted systems, it was assumed that the load met by the heat pump system would have also been met by an electric resistance heater in the baseline case. These systems saw a 46% to 56% reduction in electrical use with the ductless system. Along with these energy savings, there a…
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s13 (factual, verified)

> An evaluation of ductless mini-split heat pumps found them more cost-effective than electric resistance and propane heat at every energy price and every outdoor temperature it examined.

- **s13.a** [verified] Compared against electrical resistance and propane heating, ductless mini-split heat pumps proved more cost-effective for all energy prices and all outdoor air temperatures.
  - qualified (qualify): no direct support, 4 qualifying. modality: universal.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > The cost-effectiveness of DMSHPs used for heating depends on alternative heating systems, energy prices for a given period, and outside air temperatures. Compared against electrical resistance and propane heating, DMSHPs proved more cost-effective for all energy prices (using the same energy source) and all outdoor air…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s14 (factual, verified)

> Oil was different: there, the relative price of oil decided the outdoor temperature above which the heat pump won.

- **s14.a** [verified] For oil-fired systems, the relative energy price determined the temperature above which a mini-split became more cost-effective.
  - qualified (qualify): no direct support, 4 qualifying.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > The cost-effectiveness of DMSHPs used for heating depends on alternative heating systems, energy prices for a given period, and outside air temperatures. Compared against electrical resistance and propane heating, DMSHPs proved more cost-effective for all energy prices (using the same energy source) and all outdoor air…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s15 (factual, verified)

> So the evaluators advised oil-heated homes to switch the heat pump off when it got very cold, when the oil system would run cheaper: below 8 degrees Fahrenheit in one year, and below 25 degrees the next, depending on that year's energy prices.

- **s15.a** [verified] The evaluators recommended that oil-heated homeowners turn off the mini-split in very cold conditions, below 8F in 2015 and below 25F in 2016, when an oil-fired system would operate less expensively, depending on energy prices.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s22 (factual, verified)

> And another study found that in regions where homes heat with electricity or fuels other than gas, heating is generally more expensive and the net benefits of a heat pump are higher, though climate and energy prices also play an important role.

- **s22.a** [verified] In regions where the heating source is electricity or fuels other than natural gas, heating is generally more expensive and the net benefits of heat pumps are higher; climate and energy prices also play an important role.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55), 2 qualifying. modality: typical.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Edwards 2024, inequities in heat pump bill savings right 0.55, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L296-L299`
    > cycle11,13 (including installation) costs. Primary heating fuel is a key driver of benefits: in regions where the heating source is electricity or fuels other than natural gas, heating is generally more expensive and thus the net benefits of heat pumps are higher (see Figure 5b). However, climate and energy prices also…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s23 (factual, verified)

> Real projects show the same split: across 273 home electrification projects with cost data, some raised annual energy costs, in some cases by as much as $1,000 a year, while the big reductions were most likely in homes with high bills beforehand, such as those heating with propane or fuel oil.

- **s23.a** [verified] Among 273 electrification projects with cost savings data, some increased post-retrofit energy costs, by as much as $1,000 per year in some cases, while high reductions in annual energy cost were most likely in homes with high pre-retrofit bills, such as those heating with propane or fuel oil.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.4), 2 qualifying. modality: typical.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Less 2021 (LBNL), cost of decarbonization retrofits right 0.4, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L2700-L2706`
    > In Figure 40 we compare the distribution of energy cost savings for the 273 Electrification projects with cost savings data, against the savings for all other retrofit types. The tendency for Electrification projects to increase post-retrofit energy costs in some projects is evident in comparing the distributions, by a…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s25 (factual, verified)

> Against propane and electric resistance heat, this evidence says it nearly always does on running cost.

- **s25.a** [verified] Against propane and electric resistance heating, ductless mini-splits proved more cost-effective at all energy prices and outdoor temperatures, and the all-electric cold-climate systems saved 53% on average against an electric resistance baseline.
  - qualified (qualify): no direct support, 4 qualifying. modality: universal.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > The cost-effectiveness of DMSHPs used for heating depends on alternative heating systems, energy prices for a given period, and outside air temperatures. Compared against electrical resistance and propane heating, DMSHPs proved more cost-effective for all energy prices (using the same energy source) and all outdoor air…
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > For the ductless systems and all electric ducted systems, it was assumed that the load met by the heat pump system would have also been met by an electric resistance heater in the baseline case. These systems saw a 46% to 56% reduction in electrical use with the ductless system. Along with these energy savings, there a…
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s26 (factual, verified)

> Against oil, not always: whether it wins depends on the price of oil and how cold it gets.

- **s26.a** [verified] For oil-fired systems, the relative energy price determines the temperature above which a mini-split is more cost-effective.
  - qualified (qualify): no direct support, 4 qualifying.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > The cost-effectiveness of DMSHPs used for heating depends on alternative heating systems, energy prices for a given period, and outside air temperatures. Compared against electrical resistance and propane heating, DMSHPs proved more cost-effective for all energy prices (using the same energy source) and all outdoor air…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.

### s27 (factual, verified)

> What none of this can do is price your own house: the results moved with air conditioning, climate and energy prices.

- **s27.a** [verified] Fewer oil, propane and electric homes had positive bill savings without AC, and climate and energy prices play an important role in heat pump net benefits.
  - qualified (qualify): 2 supporting (2 independent, strongest 0.65), 6 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels. Cadmus 2016, ductless mini-split evaluation (MA and RI): Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015). Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested. Canadian Climate Institute 2023, heat pumps pay off: Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled. Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.65, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L393-L401`
    > Two of the housing stock characteristics with the largest impact on the energy bill OPEN ACCESS savings variation seen in Figure 4 are primary heating fuel type and presence of AC equipment. These effects are illustrated in Figure S4, which shows that for the 48 Joule 8, 1000–1035, April 17, 2024 1007 million homes tha…
  - supports: Edwards 2024, inequities in heat pump bill savings right 0.55, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L296-L299`
    > cycle11,13 (including installation) costs. Primary heating fuel is a key driver of benefits: in regions where the heating source is electricity or fuels other than natural gas, heating is generally more expensive and thus the net benefits of heat pumps are higher (see Figure 5b). However, climate and energy prices also…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L376-L382`
    > Measured cost savings averaged 33% against propane furnaces and 53% against electric resistance in Minnesota homes; oil was not tested, so the claim is supported for two of its three fuels.
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3611-L3619`
    > Mini-splits were cheaper to run than electric resistance and propane at all observed temperatures, but against oil they were cheaper only above a price-dependent break-even (about 32 F in 2016, 12 F in 2015).
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > In the UK, households previously on electric heating used less electricity after a heat pump, which supports the resistance-heat part; oil and propane are not tested.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.3, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L463-L467`
    > Heat pumps use up to 65% less energy than electric baseboards, which supports the resistance-heat part; oil and propane are not modelled.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.
