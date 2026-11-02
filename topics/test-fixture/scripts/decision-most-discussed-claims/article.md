# Every leap second on record has been an addition [meta.headline fp=8e9b01bd57]

Story `decision:most-discussed-claims` (test-fixture), revision 1. SEO title: Has a leap second ever been taken away? [meta.seoTitle fp=7aa4427c85]. Validation: **passed**, 0 blocking, 4 warnings, 4/4 assertions verified.

> Has a leap second ever been taken away? The IERS record says no: every one since 1972 has added a second to civil time. [meta.dek ok fp=ed5a3b3ab0]

Description: No leap second has ever been subtracted: the IERS table records 27 straight additions from 1972 to 2017. [meta.description ok fp=15c2c518b5]

## Every step in the record adds a second [heading:answer fp=5851c5c369]

The IERS table of TAI minus UTC, the record of every leap second since civil time began using them in 1972, climbs from 10 seconds to 37 seconds in 2017 without ever stepping back. [s01 ok fp=3147afb1d6] Across those 27 one-second steps, every single one added a second to civil time; none subtracted one, so a leap second has never been taken away. [s02 ok fp=1bfbd8cc75]

Figure decision-most-discussed-claims/sc02: The IERS table's opening value, its latest value, and the single-second steps between them. [decision-most-discussed-claims/sc02 fp=a8d8c149dc]

## Open issues

- **warning** - structure (deterministic): no "hook" section
- **warning** - structure (deterministic): no "setup" section
- **warning** - structure (deterministic): no "investigation" section
- **warning** - structure (deterministic): no "takeaway" section
