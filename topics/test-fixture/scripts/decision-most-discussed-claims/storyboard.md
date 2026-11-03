# Storyboard: Has a leap second ever been taken away?

2 scenes, 0:21 at 150 wpm including pauses. Script d2206ea3ad (passed). Storyboard status: **ok**.

## 1. sc01 (0:00 to 0:13, 13s incl. 1s pause)

**Purpose.** Ground the answer in the written record itself before the narration resolves it.

**Narration** (s01). The official table of TAI-UTC runs from 10 seconds in 1972 to 37 seconds in 2017, climbing by exactly one second at every entry.

**Visual** (data-chart). Two tiles side by side, joined by a single rising line. The left tile reads 1972 / 10 s; the right tile reads 2017 / 37 s. The line draws from left to right as the narration crosses from '10 seconds' to '37 seconds', climbing in even steps and never dipping; the right tile brightens to the accent once the line reaches it.

**Chart** (stat-tiles: TAI minus UTC).

| Label | Display | Value | Unit | Source |
|---|---|---|---|---|
| 1972 | 10 s | 10 | count | iers-leap-second-dat.txt, lines 17-L44 |
| 2017 | 37 s | 37 | count | iers-leap-second-dat.txt, lines 17-L44 |

Note: The table's value only ever rises between these tiles; it never falls.

**On-screen citations.** IERS, Leap_Second.dat (iers-leap-second-dat.txt, lines 17-L44)

**Direction.** Cut to the two tiles; the connecting line draws left to right as the narration crosses from '10 seconds' to '37 seconds'.

## 2. sc02 (0:13 to 0:21, 7.6s)

**Purpose.** State the resolution plainly: every step the record shows went one way.

**Narration** (s02). Every leap second since civil time started using them has been added, and none has ever been taken away.

**Visual** (typography). Dark field; the line types on in large serif, centred. On the word 'taken away' the text holds and turns to the glow.

**On screen.** "Added every time. Never taken away."

**On-screen citations.** IERS, Leap_Second.dat (iers-leap-second-dat.txt, lines 17-L44)

**Direction.** Hard cut from the tiles to the statement; hold half a second after it settles.
