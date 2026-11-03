# In a 21-site field test, 38 percent of heat pump installs needed a new electrical panel

Story `decision:does-the-upfront-cost-eat-the-savings/shorts/the-panel-upgrade` (heat-pumps), revision 2. About 0.7 minutes (96 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 4/4 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Across 21 heat pump installs, 38 percent needed a new electrical panel. Was it in your quote? [s01 ok]

## Finding

Those were cold-climate prototypes in a field test, not a national survey, so that share is not the odds for your house. [s02 ok] Where electrical upgrades were needed, they alone ran $3,750 to $8,970 in labour and materials, before the heat pump itself. [s03 ok] For a 200-amp panel on its own, a retrofit cost report cites an outside estimate of $1,954, plus wiring for each new circuit. [s04 ok]

## Close

What the whole install really costs is the question the full inquiry takes on.

## Open issues

- **info** s01 (s01.a) omission (review): Re-judged against revision 2's wording, and recorded so the next revision does not lose the counterweight. The corpus still holds two statements that deny the capacity problem (Technology Connections: "Except, uh, they do. Almost always.") and a study that puts panel work on a wider base (Wilson 2024: only 50 to 60 percent of homes have panels above 150 amps, upgrades $2,000 to $30,000). Neither contradicts what this Short claims: the hook now names its own denominator in the narration ("Across 21 heat pump installs"), asserts nothing about homes in general, and the unchanged s02 still tells the viewer the share is not the odds for their house. The replacement of "The quote covers the heat pump" with the question "Was it in your quote?" also clears the revision 1 warning: a question invites the viewer to check their own paperwork and asserts nothing about what a contractor's quote contains. Suggestion: No change required; keep s02 beside s01 in any later revision.
- **info** s01 (s01.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s03 (s03.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s04 (s04.a) missing-qualification (review): The figure's vintage is not spoken. The passage reads "The typical cost for a 200 amp electrical panel upgrade is $1,954 (Lane, 2019)", and revision 2 renders that as "an outside estimate of $1,954", dropping the year the earlier suggestion carried. It sits one sentence after a range read from the invoices of a field test reported in 2025, so a viewer hears both as present-day money. I kept this at info rather than a warning for three reasons: the sentence claims no currency (it says a report cites an outside estimate, not that a panel costs this today), it draws no comparison with s03's range and names exactly what it measures (a 200-amp panel on its own, plus the wiring for each new circuit), and the same passage's own database recorded two panel upgrades averaging $1,993, so the order of magnitude is not in doubt. Nothing a viewer takes from the sentence is unestablished; naming the year would only make it more precise. Suggestion: No change required. If the line is touched again, "a 2019 estimate the report cites" names the vintage in five words without lengthening the Short.
- **info** s04 (s04.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s01 (factual, verified)

> Across 21 heat pump installs, 38 percent needed a new electrical panel. Was it in your quote?

- info omission (review): Re-judged against revision 2's wording, and recorded so the next revision does not lose the counterweight. The corpus still holds two statements that deny the capacity problem (Technology Connections: "Except, uh, they do. Almost always.") and a study that puts panel work on a wider base (Wilson 2024: only 50 to 60 percent of homes have panels above 150 amps, upgrades $2,000 to $30,000). Neither contradicts what this Short claims: the hook now names its own denominator in the narration ("Across 21 heat pump installs"), asserts nothing about homes in general, and the unchanged s02 still tells the viewer the share is not the odds for their house. The replacement of "The quote covers the heat pump" with the question "Was it in your quote?" also clears the revision 1 warning: a question invites the viewer to check their own paperwork and asserts nothing about what a contractor's quote contains.
- **s01.a** [verified] Across 21 sites installing cold-climate heat pump prototypes, 38% needed a new panel.
  - supported (approved): 1 supporting (1 independent, strongest 0.55).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1953-L1976`
    > Table 11 below shows the different types of upgrades that were required by sites to install CCHP prototypes. The team gathered this data using invoices provided by the different HVAC contractors used at all 21 sites, as well as our observations during installation. Table 11. Summary of Upgrades Needed for Installation.…

### s02 (factual, verified)

> Those were cold-climate prototypes in a field test, not a national survey, so that share is not the odds for your house.

- **s02.a** [verified] The 38% share comes from a field test at 21 sites installing cold-climate heat pump prototypes, gathered from the invoices of the HVAC contractors used at all 21 sites, not from a national survey of homes.
  - qualified (qualify): 1 supporting (1 independent, strongest 0.55). modality: universal.
  - warning needs-qualification: "all" is stronger than the evidence (strongest support 0.55).
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1953-L1976`
    > Table 11 below shows the different types of upgrades that were required by sites to install CCHP prototypes. The team gathered this data using invoices provided by the different HVAC contractors used at all 21 sites, as well as our observations during installation. Table 11. Summary of Upgrades Needed for Installation.…

### s03 (factual, verified)

> Where electrical upgrades were needed, they alone ran $3,750 to $8,970 in labour and materials, before the heat pump itself.

- **s03.a** [verified] In that field test, the total costs for electrical upgrades varied between $3,750 and $8,970, for labor and materials only, not including the heat pump prototype.
  - supported (approved): 1 supporting (1 independent, strongest 0.55).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: PNNL 2025, DOE Cold Climate Heat Pump Challenge field results right 0.55, direct `heat-pumps/sources/pnnl-2025-cold-climate-heat-pump-challenge.txt#L1953-L1976`
    > Table 11 below shows the different types of upgrades that were required by sites to install CCHP prototypes. The team gathered this data using invoices provided by the different HVAC contractors used at all 21 sites, as well as our observations during installation. Table 11. Summary of Upgrades Needed for Installation.…

### s04 (factual, verified)

> For a 200-amp panel on its own, a retrofit cost report cites an outside estimate of $1,954, plus wiring for each new circuit.

- info missing-qualification (review): The figure's vintage is not spoken. The passage reads "The typical cost for a 200 amp electrical panel upgrade is $1,954 (Lane, 2019)", and revision 2 renders that as "an outside estimate of $1,954", dropping the year the earlier suggestion carried. It sits one sentence after a range read from the invoices of a field test reported in 2025, so a viewer hears both as present-day money. I kept this at info rather than a warning for three reasons: the sentence claims no currency (it says a report cites an outside estimate, not that a panel costs this today), it draws no comparison with s03's range and names exactly what it measures (a 200-amp panel on its own, plus the wiring for each new circuit), and the same passage's own database recorded two panel upgrades averaging $1,993, so the order of magnitude is not in doubt. Nothing a viewer takes from the sentence is unestablished; naming the year would only make it more precise.
- **s04.a** [verified] A retrofit cost report cites an outside estimate for the typical cost of a 200 amp electrical panel upgrade, $1,954 (Lane, 2019), in addition to the electrical costs for each dedicated circuit run to new electrical appliances.
  - supported (approved): 1 supporting (1 independent, strongest 0.5).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: Less 2021 (LBNL), cost of decarbonization retrofits right 0.5, direct `heat-pumps/sources/lbnl-2021-cost-of-decarbonization-retrofits.txt#L3676-L3681`
    > Electrification projects are often saddled with the burden of electrical panel upgrades in situations where the amperage is insufficient to support substantial new loads. The typical cost for a 200 amp electrical panel upgrade is $1,954 (Lane, 2019). Only two panel upgrades were explicitly recorded in the DER database,…
