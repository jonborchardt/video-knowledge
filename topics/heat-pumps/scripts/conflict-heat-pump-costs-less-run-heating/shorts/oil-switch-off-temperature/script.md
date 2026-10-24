# Heat with oil? The evaluators said turn the heat pump off below 8 degrees. A year later, 25.

Story `conflict:heat-pump-costs-less-run-heating/shorts/oil-switch-off-temperature` (heat-pumps), revision 2. About 0.8 minutes (110 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 3/3 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Heat with oil and own a heat pump? One evaluation's advice: switch the heat pump off on the coldest days and let the oil burner run. [s01 ok]

## Finding

The switch-off point was 8 degrees Fahrenheit in 2015 and 25 the year after, set by that year's oil and electricity prices and the heat pump's cold performance; dearer oil moves it lower. [s02 ok] That is one evaluation of ductless mini-splits, and the advice is for oil-heated homes only: against propane and electric resistance it found the heat pump cheaper. [s04 ok]

## Close

If you heat with oil, ask which heater runs cheaper at this year's prices; the full inquiry asks where a heat pump pays at all.

## Open issues

- **warning** - release-stale (deterministic): release.json locked script 9fe3615994; it is now f72c0d2ac3: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked package cf04f8a5d5; it is now 1c3ed97505: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation 048f176fd5; it is now 80a8637996: the approved package has changed, lock it again after review
- **info** s01 needs-human (review): Title and hook read alone: 'The evaluators said turn the heat pump off below 8 degrees. A year later, 25.' attributes the advice and the year-to-year jump signals it is not a fixed rule; s02 dates the thresholds, s03 ties them to that year's prices and cold COP in the next sentence, s04 scopes them to one evaluation of oil-heated homes. No figure is a rule a viewer could carry off. Suggestion: None.
- **info** s02 (s02.a) omission (review): The report says of the balance points that 'these values do not account for zonal savings': a mini-split heating 30 percent less of the home would drop the balance point by 20F or more (L973-L975, outside the cited passage). The Short's thresholds are therefore the whole-house case; the omission runs in the heat pump's favour (the real switch-off point would be lower), and s02 already frames the figures as one year's price- and performance-dependent output rather than a rule. Suggestion: None needed for the Short; the parent video is the place for the zonal caveat.
- **info** s04 (s04.a) missing-qualification (review): The narration compresses the passage's 'nearly always less expensive than electric resistance' (L1188-L1191) and 'always less expensive than propane' (L1194-L1195) to 'found the heat pump cheaper'. The only exception the passage names for resistance is non-cold-climate units approaching a COP of 1.0, parity with resistance, for 'very few' hours; it names no case where resistance was cheaper, so 'cheaper' states the finding's direction without overstating it. Not misleading in a Short; the modality is lost, not reversed. Suggestion: If three words fit, 'it found the heat pump cheaper, nearly always against resistance'.
- **info** s04 (s04.a) needs-human (review): short.carries names 'Massachusetts and Rhode Island homes'; revision 2 dropped the states (on the revision-1 suggestion). The break points are a function of energy prices and measured COP only (L955-L961: a map of electricity and fuel prices with temperature contours), so the place limits the figures only through prices, which s02 states beside them ('set by that year's oil and electricity prices') and s06 repeats for the viewer's own case. Not treated as a carries qualification left unspoken. Suggestion: An editor who wants the place spoken can say 'one New England evaluation of ductless mini-splits' in s04.

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

> The switch-off point was 8 degrees Fahrenheit in 2015 and 25 the year after, set by that year's oil and electricity prices and the heat pump's cold performance; dearer oil moves it lower.

- info omission (review): The report says of the balance points that 'these values do not account for zonal savings': a mini-split heating 30 percent less of the home would drop the balance point by 20F or more (L973-L975, outside the cited passage). The Short's thresholds are therefore the whole-house case; the omission runs in the heat pump's favour (the real switch-off point would be lower), and s02 already frames the figures as one year's price- and performance-dependent output rather than a rule.
- **s02.a** [verified] The evaluators recommended that oil-heated homeowners turn off the mini-split in very cold conditions, below 8F in 2015 and below 25F in 2016, when an oil-fired system would operate less expensively, depending on energy prices and cold-temperature COPs; if oil prices increase against electric energy rates, the switchover temperature point may move lower.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying. modality: possibility.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.

### s04 (factual, verified)

> That is one evaluation of ductless mini-splits, and the advice is for oil-heated homes only: against propane and electric resistance it found the heat pump cheaper.

- info missing-qualification (review): The narration compresses the passage's 'nearly always less expensive than electric resistance' (L1188-L1191) and 'always less expensive than propane' (L1194-L1195) to 'found the heat pump cheaper'. The only exception the passage names for resistance is non-cold-climate units approaching a COP of 1.0, parity with resistance, for 'very few' hours; it names no case where resistance was cheaper, so 'cheaper' states the finding's direction without overstating it. Not misleading in a Short; the modality is lost, not reversed.
- info needs-human (review): short.carries names 'Massachusetts and Rhode Island homes'; revision 2 dropped the states (on the revision-1 suggestion). The break points are a function of energy prices and measured COP only (L955-L961: a map of electricity and fuel prices with temperature contours), so the place limits the figures only through prices, which s02 states beside them ('set by that year's oil and electricity prices') and s06 repeats for the viewer's own case. Not treated as a carries qualification left unspoken.
- **s04.a** [verified] In one evaluation of ductless mini-split heat pumps in Massachusetts and Rhode Island homes, the switch-off advice was for oil-heated homes; the same evaluation found mini-splits nearly always less expensive to operate than electric resistance heat and always less expensive than propane heating systems.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 2 qualifying. modality: universal.
  - warning needs-qualification: Deetjen 2021, private economics of US residential heat pumps: Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases. Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff: UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed. "always" is stronger than the evidence (strongest support 0.45). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.45, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L1184-L1205`
    > Recommendation: The evaluation team recommends exploring methods for targeting homes with electric resistance heating for DMSHP retrofits. DMSHPs will nearly always be less expensive to operate than electric resistance heat, as shown by the COP of DMSHPs remaining above 1.0 on average for nearly all outdoor temperature…
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.45, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L653-L665`
    > Counting capital cost, resistance and propane homes usually gain, but oil-heated homes usually take a private loss (65% are in cold climates), so oil is not among the best cases.
  - qualifies (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff partly 0.3, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L1267-L1273`
    > UK households that previously used electric heating saw electricity use fall after a heat pump, while gas-boiler households paid slightly more to run one, which fits the claim for resistance heat; oil and propane are not analysed.
