# Storyboard: Has a leap second ever been taken away?

2 scenes, 0:20 at 150 wpm including pauses. Script efcf0861e8 (passed). Storyboard status: **ok**.

## 1. sc01 (0:00 to 0:13, 13.2s)

**Purpose.** Show the viewer the full span of the IERS record and that it only ever grows, one second at a time.

**Narration** (s01). The IERS table of TAI-UTC runs from 10 seconds in 1972 to 37 seconds in 2017, each value exactly one second more than the one before it.

**Visual** (data-chart). Dark field; the IERS table of TAI-UTC values scrolls upward past the frame from 1972 to 2017, then settles into two large stat tiles side by side: 10 s / 1972 on the left, 37 s / 2017 on the right, with the intervening rows fading to a thin connecting line to show the steady climb.

**On screen.** "10 seconds, 1972" / "37 seconds, 2017"

**Chart** (stat-tiles: TAI-UTC, start to most recent value).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| 1972 | 10 | 10 | count | iers-leap-second-dat.txt, lines 17-L44 |
| 2017 | 37 | 37 | count | iers-leap-second-dat.txt, lines 17-L44 |

Note: The table lists every value between these; each one is exactly one second more than the value before it. These tiles mark the endpoints, not the full run.

**On-screen citations.** IERS, Leap_Second.dat (Bulletin C 72) (iers-leap-second-dat.txt, lines 17-L44)

**Direction.** Table of TAI-UTC values scrolls upward from 1972 to 2017, settling on the two highlighted stat tiles; hold half a second on the settled tiles before the cut.

## 2. sc02 (0:13 to 0:20, 7.2s)

**Purpose.** State the answer plainly: no leap second has ever been subtracted, only added.

**Narration** (s02). No leap second has ever been subtracted from civil time; every one on record has only been added.

**Visual** (typography). Hard cut to a dark field; a single title line types on in large serif: 'Only ever added. Never subtracted.' Hold on the settled line.

**On screen.** "Only ever added. Never subtracted."

**On-screen citations.** IERS, Leap_Second.dat (Bulletin C 72) (iers-leap-second-dat.txt, lines 17-L44)

**Direction.** Hard cut in; title types on; hold 1 s after the last word before the close card.
