# Is a heat pump cheaper to run than gas, and does it ever pay for itself? [meta.headline fp=27ced44e97]

Story `decision:is-it-cheaper-to-run-than-gas` (heat-pumps), revision 6. SEO title: Heat pump vs gas furnace: running cost and payback [meta.seoTitle fp=ec4a7112ef]. Validation: **passed**, 0 blocking, 0 warnings, 60/60 assertions verified.

> Whether a heat pump heats a home for less than a gas furnace turns on local electricity and gas prices and on the unit you buy; whether it repays its price turns largely on timing, and for a gas home the clearest case is when the furnace and the air conditioner both need replacing. [meta.dek ok fp=585115616d]

Description: A heat pump's running cost against gas depends on local prices and the unit's efficiency; for a gas home, payback is best when furnace and AC are both due. [meta.description ok fp=305b2ea605]

## Same heat pump, different bills [heading:hook fp=70110b2c85]

Neighbours on the same street install the same model of heat pump, and by the end of the winter one household can end up paying less to stay warm while the other pays more. [s01 fp=4948cb6089] This article works through why, first on the cost of running a heat pump against a gas furnace and then on whether the purchase ever earns back its price. [s02 fp=1e980073d6]

## Is a heat pump actually cheaper to run than a gas furnace? [heading:question-1 fp=f2a0abfb10]

Sellers say yes: the British energy supplier Octopus Energy tells customers "it's now cheaper to run a heat pump in your home than it is a gas boiler". [s03 ok fp=a887442b99] The American Gas Association says the reverse, that "natural gas is more affordable in 41 out of 50 states when comparing ENERGY STAR natural gas furnaces to ENERGY STAR electric heat pumps." [s04 ok fp=702ea7cdb8] The YouTube channel Technology Connections frames the same dispute as a question of efficiency: "Locally we need a consistent COP of 4 just to break even with the cost of gas". [s05 ok fp=b100bb9bd0]

Each home has its own break-even number: the price of electricity divided by the price of gas, compared for the same energy content, multiplied by the furnace's efficiency, and a heat pump whose average efficiency over the heating season (its seasonal COP) is above that number heats the home more cheaply. [s06 ok fp=5744194bde] On 2024 national averages the price ratio was 3.45, which put the break-even seasonal COP at 3.28 for a high-efficiency furnace and lower for a less efficient one, as the table shows. [s07 ok fp=ba9ddd62b1]

Table t1: The break-even seasonal COP against a gas furnace at US average prices, 2024 [t1 fp=9345296029]

| | Value |
|---|---|
| Electricity-to-gas price ratio, same energy content (US average, 2024) | 3.45 |
| Break-even seasonal COP against a furnace of AFUE 0.95 (US average, 2024) | 3.28 |
| Break-even seasonal COP against a furnace of AFUE 0.80 (US average, 2024) | 2.76 |

State prices move the bar a long way: in 11 states a heat pump with a seasonal COP of 2.5 already beats a 95 percent furnace, while in 30 places, the District of Columbia among them, it needs a seasonal COP of 3.0 or more. [s08 ok fp=a3f385ef53]

Figure decision-is-it-cheaper-to-run-than-gas/sc09: States grouped by the seasonal COP a heat pump needs to beat a high-efficiency gas furnace at annual average prices. [decision-is-it-cheaper-to-run-than-gas/sc09 fp=da72e74f00]

**qualification (heat-pumps/heat-pump-beats-gas-running-cost):** The bar is the price ratio multiplied by the furnace's efficiency, not the price ratio by itself, and it is built on average prices: it leaves out time-of-use rates and backup resistance heat, and an average gas price includes the fixed monthly charge, which a household that keeps its gas connection goes on paying and one that disconnects saves. [s09 ok fp=90097d2fd1]

Clearing the bar depends on the unit: a national model by researchers at NREL and Lawrence Berkeley National Laboratory, run at winter 2021-2022 fuel prices, finds that among gas-heated homes that already have air conditioning, the share whose bills would fall runs from 38 percent with the lowest-performing heat pump to 99 percent with the highest. [s10 ok fp=dcc0fc35f0] For gas homes without air conditioning the share is lower, partly because the heat pump gives them cooling they did not pay to run before. [s11 ok fp=bcff17284e]

Table t2: Modelled share of US gas-heated homes whose energy bills would fall with a heat pump, by heat pump performance [t2 fp=11b588e5e8]

| | Lowest-performing heat pump | Highest-performing heat pump |
|---|---|---|
| Gas-heated homes with air conditioning (NREL and LBNL model, winter 2021-2022 prices) | 38% | 99% |
| Gas-heated homes without air conditioning (same model and prices) | 5% | 58% |

Across all American homes, whatever fuel they heat with, the same model has bills rising in 39 percent of homes with a minimum-efficiency unit and in 5 percent with a high-efficiency cold-climate unit. [s12 ok fp=0dd87dec77] A second national model, by Edwards and colleagues, puts 53 percent of households clearly ahead on bills, 19 percent behind and 28 percent with no clear change either way. [s13 ok fp=fcd4ca9845] Fuel prices move these shares as well: rerun at 2019 prices, when electricity cost 4.1 times as much as gas, the NREL model's share of all gas-heated homes that save drops from 32-92 percent to 22-83 percent, depending on the unit. [s14 ok fp=015492c5aa]

Measured use tells a similar story: a large British study of homes that replaced a gas boiler with a heat pump found total energy use fell by 40 percent, yet running costs came out slightly higher because a kilowatt-hour of electricity costs more than a kilowatt-hour of gas. [s15 ok fp=9a12ae5a1c] At Octopus Energy's standard prices in June 2024 the difference was £190 a year, of which a household that disconnects from mains gas wins back about £100, and these are British boilers at British prices, not a forecast for an American furnace. [s16 ok fp=61816933e1]

**qualification (heat-pumps/switching-gas-heat-pump-raises-household):** Switching from gas raises the bill only under some conditions: in the NREL model most gas homes with air conditioning pay more with a minimum-efficiency unit and nearly all pay less with the best units, and in RMI's city models energy costs rose in cold Chicago and Providence but not in Houston and Oakland, where the saving was simply too small to repay the extra equipment cost. [s17 ok fp=40d96050ed]

Table t3: UK homes that replaced a gas boiler with a heat pump: running costs and Cosy tariff savings, in pounds a year [t3 fp=0851385c36]

| | Pounds a year |
|---|---|
| Extra running cost on the standard tariff (UK, 2024) | £190 |
| Saved by disconnecting from mains gas (UK, 2024) | £100 |
| Saved on the Cosy time-of-use tariff against the standard tariff (UK study) | £318 |
| Of which, from shifting use between times of day (UK study) | £240 |

**unresolved (heat-pumps/time-use-heat-pump-electricity-tariffs):** Whether a time-of-use tariff makes a heat pump cheaper to run is not settled in this evidence: in the British study, households that moved to Cosy, Octopus's own time-of-use tariff, saved £318 a year against the supplier's standard tariff, most of it by shifting use into cheaper hours, but that is one supplier's tariff measured against its own flat rate. [s18 ok fp=ea0ca257dd] In RMI's Houston model a tariff alone did not help: a standard heat pump on a free-nights plan cost more than on a flat rate, though a customer on that plan who controlled the heat pump to preheat and precool while power was free saved around $1,000 in net present cost. [s19 ok fp=de063396d7] The NREL authors add that where time-of-use rates are offered, controlling a heat pump to use less power at peak times may improve its bill savings. [s20 ok fp=4ae18987b7]

So a gas home that already has air conditioning, and buys a well-performing heat pump where electricity is not expensive next to gas, will usually pay less to heat; with a minimum-efficiency unit, or where the price ratio is high, it often will not, because the higher that ratio the more efficient the heat pump has to be. [s21 ok fp=9cbb084f5f] A promise to halve the bill does not hold against gas in this evidence: the British homes cut their energy use sharply and still paid more to run, in RMI's gas retrofits energy costs either rose or fell too little to repay the equipment, and even the NREL model's average energy saving across all fuels is under half. [s22 ok fp=6c63efc9a9] Cuts of half or more show up in this evidence only against electric resistance heat: in Minnesota homes, energy costs fell 53 to 56 percent against resistance heaters but 26 to 40 percent against propane furnaces. [s23 ok fp=fb986af885] A smaller bill is not yet a good investment, though, and that is the second question. [s24 fp=13a0e4f77c]

## Does a heat pump really pay for itself, and does it matter when you buy? [heading:question-2 fp=ce321611e1]

The usual pitch is a payback of a few years; the channel I Like To Build Stuff reckons that at a saving of "$500 a year it take 4 years to pay back the unit." [s25 ok fp=4a8ee20066] Others land far from that: a Washington Post calculation for one home ends up "making the payback period around 48 years", though the same piece, counting "the difference between the cost of a new heat pump and a new furnace — bringing the payback time closer to eight years", shows how much the baseline matters. [s26 ok fp=7bbe6968c9]

The national models set the comparison at replacement time: Deetjen and colleagues count only what a heat pump costs beyond replacing the old heater with a similar one at the end of its life, and the NREL model compares against like-for-like replacement of equipment that has reached the end of its lifetime. [s27 ok fp=79485badb7]

**unresolved (gap 2):** Counting only the extra cost is an assumption these studies make, not a rule any of them tests, and no study in this evidence is strong enough to settle it; for a furnace that still works, the Minnesota study counts the whole installed price as the extra cost. [s28 ok fp=ab2c914749]

Even on that footing the NREL model finds that, before subsidies, a minimum-efficiency heat pump comes out ahead over its life in 55 percent of homes, and the dearer efficient models in fewer, because their higher purchase price outweighs their larger bill savings. [s29 ok fp=ded9752712] That 55 percent is drawn mostly from homes heated by oil, propane or electricity and, among gas homes, from those with central air in warmer climates. [s30 ok fp=0daea82fb0] Letting every home pick its best option raises the share to 59 percent. [s31 ok fp=10c32f5a7a]

Figure decision-is-it-cheaper-to-run-than-gas/sc25: Share of US homes ahead over the heat pump's life before subsidies, by heat pump efficiency, in the NREL and LBNL model. [decision-is-it-cheaper-to-run-than-gas/sc25 fp=34f7ec85d1]

Deetjen's study, a separate model with its own costs and assumptions, finds that only 21 percent of American single-family houses would gain economically from replacing their heater with a heat pump, and that switching from gas rarely pays even when the old heater is due, with almost no houses in cold climates where it makes sense. [s32 ok fp=c1985a904f] The same team adds that small cuts in capital cost could greatly raise that share. [s33 ok fp=8b07c74231] RMI concluded that most of the 56 million American households heated by gas would not find a heat pump cost-effective at the prices it used. [s34 ok fp=2763dba6a1] A Canadian Climate Institute model of Canadian cities answers a different question, setting a heat pump against gas heating plus air conditioning, and finds the heat pump the lowest-cost option for most households there, partly because it also does the cooling; in some regions that result depends on Canada's carbon price and rebates. [s47 ok fp=ed0d25dad5]

**unresolved (gap 0):** The same Canadian report also says bills tend to be lower in homes with heat pumps, but that remark rests on its lifetime-cost modelling and measures no change in anyone's bill after a switch from gas, so it cannot say whether switching raises a gas household's bills. [s35 ok fp=a6943b0df9]

In Britain the same study as before put the net private cost of swapping a gas boiler for a heat pump at £4,121 over 20 years: the household's share of the purchase after the grant, minus the boiler it no longer has to buy, plus higher running costs, assuming it disconnects from mains gas. [s36 ok fp=a5963bc79b] The authors also valued the Cosy tariff's savings, if they last the full period, at £4,675, which is more than that net cost. [s37 ok fp=0fec354c06]

Timing alone moves payback a long way: a Minnesota study priced a cold-climate heat pump with a propane furnace as backup at $9,450 installed, and with nothing broken that whole price was the extra cost, so the payback ran from 14.5 to 28.8 years depending on the furnace it was compared with. [s38 ok fp=22052efa3b] When the furnace and the air conditioner both needed replacing, the extra cost fell to $370 and the payback to about a year or less (0.6 to 1.1 years), and the table shows the cases in between. [s39 ok fp=2f2b584498]

Table t4: Extra cost and simple payback of a cold-climate heat pump with a propane furnace backup in Minnesota, by what needed replacing [t4 fp=589309bec2]

| | Extra cost | Payback against a condensing furnace, years | Payback against an 82% furnace, years |
|---|---|---|---|
| Nothing broken (Minnesota propane homes, 2017 study) | $9,450 | 28.8 | 14.5 |
| Air conditioner failed (same study) | $4,270 | 13.0 | 6.5 |
| Furnace failed (same study) | $5,550 | 16.9 | 8.5 |
| Furnace and air conditioner both failed (same study) | $370 | 1.1 | 0.6 |

Those homes ran on propane, not gas, so the years do not carry over to a gas home. [s40 ok fp=965534980a] For gas homes, RMI's report finds that in many retrofits a heat pump costs more than new gas equipment, and names as a notable exception the customer who must replace both a furnace and an air conditioner, since one heat pump does both jobs. [s41 ok fp=4b1e35e02f] And Lawrence Berkeley's cost study found the heat pump's price premium over gas equipment disappears once a home is adding cooling as well as heating. [s42 ok fp=d063f3a989]

**unresolved (gap 1):** None of these shares is your house's payback: the Edwards model's 19 percent of households that would pay more and 28 percent with no clear change describe a population, not whether a particular home's heat pump repays itself, and the NREL model found bill savings varied more from house to house within one area than from area to area. [s43 ok fp=9c791e41a1]

So for a gas home whose furnace still works, a heat pump rarely pays for itself on energy savings alone; bought when the furnace and the air conditioner both need replacing, or when the home is adding cooling anyway, the extra cost can shrink to little or nothing, while with only the air conditioner due it shrinks but does not vanish. [s44 ok fp=b41362ccd0]

## What to check before you switch [heading:close fp=3d1709107c]

Before signing, work out your own break-even number from your electricity and gas prices and your furnace's efficiency, and ask the installer for the seasonal COP of the unit being quoted, since it has to beat that number. [s45 fp=0e6d137be1] If your furnace still works, get the quote now and plan to buy when the air conditioner, or the air conditioner and the furnace together, come due. [s46 fp=dfaa5ba558]

## Open issues

- **info** s03 overclaim (review): Table t3: the caption and row labels date every row to Octopus Energy's June 2024 prices, but the Cosy savings passage (L1898-L1906) gives no price date; only the 190 and 100 pound rows are dated (15 June 2024). Placed on s03, the first sentence of the section holding the table; s03 itself is approved. Suggestion: Caption: 'UK homes that replaced a gas boiler with a heat pump, at Octopus Energy's prices'; drop '2024' from the two Cosy row labels.
- **info** s03 (s03.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s12 (s12.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s25 (s25.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s26 (s26.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s26 (s26.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s28 (s28.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s32 (s32.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s35 (s35.a) contextual-only (review): s35.a cites CCI L1591-L1597, which the package classes as context only (wrong 0.3, contextual) on the switching claim, as a fact that 'denies' that claim. The sentence does not use it to decide anything: it reports what the report says, which the passage establishes ('energy bills will tend to be lower in homes with heat pumps (see Section 3)'), and says the remark cannot decide the bill question, which is gap 0's condition. So the reader is not misled and the sentence is approved; but the assertion's metadata counts a contextual passage as evidence against the claim, which is why the validator attaches Bernard's 'bills do rise' limitation to it. Suggestion: When next revised (warnings and info do not count against the limit), make s35.a an attribution assertion (kind 'attribution', the report as speaker) rather than a fact that denies the claim. The validator should arguably refuse a contextual passage as decisive study evidence; that is a tooling gap, not the writer's.
- **info** s38 (s38.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s40 (s40.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s41 (s41.a) omission (review): Now framed as what RMI's report names, which L1268-L1272 entails, so approved. RMI's own Providence results (L803-L815, not a package passage) find gas cheaper even when the air conditioner is replaced too; the verdict note records this. It stays out of the article until a passage carries it. Suggestion: If the Providence lines are recorded through record-sources later, add 'though in cold, high-price Providence gas still won'.
- **info** s43 (s43.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s43 (s43.b) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s44 (s44.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
