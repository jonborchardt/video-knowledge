# Has a leap second ever been taken away?

Story `decision:most-discussed-claims` (test-fixture), revision 1. About 0.3 minutes (35 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 1/1 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Has a leap second ever been taken away?

## Answer

The IERS table of atomic time against civil time only ever climbs: 10 seconds in 1972, 37 since 2017, 27 single-second steps up and not one back. [s02 ok]

## Open issues

- **info** s02 (s02.a) missing-qualification (review): The cited rows (L17-L44) end at the 1 January 2017 value of 37 seconds, so on their own they establish that 37 is the table's last value, not that it has held "since 2017". That reading comes from the rest of the same file: the header says the last line means no leap second was introduced since its date, the file is updated through Bulletin 72 of July 2026 and was retrieved on 2026-10-31. The sentence is true and the document establishes it, but not from the lines the cite names. Suggestion: Widen the cite to test-fixture/sources/iers-leap-second-dat.txt#L1-L44 so the "since 2017" reading is reproducible from the passage, or say "37 at its last step, in 2017".

## Evidence by sentence

### s02 (factual, verified)

> The IERS table of atomic time against civil time only ever climbs: 10 seconds in 1972, 37 since 2017, 27 single-second steps up and not one back.

- info missing-qualification (review): The cited rows (L17-L44) end at the 1 January 2017 value of 37 seconds, so on their own they establish that 37 is the table's last value, not that it has held "since 2017". That reading comes from the rest of the same file: the header says the last line means no leap second was introduced since its date, the file is updated through Bulletin 72 of July 2026 and was retrieved on 2026-10-31. The sentence is true and the document establishes it, but not from the lines the cite names.
- **s02.a** [verified] Every leap second since UTC began in 1972 has been added to civil time; none has ever been taken away: the IERS table of TAI-UTC runs from 10 seconds on 1 January 1972 to 37 seconds on 1 January 2017, each value one second larger than the last, 27 steps in all.
  - supported (approved): 1 supporting (1 independent, strongest 0.85). modality: universal.
  - supports: iers-leap-second-dat.txt right 0.85, direct `test-fixture/sources/iers-leap-second-dat.txt#L17-L44`
    > 41317.0 1 1 1972 10 41499.0 1 7 1972 11 41683.0 1 1 1973 12 42048.0 1 1 1974 13 42413.0 1 1 1975 14 42778.0 1 1 1976 15 43144.0 1 1 1977 16 43509.0 1 1 1978 17 43874.0 1 1 1979 18 44239.0 1 1 1980 19 44786.0 1 7 1981 20 45151.0 1 7 1982 21 45516.0 1 7 1983 22 46247.0 1 7 1985 23 47161.0 1 1 1988 24 47892.0 1 1 1990 25 …
