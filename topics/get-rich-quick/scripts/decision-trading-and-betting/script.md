# Do 97% of Day Traders Really Lose Money?

Story `decision:trading-and-betting` (get-rich-quick), revision 2. About 4.3 minutes (616 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 22/22 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

On YouTube, Riley Coleman films himself growing a tiny futures account, and says the point is "showing you what's possible if you follow a disciplined, consistent strategy". [s01 ok] If discipline is what it takes, how many of the people who try actually end up ahead? Researchers in Brazil and Taiwan counted, and they counted the winners too.

## Setup

Ross Cameron of Warrior Trading tells beginners to "learn a strategy that is proven profitable by someone else even if there's no guarantee it'll work for you". [s04 ok] Another channel, RP Profits, is blunter: "The strategy is real. The math is real, and there's people using it right now to make money." [s05 ok] Yet the Warrior Trading blog itself carries the line "Trading is risky, and most day traders lose money." [s06 ok]

## Investigation

The Brazilian study followed people who began day trading in the country's equity futures market between 2013 and 2015, and sorted them by how many days they kept at it. [s08 ok] Of those who tried it for a single day, 29.8 percent made a net profit, and the share fell at every step after that. [s09 ok] The authors compare it to roulette, where the more rounds people play, the fewer come out ahead. [s10 ok] Of the 1,551 who kept going for more than 300 days, 97 percent lost money after fees, and only 47 came out ahead. [s11 ok] Only 17 earned more than Brazil's minimum wage, and the single best averaged 310 dollars a day. [s12 ok] And the handful who beat a bank teller's starting pay got there on a roller coaster, their daily results swinging by hundreds to thousands of dollars. [s13 ok] Did the ones who stayed at least get better with practice? The study found no evidence that they learned. [s15 ok] A second study, of individual investors who day traded in Taiwan from 1992 to 2006, found the vast majority of them unprofitable. [s27 ok] Taken as a group, they trailed the market by 7 basis points a day before costs, where a basis point is a hundredth of a percent, and trading costs more than tripled that shortfall, to 23.9. [s16 ok] So is anyone reliably good at this? A few are: in Taiwan, traders who had already been profitable, with more than 40 days of day trading in the past year, went on to earn more than their trading costs. [s18 ok] But those predictably profitable traders made up less than 3 percent of all day traders on an average day. [s19 ok] Ross Cameron describes one obstacle he hit himself: "when you trade against the high frequency trading algorithms, trading large caps, you really don't have a good edge". [s20 ok] The Brazilian futures data point the same way in a different market: when high-frequency traders' share of deals rose by 10 percent, individuals' average loss was 19 percent higher. [s21 ok]

## Answer

So yes: in both studies most people lost, and in Brazil the longer they kept at it, the worse their odds of being ahead. [s22 ok] Some people do beat the odds, and in Taiwan the ones who had been winning tended to keep winning, but they were a sliver of everyone who tried. [s23 ok] Both studies looked at other markets and other years than today's American stock market, so they give the odds there, not a law for every market. What these counts can't do is check any one trader's month: a screenshot of a small account turned into a big one is neither confirmed nor ruled out by a tally of everyone who tried.

## Takeaway

If someone sells you a strategy as consistent, ask for audited results across every account and every month, not the best screenshot. And if you try it anyway, put in only what you can afford to lose, and judge yourself by your results after fees, not by your best day.

## Open issues

- **warning** - release-stale (deterministic): release.json locked script a1196b72ff; it is now cf8aa41999: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked package c10ea75b99; it is now ef97fa3eb7: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation 37935de2ea; it is now 791be98faf: the approved package has changed, lock it again after review
- **info** s01 (s01.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s05 (s05.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s06 (s06.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s20 (s20.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s22 needs-human (review): "So yes:" answers the title question (do most lose), but the viewer last heard s02, which asks "how many ... actually end up ahead?"; a yes does not answer a how-many question. Suggestion: Drop "So yes:" or start "Very few:".

## Evidence by sentence

### s01 (attributed, verified)

> On YouTube, Riley Coleman films himself growing a tiny futures account, and says the point is "showing you what's possible if you follow a disciplined, consistent strategy".

- **s01.a** [verified] Riley Coleman's video on growing a small futures account says it is about "showing you what's possible if you follow a disciplined, consistent strategy".
  - supported (approved): no direct support, 2 qualifying, 1 source statement. modality: possibility.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience.
  - statement: I Turned $50 Into $3,754 In 21 Days Trading Futures  `C7UHiQ8_6Q0`
    > showing you what's possible if you follow a disciplined, consistent strategy
  - quotation: "showing you what's possible if you follow a disciplined, consistent strategy" from `C7UHiQ8_6Q0`

### s04 (attributed, verified)

> Ross Cameron of Warrior Trading tells beginners to "learn a strategy that is proven profitable by someone else even if there's no guarantee it'll work for you".

- **s04.a** [verified] Ross Cameron tells beginners to "learn a strategy that is proven profitable by someone else even if there's no guarantee it'll work for you".
  - supported (approved): no direct support, 2 qualifying, 1 source statement. modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience.
  - statement: THIS ⚠️ is why day traders LOSE money  `X8tpTL4povQ`
    > learn a strategy that is proven profitable by someone else even if there's no guarantee it'll work for you
  - quotation: "learn a strategy that is proven profitable by someone else even if there's no guarantee it'll work for you" from `X8tpTL4povQ`

### s05 (attributed, verified)

> Another channel, RP Profits, is blunter: "The strategy is real. The math is real, and there's people using it right now to make money."

- **s05.a** [verified] RP Profits says "The strategy is real. The math is real, and there's people using it right now to make money."
  - supported (approved): no direct support, 2 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience.
  - statement: If I Wanted to Make $1,000/Day Trading, I'd Do This (Just Copy Me)  `tfYs6i5H00w`
    > The strategy is real. The math is real, and there's people using it right now to make money.
  - quotation: "The strategy is real. The math is real, and there's people using it right now to make money." from `tfYs6i5H00w`

### s06 (attributed, verified)

> Yet the Warrior Trading blog itself carries the line "Trading is risky, and most day traders lose money."

- **s06.a** [verified] The Warrior Trading blog says "Trading is risky, and most day traders lose money."
  - supported (approved): no direct support, 2 qualifying, 1 source statement. modality: typical.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): FCA CFD consultation 2016 partly 0.4, partial `get-rich-quick/sources/fca-cp16-40-cfd.txt#L589-L591`
    > In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such.
  - qualifies (uncited): ESMA CFD intervention 2018 partly 0.5, partial `get-rich-quick/sources/esma-2018-cfd-measures.txt#L59-L62`
    > EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such.
  - statement: The Real Earnings of a Day Trader  `warriortrading-the-real-earnings-of-a-day-trader`
    > Trading is risky, and most day traders lose money.
  - quotation: "Trading is risky, and most day traders lose money." from `warriortrading-the-real-earnings-of-a-day-trader`

### s08 (factual, verified)

> The Brazilian study followed people who began day trading in the country's equity futures market between 2013 and 2015, and sorted them by how many days they kept at it.

- **s08.a** [verified] The Brazil study observes individuals who began to day trade between 2013 and 2015 in the Brazilian equity futures market.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying.
  - warning needs-qualification: FCA CFD consultation 2016: In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such. [partial: the verdict note limits its own scope ("rather than")] ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Brazil day-trader study (Chague et al.) right 0.7, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L30-L36`
    > We show that it is virtually impossible for individuals to compete with HFTs and day trade for a living, contrary to what course providers claim. We observe all individuals who began to day trade between 2013 and 2015 in the Brazilian equity futures market, the third in terms of volume in the world, and who persisted f…
  - qualifies (uncited): FCA CFD consultation 2016 partly 0.4, partial `get-rich-quick/sources/fca-cp16-40-cfd.txt#L589-L591`
    > In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such.
  - qualifies (uncited): ESMA CFD intervention 2018 partly 0.5, partial `get-rich-quick/sources/esma-2018-cfd-measures.txt#L59-L62`
    > EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such.
- **s08.b** [verified] The Brazil day-trader study computed the net profit of each new day trader, grouped by the number of days they day traded.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.4, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L162-L178`
    > We compute the total net prot6 obtained by each one of the 19,646 new day traders. Considering those who day traded for only one day (1,111 individuals), 29.8% obtained positive net prot. Considering those who day traded for 2 to 50 days (9,978), 51 to 100 days (3,100), 101 to 200 days (2,738), 201 to 300 days (1,168),…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.4, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L476-L479`
    > Fees turn a 7 bps gross daily loss into 23.9 bps net, showing transaction costs erode frequent traders' returns; fatigue and setup quality are not measured.

### s09 (factual, verified)

> Of those who tried it for a single day, 29.8 percent made a net profit, and the share fell at every step after that.

- **s09.a** [verified] In the Brazil study, 29.8% of those who day traded for one day obtained a positive net profit, and the proportion of successful day traders decreases monotonically with the number of days traded.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.4, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L162-L178`
    > We compute the total net prot6 obtained by each one of the 19,646 new day traders. Considering those who day traded for only one day (1,111 individuals), 29.8% obtained positive net prot. Considering those who day traded for 2 to 50 days (9,978), 51 to 100 days (3,100), 101 to 200 days (2,738), 201 to 300 days (1,168),…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.4, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L476-L479`
    > Fees turn a 7 bps gross daily loss into 23.9 bps net, showing transaction costs erode frequent traders' returns; fatigue and setup quality are not measured.

### s10 (factual, verified)

> The authors compare it to roulette, where the more rounds people play, the fewer come out ahead.

- **s10.a** [verified] The Brazil study's authors liken the falling proportion of successful day traders to casino roulette, where the proportion of successful players decreases with the number of rounds played.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.4, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L162-L178`
    > We compute the total net prot6 obtained by each one of the 19,646 new day traders. Considering those who day traded for only one day (1,111 individuals), 29.8% obtained positive net prot. Considering those who day traded for 2 to 50 days (9,978), 51 to 100 days (3,100), 101 to 200 days (2,738), 201 to 300 days (1,168),…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.4, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L476-L479`
    > Fees turn a 7 bps gross daily loss into 23.9 bps net, showing transaction costs erode frequent traders' returns; fatigue and setup quality are not measured.

### s11 (factual, verified)

> Of the 1,551 who kept going for more than 300 days, 97 percent lost money after fees, and only 47 came out ahead.

- **s11.a** [verified] In the Brazil study, 97% of the 1,551 individuals who day traded for more than 300 days lost money net of exchange and brokerage fees.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying.
  - warning needs-qualification: FCA CFD consultation 2016: In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such. [partial: the verdict note limits its own scope ("rather than")] ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Brazil day-trader study (Chague et al.) right 0.7, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L394-L404`
    > We next evaluate the performance of the 1,551 individuals who day traded for at least 300 days in Table 2. Considering the performance net of exchange and brokerage fees (Panel C), we nd that 97% of all investors who persisted for more than 300 days lost money. The average daily net prot is US$ -48.81, the median is US…
  - qualifies (uncited): FCA CFD consultation 2016 partly 0.4, partial `get-rich-quick/sources/fca-cp16-40-cfd.txt#L589-L591`
    > In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such.
  - qualifies (uncited): ESMA CFD intervention 2018 partly 0.5, partial `get-rich-quick/sources/esma-2018-cfd-measures.txt#L59-L62`
    > EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such.
- **s11.b** [verified] Only 47 of the 1,551 persistent day traders in the Brazil study profited net of fees.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > The facts that (i) only 47 out of the 1,551 persistent day traders (3.0%) proted net of fees and that (ii) there is no evidence of learning, may not be sucient to discard day trading as a possible career. If the few who proted were able to earn a lot, individuals could still be tempted to take their chances at day trad…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.

### s12 (factual, verified)

> Only 17 earned more than Brazil's minimum wage, and the single best averaged 310 dollars a day.

- **s12.a** [verified] Only 17 of the 1,551 earned more than the Brazilian minimum wage, and the individual who earned the most earned US$310 per day on average.
  - qualified (qualify): no direct support, 2 qualifying. modality: typical.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > The facts that (i) only 47 out of the 1,551 persistent day traders (3.0%) proted net of fees and that (ii) there is no evidence of learning, may not be sucient to discard day trading as a possible career. If the few who proted were able to earn a lot, individuals could still be tempted to take their chances at day trad…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.

### s13 (factual, verified)

> And the handful who beat a bank teller's starting pay got there on a roller coaster, their daily results swinging by hundreds to thousands of dollars.

- **s13.a** [verified] The individuals in the Brazil study who earned more than a bank teller's initial salary did so with great volatility; the standard deviation of their daily profit ranged from US$632 to US$3,308.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > The facts that (i) only 47 out of the 1,551 persistent day traders (3.0%) proted net of fees and that (ii) there is no evidence of learning, may not be sucient to discard day trading as a possible career. If the few who proted were able to earn a lot, individuals could still be tempted to take their chances at day trad…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.

### s15 (factual, verified)

> The study found no evidence that they learned.

- **s15.a** [verified] The Brazil study finds no evidence of learning among persistent day traders.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > The facts that (i) only 47 out of the 1,551 persistent day traders (3.0%) proted net of fees and that (ii) there is no evidence of learning, may not be sucient to discard day trading as a possible career. If the few who proted were able to earn a lot, individuals could still be tempted to take their chances at day trad…
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders.

### s27 (factual, verified)

> A second study, of individual investors who day traded in Taiwan from 1992 to 2006, found the vast majority of them unprofitable.

- **s27.a** [verified] In the Taiwan study of individual investors who day traded from 1992 to 2006, the vast majority of day traders are unprofitable.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying. modality: typical.
  - warning needs-qualification: FCA CFD consultation 2016: In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such. [partial: the verdict note limits its own scope ("rather than")] ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Taiwan day-trader study (Barber et al.) right 0.7, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L39-L46`
    > We analyze the performance of and learning by individual investors who engage in day trading in Taiwan from 1992 to 2006 and test the proposition that individual investors rationally speculate as day traders in order to learn whether they possess the superior trading ability. Consistent with models of both rational and…
  - qualifies (uncited): FCA CFD consultation 2016 partly 0.4, partial `get-rich-quick/sources/fca-cp16-40-cfd.txt#L589-L591`
    > In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such.
  - qualifies (uncited): ESMA CFD intervention 2018 partly 0.5, partial `get-rich-quick/sources/esma-2018-cfd-measures.txt#L59-L62`
    > EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such.

### s16 (factual, verified)

> Taken as a group, they trailed the market by 7 basis points a day before costs, where a basis point is a hundredth of a percent, and trading costs more than tripled that shortfall, to 23.9.

- **s16.a** [verified] In the Taiwan study, day traders trail the market by 7 basis points a day on average before costs, and trading costs more than triple the shortfall to 23.9 basis points per day.
  - qualified (qualify): no direct support, 2 qualifying. modality: typical.
  - warning needs-qualification: Taiwan day-trader study (Barber et al.): Fees turn a 7 bps gross daily loss into 23.9 bps net, showing transaction costs erode frequent traders' returns; fatigue and setup quality are not measured. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Taiwan day-trader study (Barber et al.) partly 0.4, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L476-L479`
    > In the second column of Table 1, we present the gross abnormal intraday returns of day traders. On average, day traders lose 7 basis points on their day trading before costs (t=-10.2). In the fourth column we see that trading costs more than triple the losses to 23.9 basis points per day. Moreover, we observe reliably …
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.4, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L162-L178`
    > The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied.

### s18 (factual, verified)

> A few are: in Taiwan, traders who had already been profitable, with more than 40 days of day trading in the past year, went on to earn more than their trading costs.

- **s18.a** [verified] In the Taiwan study, profitable traders with more than 40 days of day trading experience in the last year earn more than enough to cover their transaction costs.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Taiwan day-trader study (Barber et al.): Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > The results for a 10 trading day event horizon are displayed in Figure 7. The most striking results in the graph are: 1) irrespective of experience, traders with past profits outperform those with past losses and 2) for traders with positive past profits, cumulative abnormal returns increase with experience, and 3) pro…
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience.

### s19 (factual, verified)

> But those predictably profitable traders made up less than 3 percent of all day traders on an average day.

- **s19.a** [verified] In the Taiwan study, predictably profitable traders constitute less than 3% of all day traders on an average day.
  - qualified (qualify): no direct support, 2 qualifying. modality: universal.
  - warning needs-qualification: Taiwan day-trader study (Barber et al.): Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders. "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > The results for a 10 trading day event horizon are displayed in Figure 7. The most striking results in the graph are: 1) irrespective of experience, traders with past profits outperform those with past losses and 2) for traders with positive past profits, cumulative abnormal returns increase with experience, and 3) pro…
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience.

### s20 (attributed, verified)

> Ross Cameron describes one obstacle he hit himself: "when you trade against the high frequency trading algorithms, trading large caps, you really don't have a good edge".

- **s20.a** [verified] Ross Cameron says "when you trade against the high frequency trading algorithms, trading large caps, you really don't have a good edge".
  - supported (approved): no direct support, 1 qualifying, 1 source statement.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - qualifies (uncited): Brazil day-trader study (Chague et al.) right 0.5, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L384-L393`
    > Individuals' average daily loss is 19% higher when the HFT share of deals rises 10 points, and the authors conclude it is virtually impossible to compete with HFTs; the venue is index futures rather than large-cap stocks.
  - statement: Growing a $2k Account to $65,662.04 in 30 Days (My Day Trading Strategy)  `xGIa8Vg0PWM`
    > when you trade against the high frequency trading algorithms, trading large caps, you really don't have a good edge
  - quotation: "when you trade against the high frequency trading algorithms, trading large caps, you really don't have a good edge" from `xGIa8Vg0PWM`

### s21 (factual, verified)

> The Brazilian futures data point the same way in a different market: when high-frequency traders' share of deals rose by 10 percent, individuals' average loss was 19 percent higher.

- **s21.a** [verified] In the Brazil study, individuals' average loss is 19% higher when the fraction of deals by high-frequency traders increases by 10%.
  - qualified (qualify): no direct support, 1 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): Individuals' average daily loss is 19% higher when the HFT share of deals rises 10 points, and the authors conclude it is virtually impossible to compete with HFTs; the venue is index futures rather than large-cap stocks. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Brazil day-trader study (Chague et al.) right 0.5, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L384-L393`
    > H F T , which is the daily fraction of HFTs in the number of deals. As expected, we nd a H F Tstrong negative coecient of , indicating that the increasing presence of these investors is related to greater losses by individualsaccording to column 8, the average loss is 19% higher when the fraction of HFTs increases by 1…

### s22 (factual, verified)

> So yes: in both studies most people lost, and in Brazil the longer they kept at it, the worse their odds of being ahead.

- info needs-human (review): "So yes:" answers the title question (do most lose), but the viewer last heard s02, which asks "how many ... actually end up ahead?"; a yes does not answer a how-many question.
- **s22.a** [verified] In the Brazil study 97% of those who day traded more than 300 days lost money net of fees, and the share with a positive net profit fell with the number of days traded.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 4 qualifying.
  - warning needs-qualification: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Brazil day-trader study (Chague et al.) right 0.7, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L394-L404`
    > We next evaluate the performance of the 1,551 individuals who day traded for at least 300 days in Table 2. Considering the performance net of exchange and brokerage fees (Panel C), we nd that 97% of all investors who persisted for more than 300 days lost money. The average daily net prot is US$ -48.81, the median is US…
  - qualifies: Brazil day-trader study (Chague et al.) partly 0.4, partial `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L162-L178`
    > We compute the total net prot6 obtained by each one of the 19,646 new day traders. Considering those who day traded for only one day (1,111 individuals), 29.8% obtained positive net prot. Considering those who day traded for 2 to 50 days (9,978), 51 to 100 days (3,100), 101 to 200 days (2,738), 201 to 300 days (1,168),…
  - qualifies (uncited): FCA CFD consultation 2016 partly 0.4, partial `get-rich-quick/sources/fca-cp16-40-cfd.txt#L589-L591`
    > In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such.
  - qualifies (uncited): ESMA CFD intervention 2018 partly 0.5, partial `get-rich-quick/sources/esma-2018-cfd-measures.txt#L59-L62`
    > EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such.
  - qualifies (uncited): Taiwan day-trader study (Barber et al.) partly 0.4, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L476-L479`
    > Fees turn a 7 bps gross daily loss into 23.9 bps net, showing transaction costs erode frequent traders' returns; fatigue and setup quality are not measured.
- **s22.b** [verified] In the Taiwan study the vast majority of day traders are unprofitable.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.7), 2 qualifying. modality: typical.
  - warning needs-qualification: FCA CFD consultation 2016: In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such. [partial: the verdict note limits its own scope ("rather than")] ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.
  - supports: Taiwan day-trader study (Barber et al.) right 0.7, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L39-L46`
    > We analyze the performance of and learning by individual investors who engage in day trading in Taiwan from 1992 to 2006 and test the proposition that individual investors rationally speculate as day traders in order to learn whether they possess the superior trading ability. Consistent with models of both rational and…
  - qualifies (uncited): FCA CFD consultation 2016 partly 0.4, partial `get-rich-quick/sources/fca-cp16-40-cfd.txt#L589-L591`
    > In an FCA sample of client accounts at eight major UK CFD providers, more than 80% lost money over a year; this is leveraged retail CFD trading rather than day trading as such.
  - qualifies (uncited): ESMA CFD intervention 2018 partly 0.5, partial `get-rich-quick/sources/esma-2018-cfd-measures.txt#L59-L62`
    > EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such.

### s23 (factual, verified)

> Some people do beat the odds, and in Taiwan the ones who had been winning tended to keep winning, but they were a sliver of everyone who tried.

- **s23.a** [verified] In the Taiwan study an extensive history of profitability is a strong predictor of future profitability, but very few traders are predictably profitable.
  - qualified (qualify): no direct support, 2 qualifying.
  - warning needs-qualification: Taiwan day-trader study (Barber et al.): Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders. Add the qualification: the evidence supports a narrower or weaker statement.
  - qualifies: Taiwan day-trader study (Barber et al.) partly 0.5, direct `get-rich-quick/sources/barber-odean-day-traders-learn.txt#L598-L621`
    > The results for a 10 trading day event horizon are displayed in Figure 7. The most striking results in the graph are: 1) irrespective of experience, traders with past profits outperform those with past losses and 2) for traders with positive past profits, cumulative abnormal returns increase with experience, and 3) pro…
  - qualifies (uncited): Brazil day-trader study (Chague et al.) partly 0.5, direct `get-rich-quick/sources/chague-day-trading-for-a-living.txt#L219-L229`
    > Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience.
