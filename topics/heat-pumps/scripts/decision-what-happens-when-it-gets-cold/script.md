# What Really Happens to a Heat Pump at 0°F

Story `decision:what-happens-when-it-gets-cold` (heat-pumps), revision 3. About 8.1 minutes (1187 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 39/39 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Picture the coldest night of a northern winter: frost on the windows, and the heat pump outside still humming. Is it still heating the house, or has it turned into a very expensive space heater? Meters, not marketing, can settle this.

## Setup

An NH Patch headline put the doubt bluntly: "Taxpayers On The Hook For Tech That Falls Flat In The Cold". [s04 ok] The Mass Save heat pump page answers that "many provide efficient heat at outdoor temperatures as low as -15 °F". [s05 ok] So does a heat pump give up in the cold, or carry on as if nothing happened?

## Investigation

Start with the bluntest question: does the heat keep coming at all? Engineers score heating efficiency as a COP, and plain electric resistance heat scores 1. [s08 ok] In one evaluation, engineers metered the heat that dozens of ductless mini-splits delivered over back-to-back winters, and in the later one the units averaged a COP of 1.5 between -10 and 0 °F. [s09 ok] That is 50 percent more heat per unit of electricity than resistance heat, which the evaluators called far superior; in the earlier winter, with deep snow and ice around the outdoor units, the units ran less efficiently. [s10 ok] And not only the cold-climate models: the ordinary ones in that evaluation also ran below 0 °F, just less efficiently. [s11 ok] A newer field test followed prototype cold-climate heat pumps, and leaving out the periods when backup heat or defrost was running, their median COP between 0 and 5 °F was 1.9. [s12 ok] Those prototypes tested better in the lab, but in the field most still beat 1.75, the COP the EPA's Energy Star label requires of a cold-climate heat pump at 5 °F. [s13 ok] So the heat keeps coming. But efficiency is only half of it. As the channel Technology Connections puts it, "along with getting less efficient, their actual heat output also drops." [s15 ok] In northern Minnesota, researchers watched one small ductless unit hold a steady median output from 10 °F all the way down to -15 °F. [s16 ok] Below that it kept running at reduced output, and at -20 °F and colder it delivered only about 20 percent of what it was rated for at 5 °F. [s17 ok] The researchers' verdict was that units like it should not be used without backup below -15 °F. [s18 ok] Efficiency follows the same slope: in the same Minnesota research, outdoor temperature had the biggest effect on COP, and heat-pump-only cycles managed only around 1.3 at 10 °F, less than half what they reached on mild days. [s19 ok] Then there is the frost. In cold, humid air, frost builds up on the outdoor coil, and to melt it the heat pump runs in reverse, pulling heat out of the house, which can cool the air coming out of the vents. [s21 ok] In the prototype field test, defrost used a median of 5 to 8 percent of the energy at the temperatures where it cost most, a small share, though one site spent 16 percent of its time in defrost. [s22 ok] Which brings us to the real catch: backup heat. When a heat pump's electric backup strips kick in, Jordan Dearden warns, "They'll also absolutely destroy your electric bill." [s24 ok] In the prototype test, the units ran mostly on the heat pump alone, even at the lowest temperatures, and backup-only operation was minimal above 0 °F. [s25 ok] But in the coldest range with enough data, below 0 °F, backup elements were on 25 percent of the time, and only some of the 22 sites had enough data that cold. [s26 ok] Some backup use came from the thermostat: backup heat began at around 30 to 35 °F, and the researchers expect it would start much lower without homeowners changing setpoints, or with smarter thermostat controls. [s27 ok] Some came from faults: two sites fired up higher stages of backup heat during defrost, at least one did it in normal heating too, and the manufacturer called that a controls problem. [s28 ok] In the Minnesota study's all-electric system, the resistance booster joined in below 30 °F, yet because the heat pump ran first, the whole system still beat plain resistance heat even at the coldest reading, around -7 °F. [s29 ok] In another field study, one site's compressor would not run below 0 °F at all, even with its lockout disabled, most likely because of an on-board control setting that cannot be adjusted in the field. [s30 ok] Sizing matters too: one study estimated that in Minnesota a high-efficiency heat pump sized for the full heating load cut median bills by $182 a year, while one sized for the cooling load raised them by $96, because it leaned harder on electric resistance backup. [s31 ok] So what does all this do to the bill? For the Minnesota homes, which had heated with propane or electricity, the researchers used performance maps and typical Minnesota weather to estimate cost savings of 30 to 56 percent. [s33 ok] Gas is harder to beat: at the prices of those winters, the mini-splits from the first evaluation cost less to run than an 80 percent efficient gas system only above 70 °F, which the evaluators said made them no direct replacement for gas. [s34 ok] Against propane, they were cheaper at every temperature. [s35 ok] Even the measured units listed as cold-climate broke even with gas only above 58 °F; on paper, the rating curve of a then-current cold-climate model brought it down to between 28 and 40 °F. [s36 ok] A cost model for Toronto and Edmonton that counts equipment as well as energy points the same way: in Toronto, standard heat pumps with gas backup came out the lowest-cost option for nearly all households, but in Edmonton that held only for some house types, and gas with air conditioning won the rest. [s37 ok] The model's reasons were cheap gas and the cold itself, which makes heat pumps less efficient and calls on the backup more. [s38 ok]

## Answer

So do heat pumps still work when it gets really cold? In these field tests most units did: they kept heating below zero, with less efficiency and less output, and still got more heat from each unit of electricity than resistance heat. [s40 ok] The catch is backup heat, which ran more as it got colder, and more where a unit was sized for cooling or its controls misbehaved. [s41 ok] And do they still save money? Against propane or electric heat, the studies here say yes on running costs, though the Minnesota researchers put retrofit paybacks at over 10 years unless the old system needs replacing; against gas, it turns on the unit, the climate and local prices, and for the mini-splits measured in the first evaluation, gas won. [s43 ok] Each of these field tests followed a limited number of units, so they show what heat pumps can do in the cold, not what every installation will. [s44 ok]

## Takeaway

If your winters bite, ask the installer whether the unit is a cold-climate model, and whether it is sized for your heating load or only for your cooling. Ask what temperature the backup is set to start at, then keep the thermostat steady and watch how often the backup comes on. And if you heat with gas, work out the break-even temperature at your own prices before you decide what the furnace is for.

## Open issues

- **warning** - release-stale (deterministic): release.json locked package d8e5d3dd14; it is now 8cb301861b: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation 2761b6fc2c; it is now c496fd3682: the approved package has changed, lock it again after review
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s15 (s15.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s21 (s21.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s22 (s22.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s24 (s24.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s28 (s28.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s41 (s41.a) omission (review): The new Efficiency Maine 2026 study (78 metered whole-home installs) agrees that backup rose below 10 F, but there it was mostly the existing fossil system and only one home regularly used electric resistance; the script does not mention it. It does not contradict s41 (which says backup ran more in the cold, not which kind), and its COP of 2 at -10 F across 166 units supports s40. Suggestion: Optional on a later revision: one sentence after s29 that in Maine whole-home installs backup was mostly the old fossil system, and the 166-unit COP of 2 at -10 F as the largest field average.
- **info** s41 (s41.c) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s04 (attributed, verified)

> An NH Patch headline put the doubt bluntly: "Taxpayers On The Hook For Tech That Falls Flat In The Cold".

- **s04.a** [verified] An NH Patch headline said heat pumps are tech that falls flat in the cold.
  - supported (approved): no direct support, 7 contradicting, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - contradicts (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes wrong 0.55, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L555-L557`
    > In 78 metered Maine homes with whole-home heat pump systems, the heat pumps provided over 70% of total heating needs, with wood 10% and fossil fuel 19%.
  - contradicts (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field wrong 0.6, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L495-L518`
    > In monitored Minnesota homes cold-climate ASHPs cut heating costs 30-56%; cold weather raised backup and defrost use and lowered heat pump performance but overall system efficiencies remained high.
  - contradicts (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) wrong 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Across two New England winters, metered mini-splits kept heating below 0 F with average COP about 1.5 at -10 to 0 F, which the report calls far superior to resistance heat.
  - contradicts (uncited): PNNL 2025, DOE Cold Climate Heat Pump Challenge field results wrong 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L180-L189`
    > Prototype cold-climate heat pumps in occupied northern US and Canadian homes kept a median COP of 1.9 at 0-5 F, with most units above the ENERGY STAR 1.75 threshold in the field.
  - contradicts (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - contradicts (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.
  - contradicts (uncited): Canadian Climate Institute 2023, heat pumps pay off wrong 0.45, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L541`
    > Standard heat pumps perform well to -8 to -10°C and cold-climate models to -25°C; Norway, with temperatures similar to Canada's, leads the world in heat pump penetration, with confirmed real-world performance there.
  - statement: Heat Pump Hustle: Taxpayers On The Hook For Tech That Falls Flat In The Cold  `patch-heat-pump-hustle-taxpayers-hook-tech-falls-flat-cold`
    > Taxpayers On The Hook For Tech That Falls Flat In The Cold
  - quotation: "Taxpayers On The Hook For Tech That Falls Flat In The Cold" from `patch-heat-pump-hustle-taxpayers-hook-tech-falls-flat-cold`

### s05 (attributed, verified)

> The Mass Save heat pump page answers that "many provide efficient heat at outdoor temperatures as low as -15 °F".

- **s05.a** [verified] Mass Save says of heat pumps: "many provide efficient heat at outdoor temperatures as low as -15 °F".
  - supported (approved): no direct support, 3 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.
  - statement: Heat Pumps | Mass Save  `masssave-heat-pumps`
    > many provide efficient heat at outdoor temperatures as low as -15 °F
  - quotation: "many provide efficient heat at outdoor temperatures as low as -15 °F" from `masssave-heat-pumps`

### s08 (factual, verified)

> Engineers score heating efficiency as a COP, and plain electric resistance heat scores 1.

- **s08.a** [verified] Electric resistance heat operates at a COP of 1, less efficient than a heat pump.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55), 1 qualifying.
  - warning needs-qualification: Edwards 2024, inequities in heat pump bill savings: Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > Figure 4 shows similar cyclical data for an all-electric heat pump system. This plot shows the heat pump-only heating events (in blue), the events where defrost was active (yellow), and events that required some electric resistance booster heat (green). The all-electric heat pump does not have the fixed switch over poi…
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.

### s09 (factual, verified)

> In one evaluation, engineers metered the heat that dozens of ductless mini-splits delivered over back-to-back winters, and in the later one the units averaged a COP of 1.5 between -10 and 0 °F.

- **s09.a** [verified] An evaluation metered delivered heat from dozens of ductless mini-splits over winter 2015 and winter 2016; in the 2016 winter their COPs averaged 1.5 at -10 to 0 °F.
  - qualified (qualify): 2 supporting (1 independent, strongest 0.6), 2 qualifying, 1 context only.
  - warning needs-qualification: Wilson 2024 (NREL and LBNL), heat pumps for all?: Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates. [partial: a count of products rated at 5F on a certification list, not measured operation in homes] Edwards 2024, inequities in heat pump bill savings: Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type. Context only, RMI 2018, the economics of electrifying buildings (wrong): background sentence citing a footnote about rated models; RMI did not test cold-weather operation. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) wrong 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.6, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.

### s10 (factual, verified)

> That is 50 percent more heat per unit of electricity than resistance heat, which the evaluators called far superior; in the earlier winter, with deep snow and ice around the outdoor units, the units ran less efficiently.

- **s10.a** [verified] At a COP of 1.5 the mini-splits gave effective heating efficiencies 50% higher than electric resistance heating, which the evaluators called far superior.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 1 qualifying.
  - warning needs-qualification: Edwards 2024, inequities in heat pump bill savings: Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.6, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.
- **s10.b** [verified] The units operated less efficiently in winter 2015, which had prolonged deep snow and cold, with snow and ice around outdoor units, than in winter 2016.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 1 qualifying.
  - warning needs-qualification: Edwards 2024, inequities in heat pump bill savings: Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.6, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.

### s11 (factual, verified)

> And not only the cold-climate models: the ordinary ones in that evaluation also ran below 0 °F, just less efficiently.

- **s11.a** [verified] In the evaluation, observed non-cold-climate models operated at outdoor temperatures below 0 °F, at lower efficiency than cold-climate models.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.4), 3 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. [partial: the verdict note limits its own scope ("though")] Winkler 2023 (NREL), cold-climate heat pump field validation: Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F. Canadian Climate Institute 2023, heat pumps pay off: Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada. [partial: the verdict note limits its own scope ("though")] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.4, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2997-L3002`
    > This ratings difference is consistent with comments engineers at major manufacturers told the evaluation team, stating that cold-climate units were of higher quality and featured more of the newest technology. As cold-climate units are increasingly demanded by customers, the engineers reasoned that putting more effort …
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.

### s12 (factual, verified)

> A newer field test followed prototype cold-climate heat pumps, and leaving out the periods when backup heat or defrost was running, their median COP between 0 and 5 °F was 1.9.

- **s12.a** [verified] Excluding periods with auxiliary heat or defrost, the prototype cold-climate heat pumps in the field had a median COP of 1.9 in the 0 to 5 °F bin.
  - qualified (qualify): 2 supporting (1 independent, strongest 0.55), 2 qualifying, 1 context only.
  - warning needs-qualification: Wilson 2024 (NREL and LBNL), heat pumps for all?: Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates. [partial: a count of products rated at 5F on a certification list, not measured operation in homes] Edwards 2024, inequities in heat pump bill savings: Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type. Context only, RMI 2018, the economics of electrifying buildings (wrong): background sentence citing a footnote about rated models; RMI did not test cold-weather operation. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results wrong 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L180-L189`
    > Excluding periods with auxiliary heat or defrost, heating COPs were observed to be more tightly clustered at colder temperatures and to increase steadily with increasing outdoor air temperature (OAT). Figure 1 below shows a box and whisker chart of observed heating and cooling performance. The median COPs across all si…
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L180-L189`
    > Excluding periods with auxiliary heat or defrost, heating COPs were observed to be more tightly clustered at colder temperatures and to increase steadily with increasing outdoor air temperature (OAT). Figure 1 below shows a box and whisker chart of observed heating and cooling performance. The median COPs across all si…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.

### s13 (factual, verified)

> Those prototypes tested better in the lab, but in the field most still beat 1.75, the COP the EPA's Energy Star label requires of a cold-climate heat pump at 5 °F.

- **s13.a** [verified] The prototypes' laboratory performance was significantly more efficient, but most units' observed field COP was above 1.75, the EPA Energy Star requirement for cold-climate heat pumps at 5 °F.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55), 1 qualifying, 1 context only. modality: typical.
  - warning needs-qualification: Wilson 2024 (NREL and LBNL), heat pumps for all?: Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates. [partial: a count of products rated at 5F on a certification list, not measured operation in homes] Context only, RMI 2018, the economics of electrifying buildings (wrong): background sentence citing a footnote about rated models; RMI did not test cold-weather operation. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results wrong 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L180-L189`
    > Excluding periods with auxiliary heat or defrost, heating COPs were observed to be more tightly clustered at colder temperatures and to increase steadily with increasing outdoor air temperature (OAT). Figure 1 below shows a box and whisker chart of observed heating and cooling performance. The median COPs across all si…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.

### s15 (attributed, verified)

> As the channel Technology Connections puts it, "along with getting less efficient, their actual heat output also drops."

- **s15.a** [verified] Technology Connections said that along with getting less efficient, heat pumps' actual heat output also drops.
  - supported (approved): no direct support, 1 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Energy Systems Catapult 2023, Electrification of Heat trial performance partly 0.45, direct `heat-pumps/sources/esc-2023-eoh-interim-heat-pump-performance.txt#L391-L394`
    > Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported.
  - statement: Furnaces: Why we still burn fuel to heat our homes  `56DSH8tKUvo`
    > But along with getting less efficient, their actual heat output also drops.
  - quotation: "along with getting less efficient, their actual heat output also drops." from `56DSH8tKUvo`

### s16 (factual, verified)

> In northern Minnesota, researchers watched one small ductless unit hold a steady median output from 10 °F all the way down to -15 °F.

- **s16.a** [verified] One 1-ton ductless heat pump in Northern Minnesota delivered a consistent median capacity from 10 °F to -15 °F.
  - qualified (qualify): no direct support, 3 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > The ductless mini-split manufacturers claim systems operate at outdoor temperatures as cold as -13 ⁰F. Figure 6 shows the one minute average capacities of ductless systems installed in Northern Minnesota. This ductless heat pump delivered a consistent median capacity from 10 ⁰F to -15 ⁰F. The system continued to operat…
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.

### s17 (factual, verified)

> Below that it kept running at reduced output, and at -20 °F and colder it delivered only about 20 percent of what it was rated for at 5 °F.

- **s17.a** [verified] The unit continued to operate from -15 °F to -25 °F at reduced capacity; between -20 and -25 °F its median delivered capacity was approximately 20% of its rated capacity at 5 °F.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 1 qualifying.
  - warning needs-qualification: Energy Systems Catapult 2023, Electrification of Heat trial performance: Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > The ductless mini-split manufacturers claim systems operate at outdoor temperatures as cold as -13 ⁰F. Figure 6 shows the one minute average capacities of ductless systems installed in Northern Minnesota. This ductless heat pump delivered a consistent median capacity from 10 ⁰F to -15 ⁰F. The system continued to operat…
  - qualifies (uncited): Energy Systems Catapult 2023, Electrification of Heat trial performance partly 0.45, direct `heat-pumps/sources/esc-2023-eoh-interim-heat-pump-performance.txt#L391-L394`
    > Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported.

### s18 (factual, verified)

> The researchers' verdict was that units like it should not be used without backup below -15 °F.

- **s18.a** [verified] The researchers concluded the reduction in capacity shows these units should not be used without backup at extreme temperatures below -15 °F.
  - qualified (qualify): no direct support, 3 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > The ductless mini-split manufacturers claim systems operate at outdoor temperatures as cold as -13 ⁰F. Figure 6 shows the one minute average capacities of ductless systems installed in Northern Minnesota. This ductless heat pump delivered a consistent median capacity from 10 ⁰F to -15 ⁰F. The system continued to operat…
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.

### s19 (factual, verified)

> Efficiency follows the same slope: in the same Minnesota research, outdoor temperature had the biggest effect on COP, and heat-pump-only cycles managed only around 1.3 at 10 °F, less than half what they reached on mild days.

- **s19.a** [verified] In the Minnesota study, outdoor air temperature had the largest impact on COP; heat-pump-only heating events had COPs around 1.3 at 10 °F, rising to around 3.0 to 4.5 in the shoulder heating seasons (around 50 to 60 °F), so 1.3 is less than half of the mild-weather figure.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 1 qualifying.
  - warning needs-qualification: Energy Systems Catapult 2023, Electrification of Heat trial performance: Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2017, cold-climate heat pumps in Minnesota right 0.65, direct `heat-pumps/sources/cee-2017-cold-climate-ashp-minnesota.txt#L1143-L1157`
    > ccASHP Performance The large reductions in site energy consumption were possible because of the significant COP increase with the ccASHP systems compared to baseline systems. Heating events where only the heat pump was used typically had COPs around 1.3 at the lower temperature change point (10⁰F), and COPs increased t…
  - qualifies (uncited): Energy Systems Catapult 2023, Electrification of Heat trial performance partly 0.45, direct `heat-pumps/sources/esc-2023-eoh-interim-heat-pump-performance.txt#L391-L394`
    > Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported.

### s21 (factual, verified)

> In cold, humid air, frost builds up on the outdoor coil, and to melt it the heat pump runs in reverse, pulling heat out of the house, which can cool the air coming out of the vents.

- **s21.a** [verified] In cold, humid conditions frost accumulates on the outdoor coil and cuts heat exchange; defrost reverses the refrigerant flow so the heat pump rejects heat from the conditioned space to melt the frost, which can drop the supply air temperature.
  - supported (approved): 1 supporting (1 independent, strongest 0.55). modality: possibility.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1249-L1310`
    > 4.5 Defrost Operation When operating in cold climates under humid conditions, frost starts accumulating over time on the outdoor heat exchanger coils of the CCHPs as moisture from outdoor air begins to condense and freeze on the outdoor unit. This results in a loss of effective heat exchange and reduces the CCHP’s capa…

### s22 (factual, verified)

> In the prototype field test, defrost used a median of 5 to 8 percent of the energy at the temperatures where it cost most, a small share, though one site spent 16 percent of its time in defrost.

- **s22.a** [verified] Defrost was most energy intensive at 5 to 35 °F, where the median share of energy expended was between 5% and 8%, a small portion; one site spent 16% of its time in defrost under 40 °F against an overall average of 5%.
  - supported (approved): 1 supporting (1 independent, strongest 0.55). modality: typical.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1249-L1310`
    > 4.5 Defrost Operation When operating in cold climates under humid conditions, frost starts accumulating over time on the outdoor heat exchanger coils of the CCHPs as moisture from outdoor air begins to condense and freeze on the outdoor unit. This results in a loss of effective heat exchange and reduces the CCHP’s capa…

### s24 (attributed, verified)

> When a heat pump's electric backup strips kick in, Jordan Dearden warns, "They'll also absolutely destroy your electric bill."

- **s24.a** [verified] Jordan Dearden said electric backup heat strips will absolutely destroy your electric bill.
  - supported (approved): no direct support, 5 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.
  - statement: Heat Pump vs Furnace: Think TWICE Before Switching  `f0PBF-kE-H0`
    > They'll also absolutely destroy your electric bill.
  - quotation: "They'll also absolutely destroy your electric bill." from `f0PBF-kE-H0`

### s25 (factual, verified)

> In the prototype test, the units ran mostly on the heat pump alone, even at the lowest temperatures, and backup-only operation was minimal above 0 °F.

- **s25.a** [verified] The units primarily operated in heat-pump-only mode even at the lowest outdoor temperatures, and auxiliary-only operation was minimal above 0 °F.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 3 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. [partial: the verdict note limits its own scope ("though")] Winkler 2023 (NREL), cold-climate heat pump field validation: Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F. Canadian Climate Institute 2023, heat pumps pay off: Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada. [partial: the verdict note limits its own scope ("though")] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.45, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1238-L1247`
    > Figure 10 shows the overall distribution of operating models across all sites by OAT bin. The units are observed to primarily operate in HP-only mode even at the lowest OATs as indicated by the yellow-stacked bars. Overall, switchover temperatures were observed to be around 30-35 °F, indicated by the emergence of the o…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.

### s26 (factual, verified)

> But in the coldest range with enough data, below 0 °F, backup elements were on 25 percent of the time, and only some of the 22 sites had enough data that cold.

- **s26.a** [verified] In the coldest outdoor temperature bins with sufficient data (-10 to 0 °F), auxiliary elements were engaged 25% of the time across sites; the two coldest bins had a sample of 8 and 11 of the 22 sites.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 5 qualifying.
  - warning needs-qualification: Efficiency Maine 2026, whole-home heat pumps metered in Maine homes: In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs. Winkler 2023 (NREL), cold-climate heat pump field validation: Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat. CEE 2018, ducted and ductless cold-climate heat pumps in the field: In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency. [partial: the verdict note limits its own scope ("rather than")] Wilson 2024 (NREL and LBNL), heat pumps for all?: In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such. [partial: the verdict note limits its own scope ("not cold-climate units as such")] Canadian Climate Institute 2023, heat pumps pay off: In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.45, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1169-L1193`
    > For the OAT bins 5 °F and above, the median value decreases from around 11% at 5 °F to 0% at the highest OAT bins that have sufficient heating data to be included. Below 5 °F, the sample sizes (denoted by the number listed near the median) decrease. The data shows that auxiliary energy use increases significantly at th…
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.

### s27 (factual, verified)

> Some backup use came from the thermostat: backup heat began at around 30 to 35 °F, and the researchers expect it would start much lower without homeowners changing setpoints, or with smarter thermostat controls.

- **s27.a** [verified] Switchover to supplemental heat was observed around 30 to 35 °F; the researchers say a typical switchover temperature without homeowner setpoint interference, or with better setpoint controls, would likely be much lower.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 3 qualifying.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. [partial: the verdict note limits its own scope ("though")] Winkler 2023 (NREL), cold-climate heat pump field validation: Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F. Canadian Climate Institute 2023, heat pumps pay off: Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada. [partial: the verdict note limits its own scope ("though")] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.45, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1238-L1247`
    > Figure 10 shows the overall distribution of operating models across all sites by OAT bin. The units are observed to primarily operate in HP-only mode even at the lowest OATs as indicated by the yellow-stacked bars. Overall, switchover temperatures were observed to be around 30-35 °F, indicated by the emergence of the o…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.

### s28 (factual, verified)

> Some came from faults: two sites fired up higher stages of backup heat during defrost, at least one did it in normal heating too, and the manufacturer called that a controls problem.

- **s28.a** [verified] Two sites engaged higher stages of auxiliary heat during defrost; at least one did so in normal operation too, which the manufacturer team said was a controls problem and not intended operation.
  - supported (approved): 1 supporting (1 independent, strongest 0.55).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1249-L1310`
    > 4.5 Defrost Operation When operating in cold climates under humid conditions, frost starts accumulating over time on the outdoor heat exchanger coils of the CCHPs as moisture from outdoor air begins to condense and freeze on the outdoor unit. This results in a loss of effective heat exchange and reduces the CCHP’s capa…

### s29 (factual, verified)

> In the Minnesota study's all-electric system, the resistance booster joined in below 30 °F, yet because the heat pump ran first, the whole system still beat plain resistance heat even at the coldest reading, around -7 °F.

- warning number-dense (deterministic): 10 figures from s29 to s36: keep the ones the argument needs, chart the rest and say the point in words
- **s29.a** [verified] In the all-electric system, events with electric resistance booster heat occurred below 30 °F, but because the heat pump was prioritized, system COPs were greater than 1.0 even at the coldest outdoor temperature, around -7 °F.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55), 6 qualifying. modality: universal.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency. "all" is stronger than the evidence (strongest support 0.55). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > Figure 4 shows similar cyclical data for an all-electric heat pump system. This plot shows the heat pump-only heating events (in blue), the events where defrost was active (yellow), and events that required some electric resistance booster heat (green). The all-electric heat pump does not have the fixed switch over poi…
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > Figure 4 shows similar cyclical data for an all-electric heat pump system. This plot shows the heat pump-only heating events (in blue), the events where defrost was active (yellow), and events that required some electric resistance booster heat (green). The all-electric heat pump does not have the fixed switch over poi…
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.

### s30 (factual, verified)

> In another field study, one site's compressor would not run below 0 °F at all, even with its lockout disabled, most likely because of an on-board control setting that cannot be adjusted in the field.

- **s30.a** [verified] At Site 10 the compressor did not run below 0 °F although its lockout temperature was disabled, likely due to an on-board control setting that cannot be adjusted in the field.
  - qualified (qualify): no direct support, 3 qualifying.
  - warning needs-qualification: Winkler 2023 (NREL), cold-climate heat pump field validation: Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Most of the all-electric sites had very few hours with outdoor temperatures below the compressor lockout temperature (listed in Table 5). Site 10 was the exception. Though the compressor lockout temperature at Site 10 was disabled, the compressor did not run at temperatures below 0°F, which was likely due to an on-boar…
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.

### s31 (factual, verified)

> Sizing matters too: one study estimated that in Minnesota a high-efficiency heat pump sized for the full heating load cut median bills by $182 a year, while one sized for the cooling load raised them by $96, because it leaned harder on electric resistance backup.

- **s31.a** [verified] In Minnesota, median bill savings were $182/year for high-efficiency ASHPs sized for the heating load, while median bills rose $96/year when they were sized for the cooling load, because of higher use of electric resistance backup.
  - qualified (qualify): no direct support, 5 qualifying.
  - warning needs-qualification: Wilson 2024 (NREL and LBNL), heat pumps for all?: In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > As would be expected, we ﬁnd that sizing ASHPs for the full heating load results in higher median bill savings compared with ASHPs sized with cooling load priority. For instance, the median bill savings in Minnesota is $182/year for high-efﬁciency ASHPs sized for heating load, whereas median bills increase by $96/year …
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.

### s33 (factual, verified)

> For the Minnesota homes, which had heated with propane or electricity, the researchers used performance maps and typical Minnesota weather to estimate cost savings of 30 to 56 percent.

- **s33.a** [verified] For Minnesota homes replacing propane furnaces or electric heating, performance maps, home heating loads and normalized Minnesota weather were used to estimate homeowner cost savings of 30% to 56%.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 1 qualifying, 1 context only.
  - warning needs-qualification: Wilson 2024 (NREL and LBNL), heat pumps for all?: Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates. [partial: a count of products rated at 5F on a certification list, not measured operation in homes] Context only, RMI 2018, the economics of electrifying buildings (wrong): background sentence citing a footnote about rated models; RMI did not test cold-weather operation. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field wrong 0.6, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L495-L518`
    > Conclusions ccASHPs proved to be beneficial for typical Minnesota homes when replacing propane furnaces or electric heating. When operating in heat pump-only mode, the system manufacturer specifications for COP and capacity adequate for sizing the systems. Cold weather increased the need for back-up systems, defrost op…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.

### s34 (factual, verified)

> Gas is harder to beat: at the prices of those winters, the mini-splits from the first evaluation cost less to run than an 80 percent efficient gas system only above 70 °F, which the evaluators said made them no direct replacement for gas.

- **s34.a** [verified] For natural gas, the cost breakpoint was above 70 °F in either winter, so the mini-splits only operated cost-effectively above 70 °F compared with an 80% efficient heating system, and the evaluators said they do not provide a viable direct replacement for a gas-fired system at those energy prices.
  - qualified (qualify): no direct support, 4 qualifying.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > For natural gas, the figure shows a temperature breakpoint above 70°F for either winter, meaning a DMSHP only operates cost-effectively above 70°F (compared with an 80% efficient heating system).45 This effectively means a DMSHP does not provide a viable direct replacement for a gas-fired system at 45 System efficiency…
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.

### s35 (factual, verified)

> Against propane, they were cheaper at every temperature.

- **s35.a** [verified] The balance point for propane was -15 °F in both winters, meaning the mini-split was always less expensive than propane.
  - qualified (qualify): no direct support, 4 qualifying. modality: universal.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone. "always" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > For natural gas, the figure shows a temperature breakpoint above 70°F for either winter, meaning a DMSHP only operates cost-effectively above 70°F (compared with an 80% efficient heating system).45 This effectively means a DMSHP does not provide a viable direct replacement for a gas-fired system at 45 System efficiency…
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.

### s36 (factual, verified)

> Even the measured units listed as cold-climate broke even with gas only above 58 °F; on paper, the rating curve of a then-current cold-climate model brought it down to between 28 and 40 °F.

- **s36.a** [verified] For the measured units listed as cold climate units, gas balance points were above 58 °F for both winters; based on the rating curve of a current cold-climate unit with an HSPF of 13, the natural gas balance point dropped to 40 °F for 2015 and 28 °F for 2016.
  - qualified (qualify): no direct support, 4 qualifying.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > For natural gas, the figure shows a temperature breakpoint above 70°F for either winter, meaning a DMSHP only operates cost-effectively above 70°F (compared with an 80% efficient heating system).45 This effectively means a DMSHP does not provide a viable direct replacement for a gas-fired system at 45 System efficiency…
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.

### s37 (factual, verified)

> A cost model for Toronto and Edmonton that counts equipment as well as energy points the same way: in Toronto, standard heat pumps with gas backup came out the lowest-cost option for nearly all households, but in Edmonton that held only for some house types, and gas with air conditioning won the rest.

- **s37.a** [verified] In Toronto, standard heat pumps with gas backup are the lowest-cost option for nearly all households under mid-range assumptions; in Edmonton they are the lowest-cost option for single family homes and townhouses built in 1940 or 1980, and in other cases gas and air conditioning is the most cost-competitive option.
  - qualified (qualify): no direct support, 4 qualifying. modality: universal.
  - warning needs-qualification: Canadian Climate Institute 2023, heat pumps pay off: Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone. "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > across building ages. In Toronto, standard heat pumps with gas backup are the lowest-cost option for nearly all households under mid-range assump- tions, and still tend to be cost competitive even under high electricity and low gas price assumptions. In Edmonton, heat pumps with gas backup are the lowest-cost option fo…
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.

### s38 (factual, verified)

> The model's reasons were cheap gas and the cold itself, which makes heat pumps less efficient and calls on the backup more.

- **s38.a** [verified] Edmonton's result was due to low gas prices and climate conditions; the cold climate makes heat pumps relatively less efficient and results in greater use of the backup heating system.
  - qualified (qualify): no direct support, 9 qualifying.
  - warning needs-qualification: Canadian Climate Institute 2023, heat pumps pay off: Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone. Canadian Climate Institute 2023, heat pumps pay off: In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > across building ages. In Toronto, standard heat pumps with gas backup are the lowest-cost option for nearly all households under mid-range assump- tions, and still tend to be cost competitive even under high electricity and low gas price assumptions. In Edmonton, heat pumps with gas backup are the lowest-cost option fo…
  - qualifies: Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > tions, which creates a significant cost differential between gas and electri- city. Climate conditions play an important role: the cold climate drives up demand for electricity to meet heating needs (and amplifies the effect of the cost differential between gas and electricity in Alberta) at the same time as it makes h…
  - qualifies (uncited): Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such.

### s40 (factual, verified)

> In these field tests most units did: they kept heating below zero, with less efficiency and less output, and still got more heat from each unit of electricity than resistance heat.

- **s40.a** [verified] Most metered mini-splits kept heating at -10 to 0 °F, and a ductless cold-climate unit kept operating down to -25 °F; not every unit did (one field site's compressor did not run below 0 °F).
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55), 4 qualifying, 1 context only. modality: universal.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. Winkler 2023 (NREL), cold-climate heat pump field validation: Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F. "every" is stronger than the evidence (strongest support 0.55). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) wrong 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > The ductless mini-split manufacturers claim systems operate at outdoor temperatures as cold as -13 ⁰F. Figure 6 shows the one minute average capacities of ductless systems installed in Northern Minnesota. This ductless heat pump delivered a consistent median capacity from 10 ⁰F to -15 ⁰F. The system continued to operat…
  - qualifies: Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Most of the all-electric sites had very few hours with outdoor temperatures below the compressor lockout temperature (listed in Table 5). Site 10 was the exception. Though the compressor lockout temperature at Site 10 was disabled, the compressor did not run at temperatures below 0°F, which was likely due to an on-boar…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.
- **s40.b** [verified] Their efficiency and output fell as it got colder.
  - qualified (qualify): 2 supporting (1 independent, strongest 0.65), 1 qualifying.
  - warning needs-qualification: Energy Systems Catapult 2023, Electrification of Heat trial performance: Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2017, cold-climate heat pumps in Minnesota right 0.65, direct `heat-pumps/sources/cee-2017-cold-climate-ashp-minnesota.txt#L1143-L1157`
    > ccASHP Performance The large reductions in site energy consumption were possible because of the significant COP increase with the ccASHP systems compared to baseline systems. Heating events where only the heat pump was used typically had COPs around 1.3 at the lower temperature change point (10⁰F), and COPs increased t…
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > The ductless mini-split manufacturers claim systems operate at outdoor temperatures as cold as -13 ⁰F. Figure 6 shows the one minute average capacities of ductless systems installed in Northern Minnesota. This ductless heat pump delivered a consistent median capacity from 10 ⁰F to -15 ⁰F. The system continued to operat…
  - qualifies (uncited): Energy Systems Catapult 2023, Electrification of Heat trial performance partly 0.45, direct `heat-pumps/sources/esc-2023-eoh-interim-heat-pump-performance.txt#L391-L394`
    > Across the UK trial the measured COP fell as outdoor temperature fell, to a median 2.44 on the coldest day (mean -0.4C) against a seasonal 2.80; capacity was not reported.
- **s40.c** [verified] Their COP stayed above that of electric resistance heat in the cold.
  - qualified (qualify): 2 supporting (2 independent, strongest 0.6), 1 qualifying.
  - warning needs-qualification: Edwards 2024, inequities in heat pump bill savings: Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) right 0.6, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.55, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > Figure 4 shows similar cyclical data for an all-electric heat pump system. This plot shows the heat pump-only heating events (in blue), the events where defrost was active (yellow), and events that required some electric resistance booster heat (green). The all-electric heat pump does not have the fixed switch over poi…
  - qualifies (uncited): Edwards 2024, inequities in heat pump bill savings partly 0.4, direct `heat-pumps/sources/edwards-2024-heat-pump-inequities.txt#L1649-L1659`
    > Edwards assumes single-stage heat pumps fall to COP 1 (no better than resistance) below 5F, while cold-climate two-stage units keep a higher COP, so the claim depends on equipment type.

### s41 (factual, verified)

> The catch is backup heat, which ran more as it got colder, and more where a unit was sized for cooling or its controls misbehaved.

- info omission (review): The new Efficiency Maine 2026 study (78 metered whole-home installs) agrees that backup rose below 10 F, but there it was mostly the existing fossil system and only one home regularly used electric resistance; the script does not mention it. It does not contradict s41 (which says backup ran more in the cold, not which kind), and its COP of 2 at -10 F across 166 units supports s40.
- **s41.a** [verified] Auxiliary heater usage generally increased at colder temperature bins.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.45), 5 qualifying. modality: typical.
  - warning needs-qualification: Winkler 2023 (NREL), cold-climate heat pump field validation: Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.45, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1169-L1193`
    > For the OAT bins 5 °F and above, the median value decreases from around 11% at 5 °F to 0% at the highest OAT bins that have sufficient heating data to be included. Below 5 °F, the sample sizes (denoted by the number listed near the median) decrease. The data shows that auxiliary energy use increases significantly at th…
  - qualifies: Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Table 12 shows the auxiliary heat runtime, in hours, during winter 2021–2022, binned by outdoor air temperature. The hours of auxiliary operation in Table 12 include operating modes of compressor plus auxiliary heating and auxiliary heating only; thus, time spent in defrost mode is not included here. The percentages in…
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.
- **s41.b** [verified] A heat pump sized for the cooling load used more electric resistance backup.
  - qualified (qualify): no direct support, 5 qualifying.
  - warning needs-qualification: Wilson 2024 (NREL and LBNL), heat pumps for all?: In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > As would be expected, we ﬁnd that sizing ASHPs for the full heating load results in higher median bill savings compared with ASHPs sized with cooling load priority. For instance, the median bill savings in Minnesota is $182/year for high-efﬁciency ASHPs sized for heating load, whereas median bills increase by $96/year …
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.
- **s41.c** [verified] A controls problem made at least one site engage higher stages of auxiliary heat.
  - supported (approved): 1 supporting (1 independent, strongest 0.55).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1249-L1310`
    > 4.5 Defrost Operation When operating in cold climates under humid conditions, frost starts accumulating over time on the outdoor heat exchanger coils of the CCHPs as moisture from outdoor air begins to condense and freeze on the outdoor unit. This results in a loss of effective heat exchange and reduces the CCHP’s capa…

### s43 (factual, verified)

> Against propane or electric heat, the studies here say yes on running costs, though the Minnesota researchers put retrofit paybacks at over 10 years unless the old system needs replacing; against gas, it turns on the unit, the climate and local prices, and for the mini-splits measured in the first evaluation, gas won.

- **s43.a** [verified] Against propane furnaces or electric heating, the Minnesota study estimated cost savings, though for retrofits paybacks will typically be longer than 10 years unless equipment replacement is necessary; and the mini-splits were always cheaper than propane.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 5 qualifying, 1 context only. modality: universal.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone. "always" is stronger than the evidence (strongest support 0.6). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: CEE 2018, ducted and ductless cold-climate heat pumps in the field wrong 0.6, direct `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L495-L518`
    > Conclusions ccASHPs proved to be beneficial for typical Minnesota homes when replacing propane furnaces or electric heating. When operating in heat pump-only mode, the system manufacturer specifications for COP and capacity adequate for sizing the systems. Cold weather increased the need for back-up systems, defrost op…
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > For natural gas, the figure shows a temperature breakpoint above 70°F for either winter, meaning a DMSHP only operates cost-effectively above 70°F (compared with an 80% efficient heating system).45 This effectively means a DMSHP does not provide a viable direct replacement for a gas-fired system at 45 System efficiency…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.
- **s43.b** [verified] Against gas, the result varied with the unit (measured units vs a rated cold-climate unit), the climate and gas prices (Toronto vs Edmonton), and for the measured mini-splits gas was cheaper below 70 °F.
  - qualified (qualify): no direct support, 4 qualifying.
  - warning needs-qualification: Cadmus 2016, ductless mini-split evaluation (MA and RI): Switching between heat pump and fuel at the crossover temperature is cheapest in principle, but at 2016 prices the gas crossover was above 70 F for the measured units, so pairing with gas saved nothing; only a modelled HSPF-13 unit (28-40 F crossover) would beat gas alone. Canadian Climate Institute 2023, heat pumps pay off: Lifetime-cost model: in Toronto a heat pump with gas backup is cheapest for nearly all households, and in Edmonton for 1940 and 1980 detached and townhouses, but gas with AC wins other Edmonton cases; this is lifetime cost including equipment, not running cost alone. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Cadmus 2016, ductless mini-split evaluation (MA and RI) partly 0.3, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L3436-L3459`
    > For natural gas, the figure shows a temperature breakpoint above 70°F for either winter, meaning a DMSHP only operates cost-effectively above 70°F (compared with an 80% efficient heating system).45 This effectively means a DMSHP does not provide a viable direct replacement for a gas-fired system at 45 System efficiency…
  - qualifies: Canadian Climate Institute 2023, heat pumps pay off partly 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1142-L1150`
    > across building ages. In Toronto, standard heat pumps with gas backup are the lowest-cost option for nearly all households under mid-range assump- tions, and still tend to be cost competitive even under high electricity and low gas price assumptions. In Edmonton, heat pumps with gas backup are the lowest-cost option fo…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.25, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L730-L732`
    > Hybrid heat pumps with fossil backup are said to mitigate bill increases without necessarily raising upfront cost, but they were not analysed.
  - qualifies (uncited): Deetjen 2021, private economics of US residential heat pumps partly 0.2, partial `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L545-L547`
    > The authors note private economics might improve if supplemental heat came from gas rather than resistance, but they do not model it.

### s44 (factual, verified)

> Each of these field tests followed a limited number of units, so they show what heat pumps can do in the cold, not what every installation will.

- **s44.a** [verified] The field tests followed limited samples: dozens of metered mini-splits, 22 prototype sites, and one ductless unit for the coldest readings.
  - qualified (qualify): 2 supporting (2 independent, strongest 0.55), 9 qualifying, 1 context only.
  - warning needs-qualification: CEE 2018, ducted and ductless cold-climate heat pumps in the field: A ductless cold-climate unit delivered a consistent median capacity from 10F to -15F and kept operating to -25F at reduced capacity, though the authors say it needs backup below -15F; one monitored unit. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Cadmus 2016, ductless mini-split evaluation (MA and RI) wrong 0.55, direct `heat-pumps/sources/cadmus-2016-ductless-mini-split-evaluation.txt#L2926-L2935`
    > Figure 52 and Figure 53 provide data critical for understanding DMSHP operations, along with the average metered efficiency of units across a range of outdoor air temperatures. These measurements of field efficiency are only possible where delivered heating and cooling (i.e., BTUs) are metered. These graphs show season…
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.45, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1169-L1193`
    > For the OAT bins 5 °F and above, the median value decreases from around 11% at 5 °F to 0% at the highest OAT bins that have sufficient heating data to be included. Below 5 °F, the sample sizes (denoted by the number listed near the median) decrease. The data shows that auxiliary energy use increases significantly at th…
  - qualifies: CEE 2018, ducted and ductless cold-climate heat pumps in the field right 0.5, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L478-L489`
    > The ductless mini-split manufacturers claim systems operate at outdoor temperatures as cold as -13 ⁰F. Figure 6 shows the one minute average capacities of ductless systems installed in Northern Minnesota. This ductless heat pump delivered a consistent median capacity from 10 ⁰F to -15 ⁰F. The system continued to operat…
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? wrong 0.5, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L157-L163`
    > Over 25,000 products on the NEEP cold-climate list keep a COP of 2 or more at full capacity at 5F, and modelled per-household GHG savings are generally higher in cold climates.
  - qualifies (uncited): Efficiency Maine 2026, whole-home heat pumps metered in Maine homes partly 0.35, direct `heat-pumps/sources/efficiencymaine-2026-whole-home-heat-pump-study.txt#L1714-L1726`
    > In 78 metered Maine homes, backup heat rose below 10F, but it was fossil fuel: 13% of homes had some electric resistance heat and only one regularly used it, so reliance on resistance backup was rare in these whole-home installs.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.5, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L2150-L2157`
    > Auxiliary heat runtime generally rose in colder bins and heavy use cut system COP over 30% at two sites, but the heavy users were undersized or faulty while six sites used little auxiliary heat.
  - qualifies (uncited): CEE 2018, ducted and ductless cold-climate heat pumps in the field partly 0.45, partial `heat-pumps/sources/cee-2018-field-assessment-ducted-ductless.txt#L425-L435`
    > In all-electric systems the booster resistance heat ran at COP 1 below about 30F, but because the heat pump was prioritized the system COP stayed above 1.0 even at -7F, so backup use dented rather than erased efficiency.
  - qualifies (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? partly 0.4, partial `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L942-L946`
    > In Minnesota a high-efficiency heat pump sized for the heating load saves a median $182/yr, but sized for cooling it raises bills $96/yr through more resistance backup; reliance and the bill hit depend on sizing, not cold-climate units as such.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off partly 0.35, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L1153-L1158`
    > In Edmonton's cold climate the model finds heat pumps less efficient and more reliant on the backup system, which together with cheap gas makes all-electric heat pumps less cost-competitive; how often backup runs is not reported.
  - qualifies (uncited): Winkler 2023 (NREL), cold-climate heat pump field validation partly 0.4, direct `heat-pumps/sources/nrel-2023-cold-climate-field-validation.txt#L1946-L1951`
    > Among these ducted variable-speed units, Site 10's compressor did not run below 0F despite a disabled lockout, and the dual-fuel unit did not run below about 4F.
  - qualifies (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.35, partial `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L528-L536`
    > Cold-climate heat pumps can perform well down to -25°C (about -13°F), citing NRCan, though backup may still be needed in the coldest parts of Canada.
  - context (uncited): RMI 2018, the economics of electrifying buildings wrong 0.5, contextual `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L356-L358`
    > RMI notes that hundreds of models operate efficiently at 5F and some heat at -13F, and it models cold-climate heat pumps heating homes in Chicago and Providence.
