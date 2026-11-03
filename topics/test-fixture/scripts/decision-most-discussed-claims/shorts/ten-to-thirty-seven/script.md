# A 10-second gap in 1972 grew to 37 by 2017. The record only climbs.

Story `decision:most-discussed-claims/shorts/ten-to-thirty-seven` (test-fixture), revision 1. About 0.2 minutes (18 words at 150 wpm). Validation: **passed**, 0 blocking, 0 warnings, 1/1 assertions verified.

Markers: `[s12 ok]` every assertion verified by the deterministic checks and the reviewer; `[s12 review]` awaiting review or carrying a warning; `[s12 BLOCKED]` an open blocking issue. Sentences without a marker make no factual claim.

## Hook

A record that only climbs.

## Finding

It ran from 10 in 1972 to 37 in 2017. [s02 ok]

## Close

See the video.

## Open issues

- **info** s02 (s02.a) wording (deterministic): Wording differs from the canonical claim; the reviewer confirms the passages entail it.

## Evidence by sentence

### s02 (factual, verified)

> It ran from 10 in 1972 to 37 in 2017.

- **s02.a** [verified] The IERS table of TAI-UTC lists values from 10 s on 1 January 1972 to 37 s on 1 January 2017, each exactly one second larger than the one before.
  - supported (approved): 1 supporting (1 independent, strongest 0.85).
  - info wording: Wording differs from the canonical claim; the reviewer confirms the passages entail it.
  - supports: iers-leap-second-dat.txt right 0.85, direct `test-fixture/sources/iers-leap-second-dat.txt#L17-L44`
    > 41317.0 1 1 1972 10 41499.0 1 7 1972 11 41683.0 1 1 1973 12 42048.0 1 1 1974 13 42413.0 1 1 1975 14 42778.0 1 1 1976 15 43144.0 1 1 1977 16 43509.0 1 1 1978 17 43874.0 1 1 1979 18 44239.0 1 1 1980 19 44786.0 1 7 1981 20 45151.0 1 7 1982 21 45516.0 1 7 1983 22 46247.0 1 7 1985 23 47161.0 1 1 1988 24 47892.0 1 1 1990 25 …
