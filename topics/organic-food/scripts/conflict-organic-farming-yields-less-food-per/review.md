# Review: Does Organic Farming Grow Less Food?

| | |
|---|---|
| Story | `conflict:organic-farming-yields-less-food-per` (organic-food) |
| Revision | 3 (3 of at most 3 in this pass) |
| Validation | **passed** (2026-10-27) |
| Words / runtime | 603 words, about 4.2 min at 150 wpm |
| Sentences | 26 (20 factual or attributed) |
| Assertions | 25, 25 verified |
| Issues | 0 blocking, 3 warnings, 13 dispositioned |
| Unreviewed sentences | 0 |
| Scenes | 20, 4:21 (ok) |
| Evidence package | 0766e57110 (5 documents, 5 claims) |
| Model | claude-opus-5-5 |

Automated validation says whether the narration is eligible for human editorial review; it does not establish truth.

## Open issues

- **warning** - release-stale (deterministic): release.json locked package 6688cc1dd7; it is now 0766e57110: the approved package has changed, lock it again after review
- **warning** - release-stale (deterministic): release.json locked validation d87358ca90; it is now ed035c07d6: the approved package has changed, lock it again after review
- **warning** s13 (s13.c) needs-human (review): The clause mirrors the authors' summary at L99, but the paper's results (L87, uncited) show the 9% and 8% gaps compare diversified organic fields with undiversified conventional ones; when both systems were polycultures the gap was 21 +/- 6%, and with similar rotations 20 +/- 2%. A viewer may hear that diversified farming in general nearly closes the gap. The writer cannot cite L87 without a person authorising a corpus change (one verdict per claim and document).
- **warning** s17 (s17.a) missing-qualification (review): Clark and Tilman say most of the 742 LCA analyses are from high-input systems in Europe and North America, so the results reflect industrialised, high-input farming; the package premise lists this limit. The narration gives the land, energy and eutrophication figures (s18-s19) without it; s21's local-scale caveat is a different limit.
- **warning** s17 (s17.a) needs-human (review): The revision-1 scope warning stands (Europe/North America, high-input systems, L468-L476), but the writer cannot cite it: the store already holds the one Clark and Tilman verdict for this claim. Approved because s21 carries a scope limit and the figures are not misleading for the viewer's likely context; only an editor can add the passage.

## Dispositions

Deterministic warnings the reviewer judged false positives or already carried by the narration, at the current sentence fingerprint.

- s01 figure-in-non-factual: The only number is 'two fields' in a thought experiment; no outcome or representative figure is stated. (warning was: a rhetorical sentence carries a figure; the reviewer must confirm it is not a representative outcome)
- s07 (s07.a) needs-qualification: The sentence names Ponisio as its source and carries the authors' overestimate warning; s11 and s12 present the AAP dissent in the same section. (warning was: Contradicted by AAP 2012 clinical report on organic foods, abstract: AAP clinical report (abstract only) says well-designed farming studies show yields comparable to conventional farming. Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s08 (s08.a) needs-qualification: 'Every crop type the study grouped' is the passage's own 'all crop types', scoped to the study; the AAP dissent is presented in s11-s12. (warning was: Contradicted by AAP 2012 clinical report on organic foods, abstract: AAP clinical report (abstract only) says well-designed farming studies show yields comparable to conventional farming. "all" is stronger than the evidence (strongest support 0.75). Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s09 (s09.a) needs-qualification: Attributed to the same meta-analysis named in s07; the AAP dissent is presented in s11-s12. (warning was: Contradicted by AAP 2012 clinical report on organic foods, abstract: AAP clinical report (abstract only) says well-designed farming studies show yields comparable to conventional farming. Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s10 (s10.a) needs-qualification: The sentence names the review and says it cites earlier work; the AAP dissent is about the size of the gap, not the nitrogen mechanism, and is presented in s11-s12. (warning was: Contradicted by AAP 2012 clinical report on organic foods, abstract: AAP clinical report (abstract only) says well-designed farming studies show yields comparable to conventional farming. Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s11 (s11.a) needs-qualification: The sentence is attributed to the AAP report and opens 'Not everyone agrees', directly after the Ponisio and Mie findings it disagrees with. (warning was: Contradicted by Ponisio 2015 meta-analysis, organic yield gap: Hierarchical meta-analysis of 115 studies (1071 comparisons, 38 countries) found organic yields 19.2% lower (95% CI 15.5-22.9%), with conventional higher for all crop types; the authors note publication bias may overstate the gap. Contradicted by Mie 2017 review, health effects of organic food and farming: The review notes generally lower crop yields in organic systems, typically limited by nitrogen availability; cited in passing, not analysed. Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s12 (s12.a) needs-qualification: The sentence describes what the AAP abstract contains, which the passage shows; both sides are already named in s07-s11. (warning was: Contradicted by Ponisio 2015 meta-analysis, organic yield gap: Hierarchical meta-analysis of 115 studies (1071 comparisons, 38 countries) found organic yields 19.2% lower (95% CI 15.5-22.9%), with conventional higher for all crop types; the authors note publication bias may overstate the gap. Contradicted by Mie 2017 review, health effects of organic food and farming: The review notes generally lower crop yields in organic systems, typically limited by nitrogen availability; cited in passing, not analysed. Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s13 (s13.a) needs-qualification: s11 and s12 present the AAP dissent and its thin basis immediately before this answer, which is scoped to the pooled data and names the overestimate warning. (warning was: Contradicted by AAP 2012 clinical report on organic foods, abstract: AAP clinical report (abstract only) says well-designed farming studies show yields comparable to conventional farming. Present the disagreement: name the studies on each side instead of stating one side as fact.)
- s16 (s16.a) needs-qualification: Quoted and attributed; s17-s22 immediately give the per-unit-of-food comparison and the authors' caveats that qualify it. (warning was: Clark and Tilman 2017, environmental impacts of farming systems: Per unit of food, organic used 15% less energy but needed 25-110% more land and had 37% higher eutrophication, with similar GHG and acidification; the authors say this does not make conventional more sustainable given its pesticide and nutrient inputs, which they could not measure. Add the qualification: the evidence supports a narrower or weaker statement.)
- s19 (s19.a) needs-qualification: s22 carries the authors' warning that higher land use and eutrophication do not make conventional more sustainable, three sentences later in the same run. (warning was: Clark and Tilman 2017, environmental impacts of farming systems: Per unit of food, organic used 15% less energy but needed 25-110% more land and had 37% higher eutrophication, with similar GHG and acidification; the authors say this does not make conventional more sustainable given its pesticide and nutrient inputs, which they could not measure. Add the qualification: the evidence supports a narrower or weaker statement.)
- s22 (s22.a) needs-qualification: This sentence is itself the qualifying passage (L286-L299), attributed to the authors with its modality ('can harm'). (warning was: Clark and Tilman 2017, environmental impacts of farming systems: Per unit of food, organic used 15% less energy but needed 25-110% more land and had 37% higher eutrophication, with similar GHG and acidification; the authors say this does not make conventional more sustainable given its pesticide and nutrient inputs, which they could not measure. Add the qualification: the evidence supports a narrower or weaker statement.)
- s23 (s23.a) needs-qualification: 'Every indicator they examined' is the passage's literal 'for all indicators examined', scoped to the study. (warning was: "all" is stronger than the evidence (strongest support 0.65).)
- s24 (s24.a) needs-qualification: 'Not clearly greener' matches the authors' refusal to rank the systems, and s21-s22 carry their scale and sustainability caveats just before it. (warning was: Clark and Tilman 2017, environmental impacts of farming systems: Per unit of food, organic used 15% less energy but needed 25-110% more land and had 37% higher eutrophication, with similar GHG and acidification; the authors say this does not make conventional more sustainable given its pesticide and nutrient inputs, which they could not measure. Add the qualification: the evidence supports a narrower or weaker statement.)

## Resolved review findings

- s13 (s13.a) omission (raised against revision 1, addressed in revision 2): The answer gives a flat 'roughly a fifth', but the same Ponisio passage the script cites (L99) reports the gap fell to 9 +/- 4% with multi-cropping and 8 +/- 5% with crop rotations. The package arc asks for the conditions under which the claim holds, and this is the condition that changes the size of the answer.
- s26 unsupported (raised against revision 1, addressed in revision 2): 'The question that changed the answer here: better per field, or per plate' tells the viewer that organic looks greener per field and that this is why the AAP and Harvard Health say it is greener. No cited passage gives a per-field (per-area) comparison, and neither source says its verdict is per field (Harvard gives practices, AAP gives no basis). The close smuggles a fact the script never established.

## Research gaps

- What explains the split between Crowder and Reganold 2015 meta-analysis, organic farm profitability, Ponisio 2015 meta-analysis, organic yield gap, Mie 2017 review, health effects of organic food and farming, AAP 2012 clinical report on organic foods, abstract?

## Outstanding editorial decisions

- -: release.json locked package 6688cc1dd7; it is now 0766e57110: the approved package has changed, lock it again after review
- -: release.json locked validation d87358ca90; it is now ed035c07d6: the approved package has changed, lock it again after review
- s13 s13.c: The clause mirrors the authors' summary at L99, but the paper's results (L87, uncited) show the 9% and 8% gaps compare diversified organic fields with undiversified conventional ones; when both systems were polycultures the gap was 21 +/- 6%, and with similar rotations 20 +/- 2%. A viewer may hear that diversified farming in general nearly closes the gap. The writer cannot cite L87 without a person authorising a corpus change (one verdict per claim and document).
- s17 s17.a: Clark and Tilman say most of the 742 LCA analyses are from high-input systems in Europe and North America, so the results reflect industrialised, high-input farming; the package premise lists this limit. The narration gives the land, energy and eutrophication figures (s18-s19) without it; s21's local-scale caveat is a different limit.
- s17 s17.a: The revision-1 scope warning stands (Europe/North America, high-input systems, L468-L476), but the writer cannot cite it: the store already holds the one Clark and Tilman verdict for this claim. Approved because s21 carries a scope limit and the figures are not misleading for the viewer's likely context; only an editor can add the passage.

## History

- revision 1, 2026-10-21: blocked, 1 blocking, 3 warnings
- revision 2, 2026-10-27: needs-review, 0 blocking, 17 warnings
- revision 3, 2026-10-27: passed, 0 blocking, 3 warnings
