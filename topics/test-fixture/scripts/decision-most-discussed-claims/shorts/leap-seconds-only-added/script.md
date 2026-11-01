# Every leap second on record has only ever been added, never undone.

Story `decision:most-discussed-claims/shorts/leap-seconds-only-added` (test-fixture), revision 1. About 0.2 minutes (24 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 3/3 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

Leap seconds are only ever added. [s01 ok]

## Finding

The IERS table lists 28 values. [s02 ok] Each added a second; none was ever removed. [s03 ok]

## Close

See the full video.

## Open issues

- **info** s02 (s02.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.
- **info** s03 (s03.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s01 (factual, verified)

> Leap seconds are only ever added.

- **s01.a** [verified] Every leap second since UTC began in 1972 has been added to civil time; none has ever been taken away
  - supported (approved): 1 supporting (1 independent, strongest 0.85). modality: universal.
  - supports: iers-leap-second-dat.txt right 0.85, direct `test-fixture/sources/iers-leap-second-dat.txt#L17-L44`
    > 41317.0 1 1 1972 10 41499.0 1 7 1972 11 41683.0 1 1 1973 12 42048.0 1 1 1974 13 42413.0 1 1 1975 14 42778.0 1 1 1976 15 43144.0 1 1 1977 16 43509.0 1 1 1978 17 43874.0 1 1 1979 18 44239.0 1 1 1980 19 44786.0 1 7 1981 20 45151.0 1 7 1982 21 45516.0 1 7 1983 22 46247.0 1 7 1985 23 47161.0 1 1 1988 24 47892.0 1 1 1990 25 …

### s02 (factual, verified)

> The IERS table lists 28 values.

- **s02.a** [verified] The IERS table of TAI-UTC lists 28 values from 10 s on 1 January 1972 to 37 s on 1 January 2017, each exactly one second larger than the one before.
  - supported (approved): 1 supporting (1 independent, strongest 0.85).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: iers-leap-second-dat.txt right 0.85, direct `test-fixture/sources/iers-leap-second-dat.txt#L17-L44`
    > 41317.0 1 1 1972 10 41499.0 1 7 1972 11 41683.0 1 1 1973 12 42048.0 1 1 1974 13 42413.0 1 1 1975 14 42778.0 1 1 1976 15 43144.0 1 1 1977 16 43509.0 1 1 1978 17 43874.0 1 1 1979 18 44239.0 1 1 1980 19 44786.0 1 7 1981 20 45151.0 1 7 1982 21 45516.0 1 7 1983 22 46247.0 1 7 1985 23 47161.0 1 1 1988 24 47892.0 1 1 1990 25 …

### s03 (factual, verified)

> Each added a second; none was ever removed.

- **s03.a** [verified] Every one of the 27 steps in the IERS table added a second to civil time; none subtracted one.
  - supported (approved): 1 supporting (1 independent, strongest 0.85). modality: universal.
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: iers-leap-second-dat.txt right 0.85, direct `test-fixture/sources/iers-leap-second-dat.txt#L17-L44`
    > 41317.0 1 1 1972 10 41499.0 1 7 1972 11 41683.0 1 1 1973 12 42048.0 1 1 1974 13 42413.0 1 1 1975 14 42778.0 1 1 1976 15 43144.0 1 1 1977 16 43509.0 1 1 1978 17 43874.0 1 1 1979 18 44239.0 1 1 1980 19 44786.0 1 7 1981 20 45151.0 1 7 1982 21 45516.0 1 7 1983 22 46247.0 1 7 1985 23 47161.0 1 1 1988 24 47892.0 1 1 1990 25 …
