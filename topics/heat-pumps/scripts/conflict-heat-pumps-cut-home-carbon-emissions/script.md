# Do Heat Pumps Cut Emissions on Today's Grid?

Story `conflict:heat-pumps-cut-home-carbon-emissions` (heat-pumps), revision 4. About 4.8 minutes (706 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 19/19 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

If the electricity that runs a heat pump comes from a gas or coal power plant, is the heat pump really any cleaner than the gas furnace it replaced? It is a fair question, so let's put it to the studies.

## Setup

The doubters are easy to find: one letter to the Boston Globe warned that "the majority of electricity in Massachusetts is sourced from gas- and coal-fired power plants", and the American Gas Association argues that a gas home can have a smaller carbon footprint than a heat pump home. [s03 ok] The channel Technology Connections answers that even with a gas-fired power plant behind it, "a heat pump can move more heat energy into a living space than the natural gas itself contains". [s04 ok] So which is it, in real homes, on real grids?

## Investigation

Start in Britain, with households that replaced a gas boiler with a heat pump. A working paper turned the change in those households' energy use into emissions and found, in today's terms, a cut of 1.16 tonnes of CO2 equivalent per household per year: 36 percent of the footprint their energy use had before the heat pump. [s07 ok] The authors also assume the electricity grid keeps getting cleaner, and on that assumption project a 68 percent cut across an assumed 20-year working life: a lifetime projection, not today's figure. [s08 ok] But not every grid is Britain's. What happens where coal still runs the show? A report from RMI compared electric heating with gas in American cities on the grid of the time, and found it cut carbon in Oakland, Houston and Providence. [s10 ok] But in Chicago, where coal is the power that answers extra demand most of the year, electrifying heat increased carbon emissions in the short term. [s11 ok] RMI expected that to swing in favour of electrification, in Chicago and nationally, as coal plants keep retiring. [s12 ok] The Canadian Climate Institute, citing the International Energy Agency and a consulting firm, says that even on relatively emissions-intensive electricity, heat pumps emit 20 to 30 percent less carbon than gas furnaces, because they are so efficient. [s13 ok] That is a summary of other work, not a measurement on any one grid, so it sits beside RMI's Chicago result rather than overturning it. [s14 ok] So how many American homes sit on the wrong side of that line? One national model found switching to a heat pump would raise CO2 emissions in just 2.1 percent of the US housing stock, a share of all houses rather than of gas homes alone, but that estimate assumes grid CO2 emissions fall 45 percent over the heat pump's 15-year life. [s24 ok] A second national study, from US national laboratories, modelled every home switching to a heat pump at once, not only gas-heated ones, and found average greenhouse gas savings positive in every state, in every future grid scenario it modelled, even the most conservative one. [s25 ok] Notice what that measures: an average for each state on grids the authors project into the future, not today's grid, and not a count of the homes that come out behind. [s26 ok] The cleaner the grid, the bigger the gain. In a Lawrence Berkeley National Laboratory study of home retrofits, the group of projects built around electrification, with solar panels, sat mostly in states with low-carbon electricity, and there switching fuels sharply boosted their carbon savings. [s16 ok] The authors expect similar projects to save less carbon in states whose electricity is more carbon-intensive. [s17 ok]

## Answer

So does swapping gas for a heat pump cut emissions on today's grid? In the British homes, yes, by about a third of their energy footprint, and in RMI's words it already cuts carbon on today's grid in all but the most coal-heavy systems, though that was the grid when RMI wrote it. [s18 ok] The exception is a grid like Chicago's. [s19 ok] How rare that exception is, the evidence can only estimate: the national American studies both build in a grid that gets cleaner, so neither is a reading of today's grid alone. [s20 ok]

## Takeaway

If carbon is why you are looking at a heat pump, the question to put to your power company is not whether it burns anything, but what it burns when demand rises, and whether that is changing. Know that, and you know the part of the answer these studies turn on.

## Open issues

- **info** s03 (s03.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s03 (attributed, verified)

> The doubters are easy to find: one letter to the Boston Globe warned that "the majority of electricity in Massachusetts is sourced from gas- and coal-fired power plants", and the American Gas Association argues that a gas home can have a smaller carbon footprint than a heat pump home.

- **s03.a** [verified] A letter to the Boston Globe warned that most Massachusetts electricity comes from gas- and coal-fired plants, and the American Gas Association argues that a natural gas home can have a lower carbon footprint than a heat pump home.
  - supported (approved): no direct support, 4 contradicting, 2 qualifying, 2 source statements. modality: typical.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.
  - contradicts (uncited): Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.6, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L248-L258`
    > Average GHG savings are positive in every state for every heat pump and future grid scenario, even the conservative high-renewable-cost one, with emissions levelized over a 16-year equipment lifetime (projected grids, not today's).
  - contradicts (uncited): Deetjen 2021, private economics of US residential heat pumps right 0.5, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L635-L642`
    > Heat pump adoption raises CO2 for only 2.1% of US houses (1.7 million), but the estimate assumes grid CO2 emissions fall 45% over the heat pump's 15-year life.
  - contradicts (uncited): Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff right 0.65, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L193-L198`
    > On the 2024 UK grid, replacing a gas boiler with a heat pump cut household energy CO2eq by about 1.16 t/yr, 36% of the pre-adoption footprint, from measured consumption changes and government emission factors.
  - contradicts (uncited): Canadian Climate Institute 2023, heat pumps pay off right 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L459-L462`
    > Even on relatively emissions-intensive electricity, heat pumps emit 20 to 30% less than gas furnaces (citing IEA 2022 and a consultancy), and near zero on clean grids.
  - statement: The advance of heat pumps bumps up against cost concerns - The Boston Globe  `bostonglobe-letters-to-the-editor-heat-pump-transition`
    > the majority of electricity in Massachusetts is sourced from gas- and coal-fired power plants. Until we clean up the source of our electricity
  - statement: Natural Gas or a Heat Pump? Where You Live Matters - American Gas Association  `aga-natural-gas-or-a-heat-pump-where-you-live-matters`
    > a natural gas ENERGY STAR household can have a carbon footprint 19% lower than an ENERGY STAR heat pump household
  - quotation: "the majority of electricity in Massachusetts is sourced from gas- and coal-fired power plants" from `bostonglobe-letters-to-the-editor-heat-pump-transition`

### s04 (attributed, verified)

> The channel Technology Connections answers that even with a gas-fired power plant behind it, "a heat pump can move more heat energy into a living space than the natural gas itself contains".

- **s04.a** [verified] Technology Connections argues that even with a natural gas fired power plant, a heat pump can move more heat into a home than the gas itself contains.
  - supported (approved): no direct support, 2 qualifying, 1 source statement. modality: possibility.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.
  - statement: Furnaces: Why we still burn fuel to heat our homes  `56DSH8tKUvo`
    > a heat pump can move more heat energy into a living space than the natural gas itself contains
  - quotation: "a heat pump can move more heat energy into a living space than the natural gas itself contains" from `56DSH8tKUvo`

### s07 (factual, verified)

> A working paper turned the change in those households' energy use into emissions and found, in today's terms, a cut of 1.16 tonnes of CO2 equivalent per household per year: 36 percent of the footprint their energy use had before the heat pump.

- **s07.a** [verified] In today's terms, replacing a gas boiler with a heat pump is equivalent to a 1.16 tonne reduction in CO2eq emissions per household per year, a 36% reduction on the households' pre-heat-pump CO2eq footprint from annual energy consumption.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff right 0.65, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L193-L198`
    > today’s terms, that is equivalent to a 1.16 tonne reduction in CO2eq emissions per household per year – we calculate that this is a 36% reduction on their pre-heat-pump adoption CO2eq foot- print from annual energy consumption of 3.23 tonnes.9 By the end of an assumed 20-year heat pump lifespan (i.e., in 2043), emissio…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s08 (factual, verified)

> The authors also assume the electricity grid keeps getting cleaner, and on that assumption project a 68 percent cut across an assumed 20-year working life: a lifetime projection, not today's figure.

- **s08.a** [verified] Assuming a 20-year heat pump lifespan and an electricity grid that decarbonizes, the authors estimate heat pumps can reduce a household's CO2 equivalent emissions by 68% throughout their operational lifespan.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 2 qualifying. modality: possibility.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff right 0.65, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L193-L198`
    > today’s terms, that is equivalent to a 1.16 tonne reduction in CO2eq emissions per household per year – we calculate that this is a 36% reduction on their pre-heat-pump adoption CO2eq foot- print from annual energy consumption of 3.23 tonnes.9 By the end of an assumed 20-year heat pump lifespan (i.e., in 2043), emissio…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s10 (factual, verified)

> A report from RMI compared electric heating with gas in American cities on the grid of the time, and found it cut carbon in Oakland, Houston and Providence.

- **s10.a** [verified] RMI found that electrifying space and water heating reduced carbon compared with natural gas on the electric grid of the time in Oakland, Houston and Providence.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > Electrification already reduces carbon with today’s electric grid in all but the most coal-heavy systems. This is true in comparison to not only heating oil and propane, but also to natural gas. Figure 3 illustrates this result, showing emissions reductions in Oakland, Houston, and Providence. Because the electric grid…
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s11 (factual, verified)

> But in Chicago, where coal is the power that answers extra demand most of the year, electrifying heat increased carbon emissions in the short term.

- **s11.a** [verified] Because the grid serving Chicago has coal as its marginal generator most of the year, RMI found the short-term impact of electrification there increases carbon emissions.
  - qualified (qualify): no direct support, 2 qualifying. modality: typical.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > Electrification already reduces carbon with today’s electric grid in all but the most coal-heavy systems. This is true in comparison to not only heating oil and propane, but also to natural gas. Figure 3 illustrates this result, showing emissions reductions in Oakland, Houston, and Providence. Because the electric grid…
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s12 (factual, verified)

> RMI expected that to swing in favour of electrification, in Chicago and nationally, as coal plants keep retiring.

- **s12.a** [verified] RMI expects the long-term impact to swing in favor of electrification in Chicago and nationally with continued retirement of coal plants.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > Electrification already reduces carbon with today’s electric grid in all but the most coal-heavy systems. This is true in comparison to not only heating oil and propane, but also to natural gas. Figure 3 illustrates this result, showing emissions reductions in Oakland, Houston, and Providence. Because the electric grid…
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s13 (factual, verified)

> The Canadian Climate Institute, citing the International Energy Agency and a consulting firm, says that even on relatively emissions-intensive electricity, heat pumps emit 20 to 30 percent less carbon than gas furnaces, because they are so efficient.

- **s13.a** [verified] Citing the International Energy Agency (2022) and a consultancy (2021), the Canadian Climate Institute says that even on relatively emissions-intensive electricity, heat pumps emit between 20 and 30 per cent less carbon than gas furnaces because of their high efficiency.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.4), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Canadian Climate Institute 2023, heat pumps pay off right 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L459-L462`
    > towards zero as the grid gets cleaner. But even when running on relatively emissions‐intensive electricity, heat pumps emit between 20 and 30 per cent less carbon emissions than gas furnaces because of their high efficiency (International Energy Agency 2022; Kevin Dorma Consulting 2021). And
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s14 (factual, verified)

> That is a summary of other work, not a measurement on any one grid, so it sits beside RMI's Chicago result rather than overturning it.

- **s14.a** [verified] The Canadian Climate Institute's 20 to 30 per cent figure is cited from the International Energy Agency and a consultancy, not measured on a named grid.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.4), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Canadian Climate Institute 2023, heat pumps pay off right 0.4, direct `heat-pumps/sources/cci-2023-heat-pumps-pay-off.txt#L459-L462`
    > towards zero as the grid gets cleaner. But even when running on relatively emissions‐intensive electricity, heat pumps emit between 20 and 30 per cent less carbon emissions than gas furnaces because of their high efficiency (International Energy Agency 2022; Kevin Dorma Consulting 2021). And
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s24 (factual, verified)

> One national model found switching to a heat pump would raise CO2 emissions in just 2.1 percent of the US housing stock, a share of all houses rather than of gas homes alone, but that estimate assumes grid CO2 emissions fall 45 percent over the heat pump's 15-year life.

- **s24.a** [verified] Deetjen et al. estimate heat pump adoption increases CO2 emissions in only 2.1% of the US housing stock, based on historical grid operations and the assumption that over the heat pump's 15 years life electric grid CO2 emissions decrease by 45%.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Deetjen 2021, private economics of US residential heat pumps right 0.5, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L635-L642`
    > significantly. Climate benefits mostly increase with heat pump adoption: only in 1.7 million houses (2.1% of the US housing stock) does heat pump adoption increase CO2 emissions. Yet, abatement costs can be high: although 22.4 million houses (28% of the US housing stock) have abatement costs between 0 and 200 $/tCO2, t…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s25 (factual, verified)

> A second national study, from US national laboratories, modelled every home switching to a heat pump at once, not only gas-heated ones, and found average greenhouse gas savings positive in every state, in every future grid scenario it modelled, even the most conservative one.

- **s25.a** [verified] Wilson et al. model full, immediate ASHP adoption and find average annual GHG savings are positive in every state and in every heat pump and future grid scenario, even the conservative high renewable energy cost grid scenario.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying. modality: universal.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. "every" is stronger than the evidence (strongest support 0.6). Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.6, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L248-L258`
    > different heat pump scenario and each column being a different future grid sce- nario. Average annual GHG savings are positive in every state and in every heat pump and grid scenario, even in the conservative ‘‘high renewable energy cost’’ grid scenario. The states span a wide range of climates and grid GHG intensities…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s26 (factual, verified)

> Notice what that measures: an average for each state on grids the authors project into the future, not today's grid, and not a count of the homes that come out behind.

- **s26.a** [verified] Wilson et al. report average annual GHG savings per household by state under different future grid scenarios.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.6, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L248-L258`
    > different heat pump scenario and each column being a different future grid sce- nario. Average annual GHG savings are positive in every state and in every heat pump and grid scenario, even in the conservative ‘‘high renewable energy cost’’ grid scenario. The states span a wide range of climates and grid GHG intensities…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s16 (factual, verified)

> In a Lawrence Berkeley National Laboratory study of home retrofits, the group of projects built around electrification, with solar panels, sat mostly in states with low-carbon electricity, and there switching fuels sharply boosted their carbon savings.

- **s16.a** [verified] In LBNL's retrofit study, projects in the Electrification with PV cluster tended to be located in states with low carbon intensity of grid electricity, and fuel switching dramatically boosted carbon reductions in that cluster.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > Second, projects in the Electrification with PV cluster focused on electrification as a core upgrade strategy. These projects tended to be located in states that have low carbon intensity of grid electricity (see APPENDIX B – Energy Unit Conversion for more details), and where pre-upgrade energy use and energy cost wer…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.

### s17 (factual, verified)

> The authors expect similar projects to save less carbon in states whose electricity is more carbon-intensive.

- **s17.a** [verified] LBNL's authors expect similar electrification projects to have lower carbon savings in states with higher carbon intensity in their electricity.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > Second, projects in the Electrification with PV cluster focused on electrification as a core upgrade strategy. These projects tended to be located in states that have low carbon intensity of grid electricity (see APPENDIX B – Energy Unit Conversion for more details), and where pre-upgrade energy use and energy cost wer…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.

### s18 (factual, verified)

> So does swapping gas for a heat pump cut emissions on today's grid? In the British homes, yes, by about a third of their energy footprint, and in RMI's words it already cuts carbon on today's grid in all but the most coal-heavy systems, though that was the grid when RMI wrote it.

- **s18.a** [verified] In today's terms, British households that replaced a gas boiler with a heat pump cut the CO2eq footprint of their energy use by about a third (36%).
  - qualified (qualify): 1 supporting (1 independent, strongest 0.65), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Bernard 2024 (NBER), UK heat pumps and a time-of-use tariff right 0.65, direct `heat-pumps/sources/bernard-2024-nber-uk-heat-pumps-tou-tariff.txt#L193-L198`
    > today’s terms, that is equivalent to a 1.16 tonne reduction in CO2eq emissions per household per year – we calculate that this is a 36% reduction on their pre-heat-pump adoption CO2eq foot- print from annual energy consumption of 3.23 tonnes.9 By the end of an assumed 20-year heat pump lifespan (i.e., in 2043), emissio…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.
- **s18.b** [verified] RMI states that electrification already reduces carbon with today's electric grid in all but the most coal-heavy systems, compared with natural gas as well as oil and propane.
  - qualified (qualify): no direct support, 2 qualifying. modality: universal.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > Electrification already reduces carbon with today’s electric grid in all but the most coal-heavy systems. This is true in comparison to not only heating oil and propane, but also to natural gas. Figure 3 illustrates this result, showing emissions reductions in Oakland, Houston, and Providence. Because the electric grid…
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s19 (factual, verified)

> The exception is a grid like Chicago's.

- **s19.a** [verified] RMI found the short-term impact of electrification increases carbon emissions in Chicago, whose grid has coal as its marginal generator most of the year.
  - qualified (qualify): no direct support, 2 qualifying. modality: typical.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > Electrification already reduces carbon with today’s electric grid in all but the most coal-heavy systems. This is true in comparison to not only heating oil and propane, but also to natural gas. Figure 3 illustrates this result, showing emissions reductions in Oakland, Houston, and Providence. Because the electric grid…
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.

### s20 (factual, verified)

> How rare that exception is, the evidence can only estimate: the national American studies both build in a grid that gets cleaner, so neither is a reading of today's grid alone.

- **s20.a** [verified] Deetjen et al. base their estimate on the assumption that electric grid CO2 emissions decrease over the heat pump's life.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.5), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Deetjen 2021, private economics of US residential heat pumps right 0.5, direct `heat-pumps/sources/deetjen-2021-us-residential-heat-pumps.txt#L635-L642`
    > significantly. Climate benefits mostly increase with heat pump adoption: only in 1.7 million houses (2.1% of the US housing stock) does heat pump adoption increase CO2 emissions. Yet, abatement costs can be high: although 22.4 million houses (28% of the US housing stock) have abatement costs between 0 and 200 $/tCO2, t…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.
- **s20.b** [verified] Wilson et al. estimate savings under future grid scenarios.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.6), 2 qualifying.
  - warning needs-qualification: RMI 2018, the economics of electrifying buildings: On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all. Less 2021 (LBNL), cost of decarbonization retrofits: LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Wilson 2024 (NREL and LBNL), heat pumps for all? right 0.6, direct `heat-pumps/sources/wilson-2024-heat-pumps-for-all.txt#L248-L258`
    > different heat pump scenario and each column being a different future grid sce- nario. Average annual GHG savings are positive in every state and in every heat pump and grid scenario, even in the conservative ‘‘high renewable energy cost’’ grid scenario. The states span a wide range of climates and grid GHG intensities…
  - qualifies (uncited): RMI 2018, the economics of electrifying buildings partly 0.5, direct `heat-pumps/sources/rmi-2018-economics-of-electrifying-buildings.txt#L225-L231`
    > On 2016 short-term marginal grid data, heat pumps cut emissions versus gas in Oakland, Houston and Providence but raised them in coal-heavy Chicago (about 50% more), so the claim holds on most grids but not all.
  - qualifies (uncited): Less 2021 (LBNL), cost of decarbonization retrofits partly 0.35, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L1947-L1952`
    > LBNL: fuel switching boosted carbon cuts (68% vs 50%) in the electrification cluster, but those projects were mostly in states with low-carbon grids, and the authors expect lower carbon savings where electricity is more carbon-intensive.
