# Review: Do 97% of Day Traders Really Lose Money?

| | |
|---|---|
| Story | `decision:trading-and-betting` (get-rich-quick) |
| Revision | 1 (1 of at most 3 in this pass) |
| Validation | **passed** (2026-10-21) |
| Words / runtime | 613 words, about 4.2 min at 150 wpm |
| Sentences | 27 (19 factual or attributed) |
| Assertions | 22, 22 verified |
| Issues | 0 blocking, 2 warnings, 17 dispositioned |
| Unreviewed sentences | 0 |
| Scenes | 24, 4:24 (ok) |
| Evidence package | c10ea75b99 (3 documents, 4 claims) |
| Model | claude-opus-5-5 |

Automated validation says whether the narration is eligible for human editorial review; it does not establish truth.

## Open issues

- **warning** s16 (s16.a) missing-qualification (review): The 7 and 23.9 basis points are abnormal returns: the intercept of a regression against a value-weighted Taiwan market index (barber-odean L452-L458), weighted by the money invested. "They lost 7 basis points a day" reads as a raw loss on their accounts; it is a shortfall relative to simply holding the market.
- **warning** s20 (s20.a) overgeneralization (review): In context Cameron explains why his own accuracy fell when he traded large caps against HFT algorithms; he is not explaining why the traders in the Brazil and Taiwan studies lost. "Names one reason the rest struggle" gives his remark a scope it does not have.

## Dispositions

Deterministic warnings the reviewer judged false positives or already carried by the narration, at the current sentence fingerprint.

- s08 (s08.a) needs-qualification: The ESMA warning is about CFDs, a different product; the sentence asserts only the cited study's own population and finding, named in s08/s27, and never mentions CFDs. (warning was: ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.)
- s08 (s08.b) needs-qualification: The sentence only describes the grouping by days traded; it draws no conclusion about setup quality or fatigue, which the limit concerns. (warning was: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.)
- s09 (s09.a) needs-qualification: The sentence reports the shares the passage gives and the monotonic fall; it makes no claim about setup quality, and s10 frames it as the authors' roulette comparison. (warning was: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.)
- s10 (s10.a) needs-qualification: Reports the authors' own comparison only; no claim about setup quality or why the share falls. (warning was: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.)
- s11 (s11.a) needs-qualification: The ESMA warning is about CFDs, a different product; the sentence asserts only the cited study's own population and finding, named in s08/s27, and never mentions CFDs. (warning was: ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.)
- s11 (s11.b) needs-qualification: The narrower finding is exactly what the sentence says (47 of the 1,551 persistent traders), with the population named in s08 and the sentence itself. (warning was: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.)
- s12 (s12.a) needs-qualification: Figures are the passage's own (17 of 1,551 above minimum wage, best US$310 a day on average); s13 carries the volatility next to them. (warning was: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.)
- s13 (s13.a) needs-qualification: Restates the passage's volatility finding for the eight above a bank teller's pay; the limit adds nothing the sentence contradicts. (warning was: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.)
- s15 (s15.a) needs-qualification: Attributed to the Brazil study only, which the passage states; s18-s19 give Taiwan's separate finding on past winners. (warning was: Brazil day-trader study (Chague et al.): Only 3.0% of persistent day traders were net profitable, 1.1% beat minimum wage and 0.5% a bank teller's wage, with no evidence of improvement with experience. Add the qualification: the evidence supports a narrower or weaker statement.)
- s27 (s27.a) needs-qualification: The ESMA warning is about CFDs, a different product; the sentence asserts only the cited study's own population and finding, named in s08/s27, and never mentions CFDs. (warning was: ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.)
- s16 (s16.a) needs-qualification: The limit about fatigue and setup quality is not engaged: the sentence makes no claim about either (the market-adjusted measure is a separate reviewer finding). (warning was: Taiwan day-trader study (Barber et al.): Fees turn a 7 bps gross daily loss into 23.9 bps net, showing transaction costs erode frequent traders' returns; fatigue and setup quality are not measured. Add the qualification: the evidence supports a narrower or weaker statement.)
- s18 (s18.a) needs-qualification: s19, the next sentence, says these predictably profitable traders were under 3% of day traders. (warning was: Taiwan day-trader study (Barber et al.): Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders. Add the qualification: the evidence supports a narrower or weaker statement.)
- s19 (s19.a) needs-qualification: "All day traders" is the passage's own denominator ("less than 3% of all day traders on an average day"), not a universal claim the sentence adds. (warning was: Taiwan day-trader study (Barber et al.): Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders. "all" is stronger than the evidence (strongest support 0). Add the qualification: the evidence supports a narrower or weaker statement.)
- s21 (s21.a) needs-qualification: "Futures" and "in a different market" carry the venue limit, and "when ... was higher" reports an association, as the passage does. (warning was: Brazil day-trader study (Chague et al.): Individuals' average daily loss is 19% higher when the HFT share of deals rises 10 points, and the authors conclude it is virtually impossible to compete with HFTs; the venue is index futures rather than large-cap stocks. Add the qualification: the evidence supports a narrower or weaker statement.)
- s22 (s22.a) needs-qualification: Points back in words to s09-s11, scoped to Brazil; s28 limits the answer to these markets and years; no claim about setup quality. (warning was: Brazil day-trader study (Chague et al.): The share of day traders with positive net profit falls monotonically with the number of days traded (29.8% at one day to 3.0% beyond 300), consistent with more trading eroding results, though setup quality is not studied. Add the qualification: the evidence supports a narrower or weaker statement.)
- s22 (s22.b) needs-qualification: The ESMA warning is about CFDs, a different product; the sentence asserts only the cited study's own population and finding, named in s08/s27, and never mentions CFDs. (warning was: ESMA CFD intervention 2018: EU regulators' studies found 74-89% of retail CFD accounts lose money, with average losses of 1,600 to 29,000 per investor; CFDs are short-term leveraged speculation rather than day trading as such. [partial: retail CFD accounts are leveraged short-term speculation, overlapping with but not the same as day trading] Add the qualification: the evidence supports a narrower or weaker statement.)
- s23 (s23.a) needs-qualification: "A sliver of everyone who tried" points back to s19's under-3% figure stated beside the finding. (warning was: Taiwan day-trader study (Barber et al.): Profitable traders with more than 40 days of experience in the prior year do earn more than their trading costs, but such predictably profitable traders are under 3% of day traders. Add the qualification: the evidence supports a narrower or weaker statement.)

## Resolved review findings

None.

## Research gaps

- No study strong enough to decide: "Trading fewer, higher-quality setups beats frequent trading because fees and fatigue erode returns"

## Outstanding editorial decisions

- s16 s16.a: The 7 and 23.9 basis points are abnormal returns: the intercept of a regression against a value-weighted Taiwan market index (barber-odean L452-L458), weighted by the money invested. "They lost 7 basis points a day" reads as a raw loss on their accounts; it is a shortfall relative to simply holding the market.
- s20 s20.a: In context Cameron explains why his own accuracy fell when he traded large caps against HFT algorithms; he is not explaining why the traders in the Brazil and Taiwan studies lost. "Names one reason the rest struggle" gives his remark a scope it does not have.

## History

- revision 1, 2026-10-21: passed, 0 blocking, 2 warnings
