# Every leap second on record has been added, never subtracted [meta.headline fp=f21a8df4e3]

Story `decision:most-discussed-claims` (test-fixture), revision 2. SEO title: Has a leap second ever been taken away? [meta.seoTitle fp=7aa4427c85]. Validation: **passed**, 0 blocking, 4 warnings, 4/4 assertions verified.

> Has a leap second ever been taken away? The IERS record says every one so far has been an addition, not a subtraction. [meta.dek ok fp=ea183aae35]

Description: Every leap second since 1972 has added a second to civil time, and the IERS record shows none has ever been subtracted. [meta.description ok fp=c170e422d3]

## Every entry in the record is a step up [heading:answer fp=06d2f1ced2]

The IERS table records the gap between atomic and civil time; across every entry in it, that gap has only ever widened. [s01 ok fp=14d82e3109] Every step in that record has added a second; none has ever taken one away. [s02 ok fp=ed7f28287a]

Figure decision-most-discussed-claims/sc01: The IERS table's first and most recent values; every value between them is exactly one second more than the one before it. [decision-most-discussed-claims/sc01 fp=5059098b9c]

## Open issues

- **warning** - structure (deterministic): no "hook" section
- **warning** - structure (deterministic): no "setup" section
- **warning** - structure (deterministic): no "investigation" section
- **warning** - structure (deterministic): no "takeaway" section
