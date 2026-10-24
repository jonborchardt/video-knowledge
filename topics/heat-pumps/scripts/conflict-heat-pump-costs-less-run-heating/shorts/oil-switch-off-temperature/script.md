# Heat with oil? The evaluators said turn the heat pump off below 8 degrees. A year later, 25.

Story `conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature` (heat-pumps), revision 1. About 1.3 minutes (189 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 5/5 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Heat with oil and own a heat pump? One evaluation's advice: switch the heat pump off on the coldest days and let the oil burner run. [s01 ok]

## Finding

Its switch-off point was 8 degrees Fahrenheit in 2015 and 25 degrees the year after: the outdoor temperature below which oil ran cheaper, not a saving figure. [s02 ok] The line moved because it is set by that year's oil and electricity prices and by how the heat pump performs in the cold; if oil gets dearer against electricity, the point may move lower. [s03 ok] This is one evaluation of ductless mini-splits in Massachusetts and Rhode Island homes, and the advice is for oil-heated homes only: against electric resistance it found the heat pump nearly always cheaper to run, and against propane, always. [s04 ok] The evaluators allowed that not every household wishes to think about which heater to run and when. [s05 ok]

## Close

If you heat with oil, check whether oil or the heat pump runs cheaper at this year's prices before the cold comes, and expect the answer to move. Which homes a heat pump saves money in at all is the full inquiry; see the main video.

## Open issues

- **info** s01 needs-human (review): Title and hook read alone: 'The evaluators said turn the heat pump off below 8 degrees. A year later, 25.' attributes the advice and the year-to-year jump signals it is not a fixed rule; s02 dates the thresholds, s03 ties them to that year's prices and cold COP in the next sentence, s04 scopes them to one evaluation of oil-heated homes. No figure is a rule a viewer could carry off. Suggestion: None.
- **info** s04 (s04.a) needs-human (review): 'Massachusetts and Rhode Island homes' is not in the cited passage (L1184-L1205, the recommendations); it comes from the document's provenance (source header L1 and L10: prepared for the Electric and Gas Program Administrators of Massachusetts and Rhode Island) and the package's document name, which is also how short.carries phrases the qualification. Treated as source attribution, not a claim needing its own passage; the ductless mini-split and oil-heated-home scope are in the passage. Suggestion: Keep; if provenance may not be spoken from the header, say 'one New England utility evaluation' or drop the states.

## Evidence by sentence

### s01 (factual, verified)

> Heat with oil and own a heat pump? One evaluation's advice: switch the heat pump off on the coldest days and let the oil burner run.

- info needs-human (review): Title and hook read alone: 'The evaluators said turn the heat pump off below 8 degrees. A year later, 25.' attributes the advice and the year-to-year jump signals it is not a fixed rule; s02 dates the thresholds, s03 ties them to that year's prices and cold COP in the next sentence, s04 scopes them to one evaluation of oil-heated homes. No figure is a rule a viewer could carry off.
- **s01.a** [verified] The evaluators recommended that oil-heated homeowners turn off the mini-split in very cold conditions, when an oil-fired system would operate less expensively.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s02 (factual, verified)

> Its switch-off point was 8 degrees Fahrenheit in 2015 and 25 degrees the year after: the outdoor temperature below which oil ran cheaper, not a saving figure.

- **s02.a** [verified] The evaluators recommended that oil-heated homeowners turn off the mini-split in very cold conditions, below 8F in 2015 and below 25F in 2016, when an oil-fired system would operate less expensively, depending on energy prices.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s03 (factual, verified)

> The line moved because it is set by that year's oil and electricity prices and by how the heat pump performs in the cold; if oil gets dearer against electricity, the point may move lower.

- **s03.a** [verified] The switch-off temperature depends on energy prices and cold-temperature COPs; if oil prices increase against electric energy rates, the switchover temperature point may move lower.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying. modality: possibility.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s04 (factual, verified)

> This is one evaluation of ductless mini-splits in Massachusetts and Rhode Island homes, and the advice is for oil-heated homes only: against electric resistance it found the heat pump nearly always cheaper to run, and against propane, always.

- info needs-human (review): 'Massachusetts and Rhode Island homes' is not in the cited passage (L1184-L1205, the recommendations); it comes from the document's provenance (source header L1 and L10: prepared for the Electric and Gas Program Administrators of Massachusetts and Rhode Island) and the package's document name, which is also how short.carries phrases the qualification. Treated as source attribution, not a claim needing its own passage; the ductless mini-split and oil-heated-home scope are in the passage.
- **s04.a** [verified] In one evaluation of ductless mini-split heat pumps in Massachusetts and Rhode Island homes, the switch-off advice was for oil-heated homes; the same evaluation found mini-splits nearly always less expensive to operate than electric resistance heat and always less expensive than propane heating systems.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying. modality: universal.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. "always" is stronger than the evidence (strongest support 0.45). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s05 (factual, verified)

> The evaluators allowed that not every household wishes to think about which heater to run and when.

- **s05.a** [verified] The evaluators noted that this operating scheme may not appeal to all customer types, as many may not wish to concern themselves about which heating system to operate and when.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying. modality: universal.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. "all" is stronger than the evidence (strongest support 0.45). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.
